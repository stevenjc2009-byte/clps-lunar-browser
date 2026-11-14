import { describe, expect, it } from 'vitest'
import { darkLine, pctLine } from './dateDelta'
import type { Run } from './windowMetrics'

const run = (hours: number, status: Run['status'] = 'exact'): Run => ({ hours, status, insideHours: hours, startedBefore: false })

describe('compare dates: B minus A', () => {
  it('percent: sign, points and the 2-point "about the same" margin', () => {
    expect(pctLine('Sun', 'sun', 60, 65.3, 2)).toMatchObject({ delta: '+5.3 points', v: 'better' })
    expect(pctLine('Sun', 'sun', 65.3, 60, 2)).toMatchObject({ delta: '−5.3 points', v: 'worse' })
    expect(pctLine('Sun', 'sun', 60, 61.9, 2).v).toBe('same')
    expect(pctLine('Sun', 'sun', 60, 62, 2).v).toBe('better')
    expect(pctLine('Sun', 'sun', 50, 50, 2)).toMatchObject({ delta: '±0.0 points', v: 'same' })
  })
  it('darkness: shorter is better, 1-day margin', () => {
    expect(darkLine(run(240), run(100))).toMatchObject({ v: 'better', a: '10.0 days', b: '4.2 days' })
    expect(darkLine(run(100), run(240)).v).toBe('worse')
    expect(darkLine(run(100), run(120)).v).toBe('same')
  })
  it('a censored night only settles the call when its lower bound already decides it', () => {
    expect(darkLine(run(100, 'at_least'), run(240)).v).toBe('unknown') // A >= 100 h could still be longer than 240 h
    expect(darkLine(run(300, 'at_least'), run(100)).v).toBe('better')  // A >= 300 h is surely longer than B
    expect(darkLine(run(240), run(100, 'at_least')).v).toBe('unknown') // B >= 100 h could exceed 240 h
    expect(darkLine(run(100), run(300, 'at_least')).v).toBe('worse')   // B >= 300 h is surely longer
    expect(darkLine(run(100), run(300, 'at_least')).b).toBe('≥ 12.5 days')
  })
})
