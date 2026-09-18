---
layout: ../../../layouts/index.astro
title: Block and Combat Effects Lab
phase: codex
tags:
  - codex/labs
  - sandbox/block-fx
  - sandbox/combat-fx
date: 0058-04-24T11:05:00
authors_note: A restrained registry tour for block-scale panels and inline combat feed events.
---

# Block and Combat Effects Lab

Block effects decorate a layout-sized panel, not a few words inside a sentence. The marker still uses the supported `{{fx:name}}...{{/fx}}` contract, but the renderer gives the result a block surface and its own visual rhythm. Inline text effects such as `glow` or `shake` stay inside the surrounding line; they are not substitutes for these registered block effects.

A numeric value is visual intensity. Where motion and speed are useful, the second and third values are motion range and tempo: `{{fx:name:1.1:0.8:1.15}}...{{/fx}}`. Keep these values modest in a readable document. Reduced-motion settings remain authoritative at runtime.

## Block Effects

### `terminal` — terminal panel

**Example — quiet terminal output:**

{{fx:terminal:1.05}}[terminal] handshake accepted; archive channel is read-only.{{/fx}}

### `stat_screen` — statistics panel

**Example — compact status readout:**

{{fx:stat_screen:1.1}}VITALITY 82% // FOCUS 64% // GUARD READY{{/fx}}

### `game_screen` — game screen panel

**Example — paused encounter screen:**

{{fx:game_screen:1.05}}ROUND 03 · WIND WISP · PAUSED{{/fx}}

### `quest_log` — quest log panel

**Example — one active objective:**

{{fx:quest_log:1.1}}ACTIVE QUEST — Hold the eastern bridge until dawn.{{/fx}}

### `skill_popup` — skill notification panel

**Example — single skill unlock:**

{{fx:skill_popup:1.08}}SKILL READY — Lantern Parry{{/fx}}

### `inventory` — inventory panel

**Example — one item change:**

{{fx:inventory:1.05}}INVENTORY — Ashglass Tonic × 1{{/fx}}

### `combat_feed` — block-sized combat panel

**Example — block combat summary:**

{{fx:combat_feed:1.1}}COMBAT SUMMARY — Cinza holds the ward seam.{{/fx}}

### `status_effects` — status effects panel

**Example — active condition list:**

{{fx:status_effects:1.08}}STATUS — Lantern Blessing (18s){{/fx}}

### `system_warning` — system warning panel

**Example — restrained warning:**

{{fx:system_warning:1.1}}SYSTEM WARNING — Perimeter signal is unstable.{{/fx}}

### `memory_fragment` — memory fragment panel

**Example — recovered fragment:**

{{fx:memory_fragment:1.05}}MEMORY FRAGMENT — The gate opened before the bell.{{/fx}}

### `admin_trace` — administrative trace panel

**Example — audit trace:**

{{fx:admin_trace:1.05}}ADMIN TRACE — permission check passed for codex reader.{{/fx}}

### `party_roster` — party roster panel

**Example — small roster:**

{{fx:party_roster:1.05}}PARTY — Cinza · Ilyra · Wind Wisp{{/fx}}

### `map_ping` — map location panel

**Example — one waypoint ping:**

{{fx:map_ping:1.08}}MAP PING — Eastern bridge / 240 paces{{/fx}}

## Inline-Block Combat Feed

`combat_feed` is also the one registered inline-block effect. In this mode it sits in the text flow as a compact combat event rather than becoming a full-width panel. Label the event payload so the combat meaning stays readable; the marker controls presentation, while the bracketed label is content.

**Inline event — critical hit:**

{{fx:combat_feed:1.2}}[CRIT] Cinza deals 14 to Wind Wisp.{{/fx}}

**Inline event — buff:**

{{fx:combat_feed:1.1}}[BUFF] Lantern Blessing applied // 18s.{{/fx}}

**Inline event — debuff:**

{{fx:combat_feed:1.1}}[DEBUFF] Chilled inflicted // 6s.{{/fx}}

**Inline event — miss:**

{{fx:combat_feed:1.05}}[MISS] Wind Wisp fails to strike.{{/fx}}

**Inline event — guard break:**

{{fx:combat_feed:1.15}}[GUARD_BREAK] Enemy stance collapses.{{/fx}}

**Inline event — execute:**

{{fx:combat_feed:1.2}}[EXECUTE] Final strike confirmed.{{/fx}}

## Intensity, Motion, and Speed

Block panels and the inline combat feed use the visual-intensity value shown throughout this lab. Motion range and speed are reserved for registered motion-driven inline text effects (for example `flicker`, `wiggle`, `float`, `shake`, and `glitch`); they are not added to these block markers because the block registry does not promise those channels. Reduced-motion settings remain authoritative at runtime.

**Intensity only — low signal:**

{{fx:system_warning:0.7}}SYSTEM WARNING — low signal.{{/fx}}

**Intensity only — brighter signal:**

{{fx:map_ping:1.2}}MAP PING — bridge marker acquired.{{/fx}}

**Intensity only — combat event:**

{{fx:combat_feed:1.1}}[BLOCK] Improvised guard absorbs 5 damage.{{/fx}}

Do not combine block markers with inline text names, invent a block color argument, or pile on extreme chaos stacks: the registry defines the available block vocabulary, and the runtime's sanitization and reduced-motion behavior should remain in control.
