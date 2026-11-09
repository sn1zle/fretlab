# Pentatonic box naming (`<finger><string>`)

Each pentatonic CAGED box is labelled with a short name such as **`1E`** or **`4A`**, instead of plain `1`…`5`. The name answers: *with which finger, on which string, do I first play the focus root in this box?*

The **focus root** is the root of the selected Degree (after any parallel-mode remap). Naming uses only the **pentatonic** notes of the displayed box — never mode-colour or blues overlays.

## Format

```
<finger><string letter>
```

| Part | Meaning |
|------|---------|
| **finger** | `1`–`4` — which fretting-hand finger plays the naming root under the chosen hand position |
| **string** | Letter of the string where that root **first** appears, scanning from the **lowest-pitched** string upward (`E A D G B e` on guitar; `E A D G` on 4-string bass). Low E is `E`; high e is `e` when the tuning uses that label |

Example: **`1E`** = play the focus root with **finger 1** on the **low E** string.

## Hand position (no stretching)

The hand covers **four consecutive frets**. Finger 1 is on the lowest fret of that window; finger 4 on the highest (`window = [pos, pos+3]`).

A note outside the current window requires a **shift** (slide): move the window the smallest amount so the note fits

- note above the window → `pos = fret - 3` (land on finger 4)
- note below the window → `pos = fret` (land on finger 1)

There is **no stretch** beyond those four frets.

## Choosing the starting hand position

Imagine playing the box **once from the lowest string to the highest and back again** (round trip):

1. **Down:** strings low→high; on each string, frets low→high  
2. **Back:** the reverse of that sequence  

For each candidate starting `pos`, count how many shifts occur over the whole round trip (greedy: stay put while the next note fits; otherwise shift minimally).

**Pick the starting `pos` that minimises total shifts.**

**Tie-break:** if two starting positions yield the same shift count, prefer the one where the naming root is played with the **lower finger number**.

The finger in the box name is the finger in effect **when the root is first played on the way down** (i.e. after any shifts that already happened before that note — normally the starting window, since the first root is early in the pass).

Candidate starting positions are every fret where some box note could sit under fingers 1–4 (`fret - 0 … fret - 3`).

## Worked example — A minor pentatonic

Key **C**, Degree **vi** → focus root **A**, minor pentatonic `[0, 3, 5, 7, 10]` relative to A.

| Box (old #) | Frets (primary) | Name | Why |
|-------------|-----------------|------|-----|
| 1 | 5–8 | **1E** | First A is low E fret 5; best window starts at 5 → finger 1 |
| 2 | 7–10 | **1D** | First A is D fret 7; window starts at 7 → finger 1 |
| 3 | 9–13 | **4A** | First A is A fret 12. Window starting at **9** needs **2** round-trip shifts; starting at 10 needs **3**. At start 9, A12 is finger **4** → `4A` |
| 4 | 0–3 (same pattern as 12–15) | **1A** | First A on A string; finger 1 |
| 5 | 2–5 (same pattern as 14–17) | **4E** | First A on low E; window start 2 → finger 4 |

Octave repeats of the same CAGED shape share the same finger–string pattern and therefore the **same name**.

## Implementation

- `namePentatonicBox` / `getPentatonicBoxNames` in `src/data/musicTheory.ts`
- Shape buttons show the new names; tooltip keeps the old index (`Box 3 · 4A`)
- Unit tests in `scripts/boxNamingTest.ts`
