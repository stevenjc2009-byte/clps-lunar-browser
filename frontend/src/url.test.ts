import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from './lib/params'
import { defaultPicks, encodeUrlState, MAX_URL_SITES, parseUrlState, type ShareState } from './url'

const FULL: ShareState = {
  day: '2027-03-04', days: 30, sites: ['shackleton-rim', 'im2', 'custom'], sky: 'im2',
  params: { ...DEFAULT_PARAMS, observerHeightM: 5, maskOffsetDeg: 3, earthRule: 'whole_disc', dsnOn: false, dsnMinElDeg: 15 },
  custom: { lat: -87.5, lon: 45.25 },
}

describe('shareable URL', () => {
  it('round-trips every field', () => {
    const s = parseUrlState('#' + encodeUrlState(FULL))
    expect(s).toEqual({
      day: '2027-03-04', days: 30, sites: ['shackleton-rim', 'im2', 'custom'], sky: 'im2',
      params: { observerHeightM: 5, maskOffsetDeg: 3, earthRule: 'whole_disc', dsnOn: false, dsnMinElDeg: 15 },
      custom: { lat: -87.5, lon: 45.25 },
    })
  })

  it('round-trips the default params too (0 and false are kept)', () => {
    const p = { ...DEFAULT_PARAMS, observerHeightM: 0 }
    const s = parseUrlState(encodeUrlState({ ...FULL, params: p, custom: null }))
    expect(s.params).toEqual({ observerHeightM: 0, maskOffsetDeg: 0, earthRule: 'centre', dsnOn: true, dsnMinElDeg: 10 })
    expect(s.custom).toBeUndefined()
  })

  it('empty, missing or non-string input gives an empty state', () => {
    for (const h of ['', '#', '#&&&', '#=', '#==&=']) expect(parseUrlState(h)).toEqual({ params: {} })
    expect(parseUrlState(undefined as unknown as string)).toEqual({ params: {} })
    expect(parseUrlState(42 as unknown as string)).toEqual({ params: {} })
  })

  it('ignores unknown keys, including prototype tricks', () => {
    const s = parseUrlState('#__proto__=x&constructor=y&foo=1&sunRule=centre&d=2027-01-01')
    expect(s).toEqual({ day: '2027-01-01', params: {} })
    expect(({} as Record<string, unknown>).x).toBeUndefined()
    // The Sun rule has no control, so a link cannot set it.
    expect('sunRule' in s.params).toBe(false)
  })

  it('rejects values outside the whitelists', () => {
    const s = parseUrlState('#w=31&h=3&m=4&e=sideways&dsn=yes&del=12')
    expect(s).toEqual({ params: {} })
    expect(parseUrlState('#w=0365&h=02').params).toEqual({})  // no leading zeros
  })

  it('rejects malformed and impossible dates', () => {
    for (const d of ['2027-02-30', '2027-13-01', '27-01-01', '2027-1-1', '1999-12-31', '2101-01-01',
      '2027-01-01T00:00', 'NaN', '', '2027-01-01<script>']) {
      expect(parseUrlState(`#d=${encodeURIComponent(d)}`).day).toBeUndefined()
    }
    expect(parseUrlState('#d=2028-02-29').day).toBe('2028-02-29')   // leap day is real
  })

  it('refuses HTML, script and odd characters in site ids', () => {
    const evil = ['<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', 'javascript:alert(1)',
      '../../etc/passwd', 'IM1', 'a b', '-lead', 'x'.repeat(49), '%00', '‮im1']
    for (const id of evil) {
      const s = parseUrlState(`#g=${encodeURIComponent(id)}&s=${encodeURIComponent(id)}`)
      expect(s.sky).toBeUndefined()
      expect(s.sites).toBeUndefined()
    }
  })

  it('keeps only the well-formed site ids, without duplicates, capped', () => {
    const s = parseUrlState('#s=im1,<b>,im1,im2,,shackleton-rim')
    expect(s.sites).toEqual(['im1', 'im2', 'shackleton-rim'])
    const many = Array.from({ length: 50 }, (_, i) => `s${i}`).join(',')
    expect(parseUrlState(`#s=${many}`).sites).toHaveLength(MAX_URL_SITES)
  })

  it('custom location needs both numbers, plain decimals, in range', () => {
    expect(parseUrlState('#lat=-87.5').custom).toBeUndefined()
    expect(parseUrlState('#lon=45').custom).toBeUndefined()
    for (const [la, lo] of [['-90', '0'], ['89.999', '0'], ['-87', '361'], ['-87', '-181'], ['1e1', '0'],
      ['0x10', '0'], ['Infinity', '0'], ['NaN', '0'], ['-87', ' 45'], ['-87.123456789', '0']]) {
      expect(parseUrlState(`#lat=${encodeURIComponent(la)}&lon=${encodeURIComponent(lo)}`).custom).toBeUndefined()
    }
    expect(parseUrlState('#lat=-89.99&lon=360').custom).toEqual({ lat: -89.99, lon: 360 })
  })

  it('first value wins when a key repeats', () => {
    expect(parseUrlState('#h=5&h=0').params.observerHeightM).toBe(5)
  })

  it('an over-long hash is ignored entirely, without throwing', () => {
    expect(parseUrlState('#h=5&x=' + 'a'.repeat(5000))).toEqual({ params: {} })
  })

  it('survives broken percent-encoding and random junk', () => {
    expect(() => parseUrlState('#d=%E0%A4%A&s=%&g=%%%')).not.toThrow()
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const chars = '#&=%,.-<>"\'abcdhmsgw0123456789e'
    for (let k = 0; k < 2000; k++) {
      const junk = Array.from({ length: Math.floor(rnd() * 60) }, () => chars[Math.floor(rnd() * chars.length)]).join('')
      const s = parseUrlState(junk)
      expect(s.params).toBeTypeOf('object')
      if (s.sky) expect(s.sky).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })
})

describe('default comparison', () => {
  const seven = ['peak-near-shackleton', 'shackleton-rim', 'connecting-ridge', 'nobile-rim-2', 'de-gerlache-rim-2', 'im2', 'im1']
  it('is Shackleton rim, IM-2 and IM-1 when all are present', () => {
    expect(defaultPicks(seven)).toEqual(['shackleton-rim', 'im2', 'im1'])
  })
  it('falls back to the first three sites if one is missing', () => {
    expect(defaultPicks(seven.filter(id => id !== 'im2'))).toEqual(['peak-near-shackleton', 'shackleton-rim', 'connecting-ridge'])
    expect(defaultPicks(['a', 'b'])).toEqual(['a', 'b'])
  })
})
