// Signals: named, time-varying numbers defined once per scene and evaluated
// once per frame into ctx.signals. They are computed from frame inputs only
// (t, n, pulse, env; later audio), so rendering stays deterministic.

/** Inputs a signal may depend on. */
export interface SignalInputs {
  readonly n: number;
  readonly t: number;
  readonly pulse: number;
  readonly env: number;
}

export type SignalDef =
  /**
   * Piecewise constant. Before and at the first key's time: its value. Each
   * later key's value applies just after its time (t > time).
   */
  | { readonly type: 'steps'; readonly keys: readonly (readonly [number, number])[] }
  /** (base + pulse·ctx.pulse) × (envBase + env·ctx.env) [× gate signal] */
  | {
      readonly type: 'curve';
      readonly base: number;
      readonly pulse: number;
      readonly envBase: number;
      readonly env: number;
      /** Name of a signal defined earlier, multiplied in last (e.g. an on/off switch). */
      readonly gate?: string;
    }
  /**
   * Faulty tube: 1 while sin(t·speed + phase) > threshold (or pulse > pulseAbove,
   * if set), otherwise dim. Multiply it into a curve with `gate`.
   */
  | {
      readonly type: 'flicker';
      readonly speed: number;
      readonly phase: number;
      readonly threshold: number;
      readonly dim: number;
      readonly pulseAbove?: number;
    };

/** Evaluates signals in definition order (a gate can only use an earlier signal). */
export function evaluateSignals(defs: readonly (readonly [string, SignalDef])[], x: SignalInputs): Readonly<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [name, def] of defs) {
    if (def.type === 'steps') {
      let v = def.keys[0]?.[1] ?? 0;
      for (const [time, value] of def.keys) if (x.t > time) v = value;
      out[name] = v;
    } else if (def.type === 'flicker') {
      const lit = Math.sin(x.t * def.speed + def.phase) > def.threshold || (def.pulseAbove !== undefined && x.pulse > def.pulseAbove);
      out[name] = lit ? 1 : def.dim;
    } else {
      const level = (def.base + def.pulse * x.pulse) * (def.envBase + def.env * x.env);
      out[name] = def.gate === undefined ? level : level * (out[def.gate] as number);
    }
  }
  return out;
}
