# Fretboard app — handover

Self-contained notes for the next developer or AI agent. Verified against the codebase as of **v35** (2026-11-09). Companion doc for box names: [`docs/box-naming.md`](./box-naming.md).

---

## 1. Project overview

**What it is:** A minimal English-UI fretboard visualizer for **guitar** and **4-string bass**. It shows keys, diatonic degrees/modes, pentatonic boxes, triads, 7th arpeggios, chord grips, a progression builder, and **Solopath** (staircase solo regions across a progression). Owner: **David**.

**Stack**

| Layer | Choice |
|-------|--------|
| Build | Vite  + `@vitejs/plugin-react` |
| UI | React 19 + TypeScript |
| Style | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Fretboard | Inline SVG (`FretboardSVG.tsx`) |
| Theory helpers | Local `musicTheory.ts` (+ `tonal` in deps, used sparingly) |
| Lint | `oxlint` |

**Paths**

| Where | Path |
|-------|------|
| Agent box (canonical worktree) | `/workspace/guitar-fretboard-app` |
| David’s Mac | `/Users/david/guitar-fretboard-app` |
| Mac machineId | `7c88b373-37bb-4c48-b3ee-c63ff1dda52e` |
| Backups | `/workspace/solopath-backup/vNN` |

**Run (dev)**

```bash
cd /Users/david/guitar-fretboard-app   # or /workspace/guitar-fretboard-app
npm install
npm run dev
```

`vite.config.ts` already sets `server.host: '0.0.0.0'` and `port: 5173`. On David’s LAN, iPhone uses **`http://192.168.1.22:5173`**. Prefer not restarting `:5173` unless it is down (HMR is enough after Mac file sync).

**Build**

```bash
npm run build          # tsc -b && vite build → dist/
npm run preview        # optional local preview of dist
```

**Tests** (tsx scripts, not a Jest suite)

```bash
npx tsx scripts/solopathTest.ts      # Solopath, overlays, shapes, bass, remap, …
npx tsx scripts/boxNamingTest.ts     # finger+string box names (A minor reference, etc.)
```

Both should print `ALL … PASSED` / `ALL BOX-NAMING CHECKS PASSED`.

---

## 2. Architecture

### Key files

| File | Role |
|------|------|
| `src/App.tsx` | Top-level UI + persistent state; wires Key/Degree/vis/instrument; computes overlay notes, shapes, Solopath props; progression UI. |
| `src/components/FretboardSVG.tsx` | SVG fretboard, note dots, shape frames, As-mode radio, shape buttons, Solopath drawing/DnD. |
| `src/components/ProgressionChips.tsx` | Draggable progression chord chips (`moveItem` / preview). |
| `src/data/musicTheory.ts` | All music theory + Solopath planning + grips + box naming (~2k lines). **Start here for behaviour changes.** |
| `src/data/reorder.ts` | Pure list helpers: `moveItem`, `remapIndexAfterMove`, `previewOrder`. |
| `src/audio/guitarSynth.ts` | Optional click-to-hear (Web Audio). |
| `src/main.tsx` / `index.css` | Boot + Tailwind entry. |
| `docs/box-naming.md` | Finger+string naming rules (authoritative). |
| `scripts/solopathTest.ts` | Regression suite for theory/Solopath/overlays. |
| `scripts/boxNamingTest.ts` | Box-name regression (A minor + more). |

### Important functions (`musicTheory.ts`)

