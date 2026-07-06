# MIC - Augment Crystals (D&D 3.5e for Foundry VTT)

This module implements the **Augment Crystals** system from the *Magic Item Compendium*
(D&D 3.5e) for the D35E system on Foundry VTT. Players can socket magical crystals
into weapons, armors, and shields, respecting RAW bonus prerequisites.

## Features

- **JSON-driven catalog**: crystals defined in `crystals/*.json`, loaded automatically
  into a dedicated compendium (`MIC - Augment Crystals`).
- **Auto-folders**: items organized by *family* (Weapon / Armor / Shield) and *rank*
  (Least / Lesser / Greater).
- **Dynamic Crystal Slot**: each weapon, armor or shield gets a visual socket on the
  sheet for drag-and-drop of crystals.
- **RAW Validation**:
  - **Least:** requires masterwork or enhancement bonus.
  - **Lesser:** requires minimum +1 bonus.
  - **Greater:** requires minimum +3 bonus.
- **Multi-family and multi-rank** in a single JSON file (e.g. `adamant-armor.json`
  expands into 6 items: 3 ranks x armor/shield).
- **Auto-healing**: old `equipment` items in the compendium are recreated as `loot`
  (D35E 3.1 does not render crystals as equipment).
- **Preserves GM edits**: manual changes to flags outside the `mic-augment-crystals`
  namespace are not overwritten.
- **Foundry v13/14 compatible**.

## Current Version

**1.4.0** — 94 weapon augment crystals from MIC Chapter 2 (Acidic Burst through
Whirling), all as `rank: least`. Plus bugfixes:
- Loader: `fetchCatalog` now uses `import.meta.url` to derive the correct base path,
  resolving 404 when installed from the manifest URL.
- Socket: D35E 3.1 stores weapon enhancement at `system.enh` (not
  `system.weapon.enh`); magic weapons are now correctly recognized as valid hosts
  for Least crystals.
- Total: 122 crystals (94 weapon + 28 armor/shield).

## Installation

### A) Via Foundry (recommended)

1. Open **Setup -> Manage Modules**.
2. Click **Install Module**.
3. Paste into **Manifest URL**:
   ```
   https://raw.githubusercontent.com/paulojamel22/mic-augment-crystals/main/module.json
   ```
4. Click **Install**.
5. Activate the module in your world.
6. Restart the session.

To pin to a specific version, use the Release tag URL instead:
```
https://raw.githubusercontent.com/paulojamel22/mic-augment-crystals/v1.4.0/module.json
```

### B) Manual download

