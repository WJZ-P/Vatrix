// A small DOM test double, not browser automation. Exercise the actual install
// function and its click listener, including partial initialization failures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installUserscript } from '../src/main.js';
import { createIntroReader } from '../src/intro.js';
import { validateSettings, querySettings, descriptionSettings, videoPageKey, pageSettings, rememberPageSettings, forgetPageSettings } from '../src/settings.js';
import { SITES } from '../src/sites.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const defaults = { width: 720, height: 1280, tile: 40, margin: 0, seed: 'sensitive-seed', invert: false, autoIntro: false, audioMs: 0 };
const header = { width: 640, height: 360, tile: 40, margin: 0, invert: false, audioMs: 0, seed: null };

class Element extends EventTarget {
  constructor() {
    super();
    Object.assign(this, { style: { position: 'relative' }, dataset: {}, isConnected: true, textContent: '',
      hidden: false, value: '', checked: false, validity: { valid: true }, offsetWidth: 640, offsetHeight: 360,
      clientWidth: 640, clientHeight: 360, clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0 });
  }
  append(child) { child.parentElement = this; }
  after(child) { this.nextElementSibling = child; child.parentElement = this.parentElement; }
  remove() { this.isConnected = false; }
  setAttribute() {}
  focus() {}
  select() { this.selected = true; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  attachShadow() { this.shadowRoot = new Shadow(); return this.shadowRoot; }
  getContext() { return { isContextLost: () => false, getParameter: () => 8192, getError: () => 0, NO_ERROR: 0, getExtension: () => null }; }
}

class Shadow {
  set innerHTML(html) {
    this.nodes = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
    this.form = new Element();
    this.form.elements = [...html.matchAll(/<input\b([^>]+)>/g)].map((match) => {
      const element = new Element();
      element.name = /name="([^"]+)"/.exec(match[1])?.[1];
      element.type = /type="([^"]+)"/.exec(match[1])?.[1];
      return element;
    });
    this.form.elements.namedItem = (name) => this.form.elements.find((element) => element.name === name);
    this.form.checkValidity = () => this.form.elements.every((element) => element.validity.valid);
    this.form.reportValidity = this.form.checkValidity;
  }
  getElementById(id) { return this.nodes.get(id); }
  querySelector(selector) { assert.equal(selector, 'form'); return this.form; }
}

