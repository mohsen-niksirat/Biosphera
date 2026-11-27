/**
 * Biosphera - Procedural WebAudio Sound Engine
 * Synthesizes telemetry-reactive oceanic soundscapes, pentatonic mitosis/speciation pings,
 * and creature vocalizations with zero external audio assets.
 */

// Deep-ocean pentatonic scales (Hz)
const DAY_PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
const NIGHT_PENTATONIC = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Start muted to adhere to browser autoplay policies
    this.ambientGain = null;
    this.ambientFilter = null;
    this.ambientHarmonicGain = null;
    this.sfxGain = null;
    this.ambientOsc = null;

    // Telemetry state for reactive modulation
    this.isNight = false;
    this.darkness = 0;
    this.lastEatTime = 0;
    this.lastBirthTime = 0;
    this.birthStep = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gains
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      this.ambientGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);

      this.startAmbientDrone();
    } catch (e) {
      console.warn('WebAudio not supported:', e);
    }
  }

  toggleMute() {
    if (!this.ctx) {
      this.init();
      // WebAudio unavailable: stay muted so the button never reports a sound
      // that cannot exist, and repeated clicks don't wedge the state.
      if (!this.ctx) return false;
      this.isMuted = false;
    } else {
      this.isMuted = !this.isMuted;
    }
    // Browsers may create the context suspended (autoplay policy) — the very
    // first unmute must resume it or the soundscape stays silent.
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume();
    }

    if (this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.05, this.ctx.currentTime, 0.1);
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.2, this.ctx.currentTime, 0.1);
    }

    return !this.isMuted;
  }

  startAmbientDrone() {
    if (!this.ctx || this.ambientOsc) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const harmonicGain = this.ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, now);
    filter.Q.setValueAtTime(1.2, now);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, now); // A1 fundamental

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(56.5, now); // gentle beating

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(164.81, now); // E3 fifth harmonic
    harmonicGain.gain.setValueAtTime(0.18, now);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(this.ambientGain);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    this.ambientOsc = [osc1, osc2, osc3];
    this.ambientFilter = filter;
    this.ambientHarmonicGain = harmonicGain;
  }

  /**
   * Modulate drone filter cutoff & harmonic scale based on world & circadian telemetry.
   * Safe to call every frame or on telemetry ticks.
   */
  updateTelemetry(world = null, dayNight = null) {
    if (dayNight) {
      const lighting = dayNight.getLighting();
      this.darkness = lighting.darkness ?? 0;
      this.isNight = Boolean(lighting.isBioluminescent || this.darkness > 0.4);
    }

    if (this.isMuted || !this.ctx || !this.ambientFilter || !this.ambientOsc) return;

    const now = this.ctx.currentTime;
    const pop = world?.organisms?.length ?? 20;
    const popFactor = Math.min(1, pop / 120);

    // Day: brighter open cutoff (180–260Hz); Night: deep abyssal cutoff (75–120Hz)
    const targetCutoff = (this.isNight ? 80 : 190) + popFactor * (this.isNight ? 40 : 75);
    this.ambientFilter.frequency.setTargetAtTime(targetCutoff, now, 0.4);

    // Shift harmonic fifth: day = E3 (164.81 Hz), night = C3/Eb3 darker sub-harmonic (130.81 Hz)
    const targetHarmonicFreq = this.isNight ? 130.81 : 164.81;
    this.ambientOsc[2].frequency.setTargetAtTime(targetHarmonicFreq, now, 0.6);

    if (this.ambientHarmonicGain) {
      this.ambientHarmonicGain.gain.setTargetAtTime(this.isNight ? 0.28 : 0.14, now, 0.5);
    }
  }

  playBirth(generation = 1) {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBirthTime < 0.06) return;
    this.lastBirthTime = now;

    // Pentatonic mitosis ping
    const scale = this.isNight ? NIGHT_PENTATONIC : DAY_PENTATONIC;
    const idx = (this.birthStep + Math.max(0, generation - 1)) % scale.length;
    this.birthStep = (this.birthStep + 1) % scale.length;
    const freq = scale[idx];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.16);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.29);
  }

  playSpeciation() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const scale = this.isNight ? NIGHT_PENTATONIC : DAY_PENTATONIC;
    const root = scale[Math.floor(Math.random() * (scale.length - 2))];
    const fifth = root * 1.5;

    [root, fifth].forEach((freq, i) => {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  playEat() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastEatTime < 0.05) return;
    this.lastEatTime = now;

    // Water bubble pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 + Math.random() * 80, now);
    osc.frequency.exponentialRampToValueAtTime(520 + Math.random() * 120, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playAttack() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Crisp low chomp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.14);
  }

  playDisaster() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Earthquake / rumble sub shock
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.8);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.85);
  }
}
