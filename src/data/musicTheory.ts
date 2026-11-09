export const CHROMATIC_NOTES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
] as const;

export type NoteName = (typeof CHROMATIC_NOTES)[number];

export type LabelMode = 'note' | 'degree';

export type RomanDegree = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°';

export type VisualizationType = 'scale' | 'scale3nps' | 'pentatonic' | 'triad' | 'arp7';

export interface VisualizationTypeOption {
  id: VisualizationType;
  label: string;
}

export const VISUALIZATION_TYPES: VisualizationTypeOption[] = [
  { id: 'scale', label: 'Major Scale / Modes (7 notes)' },
  { id: 'pentatonic', label: 'Pentatonic (5 notes)' },
  { id: 'triad', label: 'Triad Arpeggio (3 notes)' },
  { id: 'arp7', label: '7th Arpeggio (4 notes)' },
];

/** Extra notes shown on top of the current pentatonic skeleton (pentatonic view only). */
export type PentaOverlayId =
  | 'off'
  | 'blues'
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian';

export interface PentaOverlayOption {
  id: PentaOverlayId;
  label: string;
}

export const PENTA_OVERLAYS: PentaOverlayOption[] = [
  { id: 'off', label: 'Off' },
  { id: 'blues', label: 'Blues' },
  { id: 'ionian', label: 'Ionian' },
  { id: 'dorian', label: 'Dorian' },
  { id: 'phrygian', label: 'Phrygian' },
  { id: 'lydian', label: 'Lydian' },
  { id: 'mixolydian', label: 'Mixo' },
  { id: 'aeolian', label: 'Aeolian' },
  { id: 'locrian', label: 'Locrian' },
];

export function isPentaOverlayId(v: unknown): v is PentaOverlayId {
  return typeof v === 'string' && PENTA_OVERLAYS.some((o) => o.id === v);
}

/** Semitones to subtract from the focus root to get the parent key tonic for each parallel mode. */
export const PARALLEL_MODE_REMAP: Record<
  Exclude<PentaOverlayId, 'off' | 'blues'>,
  { degree: RomanDegree; semisDown: number }
> = {
  ionian: { degree: 'I', semisDown: 0 },
  dorian: { degree: 'ii', semisDown: 2 },
  phrygian: { degree: 'iii', semisDown: 4 },
  lydian: { degree: 'IV', semisDown: 5 },
  mixolydian: { degree: 'V', semisDown: 7 },
  aeolian: { degree: 'vi', semisDown: 9 },
  locrian: { degree: 'vii°', semisDown: 11 },
};

/** Parent key + degree so focus root R becomes that parallel mode (R stays the same note). */
export function remapForParallelMode(
  focusRootChroma: number,
  mode: Exclude<PentaOverlayId, 'off' | 'blues'>
): { key: NoteName; degree: RomanDegree } {
  const { degree, semisDown } = PARALLEL_MODE_REMAP[mode];
  const keyChroma = (focusRootChroma - semisDown + 12) % 12;
  return { key: CHROMATIC_NOTES[keyChroma], degree };
}

/** Which Key-colours mode button matches the current degree (mode is carried by Key+Degree). */
export function modeIdForDegree(roman: RomanDegree): Exclude<PentaOverlayId, 'off' | 'blues'> {
  const hit = (Object.entries(PARALLEL_MODE_REMAP) as [Exclude<PentaOverlayId, 'off' | 'blues'>, { degree: RomanDegree }][]).find(
    ([, v]) => v.degree === roman
  );
  return hit?.[0] ?? 'ionian';
}

/**
 * The two (usually) colour tones of a degree's mode: full mode scale minus its pentatonic.
 * Example: ii / Dorian → [2, 9] (major 2nd + major 6th) on the minor pent.
 */
export function getDegreeModeColourNotes(
  scaleOffsets: number[],
  scaleIntervals: Record<number, string>,
  pentatonicOffsets: number[]
): { offsets: number[]; intervals: Record<number, string> } {
  const inPenta = new Set(pentatonicOffsets);
  const offsets = scaleOffsets.filter((o) => !inPenta.has(o));
  const intervals: Record<number, string> = {};
  for (const o of offsets) intervals[o] = scaleIntervals[o] ?? String(o);
  return { offsets, intervals };
}

/**
 * Blues overlay: b3 and b5 of the focus root, if not already in the pentatonic.
 * Mode colour dots are gated in the UI when a mode overlay is selected.
 */
export function getPentaOverlayNotes(
  overlay: PentaOverlayId,
  _tonicChroma: number,
  _focusRootChroma: number,
  pentatonicOffsets: number[]
): { offsets: number[]; intervals: Record<number, string> } {
  if (overlay !== 'blues') return { offsets: [], intervals: {} };
  const inPenta = new Set(pentatonicOffsets);
  const offsets: number[] = [];
  const intervals: Record<number, string> = {};
  for (const [o, label] of [[3, 'b3'], [6, 'b5']] as const) {
    if (inPenta.has(o)) continue;
    offsets.push(o);
    intervals[o] = label;
  }
  return { offsets, intervals };
}

/** Merge mode-colour dots with optional blues (blues labels win on shared semis). */
export function mergeOverlayNotes(
  mode: { offsets: number[]; intervals: Record<number, string> },
  blues: { offsets: number[]; intervals: Record<number, string> }
): { offsets: number[]; intervals: Record<number, string> } {
  const intervals = { ...mode.intervals, ...blues.intervals };
  const offsets = [...new Set([...mode.offsets, ...blues.offsets])].sort((a, b) => a - b);
  return { offsets, intervals };
}


/** Solid fills for mode-colour notes (from SongSponge mode palette, dark-gray column). */
export const MODE_COLOUR_FILL: Record<Exclude<PentaOverlayId, 'off' | 'blues'>, string> = {
  lydian: '#7EB6F8',
  ionian: '#F5D76E',
  mixolydian: '#F0983D',
  dorian: '#3DD6C3',
  aeolian: '#7B9FE0',
  phrygian: '#E85A8A',
  locrian: '#C9A8F0',
};

/** Dark label on light mode fills. */
export const MODE_COLOUR_TEXT = '#14141c';

/** Inclusive fret count: 2 pent notes + 1 colour may span at most 4 frets (not 5). */
const MAX_COLOUR_TRIPLET_SPAN = 4;

function fretsSpanOk(frets: number[]): boolean {
  if (frets.length === 0) return true;
  return Math.max(...frets) - Math.min(...frets) + 1 <= MAX_COLOUR_TRIPLET_SPAN;
}

/**
 * Grow a pent box frame just enough to cover mode-colour outreach frets (±1 edge),
 * keeping the gapless outline around the one-pass colour dots.
 */
export function expandPentRangeForModeShape(
  range: { min: number; max: number },
  _focusRootChroma: number = 0,
  _scaleOffsets: number[] = [],
  _tuning: Tuning = STANDARD_STRINGS,
  fretCount = 24,
  colourFrets: number[] = []
): { min: number; max: number } {
  let lo = range.min;
  let hi = range.max;
  for (const f of colourFrets) {
    if (f < 0 || f > fretCount) continue;
    // Only pull in frets adjacent to this box (gapless edge), not distant octaves.
    if (f >= range.min - 1 && f <= range.max + 1) {
      lo = Math.min(lo, f);
      hi = Math.max(hi, f);
    }
  }
  return { min: lo, max: hi };
}

/**
 * Mode-colour frets inside one CAGED pent shape (all strings).
 * Every colour degree that fits the ≤4-fret rule with that string's two pent
 * notes is kept (in-shape octave repeats), including ±1 fret edge outreach.
 */
export function pickModeColourCellsForPentShape(
  focusRootChroma: number,
  pentatonicOffsets: number[],
  colourSemis: number[],
  shapeIndex: number,
  includeOctaves: boolean,
  tuning: Tuning = STANDARD_STRINGS,
  fretCount = 24,
  _scaleOffsets: number[] = [0, 2, 4, 5, 7, 9, 11]
): Set<string> {
  const shape = getShapeCells(
    focusRootChroma,
    pentatonicOffsets,
    2,
    shapeIndex,
    fretCount,
    tuning,
    includeOctaves
  );
  const colourSet = new Set(colourSemis);
  const out = new Set<string>();

  for (const range of shape.ranges) {
    const pentByString: number[][] = tuning.map(() => []);
    for (const cell of shape.cells) {
      const [s, f] = cell.split('-').map(Number);
      if (f < range.min || f > range.max) continue;
      pentByString[s].push(f);
    }
    // In-shape octave repeats: every colour fret on every string that fits
    // the ≤4-fret triplet rule (2 pent + colour), including ±1 edge outreach.
    const lo = Math.max(0, range.min - 1);
    const hi = Math.min(fretCount, range.max + 1);
    for (let sIdx = 0; sIdx < tuning.length; sIdx++) {
      const pentFs = pentByString[sIdx];
      for (let f = lo; f <= hi; f++) {
        const chroma = ((tuning[sIdx].midi + f) % 12 + 12) % 12;
        const semi = (chroma - focusRootChroma + 12) % 12;
        if (!colourSet.has(semi)) continue;
        if (!fretsSpanOk([...pentFs, f])) continue;
        out.add(`${sIdx}-${f}`);
      }
    }
  }
  return out;
}

// Proper enharmonic 12-tone chromatic spelling for each parent Major key
// so every 7-note scale has each letter name (C D E F G A B) exactly once!
const KEY_CHROMATIC_SPELLINGS: Record<NoteName, readonly string[]> = {
  // Sharp keys (G, D, A, E, B, F#) + C
  C:  ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  G:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  D:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  A:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  E:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  B:  ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  'F#': ['B#', 'C#', 'D', 'D#', 'E', 'E#', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  // Flat keys (F, Bb, Eb, Ab, Db)
  F:  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Bb: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Eb: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Ab: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
  Db: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],
};

export interface DegreeSpec {
  roman: RomanDegree;
  semitonesFromKey: number;
  chordSuffix: string;
  arp7Suffix: string;
  modeName: string;
  modeSubtitle: string;
  pentatonicName: string;
  triadName: string;
  arp7Name: string;
  scaleIntervals: Record<number, string>;
  scaleOffsets: number[];
  pentatonicIntervals: Record<number, string>;
  pentatonicOffsets: number[];
  triadIntervals: Record<number, string>;
  triadOffsets: number[];
  arp7Intervals: Record<number, string>;
  arp7Offsets: number[];
  characterOffsets: number[];
  avoidOffsets: number[];
  characteristics: string[];
  modeQuality: string;
  extensions: string[];
}