| Function | Purpose |
|----------|---------|
| `getActiveFretboardView` | Title, focus root, interval map for Key+Degree+visType. |
| `getDegreeSpec` / `DIATONIC_DEGREES` | Per-degree scale, pent, triad, arp, characteristics. |
| `getShapeCells` | CAGED-style boxes (2 NPS pent / 3 NPS scale); octave instances. |
| `coalesceShapeRanges` / `mergeShapeResults` | Merge multi-select frames into continuous outlines. |
| `remapForParallelMode` / `PARALLEL_MODE_REMAP` | Option B: keep focus root, change parent key + degree for a mode. |
| `getDegreeModeColourNotes` | Mode − pent (= usually 2 colour tones). |
| `getPentaOverlayNotes` | Blues only: b3/b5 of focus if not already in pent. |
| `pickModeColourCellsForPentShape` | Colour frets per box (all strings, ≤4-fret rule, ±1 edge). |
| `expandPentRangeForModeShape` | Grow shape frame just enough to cover colour outreach frets. |
| `namePentatonicBox` / `getPentatonicBoxNames` | `<finger><string>` labels. |
| `computeSolopath` / `solopathWindows` / solo override helpers | Staircase regions, pins, drag snap, string sets. |
| `getChordGripCells` / `getExtGripCells` | Guitar voicings (disabled on bass). |

### State persistence

`usePersistentState` in `App.tsx` prefixes keys with **`fretboard:`** and stores JSON in `localStorage`.

| Storage key | Default | Meaning |
|-------------|---------|---------|
| `fretboard:key` | `C` | Parent major key |
| `fretboard:degree` | `I` | Roman degree |
| `fretboard:visType` | `scale` | `scale` \| `pentatonic` \| `triad` \| `arp7` |
| `fretboard:labelMode` | `note` | `note` \| `degree` |
| `fretboard:shapeOnly` | `false` | Plain white dots, no labels/colours |
| `fretboard:showTension` | `false` | Highlight character/avoid tones |
| `fretboard:pentaOverlay` | `off` | Off / Blues / mode id |
| `fretboard:shapeSelection` | `[]` | Selected shape indices (empty = All) |
| `fretboard:shapeOctaves` | `true` | Show +12 instance of selected boxes |
| `fretboard:instrument` | `guitar` | `guitar` \| `bass4` |
| `fretboard:progression2` | `[]` | Progression chords |
| `fretboard:solopath` | `false` | Solopath toggle |
| `fretboard:solopathDir` | `up` | `up` \| `down` |
| `fretboard:solopathStartFret` | `{up:0,down:12}` | Per-direction start fret |
| `fretboard:solopathRegionOverrides` | guitar store | Manual Solopath box edits (guitar) |
| `fretboard:solopathRegionOverridesBass` | bass store | Same for bass |

Legacy `fretboard:solopathStart` is removed on mount (old index-based start).

### Instruments / tunings

- **Guitar** `STANDARD_STRINGS`: high→low labels `e B G D A E` (midi 64…40). Grips enabled.
- **Bass** `BASS4_STRINGS`: high→low `G D A E` (midi 43…28), one octave below guitar’s low four. No grips (chord click shows chord tones on the neck).

Add more instruments by extending `INSTRUMENTS` in `musicTheory.ts`.

---

## 3. Feature inventory (current behaviour)

### Keys, degrees, visualizations

- **Keys:** 12 chromatic parent major keys with enharmonic spellings (`KEY_CHROMATIC_SPELLINGS`).
- **Degrees:** `I ii iii IV V vi vii°` — each carries mode name, quality, characteristics, scale/pent/triad/arp7 offsets.
- **Vis types** (`VISUALIZATION_TYPES`): Major Scale / Modes (7), Pentatonic (5), Triad (3), 7th Arpeggio (4). (`scale3nps` exists in types for internal 3NPS shape generation; UI uses `scale`.)

### Display modes

- **Notes | Intervals** (`labelMode`): note names vs interval labels on dots.
- **Shape only:** equal plain white circles (no text / role colours) — useful for contour practice.
- **Guitar | Bass** instrument toggle.

### Shapes

- Multi-select CAGED (pent) / 3NPS / string-set buttons; **All** clears selection (full neck).
- **Octave** toggle: show/hide +12 repeat of each selected box.
- Overlapping/abutting frames **coalesce** into one outline (`coalesceShapeRanges`).
- Pentatonic buttons show **finger+string names** (tooltip keeps `Box N · name`). See § box naming.

### Chord card

- Cycles common **grips** on guitar (base 7th + extensions in `CHORD_GRIPS` / `EXTENSION_GRIPS`).
- On bass: shows chord tones (no grip diagrams).

