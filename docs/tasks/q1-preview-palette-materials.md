Read CLAUDE.md and docs/art-direction.md first.

Build the foundation for higher-quality code-drawn art. Desert Lab must stay pixel-identical
(regression test unchanged).

1. Preview page:
   - npm run dev opens a preview where I pick a scene from scenes/*.json (dropdown or ?scene=).
   - Play/pause, frame scrubber, and a toggle to show the Instagram safe zones
     (top 84 / bottom 117 px at 360×640; scale for other canvases) and 20 px side margins.
   - Show the canvas at 1×, 2× or 3× with nearest-neighbour scaling.
2. Palette lock (post effect): { "type": "paletteLock", "palette": "<name>" } maps every output
   pixel to the nearest palette colour (perceptual distance, e.g. OKLab). Deterministic.
3. Materials and light:
   - Schema: `light: { direction: [x, y] }` per scene, and `materials`: named ramps of 4–5 colours
     (deepShadow, shadow, base, light, highlight) referencing palette entries.
   - A shading helper for code-drawn shapes: given a shape, its material and the light direction,
     fill it with the ramp (lit faces → light/highlight, away faces → shadow), add an outline in the
     material's deepShadow, and a 1 px highlight on edges facing the light. Hard edges only.
   - Shape assets (assets/shapes/*.json) can declare a material per shape and opt into
     auto-outline and edge highlight.
4. Unit tests: palette lock maps to palette only; shading helper output uses only ramp colours.
5. Commit: "Preview tools, palette lock, materials and shading (Q1)".

Acceptance: Desert Lab regression still 0 px. A small test scene (scenes/shading-test.json,
360×640) shows a few shaded shapes with light from the upper left; show me a screenshot at 3×.