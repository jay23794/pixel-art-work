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
- Logical canvas is set per scene (output.logicalWidth/Height). New scenes use 360×640 (3× → 1080×1920).
  scenes/desert-lab.json stays at 270×480 as a regression scene.
- Art direction rules live in docs/art-direction.md. Code-drawn art must follow them:
  one light direction per scene, 4–5 shade ramps per material, palette colours only, hard edges.
- Instagram safe zones (360×640): top 84 px and bottom 117 px hold no key detail.

## Working rules
- Make the smallest change that satisfies the task. Don't refactor unrelated code.
- Every task ends with: what changed (file list), how to run it, test results.
- Never update reference frames in tests/golden/ unless the task explicitly says so.
- If something is ambiguous, stop and ask instead of guessing.


## Current phase: landscapes and light ONLY
- Goal: detailed, beautiful pixel-art environments (sky, mountains, desert, sea, jungle, light).
- Every task ends with a still image at 3× shown to me. Visual quality is the acceptance test.
- Do NOT add engine features, schema fields or abstractions unless the visual in this task needs it.
- No objects, vehicles or characters in this phase.
- Follow docs/art-direction.md. New scenes are 360×640.