export const DIATONIC_DEGREES: DegreeSpec[] = [
  {
    roman: 'I',
    semitonesFromKey: 0,
    chordSuffix: '',
    arp7Suffix: 'maj7',
    modeName: 'Ionian (Major Scale)',
    modeSubtitle: 'Ionian',
    pentatonicName: 'Major Pentatonic',
    triadName: 'Major Triad',
    arp7Name: 'Major 7 Arpeggio',
    scaleIntervals: { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' },
    scaleOffsets: [0, 2, 4, 5, 7, 9, 11],
    pentatonicIntervals: { 0: '1', 2: '2', 4: '3', 7: '5', 9: '6' },
    pentatonicOffsets: [0, 2, 4, 7, 9],
    triadIntervals: { 0: '1', 4: '3', 7: '5' },
    triadOffsets: [0, 4, 7],
    arp7Intervals: { 0: '1', 4: '3', 7: '5', 11: '7' },
    arp7Offsets: [0, 4, 7, 11],
    characterOffsets: [11, 5],
    avoidOffsets: [5],
    characteristics: ['Bright', 'Stable', 'Happy', 'Uplifting'],
    modeQuality: 'Major mode',
    extensions: ['maj9', '6/9'],
  },
  {
    roman: 'ii',
    semitonesFromKey: 2,
    chordSuffix: 'm',
    arp7Suffix: 'm7',
    modeName: 'Dorian',
    modeSubtitle: 'Dorian',
    pentatonicName: 'Minor Pentatonic',
    triadName: 'Minor Triad',
    arp7Name: 'Minor 7 Arpeggio',
    scaleIntervals: { 0: '1', 2: '2', 3: 'b3', 5: '4', 7: '5', 9: '6', 10: 'b7' },
    scaleOffsets: [0, 2, 3, 5, 7, 9, 10],
    pentatonicIntervals: { 0: '1', 3: 'b3', 5: '4', 7: '5', 10: 'b7' },
    pentatonicOffsets: [0, 3, 5, 7, 10],
    triadIntervals: { 0: '1', 3: 'b3', 7: '5' },
    triadOffsets: [0, 3, 7],
    arp7Intervals: { 0: '1', 3: 'b3', 7: '5', 10: 'b7' },
    arp7Offsets: [0, 3, 7, 10],
    characterOffsets: [9],
    avoidOffsets: [],
    characteristics: ['Cool', 'Hip', 'Uplifting', 'Touch of mystery'],
    modeQuality: 'Minor mode',
    extensions: ['m6', 'm13'],
  },
  {
    roman: 'iii',
    semitonesFromKey: 4,
    chordSuffix: 'm',
    arp7Suffix: 'm7',
    modeName: 'Phrygian',
    modeSubtitle: 'Phrygian',
    pentatonicName: 'Minor Pentatonic',
    triadName: 'Minor Triad',
    arp7Name: 'Minor 7 Arpeggio',
    scaleIntervals: { 0: '1', 1: 'b2', 3: 'b3', 5: '4', 7: '5', 8: 'b6', 10: 'b7' },
    scaleOffsets: [0, 1, 3, 5, 7, 8, 10],
    pentatonicIntervals: { 0: '1', 3: 'b3', 5: '4', 7: '5', 10: 'b7' },
    pentatonicOffsets: [0, 3, 5, 7, 10],
    triadIntervals: { 0: '1', 3: 'b3', 7: '5' },
    triadOffsets: [0, 3, 7],
    arp7Intervals: { 0: '1', 3: 'b3', 7: '5', 10: 'b7' },
    arp7Offsets: [0, 3, 7, 10],
    characterOffsets: [1],
    avoidOffsets: [],
    characteristics: ['Middle Eastern or Spanish vibe', 'Drama', 'Tension'],
    modeQuality: 'Minor mode',
    extensions: ['m7(b9)'],
  },
  {
    roman: 'IV',
    semitonesFromKey: 5,
    chordSuffix: '',
    arp7Suffix: 'maj7',
    modeName: 'Lydian',
    modeSubtitle: 'Lydian',
    pentatonicName: 'Major Pentatonic',
    triadName: 'Major Triad',
    arp7Name: 'Major 7 Arpeggio',
    scaleIntervals: { 0: '1', 2: '2', 4: '3', 6: '#4', 7: '5', 9: '6', 11: '7' },
    scaleOffsets: [0, 2, 4, 6, 7, 9, 11],
    pentatonicIntervals: { 0: '1', 2: '2', 4: '3', 7: '5', 9: '6' },
    pentatonicOffsets: [0, 2, 4, 7, 9],
    triadIntervals: { 0: '1', 4: '3', 7: '5' },
    triadOffsets: [0, 4, 7],
    arp7Intervals: { 0: '1', 4: '3', 7: '5', 11: '7' },
    arp7Offsets: [0, 4, 7, 11],
    characterOffsets: [6],
    avoidOffsets: [],
    characteristics: ['Dreamy', 'Spacy'],
    modeQuality: 'Major mode',
    extensions: ['maj7(#11)'],
  },
  {
    roman: 'V',
    semitonesFromKey: 7,
    chordSuffix: '',
    arp7Suffix: '7',
    modeName: 'Mixolydian',
    modeSubtitle: 'Mixolydian',
    pentatonicName: 'Major Pentatonic',
    triadName: 'Major Triad',
    arp7Name: 'Dominant 7 Arpeggio',
    scaleIntervals: { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 10: 'b7' },
    scaleOffsets: [0, 2, 4, 5, 7, 9, 10],
    pentatonicIntervals: { 0: '1', 2: '2', 4: '3', 7: '5', 9: '6' },
    pentatonicOffsets: [0, 2, 4, 7, 9],
    triadIntervals: { 0: '1', 4: '3', 7: '5' },
    triadOffsets: [0, 4, 7],
    arp7Intervals: { 0: '1', 4: '3', 7: '5', 10: 'b7' },
    arp7Offsets: [0, 4, 7, 10],
    characterOffsets: [10],
    avoidOffsets: [],
    characteristics: ['Major vibe but more bluesy'],
    modeQuality: 'Major mode',
    extensions: ['9', '13', '7sus4'],
  },
  {
    roman: 'vi',
    semitonesFromKey: 9,
    chordSuffix: 'm',
    arp7Suffix: 'm7',
    modeName: 'Aeolian (Natural Minor)',
    modeSubtitle: 'Aeolian',
    pentatonicName: 'Minor Pentatonic',
    triadName: 'Minor Triad',
    arp7Name: 'Minor 7 Arpeggio',
    scaleIntervals: { 0: '1', 2: '2', 3: 'b3', 5: '4', 7: '5', 8: 'b6', 10: 'b7' },
    scaleOffsets: [0, 2, 3, 5, 7, 8, 10],
    pentatonicIntervals: { 0: '1', 3: 'b3', 5: '4', 7: '5', 10: 'b7' },
    pentatonicOffsets: [0, 3, 5, 7, 10],
    triadIntervals: { 0: '1', 3: 'b3', 7: '5' },
    triadOffsets: [0, 3, 7],
    arp7Intervals: { 0: '1', 3: 'b3', 7: '5', 10: 'b7' },
    arp7Offsets: [0, 3, 7, 10],
    characterOffsets: [8],
    avoidOffsets: [],
    characteristics: ['Dark', 'Sad'],
    modeQuality: 'Minor mode',
    extensions: ['m(b6)', 'm9'],
  },
  {
    roman: 'vii°',
    semitonesFromKey: 11,
    chordSuffix: '°',
    arp7Suffix: 'm7b5',
    modeName: 'Locrian',
    modeSubtitle: 'Locrian',
    pentatonicName: 'Half-Diminished Pentatonic (m7b5)',
    triadName: 'Diminished Triad',
    arp7Name: 'Half-Diminished Arpeggio',
    scaleIntervals: { 0: '1', 1: 'b2', 3: 'b3', 5: '4', 6: 'b5', 8: 'b6', 10: 'b7' },
    scaleOffsets: [0, 1, 3, 5, 6, 8, 10],
    pentatonicIntervals: { 0: '1', 3: 'b3', 5: '4', 6: 'b5', 10: 'b7' },
    pentatonicOffsets: [0, 3, 5, 6, 10],
    triadIntervals: { 0: '1', 3: 'b3', 6: 'b5' },
    triadOffsets: [0, 3, 6],
    arp7Intervals: { 0: '1', 3: 'b3', 6: 'b5', 10: 'b7' },
    arp7Offsets: [0, 3, 6, 10],
    characterOffsets: [6],
    avoidOffsets: [],
    characteristics: ['Unstable', 'Not resolved', 'Dark', 'Tense'],
    modeQuality: 'Minor mode (diminished)',
    extensions: [],
  },
];

/** Open strings from the highest (row 0, drawn on top) to the lowest (last row). */
export type Tuning = { label: string; midi: number }[];

// Standard tuning from high string (row 0 = high e) to low string (row 5 = low E)
export const STANDARD_STRINGS: Tuning = [
  { label: 'e', midi: 64 },
  { label: 'B', midi: 59 },
  { label: 'G', midi: 55 },
  { label: 'D', midi: 50 },
  { label: 'A', midi: 45 },
  { label: 'E', midi: 40 },
];

/** 4-string bass, standard tuning G2 D2 A1 E1 (an octave below the guitar's low strings). */
export const BASS4_STRINGS: Tuning = [
  { label: 'G', midi: 43 },
  { label: 'D', midi: 38 },
  { label: 'A', midi: 33 },
  { label: 'E', midi: 28 },
];

/** Instruments the fretboard can show; more (5/6-string bass, other tunings) are new entries here. */
export type InstrumentId = 'guitar' | 'bass4';
export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  strings: Tuning;
  /** Chord grips (drop 2 / drop 3, CAGED forms) only exist for 6-string guitar. */
  grips: boolean;
}
export const INSTRUMENTS: InstrumentDef[] = [
  { id: 'guitar', name: 'Guitar', strings: STANDARD_STRINGS, grips: true },
  { id: 'bass4', name: 'Bass', strings: BASS4_STRINGS, grips: false },
];
export const isInstrumentId = (v: unknown): v is InstrumentId => INSTRUMENTS.some((x) => x.id === v);
export const getInstrument = (id: InstrumentId | string): InstrumentDef => INSTRUMENTS.find((x) => x.id === id) ?? INSTRUMENTS[0];

export function getNoteNameForKey(midiOrChroma: number, parentKey: NoteName): string {
  const chroma = ((midiOrChroma % 12) + 12) % 12;
  return KEY_CHROMATIC_SPELLINGS[parentKey][chroma];
}

export function getDegreeSpec(roman: RomanDegree): DegreeSpec {
  return (
    DIATONIC_DEGREES.find((d) => d.roman === roman) ?? DIATONIC_DEGREES[0]
  );
}

export function getDegreeRootChroma(
  parentKey: NoteName,
  degree: DegreeSpec
): number {
  const keyIdx = CHROMATIC_NOTES.indexOf(parentKey);
  return (keyIdx + degree.semitonesFromKey) % 12;
}

export function getDegreeRootNote(
  parentKey: NoteName,
  degree: DegreeSpec
): string {
  const chroma = getDegreeRootChroma(parentKey, degree);
  return getNoteNameForKey(chroma, parentKey);
}

export interface ActiveFretboardView {
  focusRootChroma: number;
  focusRoot: string;
  chordLabel: string;
  title: string;
  subtitle: string;
  semitones: Record<number, string>;
  notes: { note: string; degree: string }[];
}

export function getActiveFretboardView(
  parentKey: NoteName,
  roman: RomanDegree,
  visType: VisualizationType
): ActiveFretboardView {
  const spec = getDegreeSpec(roman);
  const focusRootChroma = getDegreeRootChroma(parentKey, spec);
  const focusRoot = getNoteNameForKey(focusRootChroma, parentKey);

  let semitones: Record<number, string>;
  let offsets: number[];
  let title: string;
  let subtitle: string;
  const chordLabel =
    visType === 'arp7'
      ? `${focusRoot}${spec.arp7Suffix}`
      : `${focusRoot}${spec.chordSuffix}`;

  if (visType === 'scale' || visType === 'scale3nps') {
    semitones = spec.scaleIntervals;
    offsets = spec.scaleOffsets;
    title = `${focusRoot} ${spec.modeName}`;
    subtitle = `Degree ${spec.roman} in ${parentKey} major`;
  } else if (visType === 'pentatonic') {
    semitones = spec.pentatonicIntervals;
    offsets = spec.pentatonicOffsets;
    title = `${focusRoot} ${spec.pentatonicName}`;
    subtitle = `Degree ${spec.roman} (${chordLabel}) in ${parentKey} major`;
  } else if (visType === 'triad') {
    semitones = spec.triadIntervals;
    offsets = spec.triadOffsets;
    title = `${chordLabel} — ${spec.triadName}`;
    subtitle = `Triad arpeggio, degree ${spec.roman} in ${parentKey} major`;
  } else {
    semitones = spec.arp7Intervals;
    offsets = spec.arp7Offsets;
    title = `${chordLabel} — ${spec.arp7Name}`;
    subtitle = `7th arpeggio, degree ${spec.roman} in ${parentKey} major`;
  }

  const notes = offsets.map((semi) => ({
    note: getNoteNameForKey((focusRootChroma + semi) % 12, parentKey),
    degree: semitones[semi],
  }));

  return {
    focusRootChroma,
    focusRoot,
    chordLabel,
    title,
    subtitle,
    semitones,
    notes,
  };
}


// ---------- Positions / Shapes ----------
// Pentatonic boxes = 2 consecutive scale notes per string,
// 3NPS positions = 3 consecutive scale notes per string,
// each starting on a different scale tone on the low E string.

export function getShapeCount(visType: VisualizationType, tuning: Tuning = STANDARD_STRINGS): number {
  if (visType === 'pentatonic') return 5;
  if (visType === 'scale' || visType === 'scale3nps') return 7;
  if (visType === 'triad' || visType === 'arp7') return stringSetsFor(visType, tuning).length;
  return 0;
}

