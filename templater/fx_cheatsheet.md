# Text FX Cheatsheet

Use canonical markers in notes:

`{{fx:effect_name[|effect_name...][:value][:value][:value]}}your_text{{/fx}}`

- Values are unlabeled: numbers fill visual, then motion intensity (clamped `0.2` -> `5`); a color-shaped token may appear in any position.
- Single intensity affects visual only.
- In per-effect stacks, values follow `effect=value/value...` (for example, `neon=1.2/0.9/gold`).
- Stack order is left-to-right (`glow|flicker|shadow` keeps that class order).
- Stack mode is text-effects only; block effects remain single-effect wrappers.
- Blacklisted pairings are auto-sanitized with build/dev warnings.
- Soft line breaks are enabled globally, so single newlines render as `<br>`.
- **Block effects require blank lines** around the open and close markers so each lands on its own paragraph in the Markdown AST. Content lines inside a block also need blank lines between them if they should be separate paragraphs.

## Color

- Accepted colors: CSS named colors (`gold`, `crimson`, ...), hex (`#fc0`, `#ffcc00`, including 4/8-digit forms), or palette tokens (`accent`, `accent_alt`, `nigredo`, `albedo`, `citrinitas`, `rubedo`, `codex`).
- The color-capable effects are `aura`, `glow`, `gradient`, `neon`, `rift`, `shadow`, `sigil_pulse`, `veil`, and `whisper`.
- Color is position-insensitive: `{{fx:neon:gold:1.2}}` equals `{{fx:neon:1.2:gold}}`.
- Per-effect stacks use slash-separated values after `=`: `{{fx:glow=gold|aura:1.1}}` and `{{fx:neon=1.2/0.9/gold}}`.
- Fixed palettes: `chroma`, `rainbow`, and `glitch` refuse color args; supplied colors are dropped with a build warning.
- Unknown color words (for example, `banana`) are syntax errors; the whole marker stays literal.

## Effects

- `glow`
- `neon`
- `shadow`
- `rift`
- `chroma`
- `blur`
- `flicker`
- `rainbow`
- `gradient`
- `terminal` (block)
- `stat_screen` (block)
- `game_screen` (block)
- `quest_log` (block)
- `skill_popup` (block)
- `inventory` (block)
- `combat_feed` (block)
- `status_effects` (block)
- `system_warning` (block)
- `memory_fragment` (block)
- `admin_trace` (block)
- `party_roster` (block)
- `map_ping` (block)
- `aura`
- `etch`
- `whisper`
- `sigil_pulse`
- `veil`
- `cadence`
- `cadence_soft`
- `cadence_oracular`
- `cadence_childlike`
- `wiggle`
- `float`
- `shake`
- `glitch`

## Quick Examples

```md
{{fx:glow}}luminous line{{/fx}}
{{fx:glow:1.4}}brighter line{{/fx}}
{{fx:flicker:1.2:0.8}}fading lantern{{/fx}}
{{fx:glow|flicker|shadow:1.2:0.9}}stacked signal{{/fx}}
{{fx:rift:0.85}}the page tears open{{/fx}}
{{fx:aura:1.5}}sanctuary ember{{/fx}}
{{fx:etch:1.2}}carved vow{{/fx}}
{{fx:whisper:1.3}}faint confession{{/fx}}
{{fx:sigil_pulse:1.4:1.1}}sealed omen{{/fx}}
{{fx:veil:1.3}}veiled memory{{/fx}}
{{fx:cadence}}inner monologue{{/fx}}
{{fx:cadence_oracular:1.1}}solemn omen{{/fx}}
{{fx:glitch}}fractured memory{{/fx}}

{{fx:terminal:1.2:0.9}}
[SYSTEM] Boot sequence complete.
Awaiting command input.
{{/fx}}

{{fx:stat_screen:1.1}}

- HP: 100/100
- MP: 62/62
- STR: 8
- AGI: 11
  {{/fx}}

{{fx:game_screen:1.2}}
**Milestone Quest Received**

- Find the sinners you call family // 0%
- Discover your happiness // 0%
  {{/fx}}

{{fx:quest_log:1.25}}
**Active Quests**

- [Main] Descend alive // 0%
- [Side] Recover identity fragments // 5%
  {{/fx}}

{{fx:skill_popup:1.3:1.1}}
**Skill Unlocked: Cliffsense**
Grants +12% foothold detection on unstable terrain.
{{/fx}}

{{fx:inventory:1.1}}

- Rusted Compass x1 // Uncommon
- Fractured Seal x3 // Rare
- Dry Ration x2 // Common
  {{/fx}}

{{fx:combat_feed:1.2:1.2}}

- Cinza deals 14 (CRIT) to Wind Wisp
- Wind Wisp inflicts Chilled (6s)
  {{/fx}}

{{fx:status_effects:1.15}}

- Chilled // -8% movement // 6s
- Lantern Blessing // +4 regen // 18s
  {{/fx}}

{{fx:system_warning:1.2}}
**CAUTION: ACCESS INSTABILITY DETECTED**
Adaptive safeguards engaged. Recovery throughput reduced.
{{/fx}}

{{fx:memory_fragment:1.1:0.85}}
"A distant bell. A name you almost remember. A promise with no face."
{{/fx}}

{{fx:admin_trace:1.05}}
TRACE // shell.guard.patch=active
TRACE // emotional_drift_threshold=0.72
{{/fx}}

{{fx:party_roster:1.1}}

- Cinza // Vanguard // HP 100%
- ??? // Support // SIGNAL LOST
  {{/fx}}

{{fx:map_ping:1.15}}
**Map Ping: Southern Encampment**

- Distance: 2.3 km
- Threat Index: Moderate
  {{/fx}}
```

## Fast Workflow

1. Select text.
2. Trigger `FX Picker` (QuickAdd).
3. Choose effect, then optional intensities.
4. Keep markers lightweight (phrase-level emphasis).

## Authoring Bundles

- `templater/bundle_combat_beat.md`
- `templater/bundle_quest_accept.md`
- `templater/bundle_checkpoint_summary.md`
