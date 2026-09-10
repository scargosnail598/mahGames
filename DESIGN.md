# Neon Ronin visual theme

Starfall Squadron now uses an original orbital-port / Japanese cyberpunk arcade theme.
Open `index.html` directly in a modern browser. No build step, network assets or new runtime dependencies are required.

- `js/theme.js`: palette, shared ship silhouettes and pickup icons, cached scrolling edge architecture.
- `js/entities.js`: rendering only; entity mechanics and collision radii are unchanged.
- `js/game.js`: port integration, menu fighter and capped visual screen shake.
- `css/style.css`: coordinated menus, HUD and large mouse controls.
- Reduced-motion preference stops decorative port/star scrolling and disables screen shake.

The middle 62% remains free of architectural artwork. Friendly bolts are cyan lines; hostile projectiles are coral rings. Pickups have distinct pictograms. The large boss uses an amber core and brackets during its existing vulnerable phase.

## Validation

Passed JavaScript syntax checks and `git diff --check`. Compared entity source with the base commit after removing draw methods: all remaining entity code is identical.
A Node VM smoke run exercised 120 frames, every entity renderer, six power-ups, boss phases, pulse, pointer mapping, pause/resume, results and reduced motion with a mock DOM/Canvas context.

Actual browser visual QA and performance measurements have not been completed: this environment has no installed Chromium browser. Verify the menus, normal combat and boss at 1366x768 and a narrow viewport in a real browser before merging. The mock-context check cannot validate visual layout or browser rendering.


## Night Flight atmosphere and music

The port now composites three cached parallax layers, temple roof silhouettes, docking structures, distant moon and orbital arcs, haze, slow searchlights, edge traffic and lantern lights. Its lighting blends through jade, rose and blue over a 144-second gameplay cycle. Reduced motion freezes the decorative timeline. Art is generated locally on resize; no image downloads are required.

An original 72 BPM pentatonic ambient score uses soft pad chords, a low bass, sparse plucked notes and filtered stereo reverb. Music defaults to a quiet 12% bus level under the existing master level. The independent slider in the main and pause menus allows 0–35% and saves locally when storage is available. All-sound mute also mutes the score. Pause reduces music to a quarter of the chosen level. Leaving the page suspends audio, and a user gesture resumes it.

### Follow-up verification

- `node tests/audio-lifecycle.cjs`: no autoplay, single scheduler, pause volume, mute, zero-volume scheduling, background suspension, gesture resume, no scheduling backlog and volume bounds.
- Native Canvas rendering exercised 120 simulated gameplay frames and generated three lighting-phase images; jade and lantern images were visually inspected. This covers Canvas artwork, not HTML/CSS layout.
- JavaScript syntax checks and `git diff --check` pass.
- The connected cloud browser cannot access the local preview (`ERR_BLOCKED_BY_CLIENT`). Full browser layout, listening on speakers and browser performance remain unverified.
