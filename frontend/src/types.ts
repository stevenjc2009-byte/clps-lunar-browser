export interface SiteStats {
  sun_visible_pct: number
  earth_visible_pct: number
  longest_dark_hours: number
  sun_alt_max: number
  sun_alt_min: number
  earth_alt_max: number
  earth_alt_min: number
}

export interface Site {
  id: string
  name: string
  lat: number
  lon: number
  note: string
  source: string
  stats: SiteStats
  sun_alt: number[]
  sun_az: number[]
  earth_alt: number[]
  earth_az: number[]
}

export interface SkyData {
  meta: {
    start_utc: string
    end_utc: string
    step_hours: number
    samples: number
    ephemeris: string
    horizon: string
  }
  sites: Site[]
}
