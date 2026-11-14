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
  status?: 'candidate' | 'target' | 'landing'   // sky.json v2
  uncertainty_m?: number | null                 // sky.json v2
  stats: SiteStats
  sun_alt: number[]
  sun_az: number[]
  earth_alt: number[]
  earth_az: number[]
}

export interface KernelInfo { name: string; url: string; sha256: string; bytes: number }

export interface SkyData {
  meta: {
    version?: number              // 2 for sky.json v2; absent in v1
    start_utc: string
    end_utc: string
    step_hours: number
    samples: number
    ephemeris: string
    horizon: string
    kernels?: KernelInfo[]
    generated_utc?: string
    script_commit?: string
    landing_min_utc?: string      // supported landing range shown in the UI (v2)
    landing_max_utc?: string
  }
  // v2 only: hourly, same length as samples, the same for every site.
  sun_radius_deg?: number[]
  earth_radius_deg?: number[]
  dsn_moon_el_max?: number[]
  sites: Site[]
}