export interface ShapeResult {
  cells: Set<string>; // `${stringIdx}-${fret}`
  ranges: { min: number; max: number }[];
}

export function getShapeCells(
  focusRootChroma: number,
  offsets: number[],
  notesPerString: number,
  shapeIndex: number, // 0-based
  fretCount = 24,
  tuning: Tuning = STANDARD_STRINGS,
  /** When false, keep only the lowest (primary) position; skip +12/−12 repeats. */
  includeOctaves = true
): ShapeResult {
  const sorted = [...offsets].sort((a, b) => a - b);
  const lowE = tuning[tuning.length - 1].midi;
  const startChroma = (focusRootChroma + sorted[shapeIndex % sorted.length]) % 12;
  const startFret = (startChroma - (lowE % 12) + 12) % 12;
  const inScale = (m: number) =>
    sorted.includes((((m % 12) - focusRootChroma) % 12 + 12) % 12);

  const pitches: number[] = [];
  for (let m = lowE + startFret; pitches.length < notesPerString * tuning.length; m++) {
    if (inScale(m)) pitches.push(m);
  }

  const base: { s: number; f: number }[] = [];
  let p = 0;
  for (let s = tuning.length - 1; s >= 0; s--) {
    for (let n = 0; n < notesPerString; n++) {
      base.push({ s, f: pitches[p++] - tuning[s].midi });
    }
  }

  const instances: { min: number; max: number; shift: number }[] = [];
  for (const shift of [-12, 0, 12]) {
    const frets = base.map((c) => c.f + shift);
    const min = Math.min(...frets);
    const max = Math.max(...frets);
    if (min < 0 || max > fretCount) continue;
    instances.push({ min, max, shift });
  }
  const kept = includeOctaves
    ? instances
    : instances.length
      ? [instances.reduce((a, b) => (a.min <= b.min ? a : b))]
      : [];

  const cells = new Set<string>();
  const ranges: { min: number; max: number }[] = [];
  for (const inst of kept) {
    base.forEach((c) => cells.add(`${c.s}-${c.f + inst.shift}`));
    ranges.push({ min: inst.min, max: inst.max });
  }
  return { cells, ranges };
}

/**
 * Merge overlapping or abutting fret spans into continuous regions so multi-select
 * frames look like one outline at the handoff, not stacked boxes.
 */
export function coalesceShapeRanges(
  ranges: { min: number; max: number }[]
): { min: number; max: number }[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.min - b.min || a.max - b.max);
  const out: { min: number; max: number }[] = [{ min: sorted[0].min, max: sorted[0].max }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.min <= last.max + 1) {
      last.max = Math.max(last.max, cur.max);
    } else {
      out.push({ min: cur.min, max: cur.max });
    }
  }
  return out;
}

/** Merge several shape results (multi-select); frames are coalesced. */
export function mergeShapeResults(parts: ShapeResult[]): ShapeResult {
  const cells = new Set<string>();
  const ranges: { min: number; max: number }[] = [];
  for (const part of parts) {
    part.cells.forEach((c) => cells.add(c));
    ranges.push(...part.ranges);
  }
  return { cells, ranges: coalesceShapeRanges(ranges) };
}


// Triad string sets (indices into STANDARD_STRINGS: 0 = high e ... 5 = low E)
export const TRIAD_STRING_SETS: { label: string; strings: number[] }[] = [
  { label: 'EAD', strings: [5, 4, 3] },
  { label: 'ADG', strings: [4, 3, 2] },
  { label: 'DGB', strings: [3, 2, 1] },
  { label: 'GBe', strings: [2, 1, 0] },
];

export const ARP7_STRING_SETS: { label: string; strings: number[] }[] = [
  { label: 'EADG', strings: [5, 4, 3, 2] },
  { label: 'ADGB', strings: [4, 3, 2, 1] },
  { label: 'DGBe', strings: [3, 2, 1, 0] },
];

/** Neighbouring string sets (3 for triads, 4 for 7th arpeggios), low to high, for any tuning. */
export function stringSetsFor(visType: VisualizationType, tuning: Tuning = STANDARD_STRINGS): { label: string; strings: number[] }[] {
  const size = visType === 'arp7' ? 4 : 3;
  const out: { label: string; strings: number[] }[] = [];
  for (let low = tuning.length - 1; low - size + 1 >= 0; low--) {
    const strings = Array.from({ length: size }, (_, k) => low - k);
    out.push({ label: strings.map((s) => tuning[s].label).join(''), strings });
  }
  return out;
}

export function getShapeLabels(visType: VisualizationType, tuning: Tuning = STANDARD_STRINGS): string[] {
  if (visType === 'triad' || visType === 'arp7') return stringSetsFor(visType, tuning).map((t) => t.label);
  return Array.from({ length: getShapeCount(visType, tuning) }, (_, k) => String(k + 1));
}

/**
 * Name one pentatonic box as <finger><string> (e.g. "1E", "4A").
 * See docs/box-naming.md for the shift-minimising hand-position rules.
 */
export function namePentatonicBox(
  focusRootChroma: number,
  cells: Set<string>,
  range: { min: number; max: number },
  tuning: Tuning = STANDARD_STRINGS
): string {
  const byStr: number[][] = tuning.map(() => []);
  for (const cell of cells) {
    const [s, f] = cell.split('-').map(Number);
    if (f < range.min || f > range.max) continue;
    byStr[s].push(f);
  }
  for (const arr of byStr) arr.sort((a, b) => a - b);

  // Round-trip order: lowest string → highest (frets ascending), then reverse.
  const downNotes: { s: number; f: number }[] = [];
  for (let s = tuning.length - 1; s >= 0; s--) {
    for (const f of byStr[s]) downNotes.push({ s, f });
  }
  if (downNotes.length === 0) return '?';

  // First focus-root appearance scanning low → high strings.
  let rootS = -1;
  let rootF = -1;
  for (let s = tuning.length - 1; s >= 0; s--) {
    for (const f of byStr[s]) {
      const chroma = (((tuning[s].midi + f) % 12) + 12) % 12;
      if (chroma === focusRootChroma) {
        rootS = s;
        rootF = f;
        break;
      }
    }
    if (rootS >= 0) break;
  }
  if (rootS < 0) return '?';

  const allFrets = [...new Set(downNotes.map((n) => n.f))];
  const candidates = new Set<number>();
  for (const f of allFrets) {
    for (let finger = 1; finger <= 4; finger++) candidates.add(f - (finger - 1));
  }

  let bestShifts = Infinity;
  let bestRootFinger = 99;

  for (const startPos of [...candidates].sort((a, b) => a - b)) {
    let pos = startPos;
    let shifts = 0;
    let posAtRoot: number | null = null;

    const step = (f: number) => {
      if (f >= pos && f <= pos + 3) return;
      const next = f < pos ? f : f - 3;
      if (next !== pos) {
        shifts += 1;
        pos = next;
      }
    };

    for (const n of downNotes) {
      step(n.f);
      if (posAtRoot === null && n.s === rootS && n.f === rootF) posAtRoot = pos;
    }
    for (let i = downNotes.length - 1; i >= 0; i--) step(downNotes[i].f);

    if (posAtRoot === null) continue;
    const rootFinger = rootF - posAtRoot + 1;
    if (rootFinger < 1 || rootFinger > 4) continue;
    // Minimise shifts; tie-break: lower finger on the naming root.
    if (shifts < bestShifts || (shifts === bestShifts && rootFinger < bestRootFinger)) {
      bestShifts = shifts;
      bestRootFinger = rootFinger;
    }
  }

  if (bestRootFinger > 4) return '?';
  return `${bestRootFinger}${tuning[rootS].label}`;
}

/** Finger-string names for all five pentatonic CAGED boxes (primary / lowest instance). */
export function getPentatonicBoxNames(
  focusRootChroma: number,
  pentatonicOffsets: number[],
  tuning: Tuning = STANDARD_STRINGS,
  fretCount = 24
): string[] {
  return Array.from({ length: 5 }, (_, k) => {
    const shape = getShapeCells(focusRootChroma, pentatonicOffsets, 2, k, fretCount, tuning, false);
    const range = shape.ranges[0] ?? { min: 0, max: 0 };
    return namePentatonicBox(focusRootChroma, shape.cells, range, tuning);
  });
}


export function getStringSetCells(
  focusRootChroma: number,
  offsets: number[],
  setIndex: number,
  visType: VisualizationType = 'triad',
  fretCount = 24,
  tuning: Tuning = STANDARD_STRINGS
): ShapeResult {
  const set = stringSetsFor(visType, tuning)[setIndex];
  const cells = new Set<string>();
  if (!set) return { cells, ranges: [] };
  for (const s of set.strings) {
    for (let f = 0; f <= fretCount; f++) {
      const chroma = (tuning[s].midi + f) % 12;
      if (offsets.includes((chroma - focusRootChroma + 12) % 12)) cells.add(`${s}-${f}`);
    }
  }
  return { cells, ranges: [] };
}

// ---------- 7th chord grips (common Drop 2 / Drop 3 voicings) ----------
// strings: indices into STANDARD_STRINGS (0 = high e ... 5 = low E)
// role: 0 = root, 1 = 3rd, 2 = 5th, 3 = 7th
export interface ChordGrip {
  label: string;
  rootString: number;
  tones: { string: number; role: number }[];
}

export const CHORD_GRIPS: ChordGrip[] = [
  {
    label: 'Drop 3 · root on E',
    rootString: 5,
    tones: [
      { string: 5, role: 0 },
      { string: 3, role: 3 },
      { string: 2, role: 1 },
      { string: 1, role: 2 },
    ],
  },
  {
    label: 'Drop 2 · root on A',
    rootString: 4,
    tones: [
      { string: 4, role: 0 },
      { string: 3, role: 2 },
      { string: 2, role: 3 },
      { string: 1, role: 1 },
    ],
  },
  {
    label: 'Drop 3 · root on A',
    rootString: 4,
    tones: [
      { string: 4, role: 0 },
      { string: 2, role: 3 },
      { string: 1, role: 1 },
      { string: 0, role: 2 },
    ],
  },
  {
    label: 'Drop 2 · root on D',
    rootString: 3,
    tones: [
      { string: 3, role: 0 },
      { string: 2, role: 2 },
      { string: 1, role: 3 },
      { string: 0, role: 1 },
    ],
  },
];

export function getChordGripCells(
  focusRootChroma: number,
  arp7Offsets: number[],
  gripIndex: number,
  fretCount = 24
): ShapeResult {
  const grip = CHORD_GRIPS[gripIndex];
  const chordTones = [...arp7Offsets].sort((a, b) => a - b);
  const rootOpen = STANDARD_STRINGS[grip.rootString].midi;
  const firstRoot = (focusRootChroma - (rootOpen % 12) + 12) % 12;

  const cells = new Set<string>();
  const ranges: { min: number; max: number }[] = [];
  for (const r of [firstRoot, firstRoot + 12, firstRoot + 24]) {
    const frets: { s: number; f: number }[] = [];
    let ok = true;
    for (const t of grip.tones) {
      const pc = (focusRootChroma + chordTones[t.role]) % 12;
      const open = STANDARD_STRINGS[t.string].midi;
      let best: number | null = null;
      for (let f = r - 5; f <= r + 5; f++) {
        if (f < 0 || f > fretCount) continue;
        if ((open + f) % 12 !== pc) continue;
        if (best === null || Math.abs(f - r) < Math.abs(best - r)) best = f;
      }
      if (best === null) {
        ok = false;
        break;
      }
      frets.push({ s: t.string, f: best });
    }
    if (!ok || r > fretCount) continue;
    const fs = frets.map((x) => x.f);
    frets.forEach((x) => cells.add(`${x.s}-${x.f}`));
    ranges.push({ min: Math.min(...fs), max: Math.max(...fs) });
  }
  return { cells, ranges };
}

// ---------- Extension chord grips (typical chords) ----------
export interface ExtGrip {
  label: string;
  rootString: number;
  tones: { string: number; semi: number }[]; // semi = semitones above root (may exceed 12)
}

const ext = (label: string, rootString: number, tones: [number, number][]): ExtGrip => ({
  label,
  rootString,
  tones: tones.map(([string, semi]) => ({ string, semi })),
});

