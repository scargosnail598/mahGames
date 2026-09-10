// Node-only regression coverage for scheduling, muting and background suspension.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let timers = 0, voices = 0;
const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; } });
class Context {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
  createGain() { return { gain: param(), connect() {}, disconnect() {} }; }
  createOscillator() { voices++; return { frequency: param(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
  createStereoPanner() { return { pan: param(), connect() {}, disconnect() {} }; }
  createBiquadFilter() { return { frequency: param(), Q: param(), connect() {} }; }
  createConvolver() { return { connect() {} }; }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  resume() { this.state = 'running'; return Promise.resolve(); }
}
const sandbox = { Starfall: {}, window: { AudioContext: Context }, performance: { now: () => 1000 }, localStorage: { getItem: () => null, setItem() {} }, setInterval() { return ++timers; } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/audio.js'), 'utf8'), sandbox);
const a = new sandbox.Starfall.AudioManager();
assert.equal(a.ctx, null, 'must not autoplay');
a.unlock(); a.unlock(); assert.equal(timers, 1, 'only one music scheduler');
a.scheduleMusic(); assert.ok(voices > 0);
assert.equal(a.musicBus.gain.value, .12);
a.setScene('paused'); assert.equal(a.musicBus.gain.value, .03);
a.setEnabled(false); assert.equal(a.master.gain.value, 0); assert.equal(a.musicBus.gain.value, 0);
const mutedVoices = voices; a.ctx.currentTime += 1; a.scheduleMusic(); assert.equal(voices, mutedVoices);
a.setEnabled(true); a.setScene('playing'); a.setMusicVolume(0);
a.ctx.currentTime += 1; a.scheduleMusic(); assert.equal(voices, mutedVoices, 'zero volume creates no new notes');
a.setMusicVolume(.12); a.setBackgrounded(true); assert.equal(a.ctx.state, 'suspended');
a.unlock(); assert.equal(a.ctx.state, 'suspended', 'background unlock cannot resume');
a.setBackgrounded(false); assert.equal(a.ctx.state, 'suspended', 'focus alone cannot resume');
a.unlock(); assert.equal(a.ctx.state, 'running');
a.ctx.currentTime += 100; a.scheduleMusic(); assert.ok(voices - mutedVoices < 10, 'no catch-up burst');
a.setMusicVolume(10); assert.equal(a.musicVolume, .35); a.setMusicVolume(-10); assert.equal(a.musicVolume, 0);
console.log('PASS: no autoplay, single scheduler, pause ducking, master mute, zero volume, background suspend, gesture resume, no backlog and volume limits.');