1. Download the `.zip` from the
   [releases page](https://github.com/paulojamel22/mic-augment-crystals/releases).
2. Extract into `FoundryVTT/Data/modules/mic-augment-crystals/`.
3. Activate *Magic Item Compendium: Augment Crystals* in **Manage Modules**.
4. Restart the session. The `MIC - Augment Crystals` compendium is populated on
   first launch.

## Included Crystals

### Armor / Shield (28 crystals)

- **Restful Crystal** (Armor / Least): sleeping in armor does not cause Fatigue.
- **Crystal of Adamant Armor** (Armor & Shield / Least, Lesser, Greater): adds
  Hardness to the piece (2 / 5 / 10).
- **Clasp of Energy Protection** (Shield / Least, Lesser, Greater): 5 variants
  (Fire, Cold, Acid, Electricity, Sonic) — grants Resistance 5/10/15 to the piece.
- **Crystal of Adaptation** (Armor / Least, Lesser, Greater): layered protection —
  `endure elements` on least; all *alignment traits* (chaotic/good/etc.) on lesser;
  *positive/negative-dominant traits* on greater.
- **Crystal of Aquatic Action** (Armor / Least, Lesser, Greater): no armor penalty
  on Swim on least; swim speed = 1/2 land speed (round down 5ft) on lesser;
  **freedom of movement** + **water breathing** on greater.
- **Crystal of Arrow Deflection** (Shield / Least, Lesser, Greater): +2 / +5 / +2
  AC against ranged; greater also grants *Deflect Arrows* (1 attack/round).
- **Crystal of Bent Sight** (Shield / Least): allows *averting eyes* from gaze
  attacks without suffering *miss chance* on the user's own attacks against that
  creature.
- **Crystal of Glancing Blows** (Armor / Least, Lesser, Greater): competence +2 / +5
  / +10 on opposed grapple checks **only when defending against initiation** (not
  for initiating, escaping, or other grapple checks).
- **Crystal of Lifekeeping** (Armor / Least, Lesser, Greater): competence +1 / +3 /
  +5 on saves against energy drain, inflict, death spells and death effects; greater
  adds 1x/day *reroll* (immediate mental) on a failed save.
- **Crystal of Mind Cloaking** (Armor / Least, Lesser, Greater): competence +1 / +3 /
  +5 on saves against mind-affecting (spells/abilities); greater adds 1x/day reroll
  on a failed save (immediate mental).
- **Crystal of Screening** (Armor / Least, Lesser, Greater): penalizes touch attacks
  against the bearer from **incorporeal** creatures by -2 / -5 / -10.
- **Crystal of Stamina** (Armor / Least, Lesser, Greater): competence +1 / +3 / +5 on
  saves against disease and poison; greater adds 1x/day reroll (immediate mental)
  on a failed save.
- **Iron Ward Diamond** (Armor / Least, Lesser, Greater): damage reduction 1/- (cap
  10) / 3/- (cap 30, medium+heavy armor) / 5/- (cap 50, heavy only); daily reset.
- **Rubicund Frenzy** (Armor / Least, Lesser, Greater): morale +1 / +3 / +5 on
  damage rolls and saves vs fear, **only while current HP <= 1/2 max HP**; only
  works for living creatures.

### Weapon (94 crystals)

All weapon crystals from MIC 3.5 Chapter 2: Acidic Burst, Aquan, Aquatic, Arcane
Might, Auran, Banishing, Berserker, Binding, Blessed, Blindsighted, Bloodfeeding,
Bloodstone, Blurstrike, Bodyfeeder, Brash, Brutal Surge, Changeling, Chargebreaker,
Charging, Collision, Consumptive, Corrosive, Cursespewing, Deadly Precision,
Defensive Surge, Desiccating, Desiccating Burst, Disarming, Dislocator, Great
Dislocator, Dispel, Greater Dispel, Divine Wrath, Domineering, Doom Burst,
Dragondoom, Dragonhunter, Eager, Energy Aura, Energy Surge, Ethereal Reaver,
Everbright, Fiercebane, Fleshgrinding, Force, Ghost Strike, Harmonizing, Heavenly
Burst, Hideaway, Holy Surge, Hunting, Ignan, Illusion Bane, Illusion Theft, Impact,
Impaling, Impedance, Implacable, Incorporeal Binding, Knockback, Lucky, Magebane,
Maiming, Manifester, Metalline, Mighty Smiting, Mindcrusher, Mindfeeder, Morphing,
Necrotic Focus, Paralyzing, Paralyzing Burst, Parrying, Power Storing, Precise,
Prismatic Burst, Profane, Profane Burst, Psibane, Psychic, Psychokinetic,
Psychokinetic Burst, Quick Loading, Resonating, Revealing, Sacred, Sacred Burst,
Screaming, Screaming Burst, Shadowstrike, Shattermantle, Shielding, Sizing, Slow
Burst, Soulbound, Greater Soulbound, Soulbreaker, Souldrinking, Spellstrike,
Stunning, Stunning Surge, Stygian, Sundering, Sweeping, Terran, Transmuting, Unholy
Surge, Vampiric, Vanishing, Venomous, Warning, Weakening, Whirling.

Each crystal respects MIC 3.5 prerequisites.

## Languages

- **English** (default) — `lang/en.json`.
- **Portugues (Brasil)** — `lang/pt-BR.json` (kept as reference; runtime translation
  is disabled at user request).

Crystal names are always in English (canonical magic item convention). Descriptions
are in English as well.

## Settings

The module registers a GM-only setting under **Configure Settings -> Module
Settings**:

| Setting | Scope | Type | Default | Options |
|---------|-------|------|---------|---------|
| `crystalLanguageOverride` | world | String | `auto` | `auto`, `en`, `pt-BR` |

*Note: this setting is currently informational. Runtime i18n is disabled at user
request; all crystal text displays in English.*

## Technical Details

The module is built with the Foundry VTT Hooks API. Key files:

- `mic-socket.js` — `MICSocketManager`, hooks for `renderItemSheet`, drag & drop,
  rule validation.
- `mic-crystal-data.js` — `MICCrystalData` registers the DataModel
  `mic-socket-system.crystal`.
- `mic-loader.js` — scans `crystals/index.json`, creates/updates items in the
  `crystals` compendium with persistence on Foundry v14 (creates folders, unlocks
  pack, populates items, preserves hashes, does not overwrite GM edits).

### Bonus Detection Logic

The module checks multiple locations to find the enhancement bonus, compatible
with D35E 3.1's data structure:

```javascript
const enhancement = Number(
  system.enh
  ?? system.armor?.enh
  ?? system.shield?.enh
  ?? system.enhancement
  ?? 0
);
```

Magic weapons (any `system.enh > 0`) are automatically recognized as valid bases
for Least crystals.

## Module Structure

```
mic-augment-crystals/
├── module.json
├── mic-socket.js
├── mic-crystal-data.js
├── mic-loader.js
├── crystals/
│   ├── index.json
│   ├── *.json                (122 crystal definitions)
├── lang/
│   ├── en.json
│   └── pt-BR.json            (reference only)
├── styles/
│   └── mic-socket.css
└── packs/crystals/           (runtime LevelDB, auto-created on first run)
```

## API

After the module is ready, access it via:

```javascript
game.modules.get("mic-augment-crystals").api.rerun();
```

Forces a full re-sync of the compendium from the JSON catalog.