export const EXTENSION_GRIPS: Record<string, { labels: Record<number, string>; grips: ExtGrip[] }> = {
  maj9: {
    labels: { 0: '1', 4: '3', 7: '5', 11: '7', 2: '9' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 11], [2, 4], [1, 7], [0, 14]]),
      ext('root on A', 4, [[4, 0], [3, 4], [2, 11], [1, 14]]),
    ],
  },
  '6/9': {
    labels: { 0: '1', 4: '3', 7: '5', 9: '6', 2: '9' },
    grips: [
      ext('root on E', 5, [[5, 0], [4, 4], [3, 9], [2, 14], [1, 7], [0, 0]]),
      ext('root on A', 4, [[4, 0], [3, 4], [2, 9], [1, 14], [0, 7]]),
    ],
  },
  m6: {
    labels: { 0: '1', 3: 'b3', 7: '5', 9: '6' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 9], [2, 3], [1, 7]]),
      ext('root on A', 4, [[4, 0], [3, 3], [2, 9], [1, 0]]),
    ],
  },
  m13: {
    labels: { 0: '1', 3: 'b3', 10: 'b7', 9: '13' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 10], [2, 3], [1, 9]]),
      ext('root on A', 4, [[4, 0], [2, 10], [1, 3], [0, 9]]),
    ],
  },
  'm7(b9)': {
    labels: { 0: '1', 1: 'b9', 3: 'b3', 7: '5', 10: 'b7' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 10], [2, 13], [1, 7]]),
      ext('root on A', 4, [[4, 0], [2, 10], [1, 13], [0, 7]]),
    ],
  },
  'maj7(#11)': {
    labels: { 0: '1', 4: '3', 6: '#11', 11: '7' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 11], [2, 4], [1, 6]]),
      ext('root on A', 4, [[4, 0], [3, 6], [2, 11], [1, 4]]),
    ],
  },
  '9': {
    labels: { 0: '1', 4: '3', 7: '5', 10: 'b7', 2: '9' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 10], [2, 4], [1, 7], [0, 14]]),
      ext('root on A', 4, [[4, 0], [3, 4], [2, 10], [1, 14], [0, 7]]),
    ],
  },
  '13': {
    labels: { 0: '1', 4: '3', 10: 'b7', 9: '13' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 10], [2, 4], [1, 9]]),
      ext('root on A', 4, [[4, 0], [2, 10], [1, 4], [0, 9]]),
    ],
  },
  '7sus4': {
    labels: { 0: '1', 5: '4', 7: '5', 10: 'b7' },
    grips: [
      ext('root on E', 5, [[5, 0], [4, 7], [3, 10], [2, 5], [1, 7], [0, 0]]),
      ext('root on A', 4, [[4, 0], [3, 7], [2, 10], [1, 5], [0, 7]]),
    ],
  },
  'm(b6)': {
    labels: { 0: '1', 3: 'b3', 7: '5', 8: 'b6' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 8], [2, 3], [1, 7]]),
      ext('root on A', 4, [[4, 0], [3, 8], [2, 0], [1, 3]]),
    ],
  },
  m9: {
    labels: { 0: '1', 3: 'b3', 7: '5', 10: 'b7', 2: '9' },
    grips: [
      ext('root on E', 5, [[5, 0], [3, 10], [2, 3], [1, 7], [0, 14]]),
      ext('root on A', 4, [[4, 0], [3, 3], [2, 10], [1, 14]]),
    ],
  },
};

export function getExtGripCells(
  focusRootChroma: number,
  grip: ExtGrip,
  fretCount = 24
): ShapeResult {
  const rootOpen = STANDARD_STRINGS[grip.rootString].midi;
  const firstRoot = (focusRootChroma - (rootOpen % 12) + 12) % 12;
  const cells = new Set<string>();
  const ranges: { min: number; max: number }[] = [];
  for (const r of [firstRoot, firstRoot + 12, firstRoot + 24]) {
    if (r > fretCount) continue;
    const frets: { s: number; f: number }[] = [];
    let ok = true;
    for (const t of grip.tones) {
      const pc = (focusRootChroma + t.semi) % 12;
      const open = STANDARD_STRINGS[t.string].midi;
      let best: number | null = null;
      for (let f = r - 4; f <= r + 4; f++) {
        if (f < 0 || f > fretCount) continue;
        if ((open + f) % 12 !== pc) continue;
        if (best === null || Math.abs(f - r) < Math.abs(best - r)) best = f;
      }
      if (best === null) { ok = false; break; }
      frets.push({ s: t.string, f: best });
    }
    if (!ok) continue;
    const fs = frets.map((x) => x.f);
    frets.forEach((x) => cells.add(`${x.s}-${x.f}`));
    ranges.push({ min: Math.min(...fs), max: Math.max(...fs) });
  }
  return { cells, ranges };
}

// ---------- Chord progression builder ----------
export type ProgKind = 'diatonic' | 'borrowed' | 'secondary';

export interface ProgChordDef {
  roman: string; // display numeral, e.g. 'IV', 'bVII', 'III7'
  degreeNum: number; // 1..7, used for correct letter spelling
  semi: number; // semitones from key root
  suffix: string; // base chord suffix
  kind: ProgKind;
  degree?: RomanDegree; // only for diatonic chords
  spiceUps: string[]; // suggested upgrades (suffixes)
  note?: string; // sound + typical use
}

export interface ProgChord {
  roman: string;
  degreeNum: number;
  semi: number;
  suffix: string;
  kind: ProgKind;
  degree?: RomanDegree;
}

export const PROG_DIATONIC: ProgChordDef[] = [
  { roman: 'I', degreeNum: 1, semi: 0, suffix: '', kind: 'diatonic', degree: 'I', spiceUps: ['add9', 'maj7', '6', 'maj9', '6/9', 'sus2'] },
  { roman: 'ii', degreeNum: 2, semi: 2, suffix: 'm', kind: 'diatonic', degree: 'ii', spiceUps: ['m7', 'm9', 'm11', 'm6'] },
  { roman: 'iii', degreeNum: 3, semi: 4, suffix: 'm', kind: 'diatonic', degree: 'iii', spiceUps: ['m7', 'm11', 'msus4'] },
  { roman: 'IV', degreeNum: 4, semi: 5, suffix: '', kind: 'diatonic', degree: 'IV', spiceUps: ['add9', 'maj7', '6', 'maj7#11'] },
  { roman: 'V', degreeNum: 5, semi: 7, suffix: '', kind: 'diatonic', degree: 'V', spiceUps: ['7', 'sus4', '9', '13', '7sus4', 'add9'] },
  { roman: 'vi', degreeNum: 6, semi: 9, suffix: 'm', kind: 'diatonic', degree: 'vi', spiceUps: ['m7', 'madd9', 'm9', 'm11'] },
  { roman: 'vii°', degreeNum: 7, semi: 11, suffix: 'dim', kind: 'diatonic', degree: 'vii°', spiceUps: ['m7b5', 'dim7'] },
];

export const PROG_BORROWED: ProgChordDef[] = [
  { roman: 'iv', degreeNum: 4, semi: 5, suffix: 'm', kind: 'borrowed', spiceUps: ['m6', 'm7'], note: 'Melancholic, wistful. I → IV → iv → I' },
  { roman: 'bVII', degreeNum: 7, semi: 10, suffix: '', kind: 'borrowed', spiceUps: ['maj7', 'add9'], note: 'Rock / Mixolydian, earthy. I → bVII → IV → I' },
  { roman: 'bVI', degreeNum: 6, semi: 8, suffix: '', kind: 'borrowed', spiceUps: ['maj7', 'add9'], note: 'Epic, cinematic. I → bVI → bVII → I' },
  { roman: 'bIII', degreeNum: 3, semi: 3, suffix: '', kind: 'borrowed', spiceUps: ['maj7', 'add9'], note: 'Bluesy rock, raw. I → bIII → IV → I' },
  { roman: 'v', degreeNum: 5, semi: 7, suffix: 'm', kind: 'borrowed', spiceUps: ['m7'], note: 'Soft dominant without leading tone. I → v → IV → I' },
  { roman: 'iiø', degreeNum: 2, semi: 2, suffix: 'm7b5', kind: 'borrowed', spiceUps: [], note: 'Dark pre-dominant from minor. iiø → V7 → I' },
];

export const PROG_SECONDARY: ProgChordDef[] = [
  { roman: 'I7', degreeNum: 1, semi: 0, suffix: '7', kind: 'secondary', spiceUps: ['9', '13'], note: 'Leads into IV, the blues classic. I → I7 → IV' },
  { roman: 'II7', degreeNum: 2, semi: 2, suffix: '7', kind: 'secondary', spiceUps: ['9'], note: 'Leads into V. I → II7 → V' },
  { roman: 'III7', degreeNum: 3, semi: 4, suffix: '7', kind: 'secondary', spiceUps: ['7b9'], note: 'Leads into vi. I → III7 → vi' },
  { roman: 'VI7', degreeNum: 6, semi: 9, suffix: '7', kind: 'secondary', spiceUps: ['9', '7b9'], note: 'Leads into ii. I → VI7 → ii → V' },
];

export const PROG_ALL_DEFS = [...PROG_DIATONIC, ...PROG_BORROWED, ...PROG_SECONDARY];

export function findProgDef(c: ProgChord): ProgChordDef | undefined {
  return PROG_ALL_DEFS.find((d) => d.roman === c.roman && d.kind === c.kind);
}

/** Intervals (semitones above chord root → label) for each chord suffix. */
export const CHORD_FORMULAS: Record<string, Record<number, string>> = {
  '': { 0: '1', 4: '3', 7: '5' },
  m: { 0: '1', 3: 'b3', 7: '5' },
  dim: { 0: '1', 3: 'b3', 6: 'b5' },
  sus2: { 0: '1', 2: '2', 7: '5' },
  sus4: { 0: '1', 5: '4', 7: '5' },
  add9: { 0: '1', 2: '9', 4: '3', 7: '5' },
  '6': { 0: '1', 4: '3', 7: '5', 9: '6' },
  '6/9': { 0: '1', 2: '9', 4: '3', 7: '5', 9: '6' },
  maj7: { 0: '1', 4: '3', 7: '5', 11: '7' },
  maj9: { 0: '1', 2: '9', 4: '3', 7: '5', 11: '7' },
  'maj7#11': { 0: '1', 4: '3', 6: '#11', 7: '5', 11: '7' },
  '7': { 0: '1', 4: '3', 7: '5', 10: 'b7' },
  '9': { 0: '1', 2: '9', 4: '3', 7: '5', 10: 'b7' },
  '13': { 0: '1', 4: '3', 7: '5', 9: '13', 10: 'b7' },
  '7sus4': { 0: '1', 5: '4', 7: '5', 10: 'b7' },
  '7b9': { 0: '1', 1: 'b9', 4: '3', 7: '5', 10: 'b7' },
  m7: { 0: '1', 3: 'b3', 7: '5', 10: 'b7' },
  m9: { 0: '1', 2: '9', 3: 'b3', 7: '5', 10: 'b7' },
  m11: { 0: '1', 3: 'b3', 5: '11', 7: '5', 10: 'b7' },
  m6: { 0: '1', 3: 'b3', 7: '5', 9: '6' },
  madd9: { 0: '1', 2: '9', 3: 'b3', 7: '5' },
  msus4: { 0: '1', 3: 'b3', 5: '4', 7: '5' },
  m7b5: { 0: '1', 3: 'b3', 6: 'b5', 10: 'b7' },
  dim7: { 0: '1', 3: 'b3', 6: 'b5', 9: 'bb7' },
};

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_CHROMA = [0, 2, 4, 5, 7, 9, 11];

/** Spell a chord root by scale-degree letter, e.g. bIII in G → Bb (not A#). */
export function spellDegreeRoot(parentKey: NoteName, degreeNum: number, semi: number): string {
  const keyName = getNoteNameForKey(CHROMATIC_NOTES.indexOf(parentKey), parentKey);
  const keyLetterIdx = LETTERS.indexOf(keyName[0]);
  const letterIdx = (keyLetterIdx + degreeNum - 1) % 7;
  const target = (CHROMATIC_NOTES.indexOf(parentKey) + semi) % 12;
  let diff = (target - LETTER_CHROMA[letterIdx] + 12) % 12;
  if (diff > 6) diff -= 12;
  const acc = diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return LETTERS[letterIdx] + acc;
}

export function progChordName(parentKey: NoteName, c: { degreeNum: number; semi: number; suffix: string }): string {
  return spellDegreeRoot(parentKey, c.degreeNum, c.semi) + c.suffix;
}

