"""Merge docs/decisions/*.md into docs/DECISIONS.md, grouped by area.

Run from the repository root:   py -3 docs/tools/merge_decisions.py
Originals are never changed. Rerun after new files land in docs/decisions/.
Headings of each source are pushed down two levels so the area is the only H2.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "decisions"
OUT = ROOT / "docs" / "DECISIONS.md"

# stem -> (area title, order). Unknown stems go last under their own name.
AREAS = {
    "audit": ("Audit and correctness (phase 0)", 1),
    "data-v2": ("Data and ephemeris", 2),
    "engine": ("Visibility engine and verdicts", 3),
    "lola": ("Terrain (LOLA horizons)", 4),
    "sites": ("Sites", 5),
    "controls": ("Controls and parameters (UI)", 6),
    "heatmap": ("Heatmap (UI)", 7),
    "sky": ("Sky chart (UI)", 8),
    "docs": ("Documentation, CI and licensing", 9),
}


def demote(text: str, by: int = 2) -> str:
    out, fence = [], False
    for line in text.splitlines():
        if line.startswith("```"):
            fence = not fence
        m = re.match(r"(#{1,6})\s", line)
        if m and not fence:
            line = "#" * min(6, len(m.group(1)) + by) + line[len(m.group(1)):]
        out.append(line)
    return "\n".join(out)


def main():
    files = sorted(SRC.glob("*.md"))
    ordered = sorted(files, key=lambda p: (AREAS.get(p.stem, ("", 99))[1], p.stem))
    parts = [
        "# Decisions\n",
        "Every open call made during the autonomous upgrade run, with options, choice and reason, grouped by area.",
        "Merged from `docs/decisions/*.md` by `py -3 docs/tools/merge_decisions.py`; the originals are kept and remain the source of truth.\n",
        "Contents: " + "; ".join(AREAS.get(p.stem, (p.stem, 99))[0] for p in ordered) + ".\n",
    ]
    for p in ordered:
        title = AREAS.get(p.stem, (p.stem, 99))[0]
        parts.append(f"\n## {title}\n\n_Source: `docs/decisions/{p.name}`_\n")
        parts.append(demote(p.read_text(encoding="utf-8")).strip() + "\n")
    OUT.write_text("\n".join(parts), encoding="utf-8", newline="\n")
    print(f"wrote {OUT} from {len(files)} files: {', '.join(p.name for p in files)}")


if __name__ == "__main__":
    main()
