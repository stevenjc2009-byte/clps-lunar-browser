"""Generate THIRD_PARTY_NOTICES.md from the real lockfiles.

Run from the repository root:   py -3 .github/scripts/gen_third_party_notices.py

- npm: every package in frontend/package-lock.json (name, version, license, dev-only flag).
- Python: packages named in backend/requirements.txt plus their installed dependencies,
  read with importlib.metadata (so the packages must be installed in the Python you run).
Data-source notes are static text at the bottom (edit there, not in the output file).
"""
import json
import re
import sys
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "THIRD_PARTY_NOTICES.md"
CMD = "py -3 .github/scripts/gen_third_party_notices.py"


def npm_rows():
    lock = json.loads((ROOT / "frontend" / "package-lock.json").read_text(encoding="utf-8"))
    rows = []
    for path, p in lock["packages"].items():
        if not path:
            continue
        name = p.get("name") or path.split("node_modules/")[-1]
        lic = p.get("license") or "UNKNOWN (see package)"
        if isinstance(lic, dict):
            lic = lic.get("type", "UNKNOWN")
        rows.append((name, p.get("version", "?"), str(lic), bool(p.get("dev"))))
    return sorted(set(rows), key=lambda r: (r[0].lower(), r[1]))


def py_license(dist) -> str:
    md = dist.metadata
    expr = md.get("License-Expression")
    if expr:
        return expr
    lic = (md.get("License") or "").strip()
    if lic and len(lic) < 60 and "\n" not in lic:
        return lic
    cls = [c.split("::")[-1].strip() for c in md.get_all("Classifier") or [] if c.startswith("License ::")]
    cls = [c for c in cls if c != "OSI Approved"]
    return ", ".join(cls) or "UNKNOWN (see package)"


TEST_ONLY = {"pytest"}   # named in requirements.txt but used only by the tests


def py_closure(names):
    seen, found, todo = set(), {}, list(names)
    while todo:
        n = todo.pop()
        key = re.sub(r"[-_.]+", "-", n).lower()
        if key in seen:
            continue
        seen.add(key)
        try:
            d = metadata.distribution(n)
        except metadata.PackageNotFoundError:
            found[key] = (n, "not installed here", "UNKNOWN")
            continue
        found[key] = (d.metadata["Name"], d.version, py_license(d))
        for req in d.requires or []:
            if "extra ==" in req or "python_version <" in req:
                continue   # optional extras, and back-ports only needed on old Pythons
            m = re.match(r"\s*([A-Za-z0-9_.-]+)", req)
            if m:
                todo.append(m.group(1))
    return found


def py_rows():
    names = []
    for line in (ROOT / "backend" / "requirements.txt").read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Za-z0-9_.-]+)", line.split("#")[0])
        if m:
            names.append(m.group(1))
    everything = py_closure(names)
    runtime = py_closure([n for n in names if n.lower() not in TEST_ONLY])
    rows = [(n, v, lic, k not in runtime) for k, (n, v, lic) in everything.items()]
    return sorted(rows, key=lambda r: r[0].lower())


DATA = """## Data and services (not code)

| Source | Used for | Terms |
|---|---|---|
| NASA/JPL NAIF SPICE generic kernels (`de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf`, `pck00011.tpc`; URLs and sha256 in `backend/data/MANIFEST.json`) | Sun, Earth and Moon positions; Moon orientation; Moon radius | Published openly by NAIF; usage rules and request for acknowledgement: https://naif.jpl.nasa.gov/naif/rules.html (quoted in `backend/data/MANIFEST.json`). |
| NASA JPL Horizons System, https://ssd.jpl.nasa.gov/horizons/ | Independent check of every computed Sun and Earth position (`docs/validation/horizons.md`). Replies are cached in `backend/data/horizons-cache/`. | JPL service; see https://ssd.jpl.nasa.gov/ for its terms. We did not verify a specific licence page. |
| JPL DSN Telecommunications Link Design Handbook 810-005, Module 301 Rev K, Table 5 | Coordinates of the three 70 m Deep Space Network antennas (`backend/dsn.py`) | Public JPL document: https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301K.pdf |
| LOLA terrain (Lunar Orbiter Laser Altimeter, NASA PDS Geosciences Node) | Terrain horizons for the 7 listed sites (`frontend/public/horizons.json`; product names, sizes and MD5 checksums in `data/README.md`, method in `docs/TERRAIN.md`). | NASA mission data. The public-domain status of US Government works is not stated on any page we verified, so we do not assert it here. Check https://pds-geosciences.wustl.edu/missions/lro/lola.htm before relying on it. |
| LROC (LRO Camera, Arizona State University) | Landing-site positions (IM-1, IM-2 pages) | LROC pages: https://lroc.im-ldi.com/ . ASU-run; follow the site's own terms. |

NASA's challenge page notes that NASA does not endorse non-US-Government sites and that participants must follow each site's own data-use terms.
This project is not an official NASA product and carries no NASA logo.
"""


def table(rows, header):
    out = [header, "|---|---|---|---|"]
    for n, v, lic, dev in rows:
        out.append(f"| {n} | {v} | {lic} | {'dev/test only' if dev else 'runtime'} |")
    return "\n".join(out)


def main():
    npm, py = npm_rows(), py_rows()
    text = f"""# Third-party notices

Generated by `{CMD}` from `frontend/package-lock.json` and `backend/requirements.txt`. Do not edit the tables by hand; rerun the command.
"Runtime" for npm means the package is not marked `dev` in the lockfile (it may still be build-time only, such as Vite's bundled output). Python versions are those installed where the script ran (they can differ from the pins in `backend/requirements.txt`). Licence text is read from each package's own metadata; "UNKNOWN" means the metadata did not say, and the package itself must be checked.

This project's own code is MIT (see `LICENSE`).

## JavaScript (npm), {len(npm)} packages

{table(npm, "| Package | Version | Licence | Role |")}

## Python, {len(py)} packages

{table(py, "| Package | Version | Licence | Role |")}

{DATA}"""
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT}: {len(npm)} npm, {len(py)} python")


if __name__ == "__main__":
    sys.exit(main())
