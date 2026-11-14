"""SPICE kernels used by the backend: names, NAIF URLs, download + sha256 manifest.

File names were read from the NAIF directory listings on 2026-11-14
(https://naif.jpl.nasa.gov/pub/naif/generic_kernels/{spk/planets,pck,fk/satellites}/),
not guessed. Kernels are downloaded into backend/data/ (gitignored); their sha256 and
size go into backend/data/MANIFEST.json (committed) and sky.json meta.kernels.

    py -3 kernels.py          # download anything missing, (re)write MANIFEST.json
"""
import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
MANIFEST = DATA_DIR / "MANIFEST.json"
NAIF = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
LICENCE = ("NAIF generic kernels, published openly by NASA/JPL NAIF; usage rules "
           "https://naif.jpl.nasa.gov/naif/rules.html (acknowledgement encouraged)")

# Kernel sets. "de440" is what the site ships; "de421" is the old set, kept only
# for the DE421 -> DE440 comparison (compare_de421.py).
KERNEL_SETS = {
    "de440": [
        ("de440s.bsp", "spk/planets/de440s.bsp",
         "planetary + lunar ephemeris DE440 (short span, 1849-2150)"),
        ("moon_pa_de440_200625.bpc", "pck/moon_pa_de440_200625.bpc",
         "Moon orientation (principal axes frame MOON_PA_DE440) from DE440"),
        ("moon_de440_250416.tf", "fk/satellites/moon_de440_250416.tf",
         "lunar frame kernel: MOON_ME = MOON_ME_DE440_ME421 (mean Earth/polar axis)"),
        ("pck00011.tpc", "pck/pck00011.tpc",
         "text PCK: BODY301_RADII = 1737.4 km sphere used for site positions"),
    ],
    "de421": [
        ("de421.bsp", "spk/planets/de421.bsp", "planetary + lunar ephemeris DE421"),
        ("moon_pa_de421_1900-2050.bpc", "pck/moon_pa_de421_1900-2050.bpc",
         "Moon orientation from DE421"),
        ("moon_080317.tf", "fk/satellites/moon_080317.tf", "lunar frame kernel (DE421)"),
        ("pck00008.tpc", "pck/pck00008.tpc", "text PCK (radii)"),
    ],
}


def url_of(rel: str) -> str:
    return NAIF + rel


def ensure(name: str, rel: str) -> Path:
    """Return the local path of a kernel, downloading it from NAIF if missing."""
    DATA_DIR.mkdir(exist_ok=True)
    path = DATA_DIR / name
    if not path.exists():
        print(f"downloading {url_of(rel)}", file=sys.stderr)
        tmp = path.with_suffix(path.suffix + ".part")
        with urllib.request.urlopen(url_of(rel), timeout=600) as r, tmp.open("wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
        tmp.replace(path)
    return path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def kernel_entries(set_name: str = "de440") -> list[dict]:
    """[{name, url, sha256, bytes, role}] for one kernel set (downloads if missing)."""
    out = []
    for name, rel, role in KERNEL_SETS[set_name]:
        path = ensure(name, rel)
        out.append({"name": name, "url": url_of(rel), "sha256": sha256(path),
                    "bytes": path.stat().st_size, "role": role})
    return out


def write_manifest(set_name: str = "de440") -> dict:
    manifest = {
        "manifest_version": 1,
        "kernel_set": set_name,
        "written_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "licence": LICENCE,
        "kernels": kernel_entries(set_name),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    return manifest


def verify_manifest() -> list[str]:
    """Names of local kernels whose sha256 differs from MANIFEST.json (empty = all good)."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return [k["name"] for k in manifest["kernels"]
            if sha256(ensure(k["name"], k["url"].removeprefix(NAIF))) != k["sha256"]]


if __name__ == "__main__":
    m = write_manifest()
    for k in m["kernels"]:
        print(f"{k['name']:28s} {k['bytes']:>10d}  {k['sha256']}")
    print(f"wrote {MANIFEST}")
