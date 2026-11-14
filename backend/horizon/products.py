"""LOLA polar DEM products used by the horizon pipeline (PDS Geosciences Node).

Every name, size and MD5 below was read from the PDS server on 2026-11-14:
  directory listing  .../lrolol_1xxx/data/lola_gdr/polar/img/
  checksum manifest  https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx_261020.md5
  labels             <name>.lbl next to each .img (PDS3) and dsmap_polar.cat (projection equations)
Nothing here is guessed; see data/README.md for the full record.
"""
from dataclasses import dataclass

BASE_URL = ("https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/"
            "lrolol_1xxx/data/lola_gdr/polar/")
MOON_RADIUS_M = 1737400.0          # A=B=C_AXIS_RADIUS and the height OFFSET in every label
SCALING_FACTOR = 0.5               # int16 grids: HEIGHT (m) = DN * 0.5, LSB 16-bit signed
# float grids (polar/float_img/, product V2.1): PC_REAL 32-bit, HEIGHT in KILOMETRES.
# Why both: the int16 grids store height in 0.5 m steps. Next to the observer that step
# is not negligible (0.5 m at 5 m range = 5.7 deg), so the near band must use floats.


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
    dtype: str = "<i2"             # "<i2" (img/) or "<f4" (float_img/)
    to_m: float = SCALING_FACTOR   # metres per DN

    @property
    def subdir(self):
        return "float_img/" if self.dtype == "<f4" else "img/"

    @property
    def img_url(self):
        return BASE_URL + self.subdir + self.name + ".img"

    @property
    def lbl_url(self):
        return BASE_URL + self.subdir + self.name + ".lbl"

    @property
    def h_max_m(self):
        return self.dn_max * self.to_m

    @property
    def half_width_m(self):
        return self.n * self.scale_m / 2.0


PRODUCTS = {
    "ldem_875s_5m_float": Product("ldem_875s_5m_float", 5.0, 30336, 3681091584,
                                  "E276D367838A53CF5C74443618B13819",
                                  "921114FED5A4158CC83E6B6B4AFC6CE4", -87.5, -4.380, 2.372,
                                  "<f4", 1000.0),
    "ldem_80s_20m_float": Product("ldem_80s_20m_float", 20.0, 30400, 3696640000,
                                  "AD5393CA08F7C243D8E37B6C4616A1D9",
                                  "5D205769A6E6F5B5CB302F3C183F2F26", -80.0, -7.297, 7.027,
                                  "<f4", 1000.0),
    "ldem_75s_60m_float": Product("ldem_75s_60m_float", 60.0, 15248, 930006016,
                                  "152FC9CBA08A4D3F7522ADD8F98EDA9C",
                                  "C271B69DAB8769B792CE4AC571DF8692", -75.0, -7.762, 7.027,
                                  "<f4", 1000.0),
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
# Near and mid bands use the float grids (no 0.5 m steps); beyond 60 km a 0.5 m step
# is < 0.0005 deg, so the int16 240 m grid is used there (no 240 m float needed).
# The int16 5/20/60 m grids stay listed: tests compare them with the floats.
NEAR_KM, MID_KM = 10.0, 60.0
BANDS = (
    (NEAR_KM * 1000.0, ("ldem_875s_5m_float", "ldem_80s_20m_float", "ldem_75s_60m_float")),
    (MID_KM * 1000.0, ("ldem_75s_60m_float", "ldem_60s_240m")),
    (float("inf"), ("ldem_60s_240m",)),
)
USED = sorted({n for _, names in BANDS for n in names})

# Highest terrain anywhere in the products used (largest DERIVED_MAXIMUM, in metres).
H_MAX_M = max(PRODUCTS[n].h_max_m for n in USED)