function setup(t, { failFirstInit = false, audioFailure = false, audioFactory = null, realtimeFactory = null, audioPlan = { audioMs: 250 }, result = null } = {}) {
  const area = new Element();
  const wrapper = new Element();
  const toolbar = new Element();
  toolbar.parentElement = new Element();
  const video = Object.assign(new Element(), { parentElement: wrapper, closest: () => area, currentTime: 20,
    readyState: 2, videoWidth: 640, videoHeight: 360, paused: true, seeking: false, ended: false });
  const document = Object.assign(new Element(), { readyState: 'complete', hidden: false, documentElement: new Element(),
    createElement: () => new Element(), querySelectorAll: () => [video],
    // No server-rendered marker: this page counts as hydrated.
    querySelector: (selector) => (selector === '[data-server-rendered]' ? null : toolbar) });
  const location = { href: 'https://www.bilibili.com/video/BVfixture/', search: '' };
  const saved = new Map();
  if (audioFailure || audioFactory || realtimeFactory) {
    saved.set('vatrix.bilibili.settings.v1', { ...defaults, autoIntro: true, ...audioPlan });
    saved.set('vatrix.bilibili.pages.v1', rememberPageSettings({}, videoPageKey(location.href),
      { ...defaults, autoIntro: true, ...audioPlan }, 'intro'));
  }
  const callbacks = [];
  const order = [];
  const overrides = {
    document, location, window: Object.assign(new EventTarget(), { innerWidth: 1200, innerHeight: 900 }),
    getComputedStyle: () => ({ position: 'relative' }),
    MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, setInterval: () => 1, clearInterval: () => {},
    FormData: class {
      constructor(form) { this.entries = form.elements.filter((e) => e.type !== 'checkbox').map((e) => [e.name, e.value]); }
      [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    },
  };
  const originals = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  let initCount = 0;
  const app = installUserscript({
    defaults, scriptVersion: 'ui-test', site: SITES.bilibili,
    validateSettings, querySettings, descriptionSettings, videoPageKey, pageSettings, rememberPageSettings, forgetPageSettings,
    storage: { get: (key, fallback) => saved.get(key) ?? fallback, set: (key, value) => saved.set(key, value) },
    menu: { register: () => 1, unregister: () => {} },
    createRestorer: () => ({ draw() {}, destroy() {} }), decodeQr: () => null,
    scanIntro: async (_video, options) => { callbacks.push(options); return result; },
    createIntroReader: (...args) => {
      order.push('qr-init');
      if (failFirstInit && ++initCount === 1) throw new Error('initial QR setup failed');
      return createIntroReader(...args);
    },
    audio: { watchAudioUrls: () => ({ stop() {} }),
      createAudioRestorer: (options) => {
        order.push('audio-init');
        if (audioFactory) return audioFactory(options);
        throw new Error('audio setup failed');
      },
      createRealtimeMirror: (options) => {
        order.push('realtime-init');
        if (realtimeFactory) return realtimeFactory(options);
        throw new Error('realtime setup failed');
      } },
  });
  t.after(() => app.dispose());
  return { panel: toolbar.nextElementSibling.shadowRoot, video, location, callbacks, order };
}

test('actual manual click handler responds immediately and starts a paused-frame scan', async (t) => {
  const r = setup(t);
  const button = r.panel.getElementById('scan-intro');
  button.dispatchEvent(new Event('click'));
  assert.match(button.textContent, /识别中/);
  await flush();
  assert.equal(r.callbacks.length, 1);
  assert.equal(r.callbacks[0].untilSeconds, Infinity);
  assert.match(r.panel.getElementById('intro-status').textContent, /没有识别到/);
  assert.equal(r.panel.getElementById('scan-intro').textContent, '识别当前画面');
});

test('manual click retries a reader whose initial construction failed', async (t) => {
  const r = setup(t, { failFirstInit: true });
  assert.match(r.panel.getElementById('intro-status').textContent, /initial QR setup failed/);
  r.panel.getElementById('scan-intro').dispatchEvent(new Event('click'));
  await flush();
  assert.equal(r.callbacks.length, 1);
  assert.equal(r.order.filter((step) => step === 'qr-init').length, 2);
});

test('synchronous audio failure does not leave the QR button uninitialized', async (t) => {
  const r = setup(t, { audioFailure: true });
  assert.deepEqual(r.order.slice(0, 2), ['qr-init', 'audio-init']);
  r.panel.getElementById('scan-intro').dispatchEvent(new Event('click'));
  await flush();
  assert.equal(r.callbacks.length, 1);
  assert.match(r.panel.getElementById('audio-status').textContent, /音频初始化失败/);
});

test('stale binding reports an explicit error rather than a silent no-op', async (t) => {
  const r = setup(t);
  r.location.href = 'https://www.bilibili.com/video/BVother/';
  r.panel.getElementById('scan-intro').dispatchEvent(new Event('click'));
  await flush();
  assert.equal(r.callbacks.length, 0);
  assert.match(r.panel.getElementById('intro-status').textContent, /绑定已过期/);
});

test('the actual form applies decoded parameters and exposes the script version', async (t) => {
  const r = setup(t, { result: header });
  r.panel.getElementById('scan-intro').dispatchEvent(new Event('click'));
  await flush();
  assert.equal(r.panel.form.elements.namedItem('width').value, 640);
  assert.match(r.panel.getElementById('intro-status').textContent, /已读取片头二维码/);
  assert.equal(r.panel.getElementById('build-version').textContent, 'vui-test');
});

test('a rejected form opens the collapsed manual fields so the bad one can be shown', async (t) => {
  const r = setup(t, { result: header });
  assert.notEqual(r.panel.getElementById('manual').open, true, 'manual fields start collapsed');
  r.panel.form.elements.namedItem('audioMs').validity.valid = false;
  r.panel.getElementById('scan-intro').dispatchEvent(new Event('click'));
  await flush();
  assert.match(r.panel.getElementById('intro-status').textContent, /参数未成功应用/);
  assert.equal(r.panel.getElementById('manual').open, true);
  assert.match(r.panel.getElementById('status').textContent, /手动参数有误/);
});

test('a mirror-only plan restores in real time, with the download restorer as its fallback', (t) => {
  const handles = [];
  const downloads = [];
  const r = setup(t, {
    audioPlan: { audioMs: 0, audioMirror: true },
    realtimeFactory: (options) => {
      const handle = { blockMs: 0, mirror: true, mode: 'realtime', options, enables: 0, disables: 0, destroys: 0,
        enable() { this.enables++; }, disable() { this.disables++; }, destroy() { this.destroys++; } };
      handles.push(handle);
      return handle;
    },
    audioFactory: (options) => { downloads.push(options); return { blockMs: options.blockMs, mirror: options.mirror, mode: 'muted',
      enable() {}, disable() {}, destroy() {} }; },
  });
  assert.equal(handles.length, 1);
  assert.deepEqual(r.order.filter((step) => /^(audio|realtime)-/.test(step)), ['realtime-init']);
  assert.equal(downloads.length, 0, 'nothing is downloaded up front');
  // The fallback builds a download restorer for the same mirror-only plan.
  handles[0].options.fallback();
  assert.deepEqual([downloads[0].blockMs, downloads[0].mirror], [0, true]);
  // A legacy block length switches to the download restorer.
  r.panel.form.elements.namedItem('audioMs').value = '250';
  r.panel.form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(handles[0].destroys, 1);
  assert.deepEqual([downloads.at(-1).blockMs, downloads.at(-1).mirror], [250, true]);
});

test('the actual toggle pauses/reuses audio; block length, mirror and source changes destroy it', (t) => {
  const handles = [];
  const r = setup(t, { audioFactory: ({ blockMs, mirror }) => {
    const handle = { blockMs, mirror, mode: 'muted', enables: 0, disables: 0, destroys: 0,
      enable() { this.enables++; }, disable() { this.disables++; }, destroy() { this.destroys++; } };
    handles.push(handle);
    return handle;
  } });
  assert.equal(handles.length, 1);
  r.panel.getElementById('toggle').dispatchEvent(new Event('click'));
  assert.equal(handles[0].disables, 1);
  assert.equal(handles[0].destroys, 0);
  r.panel.getElementById('toggle').dispatchEvent(new Event('click'));
  assert.equal(handles.length, 1);
  assert.equal(handles[0].enables, 1);
  r.panel.form.elements.namedItem('audioMs').value = '500';
  r.panel.form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(handles[0].destroys, 1);
  assert.equal(handles[1].blockMs, 500);
  assert.equal(handles[1].mirror, false, 'a remembered page without the field was reversed only');
  r.panel.form.elements.namedItem('audioMirror').checked = true;
  r.panel.form.dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(handles[1].destroys, 1);
  assert.equal(handles[2].mirror, true);
  r.video.dispatchEvent(new Event('loadstart'));
  assert.equal(handles[2].destroys, 1);
  r.video.currentSrc = 'blob:replacement';
  r.video.dispatchEvent(new Event('loadeddata'));
  assert.equal(handles.length, 4);
});
