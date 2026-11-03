// The lab's only source of randomness: the engine's seeded generator (mulberry32).
// Re-exported, not copied, so the lab and the engine draw identical sequences.
export { createRng, deriveSeed, type Rng } from '../../src/core/random.ts';
