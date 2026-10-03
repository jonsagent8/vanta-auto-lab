# VANTA Auto Lab

A futuristic marketing site for an auto detailing studio: hand washing, interior and exterior detailing, window tint, color-change wraps and paint protection film.

A real-time 3D BMW M240i (G42) stays on screen as you scroll and gets washed, steamed, tinted, wrapped and covered in PPF. The page also has cursor-reactive effects: soap-bubble trails, a polish trail on the paint, magnetic buttons, a swirl-mark before/after slider and a self-healing scratch pad.

Static site, no build step: open it through any web server (or GitHub Pages). `three.js`, GSAP and Lenis load from CDNs.

## Structure
- `index.html`, `css/style.css`
- `js/main.js`: smooth scroll, scene choreography, HUD, booking form
- `js/car.js`: studio, materials and effects, plus a procedural fallback car
- `js/fx.js`: cursor and 2D interactive pieces
- `models/m240i.glb`: the car, preprocessed by `process-model.mjs` (Meshopt-compressed)

## Credits
- Road grime: CC0 textures from [ambientCG](https://ambientcg.com) (SurfaceImperfections003/013/014, Leaking019B), packed into `textures/grime.webp` and projected triplanar.
- 3D car: ["2022 BMW M240i Coupe"](https://sketchfab.com/3d-models/2022-bmw-m240i-coupe-822a4e2d8a0e4568beda00539f4ad341) by Nazh Design, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Recolored, re-scaled and split into parts.

Business name, address, phone, email and prices are placeholders. The booking form posts to `window.VANTA_FORM_ENDPOINT` when set (for example, a Formspree URL).