// ---------- Solopath: diagonal soloing over a progression ----------
// Target notes per chord, a passing-note source scale, CAGED-anchored
// regions that move diagonally across the neck, and voice-leading pairs.

export type SoloRole = 'primary' | 'secondary' | 'color' | 'passing';
export type SoloDirection = 'up' | 'down';

export interface SoloCell {
  s: number; // string index (0 = high e)
  f: number; // fret
  role: SoloRole;
  semi: number; // semitones above the chord root
  label: string; // interval label relative to the chord root
  name: string; // note name, spelled for this chord
}

/** guide = 7th→3rd or leading tone→root; third = 3rd moves a half step to a chord tone;
 *  chord = other chord tone → chord tone (1–2 semitones); hold = common tone;
 *  scale = chord tone → scale tone; leap = nothing closer fits (fallback). */
export type SoloStepKind = 'guide' | 'third' | 'chord' | 'hold' | 'scale' | 'leap';
export interface SoloTransition {
  from: { s: number; f: number };
  to: { s: number; f: number };
  type: 'hold' | 'resolve';
  fromName: string;
  toName: string;
  kind?: SoloStepKind;
}

export interface SolopathChord {
  index: number;
  name: string;
  roman: string;
  rootChroma: number;
  region: { min: number; max: number }; // overall fret span of the shape
  spans: ({ min: number; max: number } | null)[]; // per string (0 = high e), the shape's fret span
  shapeLabel: string; // e.g. 'A-shape' or 'A-shape + 3nps'
  strings: number[]; // the string group this region covers (0 = high e)
  groupLabel: string; // e.g. 'E–A'
  stepDir: SoloDirection; // fret direction of the step into this region
  colorIndex: number;
  cells: SoloCell[];
  scale: string[]; // passing-note source scale, spelled, from the chord root
  transitions: SoloTransition[]; // into nextIndex
  nextIndex: number; // following chord (wraps to 0 for the last chord)
  wrap: boolean; // true for the last chord (transition loops to the first)
  jump: boolean; // this region was reached by an octave jump
  jumpToNext: boolean; // the move into nextIndex is a jump (or a loop back)
}

export type SoloShapeSystem = 'caged' | '3nps';
export interface SoloShape {
  spans: ({ min: number; max: number } | null)[];
  min: number;
  max: number;
  label: string;
}

export const SOLOPATH_MAX_FRET = 22;
export const SOLOPATH_COLOR_COUNT = 6;
// Muted, low-key region colours: slate-blue, sage, sand, dusty rose, lavender-grey, teal-grey
export const SOLO_PALETTE = ['#7d8fb3', '#8ea58a', '#c4b28c', '#b88c96', '#9b91b8', '#7fa5a3'];
const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, k) => Math.round(v * (1 - t) + y[k] * t).toString(16).padStart(2, '0')).join('');
};
/**
 * Colours of a Solopath note (all notes share one size; only the colour tells the role).
 * target (3rd/7th): the region colour, dark label · root: zinc-200, dark label, ring in the region colour
 * chord tone (5th, extensions): the region colour darkened to a mid tone, light label · passing: zinc-700, light label.
 */
export function soloNoteStyle(role: 'primary' | 'secondary' | 'color' | 'passing', isRoot: boolean, colorIndex: number) {
  const col = SOLO_PALETTE[((colorIndex % SOLO_PALETTE.length) + SOLO_PALETTE.length) % SOLO_PALETTE.length];
  if (role === 'primary') return { fill: col, stroke: mixHex(col, '#ffffff', 0.35), strokeWidth: 1.25, text: '#0c0e12', weight: '700' };
  if (isRoot) return { fill: '#e4e4e7', stroke: col, strokeWidth: 2, text: '#18181b', weight: '700' };
  if (role === 'passing') return { fill: '#3f3f46', stroke: '#52525b', strokeWidth: 1, text: '#e4e4e7', weight: '600' };
  return { fill: mixHex(col, '#18181b', 0.45), stroke: col, strokeWidth: 1.25, text: '#f4f4f5', weight: '600' };
}

const MAJOR_DEG_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_DEG_SEMIS = [0, 2, 3, 5, 7, 8, 10];

