// Headless Web Audio doubles for the real-time mirror: routing, freezing, gestures and fallbacks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRealtimeMirror, mirrorWorkletSource } from '../src/audio.js';
import { createMirrorStream } from '../../viewer/vatrix.js';

const flush = async () => { for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve)); };

function setup(t, { running = true, captureError = null, workletError = null } = {}) {
  const env = { running, contexts: [], nodes: [], modules: [], reports: [], traces: [], fallbacks: 0 };
  class Node {
    constructor(kind) { this.kind = kind; this.targets = []; }
    connect(target) { this.targets.push(target); return target; }
    disconnect() { this.targets = []; }
  }
  class AudioContext {
    constructor() {
      this.state = env.running ? 'running' : 'suspended';
      this.destination = new Node('destination');
      this.audioWorklet = { addModule: async (url) => { env.modules.push(url); if (workletError) throw workletError; } };
      env.contexts.push(this);
    }
    createMediaElementSource() { if (captureError) throw captureError; return (this.source = new Node('source')); }
    createGain() { const gain = new Node('gain'); gain.gain = { value: 1 }; return (this.gain = gain); }
    createScriptProcessor() { const node = new Node('script'); env.nodes.push(node); return node; }
    resume() { if (env.running) this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  class AudioWorkletNode extends Node {
    constructor(context, name, options) {
      super('worklet');
      Object.assign(this, { context, name, options, messages: [] });
      this.port = { postMessage: (message) => this.messages.push(message) };
      env.nodes.push(this);
    }
  }
  const document = new EventTarget();
  const overrides = {
    AudioContext, AudioWorkletNode, document,
    URL: { createObjectURL: () => 'blob:mirror', revokeObjectURL() {} },
  };
  const originals = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const video = Object.assign(new EventTarget(), { paused: false, seeking: false, ended: false, readyState: 4, volume: 0.8, muted: false });
  const fallbackHandle = { mode: 'muted', enables: 0, disables: 0, destroys: 0,
    enable() { this.enables++; }, disable() { this.disables++; }, destroy() { this.destroys++; } };
  const handle = createRealtimeMirror({
    video, createMirrorStream, size: 8192,
    report: (state, text) => env.reports.push({ state, text }),
    trace: (event, details) => env.traces.push({ event, details }),
    fallback: () => { env.fallbacks++; fallbackHandle.enables++; return fallbackHandle; },
  });
  t.after(() => {
    handle.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { env, video, handle, document, fallbackHandle };
}

test('the video sound goes through the mirror, frozen while paused and reset on seeking', async (t) => {
  const r = setup(t);
  await flush();
  const [context] = r.env.contexts;
  const [node] = r.env.nodes;
  assert.equal(r.env.modules.length, 1, 'the worklet module is loaded once');
  assert.equal(node.name, 'vatrix-mirror');
  assert.deepEqual(node.options.outputChannelCount, [2]);
  assert.deepEqual(context.source.targets, [node]);
  assert.deepEqual(node.targets, [context.destination]);
  assert.equal(r.handle.mode, 'realtime');
  assert.equal(r.video.muted, false, 'the player keeps its own mute and volume');
  assert.equal(r.env.reports.at(-1).state, 'ready');
  assert.deepEqual(node.messages, ['run']);

  r.video.paused = true;
  r.video.dispatchEvent(new Event('pause'));
  r.video.seeking = true;
  r.video.dispatchEvent(new Event('seeking'));
  r.video.seeking = false;
  r.video.paused = false;
  r.video.dispatchEvent(new Event('playing'));
  assert.deepEqual(node.messages, ['run', 'stop', 'reset', 'stop', 'run']);

  // Off hands the original sound back through the unity gain; on reuses the same node.
  r.handle.disable();
  assert.deepEqual(context.source.targets, [context.gain]);
  assert.equal(context.gain.gain.value, 1);
  assert.equal(node.messages.at(-1), 'stop');
  r.handle.enable();
  await flush();
  assert.equal(r.env.nodes.length, 1);
  assert.deepEqual(context.source.targets, [node]);
  assert.equal(node.messages.at(-1), 'run');
  r.handle.destroy();
  assert.deepEqual(context.source.targets, [context.gain]);
});

test('without a gesture the scrambled sound stays muted until the first click', async (t) => {
  const r = setup(t, { running: false });
  await flush();
  assert.equal(r.video.muted, true);
  assert.equal(r.handle.mode, 'muted');
  assert.equal(r.env.reports.at(-1).state, 'blocked');
  assert.equal(r.env.contexts[0].state, 'closed', 'a suspended context is never attached');
  // Unmuting in the player must not expose the scrambled track.
  r.video.muted = false;
  r.video.dispatchEvent(new Event('volumechange'));
  assert.equal(r.video.muted, true);
  r.env.running = true;
  r.document.dispatchEvent(new Event('pointerdown'));
  await flush();
  assert.equal(r.handle.mode, 'realtime');
  assert.equal(r.video.muted, false, 'the wanted (unmuted) state comes back');
  assert.equal(r.env.reports.at(-1).state, 'ready');
});

test('a video the page already captured falls back to the download restorer', async (t) => {
  const error = Object.assign(new Error('already connected'), { name: 'InvalidStateError' });
  const r = setup(t, { captureError: error });
  await flush();
  assert.equal(r.env.fallbacks, 1);
  assert.equal(r.handle.mode, 'muted');
  r.handle.disable();
  r.handle.enable();
  assert.deepEqual([r.fallbackHandle.disables, r.fallbackHandle.enables], [1, 2]);
  assert.ok(r.env.traces.some((entry) => entry.event === 'realtime-failed'));
});

test('a page that refuses the worklet module gets the script-processor mirror', async (t) => {
  const r = setup(t, { workletError: new Error('CSP') });
  await flush();
  const [context] = r.env.contexts;
  const [node] = r.env.nodes;
  assert.equal(node.kind, 'script');
  assert.deepEqual(context.source.targets, [node]);
  assert.equal(r.handle.mode, 'realtime');
  assert.match(r.env.reports.at(-1).text, /兼容模式/);
  // Its processing callback mirrors while running and is silent when stopped.
  const buffer = (fill) => ({ getChannelData: () => new Float32Array(1024).fill(fill) });
  const output = { channels: [new Float32Array(1024), new Float32Array(1024)], getChannelData(c) { return this.channels[c]; } };
  r.video.paused = true;
  r.video.dispatchEvent(new Event('pause'));
  output.channels[0].fill(1);
  node.onaudioprocess({ inputBuffer: buffer(0.5), outputBuffer: output });
  assert.ok(output.channels[0].every((v) => v === 0));
});

test('the generated worklet module runs the mirror stream and holds it while stopped', () => {
  let Processor;
  class AudioWorkletProcessor { constructor() { this.port = {}; } }
  new Function('registerProcessor', 'AudioWorkletProcessor', mirrorWorkletSource(createMirrorStream, 8192))(
    (name, processor) => { assert.equal(name, 'vatrix-mirror'); Processor = processor; }, AudioWorkletProcessor);
  const processor = new Processor();
  const tone = (n) => Float32Array.from({ length: 128 }, (_, i) => Math.sin((2 * Math.PI * 1000 * (n * 128 + i)) / 48000));
  const out = () => [new Float32Array(128), new Float32Array(128)];
  let output = out();
  processor.process([[tone(0), tone(0)]], [output]);
  assert.ok(output[0].every((v) => v === 0), 'stopped: silence');
  processor.port.onmessage({ data: 'run' });
  let heard = false;
  for (let n = 0; n < 200; n++) {
    output = out();
    // A mono input feeds both channels.
    processor.process([[tone(n)]], [output]);
    if (n * 128 >= 8192) heard ||= output[1].some((v) => Math.abs(v) > 0.1);
    else assert.ok(output[0].every((v) => v === 0), `nothing before the latency (quantum ${n})`);
  }
  assert.ok(heard, 'mirrored sound after the latency');
  processor.port.onmessage({ data: 'reset' });
  output = out();
  processor.process([[tone(0)]], [output]);
  assert.ok(output[0].every((v) => v === 0), 'reset: the latency starts over');
});
