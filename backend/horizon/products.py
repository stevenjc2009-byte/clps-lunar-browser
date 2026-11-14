"""LOLA polar DEM products used by the horizon pipeline (PDS Geosciences Node).

Every name, size and MD5 below was read from the PDS server on 2026-11-14:
  directory listing  .../lrolol_1xxx/data/lola_gdr/polar/img/
  checksum manifest  https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx_261020.md5
  labels             <name>.lbl next to each .img (PDS3) and dsmap_polar.cat (projection equations)
Nothing here is guessed; see data/README.md for the full record.
"""
from dataclasses import dataclass

BASE_URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/"
            "lrolol_1xxx/data/lola_gdr/polar/img/")
MOON_RADIUS_M = 1737400.0          # A=B=C_AXIS_RADIUS and the height OFFSET in every label
SCALING_FACTOR = 0.5               # HEIGHT (m) = DN * 0.5, LSB 16-bit signed integer


@dataclass(frozen=True)
class Product:
    name: str          # file stem, lower case as on the server
    scale_m: float     # MAP_SCALE (exact, metres per pixel at the pole)
    n: int             # LINES == LINE_SAMPLES (square images)
    img_bytes: int     # size of the .img from the directory listing
    img_md5: str       # from the volume checksum manifest
    lbl_md5: str
    max_lat: float     # MAXIMUM_LATITUDE (edge of full coverage; corners reach further)
    dn_min: int        # DERIVED_MINIMUM
    dn_max: int        # DERIVED_MAXIMUM

    @property
    def img_url(self):
        return BASE_URL + self.name + ".img"

    @property
    def lbl_url(self):
        return BASE_URL + self.name + ".lbl"

    @property
    def half_width_m(self):
        return self.n * self.scale_m / 2.0


PRODUCTS = {
    "ldem_875s_5m": Product("ldem_875s_5m", 5.0, 30336, 1840545792,
                            "1C0391292D2579A7DC5F21DE1B1DFC6A",
                            "C83F45931FA9CC371BC91B22EDDCD877", -87.5, -8760, 4744),
    "ldem_80s_20m": Product("ldem_80s_20m", 20.0, 30400, 1848320000,
                            "F1388507C1984D5C963DE1F4323E43E8",
                            "42A136B8F5D51C3C9CB73C52FB0BC029", -80.0, -14594, 14054),
    "ldem_75s_60m": Product("ldem_75s_60m", 60.0, 15248, 465003008,
                            "8FEBFB6DF92A5F0E4AAEAA68CCAA11F4",
                            "8B205AE1B1ADAA3052295BBE5FF0C55B", -75.0, -15524, 14053),
    "ldem_60s_240m": Product("ldem_60s_240m", 240.0, 7760, 120435200,
                             "63C6F18693041352F5810D8C0397090A",
                             "0D3F03C1FB2367AC4207C999E8DE313A", -60.0, -18253, 14049),
}

# Range bands: (outer limit of the band in metres, products to try, finest first).
# The ray step inside a band equals the pixel size of the product that was sampled.
NEAR_KM, MID_KM = 10.0, 60.0
BANDS = (
    (NEAR_KM * 1000.0, ("ldem_875s_5m", "ldem_80s_20m", "ldem_75s_60m")),
    (MID_KM * 1000.0, ("ldem_75s_60m", "ldem_60s_240m")),
    (float("inf"), ("ldem_60s_240m",)),
)

# Highest terrain anywhere in the products used (largest DERIVED_MAXIMUM * 0.5 m).
H_MAX_M = max(p.dn_max for p in PRODUCTS.values()) * SCALING_FACTOR
