import { describe, expect, it } from 'vitest';
import { createFrameContext, ENV_CONSTANT, pulseAt } from '../src/core/context.ts';

const timing = { fps: 24, duration: 40, width: 270, height: 480 };

describe('createFrameContext', () => {
  it('derives t = n / fps', () => {
    expect(createFrameContext(0, timing).t).toBe(0);
    expect(createFrameContext(24, timing).t).toBe(1);
    expect(createFrameContext(300, timing).t).toBe(12.5);
  });

  it('copies timing and size', () => {
    const ctx = createFrameContext(5, timing);
    expect(ctx).toMatchObject({ n: 5, fps: 24, duration: 40, width: 270, height: 480 });
  });

  it('uses the time-based pulse and constant env', () => {
    const ctx = createFrameContext(120, timing);
    expect(ctx.pulse).toBe(0.5 + 0.5 * Math.sin(5 * 2));
    expect(ctx.pulse).toBe(pulseAt(ctx.t));
    expect(ctx.env).toBe(0.5);
    expect(ENV_CONSTANT).toBe(0.5);
  });

  it('keeps pulse in [0, 1]', () => {
    for (let n = 0; n < 960; n++) {
      const { pulse } = createFrameContext(n, timing);
      expect(pulse).toBeGreaterThanOrEqual(0);
      expect(pulse).toBeLessThanOrEqual(1);
    }
  });

  it('is a pure function of n and timing', () => {
    expect(createFrameContext(77, timing)).toEqual(createFrameContext(77, timing));
  });

  it('rejects invalid frame indices and fps', () => {
    expect(() => createFrameContext(-1, timing)).toThrow(RangeError);
    expect(() => createFrameContext(1.5, timing)).toThrow(RangeError);
    expect(() => createFrameContext(0, { ...timing, fps: 0 })).toThrow(RangeError);
  });
});
