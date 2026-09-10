(function () {
  "use strict";

  class AudioManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.master = null;
      this.lastLaser = 0;
    }

    unlock() {
      if (!this.enabled) return;
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) this.unlock();
    }

    toggle() {
      this.setEnabled(!this.enabled);
      return this.enabled;
    }

    tone(startFreq, endFreq, duration, type, volume, delay) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.ctx || !this.master) return;
      const start = this.ctx.currentTime + (delay || 0);
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscillator.type = type || "sine";
      oscillator.frequency.setValueAtTime(Math.max(30, startFreq), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), start + duration);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.15, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    noise(duration, volume, delay) {
      if (!this.enabled) return;
      this.unlock();
      if (!this.ctx || !this.master) return;
      const length = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const start = this.ctx.currentTime + (delay || 0);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(this.master);
      source.start(start);
    }

    play(name) {
      const now = performance.now();
      if (name === "laser") {
        if (now - this.lastLaser < 70) return;
        this.lastLaser = now;
        this.tone(820, 420, 0.07, "square", 0.055);
      } else if (name === "explosion") {
        this.noise(0.18, 0.23);
        this.tone(130, 45, 0.2, "sawtooth", 0.1);
      } else if (name === "hit") {
        this.noise(0.14, 0.3);
        this.tone(190, 70, 0.22, "sawtooth", 0.15);
      } else if (name === "shield") {
        this.tone(310, 760, 0.12, "sine", 0.16);
      } else if (name === "powerup") {
        this.tone(420, 840, 0.14, "sine", 0.14);
        this.tone(610, 1220, 0.18, "sine", 0.1, 0.09);
      } else if (name === "pulse") {
        this.tone(110, 860, 0.5, "sawtooth", 0.18);
        this.tone(220, 1040, 0.55, "sine", 0.18, 0.04);
      } else if (name === "warning") {
        this.tone(180, 180, 0.25, "square", 0.14);
        this.tone(150, 150, 0.25, "square", 0.14, 0.36);
      } else if (name === "bossShot") {
        this.tone(250, 110, 0.22, "triangle", 0.1);
      }
    }
  }

  Starfall.AudioManager = AudioManager;
})();