const mod12 = (n: number) => ((n % 12) + 12) % 12;
/** Signed shortest distance a → b in semitones (-5..6). */
const signedDist = (a: number, b: number) => {
  const d = mod12(b - a);
  return d > 6 ? d - 12 : d;
};
const intervalNumber = (label: string) => {
  const m = label.match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
};
function spellLetter(letterIdx: number, pc: number): string {
  let diff = mod12(pc - LETTER_CHROMA[letterIdx]);
  if (diff > 6) diff -= 12;
  return LETTERS[letterIdx] + (diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
}
function intervalLabel(letterSteps: number, semi: number): string {
  let diff = semi - MAJOR_DEG_SEMIS[letterSteps];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return (diff < 0 ? 'b'.repeat(-diff) : '#'.repeat(diff)) + (letterSteps + 1);
}

/** Target-note role of each chord tone (semitones above root) for a suffix. */
export function chordToneRoles(suffix: string): Record<number, SoloRole> {
  const f = CHORD_FORMULAS[suffix] ?? CHORD_FORMULAS[''];
  const semis = Object.keys(f).map(Number);
  const has = (x: number) => semis.includes(x);
  const isDim = has(3) && has(6) && !has(7);
  const isSus4 = !has(3) && !has(4) && f[5] === '4';
  const isSus2 = !has(3) && !has(4) && f[2] === '2';
  const roles: Record<number, SoloRole> = {};
  for (const s of semis) {
    let r: SoloRole;
    if (s === 0) r = 'secondary';
    else if (isDim && (s === 3 || s === 6 || s === 9 || s === 10)) r = 'primary';
    else if (s === 7) r = 'secondary';
    else if (s === 3 || s === 4) r = 'primary';
    else if (isSus4 && s === 5) r = 'primary';
    else if (isSus2 && s === 2) r = 'primary';
    else if (s === 10 || s === 11) r = 'primary';
    else if (s === 9 && f[9] === '6') r = 'primary'; // 6 chords: the 6 acts like a 7th
    else r = 'color';
    roles[s] = r;
  }
  return roles;
}

interface SoloTone { pc: number; semi: number; label: string; name: string; role: SoloRole }
interface SoloChordInfo {
  name: string;
  roman: string;
  rootPc: number;
  minorish: boolean;
  quality: 'major' | 'minor' | 'dim';
  scaleSemis: number[]; // source scale, semitones above the chord root
  tones: SoloTone[]; // chord tones (primary/secondary/color)
  passing: SoloTone[];
  scale: string[];
  thirdPc: number | null;
  seventhPc: number | null;
  isDominant: boolean;
}

function soloChordInfo(parentKey: NoteName, c: ProgChord): SoloChordInfo {
  const keyPc = CHROMATIC_NOTES.indexOf(parentKey);
  const keyLetter = LETTERS.indexOf(spellDegreeRoot(parentKey, 1, 0)[0]);
  const rootName = spellDegreeRoot(parentKey, c.degreeNum, c.semi);
  const rootLetter = LETTERS.indexOf(rootName[0]);
  const rootPc = mod12(keyPc + c.semi);
  const formula = CHORD_FORMULAS[c.suffix] ?? CHORD_FORMULAS[''];
  const roles = chordToneRoles(c.suffix);

  // Source scale: parent major, or parallel natural minor for bVI / bIII / iiø.
  const useMinor =
    c.kind === 'borrowed' &&
    (c.roman === 'bVI' || c.roman === 'bIII' || c.roman === 'iiø' || (c.degreeNum === 2 && c.suffix === 'm7b5'));
  const degSemis = useMinor ? MINOR_DEG_SEMIS : MAJOR_DEG_SEMIS;
  const scaleByLetter: number[] = new Array(7);
  for (let i = 0; i < 7; i++) scaleByLetter[(keyLetter + i) % 7] = mod12(keyPc + degSemis[i]);

  // Chord tones override the scale tone with the same letter (G# replaces G over E7).
  const tones: SoloTone[] = [];
  for (const semi of Object.keys(formula).map(Number).sort((a, b) => a - b)) {
    const label = formula[semi];
    const pc = mod12(rootPc + semi);
    const letter = (rootLetter + intervalNumber(label) - 1) % 7;
    scaleByLetter[letter] = pc;
    tones.push({ pc, semi, label, name: spellLetter(letter, pc), role: roles[semi] });
  }
  const tonePcs = new Set(tones.map((t) => t.pc));
  const passing: SoloTone[] = [];
  const scale: string[] = [];
  for (let k = 0; k < 7; k++) {
    const letter = (rootLetter + k) % 7;
    const pc = scaleByLetter[letter];
    const name = spellLetter(letter, pc);
    scale.push(name);
    if (tonePcs.has(pc)) continue;
    const semi = mod12(pc - rootPc);
    passing.push({ pc, semi, label: intervalLabel(k, semi), name, role: 'passing' });
  }
  const sem = (x: number) => (x in formula ? mod12(rootPc + x) : null);
  return {
    name: progChordName(parentKey, c),
    roman: c.roman,
    rootPc,
    minorish: 3 in formula && !(4 in formula),
    quality: 3 in formula && 6 in formula && !(7 in formula) ? 'dim' : 3 in formula && !(4 in formula) ? 'minor' : 'major',
    scaleSemis: [...new Set(scaleByLetter.map((pc) => mod12(pc - rootPc)))].sort((x, y) => x - y),
    tones,
    passing,
    scale,
    thirdPc: sem(4) ?? sem(3),
    seventhPc: sem(10) ?? sem(11),
    isDominant: 4 in formula && 10 in formula,
  };
}

/** Tuning of the Solopath run in progress (computeSolopath sets it; everything is synchronous). */
let T: Tuning = STANDARD_STRINGS;
/** CAGED forms are guitar shapes; other instruments get plain boxes. */
const isGuitarTuning = (t: Tuning) => t.length === 6 && t[0].midi === 64 && t[5].midi === 40;

const CAGED_NAMES = ['E', 'D', 'C', 'A', 'G'];
const PENT_FOR_QUALITY = {
  major: [0, 2, 4, 7, 9], // major pentatonic
  minor: [0, 3, 5, 7, 10], // minor pentatonic
  dim: [0, 3, 5, 7, 10], // dim / m7b5: minor forms; the b5 joins via chord-tone widening
} as const;

/** Split a (possibly multi-octave) ShapeResult into one per-string span set per octave instance. */
function shapeInstances(res: ShapeResult): ({ min: number; max: number } | null)[][] {
  return res.ranges.map((r) => {
    const spans: ({ min: number; max: number } | null)[] = T.map(() => null);
    for (const key of res.cells) {
      const [str, f] = key.split('-').map(Number);
      if (f < r.min || f > r.max) continue;
      const sp = spans[str];
      spans[str] = sp ? { min: Math.min(sp.min, f), max: Math.max(sp.max, f) } : { min: f, max: f };
    }
    return spans;
  });
}

const toShape = (spans: ({ min: number; max: number } | null)[], label: string): SoloShape => {
  const real = spans.filter((x): x is { min: number; max: number } => x !== null);
  return { spans, label, min: Math.min(...real.map((x) => x.min)), max: Math.max(...real.map((x) => x.max)) };
};
const shapeCenter = (sh: { min: number; max: number }) => (sh.min + sh.max) / 2;

/**
 * Candidate shapes of a chord within frets 0..15.
 * CAGED: the chord-quality pentatonic box (2 notes per string) starting on each box tone,
 * which lines up 1:1 with the E/D/C/A/G forms (minor and m7b5 get their minor-form boxes);
 * each string widens by a fret where that adjacent fret holds a chord tone (e.g. the b7 of G7).
 * 3nps: the 7 three-notes-per-string positions of the chord's source scale.
 */
function soloCandidateShapes(info: SoloChordInfo, system: SoloShapeSystem): SoloShape[] {
  const out: SoloShape[] = [];
  const tonePcs = new Set(info.tones.map((t) => t.pc));
  const isTone = (str: number, f: number) => tonePcs.has(mod12(T[str].midi + f));
  if (system === '3nps') {
    for (let k = 0; k < info.scaleSemis.length; k++) {
      const res = getShapeCells(info.rootPc, info.scaleSemis, 3, k, SOLOPATH_MAX_FRET, T);
      for (const spans of shapeInstances(res)) out.push(toShape(spans, `pos ${k + 1}`));
    }
  } else {
    const pent = [...PENT_FOR_QUALITY[info.quality]];
    for (let k = 0; k < pent.length; k++) {
      const res = getShapeCells(info.rootPc, pent, 2, k, SOLOPATH_MAX_FRET, T);
      for (const spans of shapeInstances(res)) {
        const wide = spans.map((sp, str) => {
          if (!sp) return sp;
          const w = { ...sp };
          if (w.min - 1 >= 0 && isTone(str, w.min - 1)) w.min -= 1;
          if (w.max + 1 <= SOLOPATH_MAX_FRET && isTone(str, w.max + 1)) w.max += 1;
          return w;
        });
        out.push(toShape(wide, `${CAGED_NAMES[k]}-shape`));
      }
    }
  }
  const seen = new Set<string>();
  return out
    .filter((sh) => {
      const key = JSON.stringify(sh.spans);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => shapeCenter(x) - shapeCenter(y) || x.min - y.min);
}


function soloShapeCells(info: SoloChordInfo, shape: SoloShape): SoloCell[] {
  const all = [...info.tones, ...info.passing];
  const cells: SoloCell[] = [];
  shape.spans.forEach((sp, s) => {
    if (!sp) return;
    for (let f = sp.min; f <= sp.max; f++) {
      const t = all.find((x) => x.pc === mod12(T[s].midi + f));
      if (t) cells.push({ s, f, role: t.role, semi: t.semi, label: t.label, name: t.name });
    }
  });
  return cells;
}

interface PairCand { fromPc: number; toPc: number; delta: number; type: 'hold' | 'resolve'; prio: number; kind: SoloStepKind }

/**
 * Voice-leading pairs a → b, best first. Moving steps always come before holds:
 *  0   7th falls a half / whole step to the next 3rd
 *  1   leading tone (3rd of a dominant) rises a half step to the next root
 *  2.. any other chord tone moving 1–2 semitones (half steps and guide tones first)
 *  6.. common tone held (only if it is a guide tone on either side), used only when no move fits
 */
function soloPairCandidates(a: SoloChordInfo, b: SoloChordInfo): PairCand[] {
  const out: PairCand[] = [];
  const core = (x: SoloChordInfo) => x.tones.filter((t) => t.role !== 'color');
  if (a.seventhPc !== null && b.thirdPc !== null) {
    const d = signedDist(a.seventhPc, b.thirdPc);
    if (d === -1 || d === -2) out.push({ fromPc: a.seventhPc, toPc: b.thirdPc, delta: d, type: 'resolve', prio: 0, kind: 'guide' });
  }
  if (a.isDominant && a.thirdPc !== null && signedDist(a.thirdPc, b.rootPc) === 1) {
    out.push({ fromPc: a.thirdPc, toPc: b.rootPc, delta: 1, type: 'resolve', prio: 1, kind: 'guide' });
  }
  for (const ta of core(a)) {
    for (const tb of core(b)) {
      const d = signedDist(ta.pc, tb.pc);
      if (Math.abs(d) !== 1 && Math.abs(d) !== 2) continue;
      if (out.some((q) => q.fromPc === ta.pc && q.toPc === tb.pc)) continue;
      // the 3rd moving a half step (3→root, 3→4) is the next-strongest step
      const third = ta.pc === a.thirdPc && Math.abs(d) === 1;
      const prio = third ? 1.5 : 2 + (Math.abs(d) - 1) * 0.5 + (ta.role === 'primary' ? 0 : 0.5) + (tb.role === 'primary' ? 0 : 0.25);
      out.push({ fromPc: ta.pc, toPc: tb.pc, delta: d, type: 'resolve', prio, kind: third ? 'third' : 'chord' });
    }
  }
  // a chord tone stepping into a scale tone of the next chord (e.g. C → B over Am)
  for (const ta of core(a)) {
    if (a.isDominant && ta.pc === a.thirdPc) continue; // the leading tone resolves up, never into a scale tone
    for (const tp of b.passing) {
      const d = signedDist(ta.pc, tp.pc);
      if (Math.abs(d) !== 1 && Math.abs(d) !== 2) continue;
      if (out.some((q) => q.fromPc === ta.pc && q.toPc === tp.pc)) continue;
      out.push({ fromPc: ta.pc, toPc: tp.pc, delta: d, type: 'resolve', prio: 7 + (Math.abs(d) - 1) * 0.5 + (ta.role === 'primary' ? 0 : 0.5), kind: 'scale' });
    }
  }
  for (const ta of core(a)) {
    const tb = core(b).find((t) => t.pc === ta.pc);
    if (!tb || (ta.role !== 'primary' && tb.role !== 'primary')) continue;
    out.push({ fromPc: ta.pc, toPc: tb.pc, delta: 0, type: 'hold', prio: ta.role === 'primary' && tb.role === 'primary' ? 5 : 5.5, kind: 'hold' });
  }
  return out.sort((x, y) => x.prio - y.prio);
}

/** Hard cap on how far a step may move along the neck (frets), same or neighbouring string. */
export const SOLO_STEP_MAX_FRETS = 4;
/** String direction from one region to the next: −1 towards the high e, +1 towards the low E, 0 same group. */
function soloStringDir(ra: SoloShape, rb: SoloShape): number {
  const mean = (sh: SoloShape) => {
    const ss = sh.spans.map((sp, i) => (sp ? i : -1)).filter((i) => i >= 0);
    return ss.length ? ss.reduce((x, y) => x + y, 0) / ss.length : 0;
  };
  return Math.sign(mean(rb) - mean(ra));
}
/**
 * Is a step from (s1,f1) to (s2,f2) a fair move? At most 4 frets along the neck. On the same
 * string it may go at most 2 frets against the path; a string change to the neighbouring
 * string in the path's string direction is a normal position change and may go up to 4 frets back.
 */
function soloStepFits(s1: number, f1: number, s2: number, f2: number, dir: number, sdir: number): boolean {
  if (Math.abs(f2 - f1) > SOLO_STEP_MAX_FRETS || Math.abs(s2 - s1) > 1) return false;
  if (dir === 0) return true;
  const back = -(f2 - f1) * dir;
  if (back <= 2) return true;
  return s2 - s1 !== 0 && s2 - s1 === sdir;
}

function soloTransitions(
  a: SoloChordInfo,
  ra: SoloShape,
  b: SoloChordInfo,
  rb: SoloShape,
  loose: boolean,
  fallback = true,
  dir = 0 // +1 / −1: fret direction of the path; steps against it by more than 2 frets come last
): SoloTransition[] {
  const ov = { min: Math.max(ra.min, rb.min), max: Math.min(ra.max, rb.max) };
  // A note counts as "shared" when it also lies inside the other shape on the same string,
  // and as "at the seam" when it is within zw frets of the other shape on that string.
  const inSpan = (sh: SoloShape, str: number, f: number, w = 0) => {
    const sp = sh.spans[str];
    return sp && f >= sp.min - w && f <= sp.max + w ? 1 : 0;
  };
  const zw = ov.max - ov.min + 1 <= 1 ? 2 : 1;
  const ovMid = ov.min <= ov.max ? (ov.min + ov.max) / 2 : (ra.min + ra.max + rb.min + rb.max) / 4;
  const midi = (s: number, f: number) => T[s].midi + f;
  const result: SoloTransition[] = [];
  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();
  const usedCells = new Set<string>();
  // Pass 1: both notes at the shared boundary (overlap ±1 fret), same or neighbouring string.
  // Pass 2: anywhere in the two regions.
  const ovLen = ov.max - ov.min + 1;
  const allPairs = soloPairCandidates(a, b);
  const sdir = soloStringDir(ra, rb);
  // chord tone → chord tone moves first, then common-tone holds, then steps into a scale tone
  const tiers = [
    allPairs.filter((q) => q.type !== 'hold' && q.kind !== 'scale'),
    allPairs.filter((q) => q.type === 'hold'),
    allPairs.filter((q) => q.kind === 'scale'),
  ];
  for (const pairs of tiers) {
  if (result.length > 0) break;
  for (const zoneOnly of loose ? [false] : [true, false]) {
  // pass 2 fills up when pass 1 found nothing, or a second pair when regions overlap well
  if (!zoneOnly && result.length > 0 && (ovLen < 2 || result.length >= 2)) break;
  for (const p of pairs) {
    if (result.length >= 2) break;
    if (usedFrom.has(p.fromPc) || usedTo.has(p.toPc)) continue;
    let best: { s1: number; f1: number; s2: number; f2: number; score: number[] } | null = null;
    for (const maxStrGap of loose ? [T.length] : zoneOnly ? [1] : [1, 2]) {
    if (best) break;
    for (let s1 = 0; s1 < T.length; s1++) {
      const sp1 = ra.spans[s1];
      if (!sp1) continue;
      for (let f1 = sp1.min; f1 <= sp1.max; f1++) {
        if (mod12(midi(s1, f1)) !== p.fromPc || usedCells.has(`${s1}-${f1}`)) continue;
        for (let s2 = 0; s2 < T.length; s2++) {
          const sp2 = rb.spans[s2];
          if (!sp2) continue;
          for (let f2 = sp2.min; f2 <= sp2.max; f2++) {
            if (mod12(midi(s2, f2)) !== p.toPc || usedCells.has(`${s2}-${f2}`)) continue;
            const move = midi(s2, f2) - midi(s1, f1);
            if (loose ? mod12(move - p.delta) !== 0 : move !== p.delta || Math.abs(s1 - s2) > maxStrGap) continue;
            if (!loose && !soloStepFits(s1, f1, s2, f2, dir, sdir)) continue;
            // holds / 7th→3rd / leading tone may sit a little off the seam (hand span ≤ 4 frets)
            const z1 = inSpan(rb, s1, f1, zw);
            const z2 = inSpan(ra, s2, f2, zw);
            if (zoneOnly && !(z1 && z2) && !(p.prio < 2 && Math.abs(f1 - f2) <= 4)) continue;
            // more inside the overlap, same string, short hand move, near the overlap centre, middle strings
            const score = [
              s1 === s2 ? 0 : 1, // a step on the shared string first, a string change second
              -(z1 + z2),
              -(inSpan(rb, s1, f1) + inSpan(ra, s2, f2)),
              Math.abs(s1 - s2),
              Math.abs(f1 - f2),
              Math.abs((f1 + f2) / 2 - ovMid),
              Math.abs(s1 - (T.length - 1) / 2),
            ];
            if (!best || cmpScore(score, best.score) < 0) {
              best = { s1, f1, s2, f2, score };
            }
          }
        }
      }
    }
    }
    if (!best) continue;
    usedFrom.add(p.fromPc);
    usedTo.add(p.toPc);
    usedCells.add(`${best.s1}-${best.f1}`);
    usedCells.add(`${best.s2}-${best.f2}`);
    const nameOf = (x: SoloChordInfo, pc: number) =>
      [...x.tones, ...x.passing].find((t) => t.pc === pc)?.name ?? getNoteNameForKey(pc, 'C');
    result.push({
      from: { s: best.s1, f: best.f1 },
      to: { s: best.s2, f: best.f2 },
      type: p.type,
      fromName: nameOf(a, p.fromPc),
      toName: nameOf(b, p.toPc),
      kind: p.kind,
    });
  }
  }
  }
  if (result.length === 0 && fallback && !loose) {
    // No voice-leading rule fits between these string groups: step from the nearest
    // chord tone to the nearest chord tone (same or neighbouring string).
    const toneA = new Map(a.tones.map((t) => [t.pc, t]));
    const toneB = new Map(b.tones.map((t) => [t.pc, t]));
    let best: { s1: number; f1: number; s2: number; f2: number; score: number[] } | null = null;
    ra.spans.forEach((sp1, s1) => {
      if (!sp1) return;
      for (let f1 = sp1.min; f1 <= sp1.max; f1++) {
        if (!toneA.has(mod12(midi(s1, f1)))) continue;
        rb.spans.forEach((sp2, s2) => {
          if (!sp2 || Math.abs(s1 - s2) > 1) return;
          for (let f2 = sp2.min; f2 <= sp2.max; f2++) {
            if (!toneB.has(mod12(midi(s2, f2)))) continue;
            if (!soloStepFits(s1, f1, s2, f2, dir, sdir)) continue;
            const score = [Math.abs(midi(s2, f2) - midi(s1, f1)), Math.abs(f1 - f2), Math.abs(s1 - s2)];
            if (!best || cmpScore(score, best.score) < 0) best = { s1, f1, s2, f2, score };
          }
        });
      }
    });
    const bb = best as { s1: number; f1: number; s2: number; f2: number; score: number[] } | null;
    if (bb) {
      const fa = toneA.get(mod12(midi(bb.s1, bb.f1)))!;
      const fb = toneB.get(mod12(midi(bb.s2, bb.f2)))!;
      result.push({
        from: { s: bb.s1, f: bb.f1 },
        to: { s: bb.s2, f: bb.f2 },
        type: midi(bb.s1, bb.f1) === midi(bb.s2, bb.f2) ? 'hold' : 'resolve',
        fromName: fa.name,
        toName: fb.name,
        kind: bb.score[0] === 0 ? 'hold' : bb.score[0] <= 2 ? 'chord' : 'leap',
      });
    }
  }
  return result;
}

function cmpScore(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Solopath: one region per progression chord, moving diagonally up or down the
 * neck (frets 0..15) with ~2-3 fret shifts, plus target / passing notes and
 * voice-leading pairs into the next chord.
 */
/**
 * John's staircase table (upward, string 5 = low E … 0 = high e); downward mirrors it.
 * The number of chords in a pass picks the row; at most 5 chords per pass.
 */
const SOLO_GROUP_TABLE: Record<number, number[][]> = {
  1: [[5, 4]],
  2: [[5, 4, 3], [2, 1, 0]],
  3: [[5, 4, 3], [3, 2], [2, 1, 0]],
  4: [[5, 4], [4, 3], [3, 2], [2, 1, 0]],
  5: [[5, 4], [4, 3], [3, 2], [2, 1], [1, 0]],
};
/**
 * The same staircase on a 4-string bass (string 3 = low E … 0 = G): string pairs climbing
 * E–A → A–D → D–G; with more chords than pairs the middle / end pairs repeat (the fret window
 * still moves on, so it stays a staircase).
 */
const SOLO_GROUP_TABLE_4: Record<number, number[][]> = {
  1: [[3, 2]],
  2: [[3, 2], [1, 0]],
  3: [[3, 2], [2, 1], [1, 0]],
  4: [[3, 2], [2, 1], [2, 1], [1, 0]],
  5: [[3, 2], [3, 2], [2, 1], [1, 0], [1, 0]],
};
/** Any other string count: pairs of neighbouring strings spread evenly from the lowest to the highest. */
function soloGroupRow(len: number, strings: number): number[][] {
  if (strings === 6) return SOLO_GROUP_TABLE[len];
  if (strings === 4) return SOLO_GROUP_TABLE_4[len];
  const pairs = Math.max(1, strings - 1);
  return Array.from({ length: len }, (_, k) => {
    const low = strings - 1 - (len <= 1 ? 0 : Math.round((k * (pairs - 1)) / (len - 1)));
    return strings === 1 ? [0] : [low, low - 1];
  });
}
const groupLabelOf = (strings: number[]) =>
  [...strings].sort((x, y) => y - x).map((st) => T[st]?.label ?? '?').join('–');

/** Chords per pass: one pass up to 5, 6–10 split in half (up, then back), longer runs in passes of ≤ 5. */
function soloPasses(count: number): number[] {
  const out: number[] = [];
  let left = count;
  while (left > 10) {
    out.push(5);
    left -= 5;
  }
  if (left > 5) out.push(Math.ceil(left / 2), Math.floor(left / 2));
  else if (left > 0) out.push(left);
  return out;
}

/**
 * String group and fret direction per chord. Each pass follows the table row for its
 * length; passes alternate direction (zigzag), the return pass mirrored.
 */
export function soloGroupSequence(
  count: number,
  direction: SoloDirection,
  tuning: Tuning = T
): { strings: number[]; label: string; stepDir: SoloDirection; pass: number }[] {
  const out: { strings: number[]; label: string; stepDir: SoloDirection; pass: number }[] = [];
  const prev = T;
  T = tuning;
  try {
    const top = tuning.length - 1;
    soloPasses(count).forEach((len, pass) => {
      const dir: SoloDirection = pass % 2 === 0 ? direction : direction === 'up' ? 'down' : 'up';
      for (const g of soloGroupRow(len, tuning.length)) {
        const strings = dir === 'up' ? g : g.map((st) => top - st);
        out.push({ strings, label: groupLabelOf(strings), stepDir: dir, pass });
      }
    });
  } finally {
    T = prev;
  }
  return out;
}

/** A shape cut down to a string group; null if a string of the group has no notes. */
function restrictShape(sh: SoloShape, strings: number[]): SoloShape | null {
  const spans: SoloShape['spans'] = sh.spans.map((sp, s) => (strings.includes(s) ? sp : null));
  if (strings.some((s) => !spans[s])) return null;
  return toShape(spans, sh.label);
}
const uniqShapes = (list: SoloShape[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = JSON.stringify(x.spans);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
/** If a cut-down shape lost its guide tones, reach up to 2 frets on one string for the nearest one. */
function reachPrimary(info: SoloChordInfo, sh: SoloShape): SoloShape {
  const prim = new Set(info.tones.filter((t) => t.role === 'primary').map((t) => t.pc));
  if (prim.size === 0) return sh;
  const pcAt = (s: number, f: number) => mod12(T[s].midi + f);
  const has = sh.spans.some((sp, s) => {
    if (!sp) return false;
    for (let f = sp.min; f <= sp.max; f++) if (prim.has(pcAt(s, f))) return true;
    return false;
  });
  if (has) return sh;
  for (const d of [1, 2]) {
    for (let s = 0; s < sh.spans.length; s++) {
      const sp = sh.spans[s];
      if (!sp) continue;
      for (const f of [sp.max + d, sp.min - d]) {
        if (f < 0 || f > SOLOPATH_MAX_FRET || !prim.has(pcAt(s, f))) continue;
        const spans = sh.spans.map((x, i) => (i === s && x ? { min: Math.min(x.min, f), max: Math.max(x.max, f) } : x));
        return toShape(spans, sh.label);
      }
    }
  }
  return sh;
}
function soloGroupCandidates(info: SoloChordInfo, strings: number[], system: SoloShapeSystem): SoloShape[] {
  return uniqShapes(
    soloCandidateShapes(info, system)
      .map((sh) => restrictShape(sh, strings))
      .filter((x): x is SoloShape => x !== null)
      .map((sh) => (system === 'caged' ? reachPrimary(info, sh) : sh))
  ).sort((x, y) => shapeCenter(x) - shapeCenter(y) || x.min - y.min);
}

export interface SolopathOptions {
  /** Fret where the first region's window begins (clamped to solopathStartRange). */
  startFret?: number;
  /** Per region (by progression index): manual box changes, hard constraints for the planner. */
  overrides?: (SoloRegionOverride | null | undefined)[];
  /** Strings of the instrument (default: 6-string guitar). */
  tuning?: Tuning;
}

/**
 * A manual change to one Solopath box. All values are absolute, so they follow the chord when the
 * progression is reordered.
 * str + n: the box's strings (top string, 0 = high e, and how many);
 * frets: the box's width in frets (1–SOLO_MAX_BOX_FRETS);
 * fret: a dragged box's first fret (it then stays exactly there).
 */
export interface SoloRegionOverride {
  str?: number;
  n?: number;
  frets?: number;
  fret?: number;
}
export const SOLO_MAX_BOX_FRETS = 7;
/** A dragged box may go anywhere on the neck (frets 0–24). */
export const SOLO_NECK_MAX_FRET = 24;

/** True when the box has been dragged to a fixed place. */
export const soloIsPinned = (ov: SoloRegionOverride | null | undefined): boolean => !!ov && typeof ov.fret === 'number' && typeof ov.str === 'number';

/** Keep a box on the neck: frets 0–24, strings 0…strings−1, with its width and string count. */
export function clampSoloPin(fret: number, str: number, w: number, n: number, strings = 6): { fret: number; str: number } {
  const ww = Math.max(1, Math.min(SOLO_MAX_BOX_FRETS, Math.round(w)));
  const nn = Math.max(1, Math.min(strings, Math.round(n)));
  return {
    fret: Math.max(0, Math.min(SOLO_NECK_MAX_FRET - ww + 1, Math.round(fret))),
    str: Math.max(0, Math.min(strings - nn, Math.round(str))),
  };
}

/** Overrides after dropping box i at pos: pinned there, with its strings and width as they were. */
export function soloPinOverrides(
  ovs: (SoloRegionOverride | null | undefined)[],
  i: number,
  pos: { fret: number; str: number; w: number; n: number },
  count: number,
  strings = 6
): (SoloRegionOverride | null)[] {
  const out = Array.from({ length: Math.max(count, i + 1) }, (_, k) => (ovs[k] ? { ...ovs[k]! } : null));
  out[i] = { ...(out[i] ?? {}), fret: pos.fret, str: pos.str, n: pos.n, frets: pos.w };
  return sanitizeSoloOverrides(out, count, strings);
}

/** Pointer movement (px) below which a press on a box is a tap, not a drag. */
export const SOLO_DRAG_THRESHOLD = 6;
export const soloIsDrag = (dx: number, dy: number, threshold = SOLO_DRAG_THRESHOLD): boolean => Math.hypot(dx, dy) >= threshold;

/** Snap a drag: whole frets horizontally, whole strings vertically, clamped to the neck. */
export function soloDragSnap(
  start: { fret: number; str: number; w: number; n: number },
  dx: number,
  dy: number,
  fretPx: number,
  stringPx: number,
  strings = 6
): { fret: number; str: number } {
  return clampSoloPin(start.fret + Math.round(dx / fretPx), start.str + Math.round(dy / stringPx), start.w, start.n, strings);
}

/**
 * Clean up stored override data: integers in range, anything else dropped. Older data is
 * migrated where it still means the same (w → frets); relative string changes (top/bot) and
 * the old overlap setting are dropped.
 */
export function sanitizeSoloOverrides(v: unknown, count = 16, strings = 6): (SoloRegionOverride | null)[] {
  if (!Array.isArray(v)) return [];
  const int = (x: unknown, lo: number, hi: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : undefined;
  return v.slice(0, count).map((o) => {
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    const out: SoloRegionOverride = {};
    const n = int(r.n, 1, strings);
    const str = int(r.str, 0, strings - 1);
    const fret = int(r.fret, 0, SOLO_NECK_MAX_FRET);
    const frets = int(r.frets ?? r.w, 1, SOLO_MAX_BOX_FRETS);
    if (str !== undefined && n !== undefined) {
      out.str = Math.min(str, strings - n);
      out.n = n;
    } else if (str !== undefined && fret !== undefined) out.str = str; // old dragged box: count from the table
    const pin = fret !== undefined && str !== undefined; // a dragged box needs its place and strings
    if (frets !== undefined && (pin || r.frets !== undefined)) out.frets = frets;
    if (pin) {
      out.frets = frets ?? SOLO_WINDOW;
      out.fret = Math.min(fret!, SOLO_NECK_MAX_FRET - out.frets + 1);
    }
    return Object.keys(out).length ? out : null;
  });
}

/** The strings of a box after its override (absolute top string + count), else the table's group. */
export function soloOverrideStrings(base: number[], ov: SoloRegionOverride | null | undefined, strings = 6): number[] {
  if (!ov || ov.str === undefined) return base;
  const n = Math.max(1, Math.min(strings, ov.n ?? base.length));
  const top = Math.max(0, Math.min(strings - n, ov.str));
  const out: number[] = [];
  for (let st = top + n - 1; st >= top; st--) out.push(st); // low string first, like the table
  return base.length > 1 && base[0] < base[base.length - 1] ? out.reverse() : out;
}

/**
 * Which way a box grows when it gets more frets: the way the path goes on to the next box
 * (the last box: the way its own pass goes). 1 = toward higher frets.
 */
export function soloGrowDir(stepDirs: SoloDirection[], i: number): 1 | -1 {
  const d = i < stepDirs.length - 1 ? stepDirs[i + 1] : stepDirs[i];
  return d === 'down' ? -1 : 1;
}

/** A box resized from its start side: upward it keeps its first fret, downward its last. */
export function soloResize(region: { min: number; max: number }, frets: number, grow: 1 | -1): { min: number; max: number } {
  const w = Math.max(1, Math.min(SOLO_MAX_BOX_FRETS, Math.round(frets)));
  let min = grow > 0 ? region.min : region.max - w + 1;
  min = Math.max(0, Math.min(SOLO_NECK_MAX_FRET - w + 1, min));
  return { min, max: min + w - 1 };
}

/** Width of a region's fret window (frets lo..lo+3). */
const SOLO_WINDOW = 4;

/** Frets the window moves per chord inside a pass: spread evenly, total span about 8–10 frets. */
const soloStepFrets = (passLen: number) => (passLen <= 1 ? 0 : Math.min(3, Math.max(1.5, 6 / (passLen - 1))));

/** Window offsets (lo − start) per chord: diagonal inside each pass, zigzag across passes. */
function soloWindowOffsets(count: number, direction: SoloDirection): number[] {
  const seq = soloGroupSequence(count, direction);
  const passLen = new Map<number, number>();
  for (const g of seq) passLen.set(g.pass, (passLen.get(g.pass) ?? 0) + 1);
  const out: number[] = [];
  let pos = 0;
  seq.forEach((g, i) => {
    if (i > 0) pos += (g.stepDir === 'up' ? 1 : -1) * soloStepFrets(passLen.get(g.pass) ?? 1);
    out.push(Math.round(pos));
  });
  return out;
}

/** Allowed start frets so every window stays on the neck (0 … SOLOPATH_MAX_FRET). */
export function solopathStartRange(count: number, direction: SoloDirection): { min: number; max: number; defaultFret: number } {
  const offs = soloWindowOffsets(Math.max(1, count), direction);
  const min = Math.max(0, -Math.min(...offs));
  const max = Math.max(min, SOLOPATH_MAX_FRET - (SOLO_WINDOW - 1) - Math.max(...offs));
  return { min, max, defaultFret: direction === 'up' ? min : Math.min(max, 12) };
}

/** The fret windows of the whole path for a start fret (after clamping). */
export function solopathWindows(count: number, direction: SoloDirection, startFret: number): { lo: number; hi: number }[] {
  const r = solopathStartRange(count, direction);
  const st = Math.min(r.max, Math.max(r.min, Math.round(startFret)));
  return soloWindowOffsets(count, direction).map((o) => ({ lo: st + o, hi: st + o + SOLO_WINDOW - 1 }));
}

/** A plain rectangle: the string group × frets lo..hi. */
function rectShape(strings: number[], lo: number, hi: number, label: string): SoloShape {
  return toShape(T.map((_, s) => (strings.includes(s) ? { min: lo, max: hi } : null)), label);
}

/** Name of the CAGED form that covers most of a rectangle ('scale' if none covers half of it). */
function soloAnchorLabel(info: SoloChordInfo, strings: number[], lo: number, hi: number): string {
  let best = { label: 'scale', cover: 0.5 };
  if (!isGuitarTuning(T)) return best.label;
  for (const sh of soloGroupCandidates(info, strings, 'caged')) {
    let n = 0;
    for (const s of strings) {
      const sp = sh.spans[s]!;
      n += Math.max(0, Math.min(sp.max, hi) - Math.max(sp.min, lo) + 1);
    }
    const cover = n / (strings.length * (hi - lo + 1));
    if (cover > best.cover) best = { label: sh.label, cover };
  }
  return best.label;
}

/** Max frets two neighbouring regions may share. */
const SOLO_MAX_OVERLAP = 2;
/** How far a region may slide off its Start window to find a better step. */
const SOLO_MAX_SHIFT = 2;

/** Cost of the best step between two regions: guide-tone steps first, scale-tone steps last. */
function soloStepCost(trs: SoloTransition[], dir: number): number {
  if (trs.length === 0) return 12;
  const rank: Record<SoloStepKind, number> = { guide: 0, third: 0.8, chord: 1.6, hold: 5, scale: 7, leap: 10 };
  const best = Math.min(...trs.map((t) => rank[t.kind ?? 'chord']));
  // a string change costs a little, so a plain shared-string step wins when it is equally good
  const cross = trs.every((t) => rank[t.kind ?? 'chord'] > best || t.from.s !== t.to.s) ? 0.3 : 0;
  void dir;
  return best + cross;
}

/**
 * Solopath as a staircase. The Start fret fixes a fret window for every chord: diagonal
 * inside a pass (about 2–3 frets per chord) and zigzag across passes, so the whole path
 * moves with Start. Every region is a plain rectangle (string group × about 4 frets).
 * The step between neighbours comes first: a region may slide up to two frets off its
 * window when that gives a real guide-tone step (7→3, leading tone→root, a half-step 3rd,
 * any chord tone → chord tone). Neighbours share at most two frets and keep moving in the
 * path direction. A beam search over the whole route picks the positions.
 */
export function computeSolopath(
  parentKey: NoteName,
  progression: ProgChord[],
  direction: SoloDirection,
  options: SolopathOptions = {}
): SolopathChord[] {
  const prev = T;
  T = options.tuning && options.tuning.length > 0 ? options.tuning : STANDARD_STRINGS;
  try {
    return computeSolopathIn(parentKey, progression, direction, options);
  } finally {
    T = prev;
  }
}

function computeSolopathIn(
  parentKey: NoteName,
  progression: ProgChord[],
  direction: SoloDirection,
  options: SolopathOptions
): SolopathChord[] {
  if (!progression || progression.length === 0) return [];
  const infos = progression.map((c) => soloChordInfo(parentKey, c));
  const ovs = sanitizeSoloOverrides(options.overrides ?? [], infos.length, T.length);
  const seq = soloGroupSequence(infos.length, direction, T).map((g, i) => {
    const strings = soloOverrideStrings(g.strings, ovs[i], T.length);
    return strings === g.strings ? g : { ...g, strings, label: groupLabelOf(strings) };
  });
  // boxes with a fixed place: dragged ones exactly where they were put; boxes with a manual
  // width where the planner put them (without those changes), resized from their start side
  const resized = (i: number) => !soloIsPinned(ovs[i]) && ovs[i]?.frets !== undefined;
  const anyFixed = infos.some((_, i) => soloIsPinned(ovs[i]) || resized(i));
  const planned = anyFixed
    ? computeSolopathIn(parentKey, progression, direction, {
        ...options,
        // the plan before the drags: string changes of boxes not dragged only
        overrides: ovs.map((o) => (o && o.str !== undefined && !soloIsPinned(o) ? { str: o.str, n: o.n } : null)),
      })
    : null;
  const stepDirs = seq.map((g) => g.stepDir);
  const fixedAt = (i: number): { min: number; max: number } | null => {
    const o = ovs[i];
    if (o && soloIsPinned(o)) return { min: o.fret!, max: o.fret! + (o.frets ?? SOLO_WINDOW) - 1 };
    if (o && resized(i) && planned) return soloResize(planned[i].region, o.frets!, soloGrowDir(stepDirs, i));
    return null;
  };
  const fixed = infos.map((_, i) => fixedAt(i));
  const pinned = (i: number) => fixed[i] !== null;
  const range = solopathStartRange(infos.length, direction);
  const wins = solopathWindows(infos.length, direction, options.startFret ?? range.defaultFret);
  const hasPrimary = (info: SoloChordInfo, c: SoloShape) => soloShapeCells(info, c).some((x) => x.role === 'primary');

  type Cand = { c: SoloShape; base: number };
  const candsAll: Cand[][] = infos.map((info, i) => {
    const out: Cand[] = [];
    const strings = seq[i].strings;
    const fx = fixed[i];
    if (fx) return [{ c: rectShape(strings, fx.min, fx.max, ''), base: 0 }];
    const nearPin = (i > 0 && pinned(i - 1)) || (i < infos.length - 1 && pinned(i + 1));
    const plan = planned ? planned[i].region : null;
    const widths = [SOLO_WINDOW, SOLO_WINDOW + 1];
    // next to a fixed box a box may slide further, so the path stays valid
    const shift = nearPin ? SOLO_MAX_SHIFT + 4 : SOLO_MAX_SHIFT;
    for (const w of widths) {
      for (let d = -shift; d <= shift; d++) {
        if (i === 0 && d !== 0) continue; // the first region begins at the Start fret
        const lo = wins[i].lo + d;
        const hi = lo + w - 1;
        if (lo < 0 || hi > SOLOPATH_MAX_FRET) continue;
        const c = rectShape(strings, lo, hi, '');
        // with pins: moving off the position planned without them costs more than any step gain
        const keep = plan ? 4 * (Math.abs(lo - plan.min) + Math.abs(hi - plan.max)) : 0;
        out.push({ c, base: Math.abs(d) + (w > SOLO_WINDOW ? 0.7 * (w - SOLO_WINDOW) : 0) + (hasPrimary(info, c) ? 0 : 6) + keep });
      }
    }
    return out.sort((x, y) => x.base - y.base);
  });

  // exact dynamic programme: the cost only depends on neighbouring regions
  type Node = { cost: number; prev: number };
  let dp: Node[] = candsAll[0].map((x) => ({ cost: x.base, prev: -1 }));
  const back: Node[][] = [dp];
  for (let i = 1; i < infos.length; i++) {
    const sign = seq[i].stepDir === 'up' ? 1 : -1;
    const cur: Node[] = candsAll[i].map(() => ({ cost: Infinity, prev: -1 }));
    candsAll[i - 1].forEach(({ c: prev }, pj) => {
      if (!isFinite(dp[pj].cost)) return;
      candsAll[i].forEach(({ c, base }, cj) => {
        const overlap = Math.min(c.max, prev.max) - Math.max(c.min, prev.min) + 1;
        const moves = sign * (c.min - prev.min) >= 1 && sign * (c.max - prev.max) >= 1;
        // neck end: more overlap, then standing still, only when nothing else fits
        const relax = !moves ? 2 : overlap > SOLO_MAX_OVERLAP ? 1 : 0;
        const trs = soloTransitions(infos[i - 1], prev, infos[i], c, false, false, sign);
        const cost = dp[pj].cost + base + soloStepCost(trs, sign) + relax * 20;
        if (cost < cur[cj].cost) cur[cj] = { cost, prev: pj };
      });
    });
    dp = cur;
    back.push(cur);
  }
  let k = dp.reduce((bi, x, j) => (x.cost < dp[bi].cost ? j : bi), 0);
  const picked: SoloShape[] = [];
  for (let i = infos.length - 1; i >= 0; i--) {
    picked.unshift(candsAll[i][k].c);
    k = back[i][k].prev;
  }
  const shapes = picked.map((sh, i) => rectShape(seq[i].strings, sh.min, sh.max, soloAnchorLabel(infos[i], seq[i].strings, sh.min, sh.max)));
  const jumps = shapes.map(() => false);
  const centerOf = (sh: SoloShape) => (sh.min + sh.max) / 2;

  return infos.map((info, i) => {
    const last = i === infos.length - 1;
    const next = last ? 0 : i + 1;
    // the loop back to the start is a jump unless the path ends near where it began
    let jumpToNext = (last && Math.abs(centerOf(shapes[i]) - centerOf(shapes[0])) > 6) || jumps[next];
    // a near loop that still finds no step inside both regions becomes a jump as well
    if (last && !jumpToNext && infos.length > 1 && soloTransitions(info, shapes[i], infos[next], shapes[next], false, false, 0).length === 0) jumpToNext = true;
    const nextDir = seq[next].stepDir === 'up' ? 1 : -1;
    return {
      index: i,
      name: info.name,
      roman: info.roman,
      rootChroma: info.rootPc,
      region: { min: shapes[i].min, max: shapes[i].max },
      spans: shapes[i].spans,
      shapeLabel: shapes[i].label,
      strings: seq[i].strings,
      groupLabel: seq[i].label,
      stepDir: seq[i].stepDir,
      colorIndex: i % SOLOPATH_COLOR_COUNT,
      cells: soloShapeCells(info, shapes[i]),
      scale: info.scale,
      transitions: infos.length > 1 ? soloTransitions(info, shapes[i], infos[next], shapes[next], jumpToNext, true, last ? 0 : nextDir) : [],
      nextIndex: next,
      wrap: last,
      jump: jumps[i],
      jumpToNext,
    };
  });
}
