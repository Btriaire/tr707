// Moteur de synthèse pour le TR-707 virtuel — le vrai 707 lit des samples PCM
// 12-bit, on ne peut pas les reproduire ; on les APPROCHE par synthèse Web
// Audio avec les recettes classiques des clones 808/909 (sinus+pitch-envelope
// pour les graves, bruit filtré pour les percus claires, oscillateurs carrés
// désaccordés pour les métalliques).

export type InstrumentId =
  | "bd1" | "bd2" | "sd1" | "sd2" | "lt" | "mt" | "ht"
  | "rim" | "cowbell" | "clap" | "tamb"
  | "hhClosed" | "hhOpen" | "crash" | "ride";

export type FaderId = "ac" | "bd" | "sd" | "lt" | "mt" | "ht" | "rimcow" | "hcptamb" | "hh" | "crash" | "ride";

export interface InstrumentDef {
  id: InstrumentId;
  name: string;
  short: string;
  fader: FaderId;
  padCols: number; // largeur du pad dans la rangée bas (pour BD/SD qui ont 2 variantes)
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: "bd1", name: "Bass Drum 1", short: "BD 1", fader: "bd", padCols: 1 },
  { id: "bd2", name: "Bass Drum 2", short: "BD 2", fader: "bd", padCols: 1 },
  { id: "sd1", name: "Snare Drum 1", short: "SD 1", fader: "sd", padCols: 1 },
  { id: "sd2", name: "Snare Drum 2", short: "SD 2", fader: "sd", padCols: 1 },
  { id: "lt", name: "Low Tom", short: "LT", fader: "lt", padCols: 1 },
  { id: "mt", name: "Mid Tom", short: "MT", fader: "mt", padCols: 1 },
  { id: "ht", name: "Hi Tom", short: "HT", fader: "ht", padCols: 1 },
  { id: "rim", name: "Rim Shot", short: "RIM", fader: "rimcow", padCols: 1 },
  { id: "cowbell", name: "Cowbell", short: "COW", fader: "rimcow", padCols: 1 },
  { id: "clap", name: "Hand Clap", short: "HCP", fader: "hcptamb", padCols: 1 },
  { id: "tamb", name: "Tambourine", short: "TAMB", fader: "hcptamb", padCols: 1 },
  { id: "hhClosed", name: "Hi-Hat Closed", short: "CH", fader: "hh", padCols: 1 },
  { id: "hhOpen", name: "Hi-Hat Open", short: "OH", fader: "hh", padCols: 1 },
  { id: "crash", name: "Crash Cymbal", short: "CRASH", fader: "crash", padCols: 1 },
  { id: "ride", name: "Ride Cymbal", short: "RIDE", fader: "ride", padCols: 1 },
];

export const FADER_IDS: FaderId[] = ["ac", "bd", "sd", "lt", "mt", "ht", "rimcow", "hcptamb", "hh", "crash", "ride"];
export const FADER_LABELS: Record<FaderId, string> = {
  ac: "AC",
  bd: "BD",
  sd: "SD",
  lt: "LT",
  mt: "MT",
  ht: "HT",
  rimcow: "RIM/COW",
  hcptamb: "HCP/TAMB",
  hh: "HH",
  crash: "CRASH",
  ride: "RIDE",
};

// mapping General MIDI percussion -> voix du kit, pour le bouton MIDI
export const MIDI_NOTE_MAP: Record<number, InstrumentId> = {
  35: "bd2", 36: "bd1",
  37: "rim", 38: "sd1", 40: "sd2",
  39: "clap",
  41: "lt", 43: "lt",
  45: "mt", 47: "mt",
  48: "ht", 50: "ht",
  42: "hhClosed", 44: "hhClosed",
  46: "hhOpen",
  49: "crash", 57: "crash",
  51: "ride", 59: "ride",
  54: "tamb",
  56: "cowbell",
};

export const NUM_STEPS = 16;
export const NUM_PATTERNS = 8; // A..H
export const BANK_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export interface Pattern {
  name: string;
  tempo: number;
  length: number;
  steps: Record<InstrumentId, boolean[]>;
  accent: boolean[];
}

function emptySteps(): Record<InstrumentId, boolean[]> {
  const o = {} as Record<InstrumentId, boolean[]>;
  for (const inst of INSTRUMENTS) o[inst.id] = Array(NUM_STEPS).fill(false);
  return o;
}

export function defaultPattern(name = "Init", tempo = 120): Pattern {
  return { name, tempo, length: 16, steps: emptySteps(), accent: Array(NUM_STEPS).fill(false) };
}

// pattern de démo — un groove 80s pop basique
export function demoPattern(): Pattern {
  const p = defaultPattern("80s Pop 1", 120);
  const on = (inst: InstrumentId, ...idx: number[]) => idx.forEach((i) => (p.steps[inst][i] = true));
  on("bd1", 0, 8);
  on("bd2", 10);
  on("sd1", 4, 12);
  on("hhClosed", 0, 2, 4, 6, 8, 10, 12, 14);
  on("hhOpen", 15);
  on("clap", 4, 12);
  p.accent[0] = true;
  p.accent[4] = true;
  p.accent[12] = true;
  return p;
}

export function randomPattern(length = 16): Pattern {
  const p = defaultPattern("Random", 120);
  p.length = length;
  const density: Partial<Record<InstrumentId, number>> = {
    bd1: 0.28, bd2: 0.08, sd1: 0.18, sd2: 0.05, hhClosed: 0.55, hhOpen: 0.1,
    clap: 0.1, rim: 0.08, cowbell: 0.05, tamb: 0.08, lt: 0.05, mt: 0.05, ht: 0.05,
    crash: 0.03, ride: 0.05,
  };
  for (const inst of INSTRUMENTS) {
    const d = density[inst.id] ?? 0.08;
    for (let i = 0; i < NUM_STEPS; i++) p.steps[inst.id][i] = Math.random() < d;
  }
  for (let i = 0; i < NUM_STEPS; i++) p.accent[i] = Math.random() < 0.15;
  return p;
}

// bibliothèque de grooves emblématiques — le rythme (la suite de pas) n'est
// pas protégeable par le droit d'auteur, contrairement à l'enregistrement ou
// à la mélodie ; c'est une pratique standard sur toutes les boîtes à rythmes
interface PresetSpec {
  name: string;
  tempo: number;
  length?: number;
  hits: Partial<Record<InstrumentId, number[]>>;
  accent?: number[];
}

