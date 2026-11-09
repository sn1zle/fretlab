// Web Audio API Plucked Guitar & Studio Synth Engine

class GuitarSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.45;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Play a warm plucked electric guitar tone (Clean Strat / Dumble style)
   */
  public playNote(
    midi: number,
    duration: number = 1.35,
    velocity: number = 0.85,
    delaySec: number = 0
  ): void {
    try {
      const ctx = this.ensureContext();
      if (!this.masterGain) return;

      const now = ctx.currentTime + delaySec;
      const freq = this.midiToFreq(midi);

      // Two slightly detuned oscillators for rich Strat neck+middle pickup warmth
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';

      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.0018, now);

      // Low-pass filter envelope (bright pluck transient -> warm woody sustain)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2.4;
      filter.frequency.setValueAtTime(Math.min(freq * 7.5, 4800), now);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(freq * 1.9, 550),
        now + 0.26
      );

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.linearRampToValueAtTime(0.32 * velocity, now + 0.012);
      noteGain.gain.exponentialRampToValueAtTime(
        0.11 * velocity,
        now + 0.18
      );
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.35;

      osc1.connect(filter);
      osc2.connect(osc2Gain);
      osc2Gain.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.04);
      osc2.stop(now + duration + 0.04);
    } catch {
      // Ignore audio errors if browser blocks autoplay before interaction
    }
  }

  /**
   * Play a two-note voice-leading transition or slide (A -> B)
   */
  public playSlideTransition(fromMidi: number, toMidi: number): void {
    this.playNote(fromMidi, 0.65, 0.85, 0);
    this.playNote(toMidi, 1.35, 0.95, 0.38);
  }

  /**
   * Strum a guitar chord voicing across strings
   */
  public strumChord(
    midiNotes: number[],
    spreadSec: number = 0.042,
    duration: number = 1.9
  ): void {
    midiNotes.forEach((midi, idx) => {
      this.playNote(midi, duration, 0.72, idx * spreadSec);
    });
  }

  /**
   * Play an arpeggio sequence (Root -> 3rd -> 5th -> Color)
   */
  public playArpeggio(midiNotes: number[], stepSec: number = 0.22): void {
    midiNotes.forEach((midi, idx) => {
      this.playNote(midi, 1.1, 0.85, idx * stepSec);
    });
  }
}

export const guitarSynth = new GuitarSynthEngine();
