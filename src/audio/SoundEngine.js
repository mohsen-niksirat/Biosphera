/**
 * Biosphera - Procedural WebAudio Sound Engine
 * Synthesizes organic soundscapes, creature vocalizations, and environmental effects with zero external audio assets.
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true; // Start muted to adhere to browser autoplay policies
    this.ambientGain = null;
    this.sfxGain = null;
    this.ambientOsc = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gains
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.06, this.ctx.currentTime);
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
      this.isMuted = false;
    } else {
      this.isMuted = !this.isMuted;
      if (this.ctx.state === 'suspended' && !this.isMuted) {
        this.ctx.resume();
      }
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

    // Sub-bass oceanic drone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(58, this.ctx.currentTime); // subtle beat frequency

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.ambientGain);

    osc1.start();
    osc2.start();
    this.ambientOsc = [osc1, osc2];
  }

  playBirth() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playEat() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

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
