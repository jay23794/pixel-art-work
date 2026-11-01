import { describe, expect, it } from 'vitest';
import { evaluateSignals, type SignalDef } from '../src/core/signals.ts';

const at = (defs: [string, SignalDef][], t: number) => evaluateSignals(defs, { n: Math.round(t * 24), t, pulse: 0.5 + 0.5 * Math.sin(t * 2), env: 0.5 });

describe('evaluateSignals', () => {
  const steps: [string, SignalDef][] = [['bulbsOn', { type: 'steps', keys: [[0, 0], [2, 1], [36.2, 0]] }]];

  it('steps: a key applies just after its time', () => {
    expect([0, 1, 2, 2.01, 36.2, 36.21, 40].map((t) => at(steps, t).bulbsOn)).toEqual([0, 0, 0, 1, 1, 0, 0]);
  });

  it('steps: matches the legacy (t > 2 ? 1 : 0) × (t > 36.2 ? 0 : 1) on every frame', () => {
    for (let n = 0; n <= 960; n++) {
      const t = n / 24;
      expect(at(steps, t).bulbsOn).toBe((t > 2 ? 1 : 0) * (t > 36.2 ? 0 : 1));
    }
  });

  it('curve: (base + pulse·p) × (envBase + env·e) × gate, in the legacy evaluation order', () => {
    const defs: [string, SignalDef][] = [
      ['lightsOn', { type: 'steps', keys: [[0, 1], [37.2, 0]] }],
      ['windowLight', { type: 'curve', base: 0.55, pulse: 0.45, envBase: 0.8, env: 0.2, gate: 'lightsOn' }],
    ];
    for (let n = 0; n <= 960; n++) {
      const t = n / 24;
      const p = 0.5 + 0.5 * Math.sin(t * 2);
      expect(at(defs, t).windowLight).toBe((0.55 + 0.45 * p) * (0.8 + 0.2 * 0.5) * (t > 37.2 ? 0 : 1));
    }
  });

  it('is a pure function of its inputs', () => {
    expect(at(steps, 12.5)).toEqual(at(steps, 12.5));
  });
});
