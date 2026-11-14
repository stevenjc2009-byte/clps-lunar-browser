"""Minimal, polite client for the JPL Horizons API (observer tables from a lunar site).

Parameters checked against a real response (2026-11-14): CENTER='coord@301' with
COORD_TYPE='GEODETIC' and SITE_COORD='E-lon,lat,alt_km' puts the observer on the Moon;
Horizons then reports 'Center pole/equ : MEAN_ME (high precision)' and DE441 as source.
TLIST + TLIST_TYPE='JD' + TIME_TYPE='UT' gives discrete UTC instants. QUANTITIES='4' =
airless apparent azimuth (clockwise from north) and elevation of the target centre.
API docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Long TLISTs are silently truncated by the API (a 218-time list came back with 80 rows),
so callers send at most CHUNK times per request and check the row count.

Raw responses are cached in backend/data/horizons-cache/ (one file per request, keyed
by a hash of the parameters) so re-runs do not hit the server.
"""
import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
CACHE = Path(__file__).resolve().parent / "data" / "horizons-cache"
CHUNK = 50               # instants per request (see truncation note above)
MIN_GAP_S = 1.0          # >= 0.5 s between requests (be polite)
USER_AGENT = "clps-lunar-browser-validation/2 (python urllib)"
_last = [0.0]


def params_for(body: str, lat: float, lon: float, jds: list[float]) -> dict:
    return {
        "format": "json",
        "COMMAND": f"'{body}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360:.6f},{lat:.6f},0'",
        "TLIST": " ".join(f"'{jd:.7f}'" for jd in jds),
        "TLIST_TYPE": "'JD'",
        "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "APPARENT": "'AIRLESS'",
        "EXTRA_PREC": "'YES'",
        "TIME_DIGITS": "'FRACSEC'",
    }


def cache_path(tag: str, params: dict) -> Path:
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
    return CACHE / f"{tag}-{key}.txt"


def fetch(tag: str, params: dict, offline: bool = False) -> str:
    """Horizons 'result' text for params, from cache or the API (POST form body)."""
    path = cache_path(tag, params)
    if path.exists():
        return path.read_text(encoding="utf-8")
    if offline:
        raise FileNotFoundError(f"not cached: {path.name}")
    wait = MIN_GAP_S - (time.monotonic() - _last[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(API, data=urllib.parse.urlencode(params).encode(),
                                 headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as r:
        payload = json.load(r)
    _last[0] = time.monotonic()
    if "result" not in payload:
        raise RuntimeError(f"Horizons error: {payload.get('error', payload)}")
    text = payload["result"]
    if "$$SOE" not in text:
        raise RuntimeError("Horizons returned no ephemeris:\n" + text[:2000])
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return text


MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def parse_time(s: str) -> datetime:
    """'2026-Nov-16 00:00:00.000' -> aware UTC datetime."""
    s = s.strip()
    y, mon, rest = s[:4], s[5:8], s[9:]
    d, hms = rest.split(" ")
    hh, mm, ss = hms.split(":")
    sec = float(ss)
    whole = int(sec)
    return datetime(int(y), MONTHS.index(mon) + 1, int(d), int(hh), int(mm), whole,
                    int(round((sec - whole) * 1e6)), tzinfo=timezone.utc)


def parse_table(text: str) -> tuple[list[datetime], list[float], list[float]]:
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    times, az, el = [], [], []
    for row in rows:
        cols = [c.strip() for c in row.split(",")]
        times.append(parse_time(cols[0]))
        az.append(float(cols[3]))
        el.append(float(cols[4]))
    return times, az, el


def header_value(text: str, key: str) -> str:
    for line in text.splitlines():
        if line.startswith(key):
            return " ".join(line.split(":", 1)[1].split())
    return "not found"
