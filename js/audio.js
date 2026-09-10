(function () {
  "use strict";

  class AudioManager {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.master = null;
      this.lastLaser = 0;
      this.musicVolume = .12;
      this.backgrounded = false;
      this.scene = 'menu';
      try {
        const saved=localStorage.getItem('starfall-music-volume');
        if(saved!==null && Number.isFinite(Number(saved)))this.musicVolume=Math.max(0,Math.min(.35,Number(saved)));
      } catch (_) {}
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
        this.createMusic();
      }
      if (!this.backgrounded && this.ctx.state === "suspended") this.ctx.resume().catch(()=>{});
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) this.unlock();
      if(this.master)this.master.gain.setTargetAtTime(enabled?.18:0,this.ctx.currentTime,.025);
      this.updateMusicLevel();
    }

    toggle() {
      this.setEnabled(!this.enabled);
      return this.enabled;
    }

    // Original 72 BPM pentatonic ambient score. No downloads or autoplay.
    createMusic() {
      const c=this.ctx;
      this.musicBus=c.createGain();this.musicBus.gain.value=0;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;filter.Q.value=.4;
      const reverb=c.createConvolver(), length=Math.floor(c.sampleRate*2.1);
      const impulse=c.createBuffer(2,length,c.sampleRate);
      let seed=73;
      for(let ch=0;ch<2;ch++){
        const data=impulse.getChannelData(ch);
        for(let i=0;i<length;i++) {seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.pow(1-i/length,3)*.35;}
      }
      reverb.buffer=impulse;
      const wet=c.createGain();wet.gain.value=.55;
      filter.connect(this.musicBus);filter.connect(reverb);reverb.connect(wet);wet.connect(this.musicBus);
      this.musicBus.connect(this.master);this.musicInput=filter;
      this.musicStep=0;this.nextMusicTime=c.currentTime+.08;
      this.musicTimer=setInterval(()=>this.scheduleMusic(),120);
      this.updateMusicLevel();
    }

    updateMusicLevel() {
      if(!this.musicBus)return;
      const target=this.enabled&&!this.backgrounded?this.musicVolume*(this.scene==='paused'?.25:1):0;
      this.musicBus.gain.setTargetAtTime(target,this.ctx.currentTime,.3);
    }

    setMusicVolume(value) {
      this.musicVolume=Math.max(0,Math.min(.35,Number(value)||0));
      try { localStorage.setItem('starfall-music-volume',String(this.musicVolume)); } catch (_) {}
      this.unlock();this.updateMusicLevel();
    }

    setScene(scene) {this.scene=scene;this.updateMusicLevel();}

    setBackgrounded(value) {
      this.backgrounded=value;this.updateMusicLevel();
      if(value && this.ctx && this.ctx.state==='running')this.ctx.suspend().catch(()=>{});
      // Resume only on a user gesture, never on visibility alone.
    }

    musicNote(midi,start,duration,volume,type,pan,attack) {
      const c=this.ctx,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
      o.type=type;o.frequency.value=440*Math.pow(2,(midi-69)/12);p.pan.value=pan;
      g.gain.setValueAtTime(.0001,start);
      g.gain.exponentialRampToValueAtTime(volume,start+attack);
      g.gain.exponentialRampToValueAtTime(.0001,start+duration);
      o.connect(g);g.connect(p);p.connect(this.musicInput);
      o.onended=()=>{o.disconnect();g.disconnect();p.disconnect();};
      o.start(start);o.stop(start+duration+.05);
    }

    scheduleMusic() {
      if(!this.ctx || this.ctx.state!=='running')return;
      const now=this.ctx.currentTime,beat=60/72;
      if(this.nextMusicTime<now-.4)this.nextMusicTime=now+.05;
      // Schedule a small lookahead window; background tabs cannot accumulate notes.
      while(this.nextMusicTime<now+.3){
        const step=this.musicStep,t=this.nextMusicTime,bar=Math.floor(step/8)%8;
        if(this.enabled && !this.backgrounded && this.musicVolume>0){
          const chords=[[45,52,59],[41,48,55],[48,55,62],[43,50,57]];
          if(step%8===0){
            chords[Math.floor(bar/2)].forEach((n,i)=>this.musicNote(n,t,beat*5,.13,'sine',(i-1)*.35,.7));
            this.musicNote(chords[Math.floor(bar/2)][0]-12,t,beat*3,.10,'sine',0,.4);
          }
          const melody=[69,null,72,76,null,79,76,null,72,null,69,null,67,64,null,null];
          const note=melody[step%16];
          if(note!==null)this.musicNote(note+(bar>=4?-12:0),t,beat*2.8,.14,'triangle',Math.sin(step*.7)*.45,.018);
          if(step%16===12)this.musicNote(88,t,beat*3,.035,'sine',-.3,.025);
        }
        this.musicStep++;this.nextMusicTime+=beat/2;
      }
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
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
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
      source.onended=()=>{source.disconnect();gain.disconnect();};
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
