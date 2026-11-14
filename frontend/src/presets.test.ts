import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, DSN_EL_CHOICES_DEG, HEIGHT_CHOICES_M, MASK_OFFSET_CHOICES_DEG, paramsKey } from './lib/params'
import { PRESETS, presetFor } from './presets'

describe('presets', () => {
  it('first preset is exactly the engine defaults', () => {
    expect(PRESETS[0].params).toEqual(DEFAULT_PARAMS)
    expect(presetFor(DEFAULT_PARAMS)?.id).toBe('default')
  })
  it('only real Params fields and only choices the engine offers', () => {
    const keys = Object.keys(DEFAULT_PARAMS).sort()
    for (const pr of PRESETS) {
      expect(Object.keys(pr.params).sort()).toEqual(keys)
      expect(HEIGHT_CHOICES_M as readonly number[]).toContain(pr.params.observerHeightM)
      expect(MASK_OFFSET_CHOICES_DEG as readonly number[]).toContain(pr.params.maskOffsetDeg)
      expect(DSN_EL_CHOICES_DEG as readonly number[]).toContain(pr.params.dsnMinElDeg)
      expect(['upper_limb', 'centre']).toContain(pr.params.sunRule)
      expect(['centre', 'any_part', 'whole_disc']).toContain(pr.params.earthRule)
    }
  })
  it('every preset is distinct, has a name and a one-line explanation', () => {
    expect(new Set(PRESETS.map(pr => paramsKey(pr.params))).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map(pr => pr.id)).size).toBe(PRESETS.length)
    for (const pr of PRESETS) {
      expect(pr.name.length).toBeGreaterThan(3)
      expect(pr.why).toMatch(/^[A-Z].*\.$/)
      expect(pr.why).not.toContain('\n')
    }
  })
  it('names match what they change', () => {
    const get = (id: string) => PRESETS.find(pr => pr.id === id)!.params
    expect(get('cautious')).toEqual({ ...DEFAULT_PARAMS, maskOffsetDeg: 5, earthRule: 'whole_disc' })
    expect(get('tall-mast')).toEqual({ ...DEFAULT_PARAMS, observerHeightM: 5 })
    expect(get('strict-radio')).toEqual({ ...DEFAULT_PARAMS, dsnMinElDeg: 15 })
  })
  it('a mix that matches no preset is custom (null)', () => {
    expect(presetFor({ ...DEFAULT_PARAMS, maskOffsetDeg: 10 })).toBeNull()
  })
})
