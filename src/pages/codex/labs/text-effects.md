---
layout: ../../../layouts/index.astro
title: Text Effects Reference
phase: codex
tags:
  - codex/labs
  - reference/text-fx
date: 0058-04-24T12:00:00
authors_note: A calm reference for Solarisael's supported inline text effects and their four control channels.
---

# Text Effects Reference

Text effects are inline markers around a short fragment: `{{fx:effect}}text{{/fx}}`. A numeric value after the effect sets **visual intensity**; a second numeric value sets **motion range**; a third sets **speed/tempo**. Color-capable effects also accept a named or hex color in the color position, for example `{{fx:glow:#7fd0ff}}`. Keep values restrained: intensity and motion range use the supported `0.2`–`5` scale, while speed is an independent tempo control.

The four adjustable channels are **color** (accent or halo hue where supported), **visual intensity** (how strongly the treatment appears), **motion range** (how far it travels or varies), and **speed/tempo** (how quickly it cycles). A marker such as `{{fx:flicker:0.9:0.7:1.2}}` therefore changes all three numeric channels without making motion imply speed.

## Supported effects

### Glow

Supports: color, visual intensity.

{{fx:glow:0.9}}A small, steady glimmer.{{/fx}}

### Neon

Supports: color, visual intensity.

{{fx:neon:gold}}A warm sign in the rain.{{/fx}}

### Shadow

Supports: color, visual intensity.

{{fx:shadow:0.85}}A thought with a quiet edge.{{/fx}}

### Rift

Rift supports color and visual intensity.

{{fx:rift:0.85}}A seam opens beneath the words.{{/fx}}

### Chroma

Supports: visual intensity; fixed aberration palette.

{{fx:chroma:0.8}}A prism at the edge of sight.{{/fx}}

### Blur

Supports: visual intensity.

{{fx:blur:0.75}}Distance softens the sentence.{{/fx}}

### Flicker

Supports: visual intensity, motion range, speed/tempo.

{{fx:flicker:0.8:0.65:0.9}}A signal finds its rhythm.{{/fx}}

### Rainbow

Supports: visual intensity; fixed color cycle.

{{fx:rainbow:0.7}}A patient arc after rain.{{/fx}}

### Gradient

Supports: color, visual intensity.

{{fx:gradient:0.8}}Light passes through the phrase.{{/fx}}

### Aura

Supports: color, visual intensity.

{{fx:aura:0.85}}A soft field gathers around it.{{/fx}}

### Etch

Supports: visual intensity.

{{fx:etch:0.8}}The vow remains legible.{{/fx}}

### Whisper

Supports: color, visual intensity.

{{fx:whisper:0.75}}The smallest voice still arrives.{{/fx}}

### Sigil Pulse

Supports: color, visual intensity, motion range, speed/tempo.

{{fx:sigil_pulse:0.8:0.7:0.85}}A mark answers once.{{/fx}}

### Veil

Supports: color, visual intensity.

{{fx:veil:0.75}}A memory crosses the glass.{{/fx}}

### Cadence

Supports: visual intensity.

Cadence is measured and even; `cadence_soft` is gentler, `cadence_oracular` is weightier, and `cadence_childlike` is brighter and more playful, all in the same sentence.

{{fx:cadence:0.8}}The sentence walks at a human pace.{{/fx}}

### Cadence Soft

Supports: visual intensity.

{{fx:cadence_soft:0.75}}The sentence settles like dusk.{{/fx}}

### Cadence Oracular

Supports: visual intensity.

{{fx:cadence_oracular:0.8}}The sentence keeps a solemn measure.{{/fx}}

### Cadence Childlike

Supports: visual intensity.

{{fx:cadence_childlike:0.8}}The sentence skips toward wonder.{{/fx}}

### Wiggle

Supports: visual intensity, motion range, speed/tempo.

{{fx:wiggle:0.7:0.55:0.8}}The rune gives a tiny wave.{{/fx}}

### Float

Supports: visual intensity, motion range, speed/tempo.

{{fx:float:0.7:0.5:0.75}}A thought drifts upward.{{/fx}}

### Shake

Supports: visual intensity, motion range, speed/tempo.

{{fx:shake:0.65:0.45:0.7}}The floor answers softly.{{/fx}}

### Glitch

Supports: visual intensity, motion range, speed/tempo; fixed aberration palette.

{{fx:glitch:0.7:0.55:0.8}}A letter briefly misremembers itself.{{/fx}}

## Control ladders

Each ladder changes one channel while holding the others steady.

### Intensity ladder

- `0.2` — {{fx:glow:0.2}}Faint signal.{{/fx}}
- `0.7` — {{fx:glow:0.7}}Clear signal.{{/fx}}
- `1.2` — {{fx:glow:1.2}}Focused signal.{{/fx}}
- `1.8` — {{fx:glow:1.8}}Radiant signal.{{/fx}}

### Motion ladder

The speed remains `0.8`; only the travel range changes.

- `0.2` — {{fx:float:0.8:0.2:0.8}}Near-still drift.{{/fx}}
- `0.7` — {{fx:float:0.8:0.7:0.8}}Measured drift.{{/fx}}
- `1.3` — {{fx:float:0.8:1.3:0.8}}Wide drift.{{/fx}}

### Speed / tempo ladder

The motion range remains `0.7`; only the tempo changes.

- `0.5` — {{fx:flicker:0.8:0.7:0.5}}Slow tempo.{{/fx}}
- `1.0` — {{fx:flicker:0.8:0.7:1}}Steady tempo.{{/fx}}
- `1.6` — {{fx:flicker:0.8:0.7:1.6}}Quick tempo.{{/fx}}

### Color ladder

- `#7fd0ff` — {{fx:glow:#7fd0ff}}Blue signal.{{/fx}}
- `gold` — {{fx:glow:gold}}Gold signal.{{/fx}}
- `crimson` — {{fx:glow:crimson}}Crimson signal.{{/fx}}
- `codex` — {{fx:glow:codex}}Codex signal.{{/fx}}

## Curated stacks

These five named stacks are rendered compositions, not additional effect references.

### Spectral

`{{fx:gradient|aura|glow:0.85}}`

{{fx:gradient|aura|glow:0.85}}Layered color gathers into a restrained halo.{{/fx}}

### Oracular

`{{fx:cadence_oracular|veil|whisper:0.8}}`

{{fx:cadence_oracular|veil|whisper:0.8}}The threshold remembers the shape of your name.{{/fx}}

### Fractured

`{{fx:chroma|glitch|shadow:0.75:0.6:0.8}}`

{{fx:chroma|glitch|shadow:0.75:0.6:0.8}}The signal returns with one readable fracture.{{/fx}}

### Tender

`{{fx:cadence_soft|aura|whisper:0.7}}`

{{fx:cadence_soft|aura|whisper:0.7}}A small mercy settles without asking permission.{{/fx}}

### Overdriven

`{{fx:neon|flicker|sigil_pulse:1.25:0.9:1.1}}`

{{fx:neon|flicker|sigil_pulse:1.25:0.9:1.1}}The final signal crosses its deliberate upper edge.{{/fx}}
