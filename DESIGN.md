# Neon Ronin visual theme

Starfall Squadron now uses an original orbital-port / Japanese cyberpunk arcade theme.
Open `index.html` directly in a modern browser. No build step, network assets or new runtime dependencies are required.

- `js/theme.js`: palette, shared ship silhouettes and pickup icons, cached scrolling edge architecture.
- `js/entities.js`: rendering only; entity mechanics and collision radii are unchanged.
- `js/game.js`: port integration, menu fighter and capped visual screen shake.
- `css/style.css`: coordinated menus, HUD and large mouse controls.
- Reduced-motion preference stops decorative port/star scrolling and disables screen shake.

The middle 65% remains free of architectural artwork. Friendly bolts are cyan lines; hostile projectiles are coral rings. Pickups have distinct pictograms. The large boss uses an amber core and brackets during its existing vulnerable phase.

## Validation

Passed JavaScript syntax checks and `git diff --check`. Compared entity source with the base commit after removing draw methods: all remaining entity code is identical.
A Node VM smoke run exercised 120 frames, every entity renderer, six power-ups, boss phases, pulse, pointer mapping, pause/resume, results and reduced motion with a mock DOM/Canvas context.

Actual browser visual QA and performance measurements have not been completed: this environment has no installed Chromium browser. Verify the menus, normal combat and boss at 1366x768 and a narrow viewport in a real browser before merging. The mock-context check cannot validate visual layout or browser rendering.