### Progression + Solopath

- Build a progression from diatonic / borrowed / secondary chips; reorder via `ProgressionChips` + `reorder.ts`.
- **Solopath:** with ≥2 chords, plans a staircase of regions (string sets + fret windows) up or down the neck; equal-size notes coloured by role (primary / secondary / color / passing); DnD boxes and chips; per-region string/fret overrides persisted per instrument.

### Pentatonic overlay radio (“As mode”)

Gated strictly by `pentaOverlay` (v33+):

| Selection | Behaviour |
|-----------|-----------|
| **Off** | Plain pentatonic only — no colour/blue dots. Radio can be selected. |
| **Blues** | Pent + blue notes only (`b3`/`b5` of focus if not already in pent). **No** Key/Degree remap. |
| **Mode** (Ionian…Locrian) | **Remaps** Key+Degree so the **focus root stays** the same pitch (`remapForParallelMode`, option B). Example: focus C + Dorian → Key `Bb`, Degree `ii`. Sets `pentaOverlay` to that mode id. Shows **mode − pent** colour tones. |

Colour placement rules (v30–v31):

- Solid fills from `MODE_COLOUR_FILL` (not dashed gold).
- **In-shape octave repeats:** every string may show a valid colour fret (not limited to one pick per degree).
- **≤4 frets:** 2 pent notes + 1 colour on a string must satisfy `max−min+1 ≤ 4` (`MAX_COLOUR_TRIPLET_SPAN`).
- Frame **edge expand** (`expandPentRangeForModeShape`) only pulls in colour frets within ±1 of the pent box (gapless outline). This is **not** full 3NPS; target feel is ~5 strings×3 + 1×2 notes when colours are on.
- Example constraint: open C Ionian putting **7 on G4** with pent G0+A2 would span **5** frets → rejected; 7 stays on B0 (etc.). A-box / G-box still get **G4** where the span is 4.

**Mode palette (dark-gray column reference)**

| Mode | Hex |
|------|-----|
| Lydian | `#7EB6F8` |
| Ionian | `#F5D76E` |
| Mixolydian | `#F0983D` |
| Dorian | `#3DD6C3` |
| Aeolian | `#7B9FE0` |
| Phrygian | `#E85A8A` |
| Locrian | `#C9A8F0` |

Also used on As-mode buttons, overlay chips, and Bright→Dark **dots**.

### Bright → Dark barometer

- Order: Lydian → Ionian → Mixo → Dorian → Aeolian → Phrygian → Locrian (`BRIGHTNESS_ORDER`: `IV I V ii vi iii vii°`).
- **Dots** use mode palette fills; **connecting line stays neutral zinc** (`from-zinc-400/60` → `zinc-800`). Clicking a dot sets `activeDegree` only (does not by itself set `pentaOverlay`).

### Box naming (`<finger><string>`)

Full rules: [`docs/box-naming.md`](./box-naming.md).

- Name = finger (1–4) + string letter of the **first focus root** in the box, scanning low→high strings.
- Hand = 4-fret window; choose start position that **minimises shifts** on a low→high→back pass; **tie-break = lower finger**.
- Verified: for major & minor pentatonics across all 12 roots × 5 boxes, the tie-break **never changes the chosen finger** (unique best finger at min shifts).
- **A minor** (C / vi): `1E, 1D, 4A, 1A, 4E`.
- **C major** (C / I): `2E, 2D, 4A, 2A, 4E`.

---

## 4. David’s working preferences

- Speaks **German**; product UI stays **minimal English**.
- Tests himself on **Mac + iPhone**; **do not** send screenshots unless he asks.
- Music-theory taste often comes from **John** (separate advisor/agent); implement what David confirms.
- Prefer **Mac file sync + Vite HMR**; don’t restart `:5173` unless needed.
- CET / Europe/Berlin times when reporting.
- Ask before Netlify when limits matter; currently **Mac-only deploys**.

---

## 5. Deployment

**Current policy:** sync sources to the Mac only. **Do not deploy Netlify** — free-tier limits are used up.

