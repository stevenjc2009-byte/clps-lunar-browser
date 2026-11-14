"""Download the NAIF kernels listed in backend/data/MANIFEST.json and verify their sha256.

Used by CI (the kernels are not in git). Already-present files are only verified, so a
cached backend/data/ makes this a fast no-download check. Exits 1 on any mismatch.
    py -3 .github/scripts/fetch_kernels.py
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "backend" / "data"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    manifest = json.loads((DATA / "MANIFEST.json").read_text(encoding="utf-8"))
    bad = 0
    for k in manifest["kernels"]:
        path = DATA / k["name"]
        if not path.exists():
            print(f"downloading {k['url']}", flush=True)
            tmp = path.with_suffix(path.suffix + ".part")
            with urllib.request.urlopen(k["url"], timeout=600) as r, tmp.open("wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            tmp.replace(path)
        ok = sha256(path) == k["sha256"] and path.stat().st_size == k["bytes"]
        print(f"{'ok  ' if ok else 'BAD '} {k['name']} {path.stat().st_size} bytes")
        bad += not ok
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
