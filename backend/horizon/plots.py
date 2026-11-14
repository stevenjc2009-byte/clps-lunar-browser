"""Polar plot + panorama of each site's horizon (matplotlib, Agg backend, no windows)."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from .geometry import enu_basis, unit_from_latlon  # noqa: E402

# IAU/USGS Gazetteer centres (searched 2026-11-14), used only as direction labels.
FEATURES = {
    "Shackleton": (-89.67, 129.78), "de Gerlache": (-88.48, -88.34),
    "Shoemaker": (-88.14, 45.91), "Haworth": (-87.45, -5.17), "Faustini": (-87.18, 84.31),
    "Nobile": (-85.28, 53.27), "Malapert": (-85.00, 11.40), "Mons Mouton": (-84.60, 31.00),
    "Malapert A": (-80.18, -3.79),
}


def bearing_and_distance(lat, lon, lat2, lon2):
    """Initial great-circle azimuth (deg, clockwise from north) and distance (km)."""
    e, n, u = enu_basis(lat, lon)
    p = unit_from_latlon(lat2, lon2)
    az = np.degrees(np.arctan2(p @ e, p @ n)) % 360.0
    dist = 1737.4 * np.arccos(np.clip(p @ u, -1, 1))
    return az, dist


def _features(lat, lon, max_km=250.0):
    out = []
    for name, (fl, fo) in FEATURES.items():
        az, d = bearing_and_distance(lat, lon, fl, fo)
        if 0.5 < d < max_km:
            out.append((name, az, d))
    return out


def panorama(path, sid, site, sun=None):
    az = np.arange(len(site["heights"]["0"])) * site["az_step_deg"]
    fig, ax = plt.subplots(figsize=(12, 3.6), dpi=110)
    h0 = np.array(site["heights"]["0"])
    lo = min(h0.min(), -1.0) - 0.5
    if sun is not None:
        ax.scatter(sun[1], sun[0], s=0.3, c="#e0a000", alpha=0.25, label="Sun centre, hourly, 1 yr")
    ax.fill_between(az, lo, h0, color="#7a6a58", alpha=0.85, label="terrain (0 m observer)")
    for k, c in (("2", "#1f5fa8"), ("5", "#b0306a")):
        ax.plot(az, site["heights"][k], lw=0.7, color=c, label=f"{k} m observer")
    ax.axhline(0, color="k", lw=0.5, ls=":")
    for name, faz, d in _features(site["lat"], site["lon"]):
        ax.annotate(f"{name}\n{d:.0f} km", (faz, h0.max() + 0.3), fontsize=7, ha="center")
        ax.axvline(faz, color="grey", lw=0.4, ls="--")
    ax.set_xlim(0, 360)
    ax.set_ylim(lo, max(h0.max() + 1.5, 2.0))
    ax.set_xticks(range(0, 361, 45), ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"])
    ax.set_xlabel("azimuth (clockwise from local north = toward the lunar north pole)")
    ax.set_ylabel("elevation (deg)")
    ax.set_title(f"{sid}: LOLA terrain horizon ({site['lat']}, {site['lon']}), "
                 f"ground {site['h_site_m']:.0f} m")
    ax.legend(loc="lower right", fontsize=7, markerscale=10)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def polar(path, sid, site):
    az = np.radians(np.arange(len(site["heights"]["0"])) * site["az_step_deg"])
    fig = plt.figure(figsize=(5.5, 5.5), dpi=110)
    ax = fig.add_subplot(projection="polar")
    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)                  # clockwise, as seen looking up at the sky map
    h0 = np.array(site["heights"]["0"])
    rmin = np.floor(min(h0.min(), -1.0)) - 1
    ax.set_rorigin(rmin)
    ax.set_ylim(rmin, max(h0.max() + 1, 1))
    ax.fill_between(np.append(az, az[0]), rmin, np.append(h0, h0[0]), color="#7a6a58", alpha=0.85)
    ax.plot(np.append(az, az[0]), np.append(site["heights"]["2"], site["heights"]["2"][0]),
            lw=0.7, color="#1f5fa8")
    for name, faz, d in _features(site["lat"], site["lon"]):
        ax.annotate(name, (np.radians(faz), h0.max() + 0.5), fontsize=7, ha="center")
    ax.set_title(f"{sid}: horizon elevation (deg) vs azimuth\nN = toward lunar north pole, "
                 "clockwise", fontsize=9)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)