**Live site (frozen):** [https://songsponge.com](https://songsponge.com) — last Netlify prod was ~**v32**. Netlify site name: `songsponge`.

**DNS (Strato):**

- Apex `A` → `75.2.60.5`
- `www` `CNAME` → `songsponge.netlify.app`

**Mac sync pattern**

1. Edit in `/workspace/guitar-fretboard-app` (or copy back from Mac if he edited there).
2. `CopyFromBox` (or equivalent) → `/Users/david/guitar-fretboard-app/src/...` on machineId `7c88b373-37bb-4c48-b3ee-c63ff1dda52e`.
3. Confirm Vite HMR log + matching `shasum`.
4. Snapshot sources under `/workspace/solopath-backup/vNN`.

**Re-enable Netlify when allowed** (token must already be in the environment as `NETLIFY_AUTH_TOKEN` — **never** paste the token into docs or commits):

```bash
cd /workspace/guitar-fretboard-app
npm run build
~/.local/bin/netlify22 deploy --prod --dir dist --no-build
```

The Netlify identity badge may still appear during local/dev; leave it.

---

## 6. Version history (backups)

Snapshots live in `/workspace/solopath-backup/vNN`. Early folders often contain full `src/` (+ `scripts/`); later ones are lean file copies.

| Ver | Notable change (reconstructed) |
|-----|--------------------------------|
| v11–v19 | Incremental Solopath / progression / UI hardening (see folder contents). |
| v20–v24 | Bass instrument path, grip/string-set work, Netlify era features. |
| v25–v27 | Shape multi-select / octave filtering refinements. |
| v28 | One-pick mode colours with CAGED preferred strings (John slots). |
| v29 | Gapless edge expand + solid mode palette fills. |
| v30 | ≤4-fret colour rule; Bright→Dark palette (initially also coloured the line). |
| v31 | In-shape **octave repeats** of mode colours restored under the 4-fret rule. |
| v32 | Barometer: **dots only** coloured; line back to neutral zinc. **Last Netlify prod.** |
| v33 | Overlay radio gate: **Off** = plain pent; **Blues** = blues only; modes remap + colours. |
| v34 | Pentatonic **finger+string** box names + `docs/box-naming.md` + tests. |
| v35 | This handover document. |

---

## 7. Known issues / compromises / open ideas

- **Open C Ionian 7 on G4** vs ≤4-fret rule: G0+A2+B4 spans 5 frets → colour 7 stays on **B0** (and similar). Mid-neck boxes still show **G4** where legal.
- Stale comments: keep JSDoc in sync with `pickModeColourCellsForPentShape` (all-string repeats, not one-pick).
- **Brightness bar** changes degree only; it does not set `pentaOverlay`. After Off, changing the barometer does not turn colours back on until a mode radio is clicked.
- **Bass:** only standard EADG 4-string; 5/6-string or alternate tunings = new `INSTRUMENTS` entries.
- **Netlify frozen** at ~v32; Mac may be ahead (v33+). Don’t assume songsponge.com matches Mac.
- Solopath overrides are keyed by progression signature + instrument; changing key/progression signature clears applicability of old pins.
- `scale3nps` is in the type union for shape math; the main vis toggle does not expose it as its own tab.
- Possible future: more instruments, richer blues UI colour distinct from mode palette, optional one-pick-vs-repeats toggle if David wants both pedagogies.

---

## Quick checklist for the next worker

1. Read this file + `docs/box-naming.md`.
2. Run `npx tsx scripts/solopathTest.ts` and `npx tsx scripts/boxNamingTest.ts`.
3. Sync to Mac; confirm HMR; **skip Netlify** unless David explicitly lifts the limit.
4. For pent colour bugs: check `pentaOverlay` gating in `App.tsx`, then `pickModeColourCellsForPentShape` / `MAX_COLOUR_TRIPLET_SPAN`.
5. For naming bugs: `namePentatonicBox` + `boxNamingTest.ts`.
6. Prefer small backups (`vNN`) after each accepted change set.
