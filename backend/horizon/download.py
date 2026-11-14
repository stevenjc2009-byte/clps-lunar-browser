"""Resumable, checksum-verified download of the LOLA polar DEMs.

Usage (from backend/):  py -3 -m horizon.download [--dest D:\\clps-lola-data] [names...]

- HTTP Range resume: a partial file is continued from its current size.
- Size check against the server directory listing, then MD5 against the PDS
  volume checksum manifest (values in products.py). A file that fails is renamed
  to <name>.bad and the script exits non-zero.
- A verified file gets a <name>.md5ok marker so re-runs skip the slow MD5 pass.
"""
import argparse
import hashlib
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from .products import PRODUCTS, USED

DEFAULT_DEST = Path(os.environ.get("CLPS_LOLA_DATA", r"D:\clps-lola-data"))
CHUNK = 4 * 1024 * 1024
UA = "clps-lunar-browser-horizon/1.0"


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            h.update(block)
    return h.hexdigest().upper()


def fetch(url, path, size, retries=8):
    """Download url to path, resuming with Range until the file has `size` bytes."""
    for attempt in range(retries):
        have = path.stat().st_size if path.exists() else 0
        if have == size:
            return
        if have > size:
            raise RuntimeError(f"{path} is larger than expected ({have} > {size})")
        req = urllib.request.Request(url, headers={"User-Agent": UA,
                                                   "Range": f"bytes={have}-"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                if have and r.status != 206:
                    raise RuntimeError(f"server ignored Range for {url} (HTTP {r.status})")
                t0, got = time.time(), 0
                with open(path, "ab") as f:
                    for block in iter(lambda: r.read(CHUNK), b""):
                        f.write(block)
                        got += len(block)
                rate = got / max(time.time() - t0, 1e-6) / 1e6
                print(f"  {path.name}: +{got / 1e6:.0f} MB at {rate:.1f} MB/s", flush=True)
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            print(f"  {path.name}: attempt {attempt + 1} interrupted ({e}); resuming", flush=True)
            time.sleep(min(30, 2 ** attempt))
    have = path.stat().st_size if path.exists() else 0
    if have != size:
        raise RuntimeError(f"{path.name}: gave up at {have} of {size} bytes")


def ensure(name, dest):
    p = PRODUCTS[name]
    dest.mkdir(parents=True, exist_ok=True)
    ok = True
    for url, size, md5 in ((p.lbl_url, None, p.lbl_md5), (p.img_url, p.img_bytes, p.img_md5)):
        path = dest / url.rsplit("/", 1)[1]
        marker = path.with_suffix(path.suffix + ".md5ok")
        if marker.exists() and path.exists() and (size is None or path.stat().st_size == size):
            print(f"{path.name}: already verified")
            continue
        if size is None:                       # small label: fetch whole file fresh
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                path.write_bytes(r.read())
        else:
            print(f"{path.name}: {size / 1e9:.2f} GB from {url}", flush=True)
            fetch(url, path, size)
        got = md5_of(path)
        if got != md5:
            bad = path.with_suffix(path.suffix + ".bad")
            path.replace(bad)
            print(f"{path.name}: MD5 MISMATCH {got} != {md5}; moved to {bad.name}")
            ok = False
        else:
            marker.write_text(got + "\n")
            print(f"{path.name}: MD5 ok {got}")
    return ok


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("names", nargs="*", default=USED,
                    help=f"default: the grids the horizons use; all: {' '.join(PRODUCTS)}")
    ap.add_argument("--dest", type=Path, default=DEFAULT_DEST)
    a = ap.parse_args(argv)
    results = [ensure(n, a.dest) for n in a.names]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
