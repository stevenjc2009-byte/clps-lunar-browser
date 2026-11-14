// Every user-adjustable model setting, with the documented defaults
// (docs/decisions/engine.md). App state holds one Params object so the future
// controls panel only has to change it in one place.

import type { EarthRule, SunRule } from './visibility'

export interface Params {
  observerHeightM: number   // eye/antenna height above the ground: 0, 2 or 5 m
  maskOffsetDeg: number     // extra degrees added to the skyline everywhere: 0, 3, 5 or 10
  sunRule: SunRule          // 'upper_limb' (default) or 'centre'
  earthRule: EarthRule      // 'centre' (default), 'any_part' or 'whole_disc'
  dsnOn: boolean            // link needs a Deep Space Network dish to see the Moon too
  dsnMinElDeg: number       // lowest Moon elevation a DSN dish can use: 10 deg default
}

export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze({
  observerHeightM: 2,
  maskOffsetDeg: 0,
  sunRule: 'upper_limb',
  earthRule: 'centre',
  dsnOn: true,
  dsnMinElDeg: 10,
})

export const HEIGHT_CHOICES_M = [0, 2, 5] as const
export const MASK_OFFSET_CHOICES_DEG = [0, 3, 5, 10] as const
export const DSN_EL_CHOICES_DEG = [5, 10, 15] as const

export function paramsKey(p: Params): string {
  return [p.observerHeightM, p.maskOffsetDeg, p.sunRule, p.earthRule, p.dsnOn ? 1 : 0, p.dsnMinElDeg].join('|')
}
