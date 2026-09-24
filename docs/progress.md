# Progress: current true state

- Updated: 2026-09-23 by Kintsu
- Release source: current `main` tree
- Public site: `https://solarisael.github.io/`
- Build: pass, 75 pages
- Tests: pass, 274 tests across 29 files

## Route cleanup and Rift

The node disposal registry is shared by both module copies.
The mantle glow uses the installed registry during HTMX swaps and history navigation.
Route failure handling listens for the HTMX abort and history error events.
The build guard reloads the page when the head and incoming shell have different build IDs.
The site pins Folly commit `5488d3b` for the Rift marker.
Local Chrome showed the Rift effect with WebGL2, and each route probe disposed once.

## Ornament color correction

Ornament images no longer use the content image grayscale filter.
The five Cinza border assets use the same `#c8a96b` gold as the cardinal ornaments.
Native Chrome verified gold ornaments and glows in dark mode and black ornaments and glows in light mode.
The changed stylesheet passes Prettier.
The correction is part of this release.

## Menu spacing and scrolling

The menu tablet keeps its original width and uses more vertical space.
Settings labels sit above their controls.
The existing native scroll container keeps long views inside the tablet.
The thin scrollbar uses a transparent track.
Native Chrome verifies internal scrolling and focus visibility at desktop, 390-pixel, and 320-pixel widths.
The wheel input tool times out, so direct wheel input remains unverified.
The browser shows the static tablet during this check; this check does not verify GPU effects.
The change is part of this release.

## Current release

The canonical effects page is `/codex/labs/effect-windows/`.
Terminal is the active VGPU specimen.
The other twelve windows remain legacy placeholders.

The main menu uses VGPU for glass, ink, and lettering.
Each root inscription owns a depth region with depth `192` and padding `48`.
Runtime failures preserve their original errors in logs and data attributes.

`LESSON_MAP.md` routes required coding, project, and design lessons.
Query every matching block before implementation or worker dispatch.

## Native CSS cutover

The local source has 26 CSS files.
All 26 files now use native CSS only.
The cutover removes Tailwind, its Vite plugin, its typography plugin, and its Prettier plugin.
`base.css` now owns the explicit reset and the `.sr-only` accessibility helper.
The cutover keeps the current selectors and rendered geometry.
The selector audit remains separate from this cut.

The local build produces 75 pages.
All 273 tests pass.
The format check and all CSS audits pass.
Chrome verified six representative route families and both responsive seams.
The cutover is part of this release.

## Effects menu

Site configuration opens a nested Effects view.
An overall preset sets both categories.
Shell decoration has ornament opacity and glow sliders.
Scripts of Folly has a visual intensity slider.
Each category also has its own preset.
Custom labels follow the actual numeric values.

The `site_effects` cookie replaces the old shell and effect preset cookies.
Existing preferences migrate once.
Reset effects preserves display and reading settings.
Back and Escape return through the parent view and restore focus.
Neither category changes animation timing.

Chrome verified presets, custom values, reload, keyboard input, and reset boundaries.
The menu fits widths of 1440, 390, and 320 CSS pixels.
Both menu palettes keep the percentage values readable.

All 34 focused menu and navigation tests pass.
Five deliberate in-memory mutations each fail their regression.
The mutation probe does not change the live source.
The menu is part of this release.

## Glow, depth, and spacing fixes

Light mode renders the ornaments and their glow in black.
Dark mode keeps the gold ornaments and glow.
The Settings and Effects views use a centered column with a maximum width of `28rem`.
Each header, control row, slider row, and reset button owns a local depth region.
The shared values are depth `96`, padding `48`, and inner region `0.5`.
All 24 rendered depth regions declare padding `48`.
The views have no whole-panel depth region.
The hearth preserves spaces at inline emphasis boundaries.

Native Chrome verified the glow and hearth spacing at widths of 1440 and 390 CSS pixels.
Native Chrome verified the menu views at widths of 1440, 390, and 320 CSS pixels.
Native Chrome verified matching ornament and glow colors in both palettes at 1440 CSS pixels.
The reported Folly text overlap still needs an affected passage.
The text effects reference and Pretext shapes preserve word spaces in the observed desktop session.
These changes are part of this release.

## Previous live proof

Native Chrome reported the public Terminal renderer as `vgpu` and state `ready`.
Native Chrome reported the public menu glass and lettering as `webgpu`.
The public menu ink renderer reported `vgpu`.
The menu contained five local inscription basins.
No public VGPU owner reported an error.

GitHub validation and Pages deployment passed for the earlier `c9881d2` release.
See `history/2026-09-18.md` for that incident, rollback, repair, and proof.

## Open decisions

Sol chose to publish the current Terminal artwork with this release.
Perimeter tracers remain a future art candidate.
The final long-term host can still change.
GitHub Pages is the active public host now.

## Known stale surfaces

Root `progress.md` is the 2026-05-23 snapshot.
This file supersedes it.
Use current source and browser proof when older documents disagree.
