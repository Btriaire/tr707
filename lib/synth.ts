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
