// Deep links into two NASA-listed map tools, so a reader can look at a site in real LRO imagery.
//
// Both formats were verified in a browser on 2026-11-14 (see docs/decisions/sky.md):
// - LROC QuickMap (quickmap.lroc.im-ldi.com): `proj=27` is "Stereographic (South Pole)", defined by the
//   tool's own map config (/maps/lroc) as +proj=stere +a=1737400 +b=1737400 +lat_0=-90 +lon_0=0 +k=1,
//   in metres; `prjExtent=minX,minY,maxX,maxY` is the visible box in that projection.
//   Loading a link and reading the tool's LAT/LON read-out at the view centre gave -89.00522, 125.29495
//   for a request of -89.00506, 125.30930 (about 7 m apart, below one screen pixel at 43 m/px).
// - Moon Trek (trek.nasa.gov/moon): the hash carries x = longitude (deg east), y = latitude (deg), z = zoom,
//   p = the Moon geographic CRS. The app re-centred on the requested point (-61.16638, -88.51684 for a
//   request of -61.16732, -88.51566) and rewrote the rest of the hash.

const MOON_RADIUS_M = 1_737_400
const QUICKMAP_HOME = 'https://quickmap.lroc.im-ldi.com/'
const MOON_TREK_HOME = 'https://trek.nasa.gov/moon/'
const HALF_WIDTH_M = 5000   // QuickMap view: a 10 km wide box round the site
const TREK_ZOOM = 7

export interface SiteLink { label: string; href: string; deep: boolean }

// South-polar stereographic (sphere, same constants as QuickMap's proj 27). Undefined at the north pole.
export function southPolarXY(latDeg: number, lonDeg: number): { x: number; y: number } {
  const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360)
  const lon = (lonDeg * Math.PI) / 180
  return { x: rho * Math.sin(lon), y: rho * Math.cos(lon) }
}

const ok = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && lat < 0 && lat >= -90 && Math.abs(lon) <= 360

export function quickMapUrl(lat: number, lon: number): string {
  if (!ok(lat, lon)) return QUICKMAP_HOME
  const { x, y } = southPolarXY(lat, lon)
  const box = [x - HALF_WIDTH_M, y - HALF_WIDTH_M, x + HALF_WIDTH_M, y + HALF_WIDTH_M].map(Math.round).join('%2C')
  return `${QUICKMAP_HOME}?proj=27&prjExtent=${box}`
}

export function moonTrekUrl(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 360) return MOON_TREK_HOME
  const lon180 = ((lon + 180) % 360 + 360) % 360 - 180
  return `${MOON_TREK_HOME}#v=0.1&x=${lon180.toFixed(5)}&y=${lat.toFixed(5)}&z=${TREK_ZOOM}` +
    '&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903&d=&locale=&b=moon&e=&sfz=&w='
}

export function siteLinks(lat: number, lon: number): SiteLink[] {
  return [
    { label: 'View in LROC QuickMap', href: quickMapUrl(lat, lon), deep: ok(lat, lon) },
    { label: 'View in Moon Trek', href: moonTrekUrl(lat, lon), deep: Number.isFinite(lat) && Number.isFinite(lon) },
  ]
}

export const coordsText = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? 'W' : 'E'}`
