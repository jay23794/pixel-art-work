# PixelForge — project rules

PixelForge renders 16-bit pixel-art scenes from JSON scene descriptions into MP4 video.

## Fixed decisions
- TypeScript, PixiJS v8, Zod, Vitest, Playwright, FFmpeg. One package (no monorepo).
- Default format: vertical. Logical canvas 270×480, output 1080×1920 (4× nearest-neighbour). 24 fps.
- All scene coordinates are logical pixels.
- Rendering is deterministic: frame n is rendered at t = n / fps. No Math.random(),
  no Date.now(), no PixiJS ticker. Randomness only via the seeded RNG in src/core/random.ts.
- Preview and export use the same rendering code.
- No music/audio for now. Keep a `ctx` object passed to every component so audio can be added later.
- Camera is minimal for now (static or whole-pixel pan). Camera code lives only in src/camera/.
- Scenes are data. No scene-specific code outside src/components/ and scenes/*.json.

## Working rules
- Make the smallest change that satisfies the task. Don't refactor unrelated code.
- Every task ends with: what changed (file list), how to run it, test results.
- Never update reference frames in tests/golden/ unless the task explicitly says so.
- If something is ambiguous, stop and ask instead of guessing.