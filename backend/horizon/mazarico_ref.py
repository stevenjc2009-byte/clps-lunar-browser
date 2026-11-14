"""Independent check: LOLA team average-visibility map (Mazarico et al. 2011 method).

From backend/:   py -3 -m horizon.mazarico_ref [sites.json]
Reads AVGVISIB_85S_060M_201608.IMG (PDS LOLA extras/illumination, 51,166,728 bytes,
MD5 33B0157A3C77E65140D01340E5856EF0, 60 m/px, 5058 x 5058, int16, value = DN * 4e-5 =
fraction of time steps sunlit by any part of the disc, surface level). Prints the value
at each site and Glaser et al. point: nearest pixel, bilinear, and min/max of the 3x3
pixels around it (the spread shows how much 60 m of position matters).
The illumination period is not stated in the label (LOLA data 2009-2013).
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

from .download import DEFAULT_DEST
from .geometry import stereo_xy_from_latlon

URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/"
       "illumination/img/avgvisib_85s_060m_201608.img")
PATH = DEFAULT_DEST / "ref" / "avgvisib_85s_060m_201608.img"
MD5, BYTES, N, SCALE, DN_TO_FRAC = "33B0157A3C77E65140D01340E5856EF0", 51166728, 5058, 60.0, 4e-5
POINTS = [("Glaser Shackleton S", -89.7849, 203.97), ("Glaser C1", -89.4505, 222.84),
          ("Glaser C2", -89.3157, 245.94), ("Glaser C1 (2 m point)", -89.4398, 222.83)]


def load():
    if not PATH.exists() or PATH.stat().st_size != BYTES:
        raise FileNotFoundError(f"{PATH} missing or incomplete; download {URL}")
    if hashlib.md5(PATH.read_bytes()).hexdigest().upper() != MD5:
        raise ValueError(f"{PATH} MD5 mismatch")
    return np.fromfile(PATH, dtype="<i2").reshape(N, N)


def sample(img, lat, lon):
    x, y = stereo_xy_from_latlon(lat, lon)
    c, r = x / SCALE + N / 2 - 0.5, -y / SCALE + N / 2 - 0.5
    if not (1 <= c < N - 2 and 1 <= r < N - 2):
        return None
    ci, ri = int(np.floor(c)), int(np.floor(r))
    fc, fr = c - ci, r - ri
    q = img[ri:ri + 2, ci:ci + 2].astype(float)
    bil = (1 - fr) * ((1 - fc) * q[0, 0] + fc * q[0, 1]) + fr * ((1 - fc) * q[1, 0] + fc * q[1, 1])
    near = img[int(round(r)), int(round(c))]
    blk = img[int(round(r)) - 1:int(round(r)) + 2, int(round(c)) - 1:int(round(c)) + 2]
    pct = 100.0 * DN_TO_FRAC
    return {"nearest_pct": round(near * pct, 1), "bilinear_pct": round(bil * pct, 1),
            "min3x3_pct": round(blk.min() * pct, 1), "max3x3_pct": round(blk.max() * pct, 1)}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    img = load()
    pts = list(POINTS)
    if argv:
        pts += [(s["id"], s["lat"], s["lon"]) for s in json.loads(Path(argv[0]).read_text("utf-8"))]
    out = {}
    for name, lat, lon in pts:
        v = sample(img, lat, lon)
        out[name] = v
        print(f"{name:28s} " + ("outside map" if v is None else
              f"nearest {v['nearest_pct']:5.1f} bilinear {v['bilinear_pct']:5.1f} "
              f"3x3 {v['min3x3_pct']:5.1f}-{v['max3x3_pct']:5.1f} %"))
    return out


if __name__ == "__main__":
    main()