const PRESET_SPECS: PresetSpec[] = [
  {
    name: "Funky Drummer",
    tempo: 100,
    hits: {
      bd1: [0, 6, 10],
      sd1: [4, 9, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
      hhOpen: [15],
    },
    accent: [0, 4, 12],
  },
  {
    name: "When Levee Breaks",
    tempo: 74,
    hits: {
      bd1: [0, 3, 6, 10],
      sd1: [4, 12],
    },
    accent: [0, 4, 10, 12],
  },
  {
    name: "Billie Jean",
    tempo: 117,
    hits: {
      bd1: [0, 4, 8, 12],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "We Will Rock You",
    tempo: 81,
    hits: {
      bd1: [0, 4],
      clap: [8],
    },
    accent: [0, 4, 8],
  },
  {
    name: "Amen Break",
    tempo: 136,
    hits: {
      bd1: [0, 10],
      sd1: [4, 7, 12, 14],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Disco Four Floor",
    tempo: 120,
    hits: {
      bd1: [0, 4, 8, 12],
      hhOpen: [2, 6, 10, 14],
      clap: [4, 12],
    },
    accent: [0, 4, 8, 12],
  },
  {
    name: "Rosanna Shuffle",
    tempo: 86,
    hits: {
      bd1: [0, 10],
      sd1: [8],
      hhClosed: [0, 3, 6, 8, 11, 14],
    },
    accent: [8],
  },
  {
    name: "Motown Stomp",
    tempo: 112,
    hits: {
      bd1: [0, 8],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
      tamb: [2, 6, 10, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Boom Bap",
    tempo: 90,
    hits: {
      bd1: [0, 10],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Dembow Reggaeton",
    tempo: 95,
    hits: {
      bd1: [0, 6, 8, 14],
      clap: [3, 11],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [3, 11],
  },
  {
    name: "Good Times",
    tempo: 120,
    hits: {
      bd1: [0, 6, 8, 14],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [0, 8],
  },
  {
    name: "Apache Break",
    tempo: 108,
    hits: {
      bd1: [0, 10],
      sd1: [4, 12],
      lt: [14],
      ht: [15],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Think Break",
    tempo: 100,
    hits: {
      bd1: [0, 6],
      sd1: [4, 10, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Impeach The Prez",
    tempo: 96,
    hits: {
      bd1: [0, 8, 10],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Blue Monday",
    tempo: 130,
    hits: {
      bd1: [0, 3, 6, 8, 11, 14],
      clap: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [0, 8],
  },
  {
    name: "Walk This Way",
    tempo: 106,
    hits: {
      bd1: [0, 10],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12],
      hhOpen: [14],
    },
    accent: [4, 12],
  },
  {
    name: "Superstition Funk",
    tempo: 100,
    hits: {
      bd1: [0, 3, 8, 11],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [0, 8],
  },
  {
    name: "Gated Tom Fill",
    tempo: 106,
    hits: {
      bd1: [0],
      sd1: [8],
      ht: [9],
      lt: [10, 12, 14],
      mt: [11, 13, 15],
    },
    accent: [10, 12, 14],
  },
  {
    name: "Come Together Toms",
    tempo: 82,
    hits: {
      bd1: [0],
      sd1: [8],
      lt: [6],
      mt: [10],
      ht: [14],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [6, 10, 14],
  },
  {
    name: "Papa Rollin Stone",
    tempo: 104,
    hits: {
      bd1: [0, 10],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
      tamb: [2, 6, 10, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Depeche Mode Stomp",
    tempo: 123,
    hits: {
      bd1: [0, 8],
      clap: [4, 12],
      tamb: [0, 2, 4, 6, 8, 10, 12, 14],
      rim: [6, 14],
    },
    accent: [0, 4, 8, 12],
  },
  {
    name: "Sweet Dreams Pulse",
    tempo: 125,
    hits: {
      bd1: [0, 4, 8, 12],
      clap: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [0, 8],
  },
  {
    name: "I Feel Love Pulse",
    tempo: 125,
    hits: {
      bd1: [0, 4, 8, 12],
      hhClosed: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    },
    accent: [0, 4, 8, 12],
  },
  {
    name: "Around The World",
    tempo: 121,
    hits: {
      bd1: [0, 3, 6, 8, 11, 14],
      hhOpen: [4, 12],
    },
    accent: [0, 8],
  },
  {
    name: "Sabotage Break",
    tempo: 171,
    hits: {
      bd1: [0, 7, 10],
      sd1: [4, 12],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Kashmir Stomp",
    tempo: 82,
    hits: {
      bd1: [0, 6, 10],
      sd1: [8],
      lt: [3, 11],
    },
    accent: [0, 8],
  },
  {
    name: "Whole Lotta Love",
    tempo: 92,
    hits: {
      bd1: [0, 10],
      sd1: [4, 12],
      hhClosed: [0, 3, 6, 8, 11, 14],
    },
    accent: [4, 12],
  },
  {
    name: "Sing Sing Sing Swing",
    tempo: 100,
    hits: {
      bd1: [0, 8],
      lt: [2, 6, 10, 14],
      ht: [4, 12],
    },
    accent: [0, 8],
  },
  {
    name: "Message In A Bottle",
    tempo: 144,
    hits: {
      bd1: [0, 10],
      sd1: [8],
      hhClosed: [2, 6, 10, 14],
      rim: [4, 12],
    },
    accent: [8],
  },
  {
    name: "Give It Away Funk",
    tempo: 92,
    hits: {
      bd1: [0, 3, 6, 10, 13],
      sd1: [8],
      hhClosed: [0, 2, 4, 6, 8, 10, 12, 14],
    },
    accent: [0, 8],
  },
];

function buildPresetPattern(spec: PresetSpec): Pattern {
  const p = defaultPattern(spec.name, spec.tempo);
  p.length = spec.length ?? NUM_STEPS;
  for (const [inst, idxs] of Object.entries(spec.hits) as [InstrumentId, number[]][]) {
    for (const i of idxs) p.steps[inst][i] = true;
  }
  if (spec.accent) for (const i of spec.accent) p.accent[i] = true;
  return p;
}

export const PRESET_PATTERNS: Pattern[] = PRESET_SPECS.map(buildPresetPattern);
export const PRESET_NAMES: string[] = PRESET_SPECS.map((s) => s.name);

// chaque famille a un algorithme de synthèse RÉELLEMENT différent (pas
// juste pitch/decay) — c'est kickType/snareType/hatType qui font sonner les
// kits différemment, pitchMult/decayMult ne font qu'affiner à la marge
export type KickType = "classic" | "deep808" | "acoustic" | "distorted";
export type SnareType = "classic" | "tight" | "acoustic" | "brush" | "industrial";
export type HatType = "classic" | "fmBell" | "soft" | "crushed";

export interface Kit {
  name: string;
  kickType: KickType;
  snareType: SnareType;
  hatType: HatType;
  pitchMult: number;
  decayMult: number;
  drive: number; // 0..1, ajoute un léger waveshaping "lo-fi"
  room: number; // 0..1, envoi vers la reverb algorithmique
  stereoWidth: number; // 0..1, largeur du panoramique par voix
  humanize: number; // 0..1, variation aléatoire de pitch/timing/vélocité par coup
  subBoost: number; // 0..1, renfort de sub sur le kick (mix supplémentaire)
  toneTilt: number; // -1..1, bascule sombre(-1)/brillant(+1), shelving EQ global
  // échantillons réels (générés par IA) pour certaines voix — les voix non
  // listées ici retombent sur la synthèse (kickType/snareType/hatType),
  // kit "hybride" : vrais sons là où on en a, synthèse pour le reste
  sampleUrls?: Partial<Record<InstrumentId, string>>;
}
export const KITS: Kit[] = [
  { name: "80s Pop Kit 1", kickType: "classic", snareType: "classic", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0, room: 0.12, stereoWidth: 0.6, humanize: 0.2, subBoost: 0, toneTilt: 0 },
  { name: "Punchy Kit", kickType: "acoustic", snareType: "tight", hatType: "classic",
    pitchMult: 1.08, decayMult: 0.75, drive: 0.15, room: 0.05, stereoWidth: 0.5, humanize: 0.1, subBoost: 0.2, toneTilt: 0.1 },
  { name: "Lo-Fi Kit", kickType: "classic", snareType: "classic", hatType: "crushed",
    pitchMult: 0.92, decayMult: 1.2, drive: 0.4, room: 0.2, stereoWidth: 0.4, humanize: 0.35, subBoost: 0, toneTilt: -0.3 },
  { name: "Bright Kit", kickType: "classic", snareType: "classic", hatType: "fmBell",
    pitchMult: 1.15, decayMult: 0.9, drive: 0.05, room: 0.1, stereoWidth: 0.7, humanize: 0.15, subBoost: 0, toneTilt: 0.35 },
  { name: "Acoustic Studio Kit", kickType: "acoustic", snareType: "acoustic", hatType: "soft",
    pitchMult: 0.97, decayMult: 1.15, drive: 0.04, room: 0.38, stereoWidth: 1, humanize: 0.55, subBoost: 0.1, toneTilt: 0 },
  { name: "Modern Punch Kit", kickType: "deep808", snareType: "tight", hatType: "classic",
    pitchMult: 1.04, decayMult: 0.68, drive: 0.22, room: 0.06, stereoWidth: 0.75, humanize: 0.08, subBoost: 0.45, toneTilt: 0.1 },
  { name: "808 Trap Kit", kickType: "deep808", snareType: "tight", hatType: "fmBell",
    pitchMult: 0.95, decayMult: 1.4, drive: 0.1, room: 0.05, stereoWidth: 0.6, humanize: 0.05, subBoost: 0.7, toneTilt: 0.3 },
  { name: "Vintage Tape Kit", kickType: "acoustic", snareType: "brush", hatType: "soft",
    pitchMult: 0.9, decayMult: 1.05, drive: 0.5, room: 0.25, stereoWidth: 0.5, humanize: 0.4, subBoost: 0.15, toneTilt: -0.55 },
  { name: "Industrial Kit", kickType: "distorted", snareType: "industrial", hatType: "crushed",
    pitchMult: 1.15, decayMult: 0.6, drive: 0.65, room: 0.1, stereoWidth: 0.3, humanize: 0.05, subBoost: 0.3, toneTilt: 0.15 },
  { name: "Jazz Brush Kit", kickType: "acoustic", snareType: "brush", hatType: "soft",
    pitchMult: 0.98, decayMult: 0.85, drive: 0, room: 0.3, stereoWidth: 1, humanize: 0.7, subBoost: 0, toneTilt: -0.2 },
  // kit hybride : kick/snare/low tom = vrais sons générés par IA (ElevenLabs
  // Sound Effects), le reste (toms restants, rim, cowbell, clap, tamb,
  // hi-hats, cymbales) retombe sur la synthèse "classic" — quota IA épuisé
  // avant d'avoir pu générer les 15 voix, complété plus tard
  { name: "AI Generated Kit", kickType: "classic", snareType: "classic", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0, room: 0.15, stereoWidth: 0.7, humanize: 0.15, subBoost: 0, toneTilt: 0,
    sampleUrls: {
      bd1: "/samples/aigen/bd1.mp3",
      bd2: "/samples/aigen/bd2.mp3",
      sd1: "/samples/aigen/sd1.mp3",
      sd2: "/samples/aigen/sd2.mp3",
      lt: "/samples/aigen/lt.mp3",
    } },
  // kit "808 Legacy" : vrais échantillons WAV d'un TR-808 (fournis par
  // l'utilisateur), identifiés par analyse spectrale (fréquence dominante,
  // durée, enveloppe) faute de pouvoir les écouter directement — bd2/sd2/
  // toms/tamb n'avaient pas de son 808 identifiable avec confiance dans le
  // pack fourni et retombent donc sur la synthèse "deep808"/"classic"
  { name: "808 Legacy Kit", kickType: "deep808", snareType: "classic", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0, room: 0.05, stereoWidth: 0.6, humanize: 0.05, subBoost: 0.5, toneTilt: 0.1,
    sampleUrls: {
      bd1: "/samples/808kit/bd1.wav",
      sd1: "/samples/808kit/sd1.wav",
      rim: "/samples/808kit/rim.wav",
      cowbell: "/samples/808kit/cowbell.wav",
      clap: "/samples/808kit/clap.wav",
      hhClosed: "/samples/808kit/hhClosed.wav",
      hhOpen: "/samples/808kit/hhOpen.wav",
      crash: "/samples/808kit/crash.wav",
      ride: "/samples/808kit/ride.wav",
    } },
  // kit "909 Legacy" : vrais échantillons WAV d'un TR-909 (fournis par
  // l'utilisateur) — cette fois identifiés avec certitude, les noms de
  // fichiers encodent le numéro de note General MIDI percussion standard
  // (35=Bass Drum, 38=Acoustic Snare, 42=Closed HH, 46=Open HH, 49=Crash 1,
  // 51=Ride 1, 37=Side Stick, 39=Hand Clap, 41/45/50=toms low/mid/hi...) qui
  // correspond exactement aux étiquettes du pack (BD1/SN1/CHH/OHH/CS1/RD2...)
  // — le 909 matériel n'a pas de cowbell/tambourine, ces deux voix restent
  // donc en synthèse comme sur le vrai instrument
  { name: "909 Legacy Kit", kickType: "classic", snareType: "classic", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0, room: 0.05, stereoWidth: 0.6, humanize: 0.05, subBoost: 0.15, toneTilt: 0.15,
    sampleUrls: {
      bd1: "/samples/909kit/bd1.wav",
      bd2: "/samples/909kit/bd2.wav",
      sd1: "/samples/909kit/sd1.wav",
      sd2: "/samples/909kit/sd2.wav",
      lt: "/samples/909kit/lt.wav",
      mt: "/samples/909kit/mt.wav",
      ht: "/samples/909kit/ht.wav",
      rim: "/samples/909kit/rim.wav",
      clap: "/samples/909kit/clap.wav",
      hhClosed: "/samples/909kit/hhClosed.wav",
      hhOpen: "/samples/909kit/hhOpen.wav",
      crash: "/samples/909kit/crash.wav",
      ride: "/samples/909kit/ride.wav",
    } },
  // kit "Street Symphony" : pack de batterie acoustique/urbain fourni par
  // l'utilisateur (noms clairs Kick/Snare/HiHat/Clap/RimShot), variantes
  // distinguées par analyse spectrale (fréquence dominante/centroïde) faute
  // de pouvoir les écouter — cowbell/tamb complétés depuis un 2e pack fourni
  // (Soundtrack Perc Kit, percussions live, converti AIFF→WAV) puisque le
  // pack batterie seul n'en contenait pas ; pas de toms/cymbales dans ces
  // deux packs, ces voix restent en synthèse
  { name: "Street Symphony Kit", kickType: "acoustic", snareType: "acoustic", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0, room: 0.1, stereoWidth: 0.7, humanize: 0.1, subBoost: 0.1, toneTilt: 0,
    sampleUrls: {
      bd1: "/samples/streetkit/bd1.wav",
      bd2: "/samples/streetkit/bd2.wav",
      sd1: "/samples/streetkit/sd1.wav",
      sd2: "/samples/streetkit/sd2.wav",
      rim: "/samples/streetkit/rim.wav",
      clap: "/samples/streetkit/clap.wav",
      cowbell: "/samples/streetkit/cowbell.wav",
      tamb: "/samples/streetkit/tamb.wav",
      hhClosed: "/samples/streetkit/hhClosed.wav",
      hhOpen: "/samples/streetkit/hhOpen.wav",
    } },
  // kit "West Coast Boom" : construit à partir d'un pack de production hip-hop
  // fourni par l'utilisateur — nommé par le style plutôt que par le nom du
  // producteur associé au pack (nom propre/marque, à éviter comme libellé
  // dans une appli web publique). Voix identifiées via les abréviations du
  // pack (kik/snr/hat/rim/cras, vérifiées par fréquence fondamentale : tous
  // les "kik" ~60-80Hz, tous les "snr" ~210-295Hz, cohérent avec les
  // étiquettes) ; cowbell = triangle du pack "True Soul" en substitut créatif
  // faute de vraie cowbell dans le pack ; pas de toms/ride/clap/tamb/open hat
  // identifiés avec confiance, ces voix restent en synthèse
  { name: "West Coast Boom Kit", kickType: "deep808", snareType: "tight", hatType: "classic",
    pitchMult: 1, decayMult: 1, drive: 0.05, room: 0.08, stereoWidth: 0.65, humanize: 0.08, subBoost: 0.3, toneTilt: 0.05,
    sampleUrls: {
      bd1: "/samples/wcboomkit/bd1.wav",
      bd2: "/samples/wcboomkit/bd2.wav",
      sd1: "/samples/wcboomkit/sd1.wav",
      sd2: "/samples/wcboomkit/sd2.wav",
      rim: "/samples/wcboomkit/rim.wav",
      hhClosed: "/samples/wcboomkit/hhClosed.wav",
      crash: "/samples/wcboomkit/crash.wav",
      cowbell: "/samples/wcboomkit/cowbell.wav",
    } },
];

// position stéréo par voix (-1 gauche .. +1 droite), échelle par kit.stereoWidth
const PAN_POS: Record<InstrumentId, number> = {
  bd1: 0, bd2: 0, sd1: 0, sd2: 0,
  lt: -0.38, mt: -0.05, ht: 0.32,
  rim: 0.18, cowbell: 0.28, clap: 0, tamb: 0.22,
  hhClosed: -0.28, hhOpen: -0.28,
  crash: -0.42, ride: 0.42,
};

function makeLofiCurve(amount: number): Float32Array {
  const n = 1024;
  const c = new Float32Array(n);
  const k = 1 + amount * 8;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

// quantifie le signal (réduction de résolution façon bit-crusher), pour le
// hatType "crushed" — granuleux, numérique, très différent du bandpass classique
let crushCurveCache: Float32Array | null = null;
function makeCrushCurve(): Float32Array {
  if (crushCurveCache) return crushCurveCache;
  const n = 2048;
  const c = new Float32Array(n);
  const steps = 10;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  crushCurveCache = c;
  return c;
}

// petite reverb algorithmique (bruit en décroissance exponentielle) pour la
// "room" des kits — pas d'échantillon externe requis
function makeReverbImpulse(ctx: BaseAudioContext, seconds = 1.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }
  }
  return buf;
}

export class TR707Engine {
  ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private colorNoiseBuffer: AudioBuffer | null = null; // bruit filtré, plus "rond" (kick/toms)
  private faderGains: Partial<Record<FaderId, GainNode>> = {};
  private master: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private reverbSend: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbReturn: GainNode | null = null;
  private toneLow: BiquadFilterNode | null = null;
  private toneHigh: BiquadFilterNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private limiterMakeup: GainNode | null = null;
  limiterOn = false;
  analyser: AnalyserNode | null = null;

  // échantillons réels (kits hybrides) : cache par URL, chargement async
  private sampleBuffers: Map<string, AudioBuffer> = new Map();
  private samplesLoading: Set<string> = new Set();

  faders: Record<FaderId, number> = {
    ac: 0.7, bd: 0.85, sd: 0.8, lt: 0.7, mt: 0.7, ht: 0.7,
    rimcow: 0.65, hcptamb: 0.65, hh: 0.7, crash: 0.7, ride: 0.65,
  };
  volume = 0.85;
  kitIndex = 0;
  shuffle = 0;

  patterns: Pattern[] = Array.from({ length: NUM_PATTERNS }, () => defaultPattern());
  currentPattern = 0;

  playing = false;
  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;
  private initPromise: Promise<void> | null = null;
  onStep: ((step: number) => void) | null = null;

  get isReady() {
    return this.ctx !== null;
  }

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.buildGraph();
    return this.initPromise;
  }

  private async buildGraph() {
    const ctx = new AudioContext({ latencyHint: "interactive" });
    this.ctx = ctx;

    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;

    // bruit "coloré" (filtré passe-bas en post-traitement) : plus rond que le
    // blanc pur, utilisé pour le corps du kick et des toms
    const colorBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const colorData = colorBuf.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      prev = prev * 0.92 + data[i] * 0.08;
      colorData[i] = prev * 4;
    }
    this.colorNoiseBuffer = colorBuf;

    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = makeLofiCurve(KITS[this.kitIndex].drive) as Float32Array<ArrayBuffer>;

    // tilt EQ (bascule sombre/brillant) — deux shelving filters en série,
    // dosés par kit.toneTilt
    this.toneLow = ctx.createBiquadFilter();
    this.toneLow.type = "lowshelf";
    this.toneLow.frequency.value = 250;
    this.toneHigh = ctx.createBiquadFilter();
    this.toneHigh.type = "highshelf";
    this.toneHigh.frequency.value = 4000;
    this.shaper.connect(this.toneLow);
    this.toneLow.connect(this.toneHigh);

    this.master = ctx.createGain();
    this.master.gain.value = this.volume * 0.6;
    this.toneHigh.connect(this.master);

    // limiteur de sortie, togglable (OPTION) sans reconnecter le graphe :
    // désactivé = seuil 0dB/ratio 1 (transparent)
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = 0;
    this.limiter.ratio.value = 1;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.15;
    this.limiterMakeup = ctx.createGain();
    this.limiterMakeup.gain.value = 1;
    this.master.connect(this.limiter);
    this.limiter.connect(this.limiterMakeup);
    this.limiterMakeup.connect(ctx.destination);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.limiterMakeup.connect(this.analyser);

    // reverb "room" : un seul send global post-drive, le mix dépend de kit.room
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = KITS[this.kitIndex].room;
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = makeReverbImpulse(ctx);
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.5;
    this.shaper.connect(this.reverbSend);
    this.reverbSend.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);

    this.applyToneTilt();
    this.preloadKitSamples(this.kitIndex);

    for (const id of FADER_IDS) {
      const g = ctx.createGain();
      g.gain.value = this.faders[id];
      g.connect(this.shaper);
      this.faderGains[id] = g;
    }
  }

  setFader(id: FaderId, v: number) {
    this.faders[id] = v;
    const t = this.ctx?.currentTime ?? 0;
    this.faderGains[id]?.gain.setTargetAtTime(v, t, 0.01);
  }

  setVolume(v: number) {
    this.volume = v;
    const t = this.ctx?.currentTime ?? 0;
    this.master?.gain.setTargetAtTime(v * 0.6, t, 0.01);
  }

  setKit(i: number) {
    this.kitIndex = i;
    const t = this.ctx?.currentTime ?? 0;
    if (this.shaper) this.shaper.curve = makeLofiCurve(KITS[i].drive) as Float32Array<ArrayBuffer>;
    this.reverbSend?.gain.setTargetAtTime(KITS[i].room, t, 0.05);
    this.applyToneTilt();
    this.preloadKitSamples(i);
  }

  // précharge les échantillons du kit (si présents) — asynchrone, avec repli
  // sur la synthèse tant que le buffer n'est pas encore prêt
  private preloadKitSamples(i: number) {
    const urls = KITS[i].sampleUrls;
    if (!urls) return;
    for (const url of Object.values(urls)) {
      if (url) this.ensureSampleLoaded(url);
    }
  }

  private ensureSampleLoaded(url: string) {
    if (!this.ctx || this.sampleBuffers.has(url) || this.samplesLoading.has(url)) return;
    this.samplesLoading.add(url);
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((arr) => this.ctx!.decodeAudioData(arr))
      .then((decoded) => {
        this.sampleBuffers.set(url, decoded);
        this.samplesLoading.delete(url);
      })
      .catch(() => {
        this.samplesLoading.delete(url);
      });
  }

  private playSample(buffer: AudioBuffer, dest: AudioNode, time: number, vel: number, pitchMult: number) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pitchMult;
    const amp = this.ctx.createGain();
    amp.gain.value = Math.min(1, vel);
    src.connect(amp);
    amp.connect(dest);
    src.start(time);
  }

  private applyToneTilt() {
    if (!this.ctx || !this.toneLow || !this.toneHigh) return;
    const tilt = KITS[this.kitIndex].toneTilt;
    const t = this.ctx.currentTime;
    this.toneLow.gain.setTargetAtTime(-tilt * 6, t, 0.05);
    this.toneHigh.gain.setTargetAtTime(tilt * 6, t, 0.05);
  }

  setLimiterOn(on: boolean) {
    this.limiterOn = on;
    if (!this.ctx || !this.limiter || !this.limiterMakeup) return;
    const t = this.ctx.currentTime;
    this.limiter.threshold.setTargetAtTime(on ? -14 : 0, t, 0.03);
    this.limiter.ratio.setTargetAtTime(on ? 5 : 1, t, 0.03);
    this.limiterMakeup.gain.setTargetAtTime(on ? 1.4 : 1, t, 0.03);
  }

  resume() {
    this.ctx?.resume();
  }

  private noise(colored = false): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = colored ? this.colorNoiseBuffer : this.noiseBuffer;
    src.loop = false;
    return src;
  }

  // panning par voix (position fixe × largeur stéréo du kit), câblé devant le
  // fader de groupe — transparent pour tout le code de synthèse existant
  private destFor(inst: InstrumentDef, kit: Kit): AudioNode {
    const faderGain = this.faderGains[inst.fader] ?? this.shaper!;
    const pan = (PAN_POS[inst.id] ?? 0) * kit.stereoWidth;
    if (!this.ctx || Math.abs(pan) < 0.005) return faderGain;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(faderGain);
    return panner;
  }

  // ————— synthèse par instrument —————
  private triggerInstrument(id: InstrumentId, time: number, vel: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const inst = INSTRUMENTS.find((i) => i.id === id)!;
    const kit = KITS[this.kitIndex];
    const dest = this.destFor(inst, kit);

    // humanisation : légère variation de pitch/vélocité par coup — évite le
    // rendu "trop parfait" d'une machine purement synthétique
    const pm = kit.pitchMult * (1 + (Math.random() * 2 - 1) * kit.humanize * 0.03);
    const dm = kit.decayMult;
    vel = vel * (1 + (Math.random() * 2 - 1) * kit.humanize * 0.12);

    // kit hybride : si un vrai échantillon existe (et est chargé) pour cette
    // voix, il remplace entièrement la synthèse ci-dessous
    const sampleUrl = kit.sampleUrls?.[id];
    if (sampleUrl) {
      const buf = this.sampleBuffers.get(sampleUrl);
      if (buf) {
        this.playSample(buf, dest, time, vel, pm);
        return;
      }
      this.ensureSampleLoaded(sampleUrl); // pas encore prêt : synthèse en repli cette fois-ci
    }

    if ((id === "bd1" || id === "bd2") && kit.subBoost > 0) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = 54 * pm;
      const subAmp = ctx.createGain();
      const subDecay = 0.4 * dm;
      subAmp.gain.setValueAtTime(vel * kit.subBoost * 0.8, time);
      subAmp.gain.exponentialRampToValueAtTime(0.001, time + subDecay);
      sub.connect(subAmp);
      subAmp.connect(dest);
      sub.start(time);
      sub.stop(time + subDecay + 0.05);
    }

    switch (id) {
      case "bd1":
      case "bd2": {
        const variant = id === "bd1" ? 1 : 2;

        if (kit.kickType === "deep808") {
          // 808 : chute de pitch lente, decay long, pas de click dur — un
          // "thump" grave et soutenu plutôt qu'un coup sec
          const osc = ctx.createOscillator();
          osc.type = "sine";
          const startFreq = (variant === 1 ? 78 : 68) * pm;
          const endFreq = (variant === 1 ? 32 : 28) * pm;
          const pitchDecay = 0.32 * dm;
          osc.frequency.setValueAtTime(startFreq, time);
          osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 18), time + pitchDecay);
          const amp = ctx.createGain();
          const ampDecay = 0.55 * dm;
          amp.gain.setValueAtTime(0.0001, time);
          amp.gain.linearRampToValueAtTime(vel, time + 0.006);
          amp.gain.exponentialRampToValueAtTime(0.001, time + ampDecay);
          osc.connect(amp);
          amp.connect(dest);
          osc.start(time);
          osc.stop(time + ampDecay + 0.05);
        } else if (kit.kickType === "acoustic") {
          // fût acoustique : deux partiels (fondamentale + harmonique qui
          // décroît plus vite) + transitoire de batteur en bruit filtré
          const startFreq = (variant === 1 ? 140 : 120) * pm;
          const endFreq = (variant === 1 ? 55 : 48) * pm;
          const pitchDecay = 0.1 * dm;
          const ampDecay = (variant === 1 ? 0.2 : 0.28) * dm;
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(startFreq, time);
          osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), time + pitchDecay);
          const amp = ctx.createGain();
          amp.gain.setValueAtTime(vel, time);
          amp.gain.exponentialRampToValueAtTime(0.001, time + ampDecay);
          osc.connect(amp);
          amp.connect(dest);
          osc.start(time);
          osc.stop(time + ampDecay + 0.05);

          const osc2 = ctx.createOscillator();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(startFreq * 2.4, time);
          osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.6, time + pitchDecay * 0.6);
          const amp2 = ctx.createGain();
          amp2.gain.setValueAtTime(vel * 0.25, time);
          amp2.gain.exponentialRampToValueAtTime(0.001, time + ampDecay * 0.35);
          osc2.connect(amp2);
          amp2.connect(dest);
          osc2.start(time);
          osc2.stop(time + ampDecay * 0.35 + 0.03);

          const noise = this.noise();
          const nf = ctx.createBiquadFilter();
          nf.type = "bandpass";
          nf.frequency.value = 1100;
          nf.Q.value = 0.9;
          const namp = ctx.createGain();
          namp.gain.setValueAtTime(vel * 0.3, time);
          namp.gain.exponentialRampToValueAtTime(0.001, time + 0.018);
          noise.connect(nf);
          nf.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + 0.025);
        } else if (kit.kickType === "distorted") {
          // triangle (pas sinus) + saturation dédiée très dure : grain
          // agressif, industriel, distinct de tout le reste
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          const startFreq = (variant === 1 ? 150 : 130) * pm;
          const endFreq = (variant === 1 ? 50 : 44) * pm;
          const pitchDecay = 0.08 * dm;
          osc.frequency.setValueAtTime(startFreq, time);
          osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), time + pitchDecay);
          const preAmp = ctx.createGain();
          const ampDecay = (variant === 1 ? 0.18 : 0.26) * dm;
          preAmp.gain.setValueAtTime(vel * 2.2, time);
          preAmp.gain.exponentialRampToValueAtTime(0.001, time + ampDecay);
          const crush = ctx.createWaveShaper();
          crush.curve = makeLofiCurve(0.95) as Float32Array<ArrayBuffer>;
          crush.oversample = "2x";
          osc.connect(preAmp);
          preAmp.connect(crush);
          crush.connect(dest);
          osc.start(time);
          osc.stop(time + ampDecay + 0.05);
        } else {
          // classic (80s) : sinus + click carré net, le son TR-707 d'origine
          const osc = ctx.createOscillator();
          osc.type = "sine";
          const startFreq = (variant === 1 ? 165 : 145) * pm;
          const endFreq = (variant === 1 ? 48 : 42) * pm;
          const pitchDecay = (variant === 1 ? 0.09 : 0.13) * dm;
          osc.frequency.setValueAtTime(startFreq, time);
          osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), time + pitchDecay);
          const amp = ctx.createGain();
          const ampDecay = (variant === 1 ? 0.22 : 0.35) * dm;
          amp.gain.setValueAtTime(vel, time);
          amp.gain.exponentialRampToValueAtTime(0.001, time + ampDecay);
          osc.connect(amp);
          amp.connect(dest);
          osc.start(time);
          osc.stop(time + ampDecay + 0.05);

          const click = ctx.createOscillator();
          click.type = "square";
          click.frequency.value = 1800 * pm;
          const clickAmp = ctx.createGain();
          clickAmp.gain.setValueAtTime(vel * 0.4, time);
          clickAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.004);
          click.connect(clickAmp);
          clickAmp.connect(dest);
          click.start(time);
          click.stop(time + 0.01);
        }
        break;
      }
      case "sd1":
      case "sd2": {
        const variant = id === "sd1" ? 1 : 2;

        if (kit.snareType === "tight") {
          // trap/808 : un seul ton court + un claquement de bruit très bref,
          // beaucoup plus sec et court que le classic
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.value = (variant === 1 ? 260 : 230) * pm;
          const oscAmp = ctx.createGain();
          const toneDecay = 0.045 * dm;
          oscAmp.gain.setValueAtTime(vel * 0.6, time);
          oscAmp.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
          osc.connect(oscAmp);
          oscAmp.connect(dest);
          osc.start(time);
          osc.stop(time + toneDecay + 0.02);

          const noise = this.noise();
          const nf = ctx.createBiquadFilter();
          nf.type = "highpass";
          nf.frequency.value = 2200;
          const namp = ctx.createGain();
          const noiseDecay = 0.06 * dm;
          namp.gain.setValueAtTime(vel * 0.85, time);
          namp.gain.exponentialRampToValueAtTime(0.001, time + noiseDecay);
          noise.connect(nf);
          nf.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + noiseDecay + 0.02);
        } else if (kit.snareType === "acoustic") {
          // timbre acoustique : bruit très résonnant (bruit de timbre) +
          // deux tons rapprochés qui battent, decay plus long et texturé
          const noise = this.noise();
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = variant === 1 ? 2200 : 1800;
          bp.Q.value = 3.5;
          const namp = ctx.createGain();
          const noiseDecay = (variant === 1 ? 0.28 : 0.34) * dm;
          namp.gain.setValueAtTime(vel * 0.75, time);
          namp.gain.exponentialRampToValueAtTime(0.001, time + noiseDecay);
          noise.connect(bp);
          bp.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + noiseDecay + 0.02);

          for (const detune of [1, 1.02]) {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = (variant === 1 ? 195 : 170) * pm * detune;
            const oscAmp = ctx.createGain();
            const toneDecay = 0.1 * dm;
            oscAmp.gain.setValueAtTime(vel * 0.28, time);
            oscAmp.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
            osc.connect(oscAmp);
            oscAmp.connect(dest);
            osc.start(time);
            osc.stop(time + toneDecay + 0.02);
          }
        } else if (kit.snareType === "brush") {
          // balai jazz : pas de transitoire net, un souffle de bruit qui
          // monte doucement puis s'éteint — aucun "clac"
          const noise = this.noise();
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = variant === 1 ? 1600 : 1300;
          bp.Q.value = 0.5;
          const namp = ctx.createGain();
          const noiseDecay = (variant === 1 ? 0.22 : 0.3) * dm;
          namp.gain.setValueAtTime(0.0001, time);
          namp.gain.linearRampToValueAtTime(vel * 0.5, time + 0.018);
          namp.gain.exponentialRampToValueAtTime(0.001, time + 0.018 + noiseDecay);
          noise.connect(bp);
          bp.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + noiseDecay + 0.03);
        } else if (kit.snareType === "industrial") {
          // bruit modulé en anneau par un carré : texture métallique,
          // robotique — rien à voir avec un ton de peau
          const noise = this.noise();
          const modOsc = ctx.createOscillator();
          modOsc.type = "square";
          modOsc.frequency.value = (variant === 1 ? 210 : 170) * pm;
          const ringGain = ctx.createGain();
          ringGain.gain.value = 0;
          const modScale = ctx.createGain();
          modScale.gain.value = 1;
          modOsc.connect(modScale);
          modScale.connect(ringGain.gain);
          const hp = ctx.createBiquadFilter();
          hp.type = "highpass";
          hp.frequency.value = 500;
          const namp = ctx.createGain();
          const noiseDecay = 0.16 * dm;
          namp.gain.setValueAtTime(vel * 0.8, time);
          namp.gain.exponentialRampToValueAtTime(0.001, time + noiseDecay);
          noise.connect(ringGain);
          ringGain.connect(hp);
          hp.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + noiseDecay + 0.02);
          modOsc.start(time);
          modOsc.stop(time + noiseDecay + 0.02);
        } else {
          // classic (80s) : deux partiels toniques + bruit bandpass+highpass
          const toneDecay = 0.1 * dm;
          for (const [freq, mix] of [[(variant === 1 ? 200 : 175), 0.5], [(variant === 1 ? 335 : 290), 0.22]] as const) {
            const osc = ctx.createOscillator();
            osc.type = "triangle";
            osc.frequency.value = freq * pm;
            const oscAmp = ctx.createGain();
            oscAmp.gain.setValueAtTime(vel * mix, time);
            oscAmp.gain.exponentialRampToValueAtTime(0.001, time + toneDecay);
            osc.connect(oscAmp);
            oscAmp.connect(dest);
            osc.start(time);
            osc.stop(time + toneDecay + 0.02);
          }

          const noise = this.noise();
          const nf = ctx.createBiquadFilter();
          nf.type = "bandpass";
          nf.frequency.value = variant === 1 ? 1800 : 1400;
          nf.Q.value = 0.6;
          const nf2 = ctx.createBiquadFilter();
          nf2.type = "highpass";
          nf2.frequency.value = variant === 1 ? 900 : 650;
          const namp = ctx.createGain();
          const noiseDecay = (variant === 1 ? 0.13 : 0.22) * dm;
          namp.gain.setValueAtTime(vel * (variant === 1 ? 0.7 : 0.95), time);
          namp.gain.exponentialRampToValueAtTime(0.001, time + noiseDecay);
          noise.connect(nf);
          nf.connect(nf2);
          nf2.connect(namp);
          namp.connect(dest);
          noise.start(time);
          noise.stop(time + noiseDecay + 0.02);
        }
        break;
      }
      case "lt":
      case "mt":
      case "ht": {
        const base = (id === "lt" ? 95 : id === "mt" ? 140 : 200) * pm;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(base * 1.5, time);
        osc.frequency.exponentialRampToValueAtTime(base * 0.85, time + 0.16);
        const amp = ctx.createGain();
        const decay = 0.32 * dm;
        amp.gain.setValueAtTime(vel, time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
        osc.connect(amp);
        amp.connect(dest);
        osc.start(time);
        osc.stop(time + decay + 0.05);

        // overtone discret : donne un peu de corps/réalisme au fût
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(base * 2.02, time);
        osc2.frequency.exponentialRampToValueAtTime(base * 1.2, time + 0.08);
        const amp2 = ctx.createGain();
        amp2.gain.setValueAtTime(vel * 0.18, time);
        amp2.gain.exponentialRampToValueAtTime(0.001, time + decay * 0.4);
        osc2.connect(amp2);
        amp2.connect(dest);
        osc2.start(time);
        osc2.stop(time + decay * 0.4 + 0.05);

        // transitoire d'attaque (bruit coloré) : le "clac" de la baguette
        const noise = this.noise(true);
        const nf = ctx.createBiquadFilter();
        nf.type = "bandpass";
        nf.frequency.value = base * 3;
        nf.Q.value = 0.8;
        const namp = ctx.createGain();
        namp.gain.setValueAtTime(vel * 0.25, time);
        namp.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
        noise.connect(nf);
        nf.connect(namp);
        namp.connect(dest);
        noise.start(time);
        noise.stop(time + 0.03);
        break;
      }
      case "rim": {
        const amp = ctx.createGain();
        const decay = 0.045 * dm;
        amp.gain.setValueAtTime(vel * 0.6, time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
        for (const f of [440, 330]) {
          const osc = ctx.createOscillator();
          osc.type = "square";
          osc.frequency.value = f * pm;
          osc.connect(amp);
          osc.start(time);
          osc.stop(time + decay + 0.02);
        }
        amp.connect(dest);

        const noise = this.noise();
        const nf = ctx.createBiquadFilter();
        nf.type = "highpass";
        nf.frequency.value = 2000;
        const namp = ctx.createGain();
        namp.gain.setValueAtTime(vel * 0.5, time);
        namp.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
        noise.connect(nf);
        nf.connect(namp);
        namp.connect(dest);
        noise.start(time);
        noise.stop(time + 0.05);
        break;
      }
      case "cowbell": {
        const amp = ctx.createGain();
        const decay = 0.3 * dm;
        amp.gain.setValueAtTime(vel * 0.5, time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 800 * pm;
        bp.Q.value = 2;
        for (const f of [800, 540]) {
          const osc = ctx.createOscillator();
          osc.type = "square";
          osc.frequency.value = f * pm;
          osc.connect(bp);
          osc.start(time);
          osc.stop(time + decay + 0.05);
        }
        bp.connect(amp);
        amp.connect(dest);
        break;
      }
      case "clap": {
        const offsets = [0, 0.012, 0.024];
        for (const o of offsets) {
          const noise = this.noise();
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1200;
          bp.Q.value = 1.2;
          const amp = ctx.createGain();
          amp.gain.setValueAtTime(vel * 0.5, time + o);
          amp.gain.exponentialRampToValueAtTime(0.001, time + o + 0.02);
          noise.connect(bp);
          bp.connect(amp);
          amp.connect(dest);
          noise.start(time + o);
          noise.stop(time + o + 0.03);
        }
        const tail = this.noise();
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1000;
        bp.Q.value = 1;
        const amp = ctx.createGain();
        const tailDecay = 0.15 * dm;
        amp.gain.setValueAtTime(vel * 0.35, time + 0.03);
        amp.gain.exponentialRampToValueAtTime(0.001, time + 0.03 + tailDecay);
        tail.connect(bp);
        bp.connect(amp);
        amp.connect(dest);
        tail.start(time + 0.03);
        tail.stop(time + 0.03 + tailDecay + 0.02);
        break;
      }
      case "tamb": {
        const noise = this.noise();
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 5000;
        const amp = ctx.createGain();
        const decay = 0.08 * dm;
        amp.gain.setValueAtTime(vel * 0.5, time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
        noise.connect(hp);
        hp.connect(amp);
        amp.connect(dest);
        noise.start(time);
        noise.stop(time + decay + 0.02);
        break;
      }
      case "hhClosed":
      case "hhOpen": {
        const open = id === "hhOpen";
        const decay = (open ? 0.45 : 0.08) * dm;

        if (kit.hatType === "fmBell") {
          // FM 2-opérateurs : partiels inharmoniques bien définis, plus
          // "cloche brillante" que le bruit métallique classique
          const highpass = ctx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = 3500;
          const amp = ctx.createGain();
          amp.gain.setValueAtTime(vel * 0.3, time);
          amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
          for (const carrierFreq of [820, 1450, 2300]) {
            const carrier = ctx.createOscillator();
            carrier.type = "sine";
            carrier.frequency.value = carrierFreq * pm;
            const modulator = ctx.createOscillator();
            modulator.type = "sine";
            modulator.frequency.value = carrierFreq * 1.41 * pm;
            const modGain = ctx.createGain();
            modGain.gain.value = carrierFreq * 0.8;
            modulator.connect(modGain);
            modGain.connect(carrier.frequency);
            carrier.connect(amp);
            carrier.start(time);
            carrier.stop(time + decay + 0.05);
            modulator.start(time);
            modulator.stop(time + decay + 0.05);
          }
          amp.connect(highpass);
          highpass.connect(dest);
        } else if (kit.hatType === "soft") {
          // uniquement du bruit filtré, sans oscillateur : un "tss" respiré,
          // beaucoup moins agressif que la technique 808/909
          const noise = this.noise();
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 7500;
          bp.Q.value = 0.6;
          const amp = ctx.createGain();
          amp.gain.setValueAtTime(0.0001, time);
          amp.gain.linearRampToValueAtTime(vel * 0.32, time + 0.006);
          amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
          noise.connect(bp);
          bp.connect(amp);
          amp.connect(dest);
          noise.start(time);
          noise.stop(time + decay + 0.03);
        } else {
          // classic (808/909) ou crushed (= classic + bit-crush) : 7
          // oscillateurs carrés désaccordés à travers bandpass+highpass
          const fundamental = 40 * pm;
          const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21, 9.4];
          const bandpass = ctx.createBiquadFilter();
          bandpass.type = "bandpass";
          bandpass.frequency.value = 10000;
          bandpass.Q.value = 1;
          const highpass = ctx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = 7000;
          const amp = ctx.createGain();
          amp.gain.setValueAtTime(vel * 0.35, time);
          amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
          for (const r of ratios) {
            const osc = ctx.createOscillator();
            osc.type = "square";
            osc.frequency.value = fundamental * r * (1 + (Math.random() * 2 - 1) * 0.01);
            osc.connect(bandpass);
            osc.start(time);
            osc.stop(time + decay + 0.05);
          }
          bandpass.connect(highpass);
          if (kit.hatType === "crushed") {
            const crush = ctx.createWaveShaper();
            crush.curve = makeCrushCurve() as Float32Array<ArrayBuffer>;
            highpass.connect(crush);
            crush.connect(amp);
          } else {
            highpass.connect(amp);
          }
          amp.connect(dest);
        }
        break;
      }
      case "crash":
      case "ride": {
        const isCrash = id === "crash";
        const fundamental = 40 * pm;
        const ratios = [1, 1.5, 2, 2.5, 3.6, 4.2];
        const mult = isCrash ? 6 : 5;
        const decay = (isCrash ? 1.3 : 0.85) * dm;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(vel * (isCrash ? 0.4 : 0.3), time);
        amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = isCrash ? 9000 : 7000;
        bp.Q.value = 0.7;
        for (const r of ratios) {
          const osc = ctx.createOscillator();
          osc.type = "square";
          osc.frequency.value = fundamental * r * mult * (1 + (Math.random() * 2 - 1) * 0.008);
          osc.connect(bp);
          osc.start(time);
          osc.stop(time + decay + 0.1);
        }
        bp.connect(amp);
        amp.connect(dest);

        // "ping" tonal de la ride : une fréquence de cloche bien définie,
        // absente sur le crash — c'est ce qui différencie les deux à l'oreille
        if (!isCrash) {
          const bell = ctx.createOscillator();
          bell.type = "triangle";
          bell.frequency.value = 850 * pm;
          const bellAmp = ctx.createGain();
          const bellDecay = 0.5 * dm;
          bellAmp.gain.setValueAtTime(vel * 0.22, time);
          bellAmp.gain.exponentialRampToValueAtTime(0.001, time + bellDecay);
          bell.connect(bellAmp);
          bellAmp.connect(dest);
          bell.start(time);
          bell.stop(time + bellDecay + 0.05);
        }
        break;
      }
    }
  }

  async playPreview(id: InstrumentId) {
    await this.init();
    this.resume();
    if (!this.ctx) return;
    this.triggerInstrument(id, this.ctx.currentTime + 0.001, 0.85);
  }

  get stepDur(): number {
    const tempo = this.patterns[this.currentPattern]?.tempo ?? 120;
    return 60 / tempo / 4; // double-croches
  }

  async start() {
    await this.init();
    this.resume();
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.schedulerTimer = window.setInterval(() => this.scheduler(), 25);
  }

  stop() {
    this.playing = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.onStep?.(-1);
  }

  toggle() {
    if (this.playing) this.stop();
    else this.start();
  }

  restart() {
    if (!this.playing || !this.ctx) return;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.02;
  }

  private scheduler() {
    if (!this.ctx) return;
    const lookahead = 0.12;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      const pattern = this.patterns[this.currentPattern];
      const shuffleOffset = this.currentStep % 2 === 1 ? this.shuffle * this.stepDur * 0.6 : 0;
      this.scheduleStep(this.currentStep, this.nextNoteTime + shuffleOffset);
      this.nextNoteTime += this.stepDur;
      this.currentStep = (this.currentStep + 1) % Math.max(1, pattern.length);
    }
  }

  private scheduleStep(stepIndex: number, time: number) {
    if (!this.ctx) return;
    const pattern = this.patterns[this.currentPattern];
    const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
    window.setTimeout(() => this.onStep?.(stepIndex), delay);

    const accented = pattern.accent[stepIndex];
    const accentBoost = accented ? 1 + this.faders.ac * 0.6 : 1;
    const humanize = KITS[this.kitIndex].humanize;
    for (const inst of INSTRUMENTS) {
      if (pattern.steps[inst.id][stepIndex]) {
        // micro-décalage temporel par voix : un vrai batteur ne tombe jamais
        // deux fois exactement sur le même instant
        const jitter = (Math.random() * 2 - 1) * humanize * 0.006;
        this.triggerInstrument(inst.id, time + jitter, Math.min(1, 0.72 * accentBoost));
      }
    }
  }
}
