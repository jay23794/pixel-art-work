# Moods → concrete choices

Pick the mood words from the brief; when two moods combine ("lonely and peaceful"), take the
calmer value of each setting. Light count = light sources besides the moon.

| mood | accent | lights | density (stars / rain / fog) | motion budget | empty space | composition |
|---|---|---|---|---|---|---|
| **lonely** | warm (one lamp) or silver | **1**, small, off-centre | stars 0.4–0.7; fog thin | 0.1–0.6% | ≥ 50% of the frame quiet (sky, water) | the light on a third, small against a big dark area; no second focal point |
| **cozy** | warm | 3–8 windows/lamps, clustered | stars 0.6–1; no rain or light rain 0.4 | 0.2–1% | 30% | lights close together, warm pools on the ground, a frame/near shelter |
| **eerie** | silver (or neon, dim) | 0–1, cold | stars 0.2–0.5; fog dense, sky role | 0.1–0.5% | 60%, darkness at the edges | crescent or hidden moon (`glow: false`), fog over the focal point's base, slow sway |
| **stormy** | silver | 0–2 | stars false; rain 1, wind 0.3–0.5; clouds 2 | 2–5% (dramatic) | 20% | lightning ≤ 1 per 4 s, angled rain 1/4–1/3, breaking water |
| **magical** | warm (fireflies) or silver | many tiny: fireflies 8–14, sparkles | stars 1–3; thin moon-role mist | 0.4–1.5% | 30–40% | moonlight beams (`lightBeam`), a meteor once per loop, glow on a clearing |
| **peaceful** | silver or warm | 0–2, steady (flicker rate 0–0.03) | stars 0.6–1; drizzle 0.4–0.5 at most; low fog sway | 0.1–0.8% | 40–60% | horizontal composition, still water reflections, slow ripples (`life` 0.5, `per` 1) |

Notes
- **Motion budget is the mood's loudness.** If a calm brief measures > 2%, cut density (rain
  0.5, fewer ripple cells) before cutting what tells the story.
- **One light reads lonelier than none.** Darkness alone reads peaceful or eerie; a single warm
  point in it reads lonely.
- **Empty space is a choice:** leave the top third to sky and stars, don't fill water with
  effects; keep effects in bands (fog low, ripples near the light).
