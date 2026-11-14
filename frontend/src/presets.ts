// Named, illustrative sets of model settings. Every preset is built only from real Params
// fields (lib/params.ts) and only from the choices the engine already offers
// (HEIGHT_CHOICES_M, MASK_OFFSET_CHOICES_DEG, DSN_EL_CHOICES_DEG). Each one starts from the
// defaults and changes only what its name says.

import { DEFAULT_PARAMS, paramsKey, type Params } from './lib/params'

export interface Preset {
  id: string
  name: string
  why: string        // one plain sentence: what it changes and what that means
  params: Params
}

const p = (over: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...over })

export const PRESETS: readonly Preset[] = [
  {
    id: 'default', name: 'Default (our best guess)',
    why: 'Antenna and panels 2 m up, no extra margin on the skyline, Sun counted from its top edge, Earth from its centre, and a Deep Space Network dish at 10° or more.',
    params: p({}),
  },
  {
    id: 'cautious', name: 'Cautious radio: whole Earth disc, DSN ≥ 15°',
    why: 'Only counts Earth once all of it is above the skyline, and only counts radio time when a Deep Space Network dish sees the Moon at least 15° up: a careful estimate of time to talk home.',
    params: p({ earthRule: 'whole_disc', dsnMinElDeg: 15 }),
  },
  {
    id: 'skyline-3', name: 'Skyline 3° higher',
    why: 'Pretends the skyline is 3° higher everywhere, a margin for things the map misses such as boulders. Near the pole the Sun never climbs more than a few degrees, so some sites then get no Sun at all: this shows how much the answer depends on the exact skyline.',
    params: p({ maskOffsetDeg: 3 }),
  },
  {
    id: 'tall-mast', name: 'Tall mast: 5 m',
    why: 'Puts the antenna and panels 5 m up instead of 2 m, so they see slightly further over nearby hills.',
    params: p({ observerHeightM: 5 }),
  },
  {
    id: 'ground', name: 'On the ground: 0 m',
    why: 'Puts the antenna and panels right at ground level, the lowest choice: a little more skyline is in the way.',
    params: p({ observerHeightM: 0 }),
  },
  {
    id: 'strict-radio', name: 'Strict radio: DSN ≥ 15°',
    why: 'Only counts radio time when a Deep Space Network dish on Earth sees the Moon at least 15° above its horizon, instead of 10°.',
    params: p({ dsnMinElDeg: 15 }),
  },
  {
    id: 'earth-only', name: 'Earth in view only (no dish check)',
    why: 'Counts every hour Earth is above the skyline as radio time, as if a dish on Earth were always free and in view: an upper limit.',
    params: p({ dsnOn: false }),
  },
  {
    id: 'sun-centre', name: 'Sun from its centre',
    why: 'Counts sunlight only once the middle of the Sun is above the skyline, not its top edge: a stricter test.',
    params: p({ sunRule: 'centre' }),
  },
]

// The preset whose settings exactly match, or null for a custom mix.
export function presetFor(params: Params): Preset | null {
  const k = paramsKey(params)
  return PRESETS.find(pr => paramsKey(pr.params) === k) ?? null
}
