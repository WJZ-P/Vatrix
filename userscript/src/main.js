/** Browser integration only. The renderer and desktop defaults are injected by the build. */
export function installUserscript({ createRestorer, scanIntro, decodeQr, createIntroReader, audio, defaults, validateSettings, querySettings, descriptionSettings, videoPageKey, pageSettings, rememberPageSettings, forgetPageSettings, storage, menu, iconUrl, scriptVersion = 'unknown' }) {
  const SELECTOR = '.bpx-player-primary-area video';
  const TOOLBAR_SELECTOR = '#arc_toolbar_report .video-toolbar-left-main';
  const STORAGE_KEY = 'vatrix.bilibili.settings.v1';
  // Per-video memory, keyed by BVID and part: what the intro QR said, plus
  // whatever the viewer corrected by hand on that page.
  const PAGES_KEY = 'vatrix.bilibili.pages.v1';
  let settings;
  let settingsNotice = '';
  let enabled = false;
  let active = null;
  let scanHandle = null;
  let pageKey = videoPageKey(location.href);
  let disposed = false;
  // Audio files the player fetched; only those requested after the current
  // video was navigated to can belong to it.
  const audioUrls = audio?.watchAudioUrls();
  let navigatedAt = 0;
  // Bilibili renders its pages on the server with Vue and hydrates them only
  // after the player has started. A node of ours inside that server-rendered
  // markup makes hydration fail; Vue then renders the whole page again, the
  // player container goes with it, and the page's player check (checkBofqi)
  // rebuilds the player, so the video restarts from 0. Vue removes
  // data-server-rendered from its root as hydration starts, and hydration is
  // synchronous, so the toolbar button waits for that attribute to go. The
  // player's own DOM is not server-rendered: the canvas mounts at once, so the
  // intro in the first second is still read.
  const hydrationDeadline = Date.now() + 30000;
  const hydrated = () => !document.querySelector('[data-server-rendered]') || Date.now() > hydrationDeadline;

  /** This page's remembered plan, ignored when it no longer validates. */
  function pageMemory() {
    let entry;
    try {
      entry = pageSettings(storage.get(PAGES_KEY, {}), pageKey);
    } catch { return null; }
    if (!entry) return null;
    try {
      validateSettings(entry.settings, defaults);
    } catch { return null; }
    return entry;
  }
  function rememberPage(values, source) {
    if (!pageKey) return;
    try {
      storage.set(PAGES_KEY, rememberPageSettings(storage.get(PAGES_KEY, {}), pageKey, values, source));
    } catch { /* Memory is a convenience; this session still works without it. */ }
  }
  function forgetPage() {
    if (!pageKey) return;
    try {
      storage.set(PAGES_KEY, forgetPageSettings(storage.get(PAGES_KEY, {}), pageKey));
    } catch { /* As above. */ }
  }
  /** Only a page whose intro QR we verified restores by itself. */
  function autoEnabled() {
    return Boolean(settings.autoIntro && pageMemory()?.source === 'intro');
  }

  function loadSettings() {
    settingsNotice = '';
    // This page's memory beats the last-used values; an explicit URL still wins.
    const remembered = pageMemory()?.settings ?? {};
    try {
      const saved = storage.get(STORAGE_KEY, {});
      return validateSettings({ ...saved, ...remembered, ...querySettings(location.search) }, defaults);
    } catch (error) {
      settingsNotice = `参数读取失败，已恢复默认值：${error.message}`;
      return validateSettings({}, defaults);
    }
  }
  settings = loadSettings();
  enabled = autoEnabled();

  function mount(video, toolbar) {
    const mountedPageKey = pageKey;
    const area = video.closest('.bpx-player-primary-area');
    const wrapper = video.parentElement;
    const listeners = new AbortController();
    const positioned = [];
    for (const element of [wrapper]) {
      if (getComputedStyle(element).position === 'static') {
        positioned.push([element, element.style.position]);
        element.style.position = 'relative';
      }
    }

    const canvas = document.createElement('canvas');
    canvas.dataset.vatrixRestored = '';
    canvas.setAttribute('aria-hidden', 'true');
    // Stay inside the video layer: danmaku and player controls remain above us.
    canvas.style.cssText = 'position:absolute;pointer-events:none;z-index:1;background:#000;object-fit:contain;visibility:hidden;';
    wrapper.append(canvas);
    const ui = document.createElement('div');
    ui.id = 'vatrix-userscript-ui';
    ui.style.cssText = 'display:inline-flex;align-items:center;position:relative;flex-shrink:0;margin-left:16px;pointer-events:auto;';
    const shadow = ui.attachShadow({ mode: 'open' });
    // Bilibili's own theme variables (bili-theme map.css) inherit into the
    // shadow tree, so the panel follows whichever theme the page has loaded;
    // the fallbacks are its light values.
    shadow.innerHTML = `
      <style>
        :host {
          --vx-blue: var(--brand_blue, #00aeec);
          --vx-blue-thin: var(--brand_blue_thin, #dff6fd);
          --vx-surface: var(--bg1_float, #fff);
          --vx-well: var(--graph_bg_regular, #f1f2f3);
          --vx-line: var(--line_regular, #e3e5e7);
          --vx-line-light: var(--line_light, #f1f2f3);
          --vx-text1: var(--text1, #18191c);
          --vx-text2: var(--text2, #61666d);
          --vx-text3: var(--text3, #9499a0);
          --vx-weak: var(--graph_weak, #c9ccd0);
          --vx-white: var(--text_white, #fff);
          --vx-red: var(--stress_red, #f85a54);
          --vx-green: var(--success_green, #2ac864);
          font-size: 14px; line-height: 1.5; text-align: left;
        }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }
        button, input { font: inherit; color: inherit; }
        button { cursor: pointer; }
        :focus-visible { outline: 2px solid var(--vx-blue); outline-offset: 2px; }
        #open { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0; border: 0; background: none;
          color: var(--vx-text2); font-size: 13px; white-space: nowrap; transition: color .2s; }
        #open:hover, #open[aria-expanded=true], :host([data-enabled=true]) #open { color: var(--vx-blue); }
        #open img { display: block; width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; }
        dialog { position: fixed; margin: 0; width: min(340px, calc(100vw - 24px)); max-width: none; padding: 0;
          overflow-y: auto; border: 1px solid var(--vx-line); border-radius: 8px; background: var(--vx-surface);
          color: var(--vx-text1); box-shadow: 0 0 30px rgba(0, 0, 0, .1); overscroll-behavior: contain; }
        dialog[open] { animation: vx-pop .18s ease-out; }
        @keyframes vx-pop { from { opacity: 0; transform: translateY(-6px); } }
        dialog::backdrop { background: transparent; }
        form { display: flex; flex-direction: column; gap: 14px; margin: 0; padding: 16px; }
        header { display: flex; align-items: center; gap: 8px; }
        header img { width: 22px; height: 22px; }
        header strong { font-size: 16px; font-weight: 600; }
        #build-version { font-size: 12px; color: var(--vx-text3); }
        #close { display: grid; place-items: center; width: 28px; height: 28px; margin-left: auto; padding: 0; border: 0;
          border-radius: 6px; background: none; color: var(--vx-text3); transition: background-color .2s, color .2s; }
        #close:hover { background: var(--vx-well); color: var(--vx-text1); }
        #close svg { width: 14px; height: 14px; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
        .hero { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 8px;
          background: var(--vx-well); transition: background-color .25s; }
        :host([data-enabled=true]) .hero { background: var(--vx-blue-thin); }
        .hero > div { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
        .hero strong { font-size: 15px; font-weight: 600; }
        #status { font-size: 12px; color: var(--vx-text2); overflow-wrap: anywhere; }
        [role=status][data-error=true] { color: var(--vx-red); }
        .switch, #toggle { appearance: none; position: relative; flex: none; width: 40px; height: 22px; margin: 0; padding: 0;
          border: 0; border-radius: 11px; background: var(--vx-weak); cursor: pointer; transition: background-color .2s; }
        .switch::after, #toggle::after { content: ""; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
          border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .2); transition: transform .2s; }
        .switch:checked, #toggle[aria-checked=true] { background: var(--vx-blue); }
        .switch:checked::after, #toggle[aria-checked=true]::after { transform: translateX(18px); }
        .intro { display: flex; align-items: flex-start; gap: 8px; margin-top: -4px; font-size: 12px; color: var(--vx-text2); }
        .intro::before { content: ""; flex: none; width: 6px; height: 6px; margin-top: 6px; border-radius: 50%;
          background: var(--vx-weak); transition: background-color .2s; }
        :host([data-intro=found]) .intro::before { background: var(--vx-green); }
        :host([data-intro=scanning]) .intro::before { background: var(--vx-blue); animation: vx-blink 1s ease-in-out infinite; }
        :host([data-intro=missing]) .intro::before, :host([data-intro=error]) .intro::before { background: var(--vx-red); }
        @keyframes vx-blink { 50% { opacity: .3; } }
        #intro-status { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .link { flex: none; padding: 0; border: 0; background: none; color: var(--vx-blue); font-size: 12px; transition: opacity .2s; }
        .link:hover { opacity: .75; }
        #audio-status { margin: -8px 0 0 14px; font-size: 12px; color: var(--vx-text2); overflow-wrap: anywhere; }
        label { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; font-size: 13px; color: var(--vx-text2); }
        input:not([type=checkbox]) { width: 100%; height: 34px; padding: 0 10px; border: 1px solid var(--vx-line); border-radius: 6px;
          background: var(--vx-well); color: var(--vx-text1); font-size: 14px; outline: none;
          transition: border-color .2s, background-color .2s; }
        input:not([type=checkbox]):hover { border-color: var(--vx-weak); }
        input:not([type=checkbox]):focus { border-color: var(--vx-blue); background: var(--vx-surface); }
        small { font-size: 12px; color: var(--vx-text3); }
        .option { flex-direction: row; align-items: center; gap: 12px; color: var(--vx-text1); font-size: 14px; cursor: pointer; }
        .option > span { display: flex; flex: 1; flex-direction: column; min-width: 0; }
        details { padding-top: 12px; border-top: 1px solid var(--vx-line-light); }
        summary { display: flex; align-items: baseline; gap: 8px; list-style: none; color: var(--vx-text1); cursor: pointer; }
        summary::-webkit-details-marker { display: none; }
        summary::after { content: ""; align-self: center; width: 6px; height: 6px; margin: -3px 2px 0 auto;
          border-right: 1.5px solid var(--vx-text3); border-bottom: 1.5px solid var(--vx-text3); transform: rotate(45deg);
          transition: transform .2s; }
        details[open] summary::after { margin-top: 3px; transform: rotate(225deg); }
        .manual { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
        .actions { display: flex; gap: 8px; }
        .btn { height: 32px; padding: 0 14px; border: 1px solid var(--vx-line); border-radius: 6px; background: var(--vx-surface);
          color: var(--vx-text1); font-size: 13px; transition: color .2s, border-color .2s, background-color .2s, filter .2s; }
        .btn:hover { border-color: var(--vx-blue); color: var(--vx-blue); }
        .btn.primary { margin-left: auto; border-color: var(--vx-blue); background: var(--vx-blue); color: var(--vx-white); }
        .btn.primary:hover { color: var(--vx-white); filter: brightness(1.08); }
      </style>
      <button id="open" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel">
        <img id="brand-icon" width="22" height="22" alt="" aria-hidden="true" draggable="false">
        <span id="button-label">Vatrix</span>
      </button>
      <dialog id="panel" aria-labelledby="panel-title">
      <form>
        <header>
          <img id="panel-icon" width="22" height="22" alt="" aria-hidden="true" draggable="false">
          <strong id="panel-title">Vatrix</strong><span id="build-version"></span>
          <button id="close" type="button" aria-label="关闭"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
        </header>
        <section class="hero">
          <div><strong>画面还原</strong><span id="status" role="status" aria-live="polite"></span></div>
          <button id="toggle" type="button" role="switch" aria-checked="false" aria-label="画面还原"></button>
        </section>
        <div class="intro"><span id="intro-status" role="status" aria-live="polite"></span><button id="scan-intro" class="link" type="button">识别当前画面</button></div>
        <p id="audio-status" role="status" aria-live="polite" hidden></p>
        <label>seed<input name="seed" type="text" maxlength="4096" autocomplete="off" spellcheck="false"><small>片头二维码不含 seed 时，在这里填写</small></label>
        <label class="option"><span>自动识别片头二维码<small>带 Vatrix 片头的视频会自动开启还原</small></span><input class="switch" name="autoIntro" type="checkbox" role="switch"></label>
        <details id="manual">
          <summary>手动参数<small>没有片头二维码时使用</small></summary>
          <div class="manual">
            <div class="grid">
              <label>tile<input name="tile" type="number" min="2" max="16384" step="2" required></label>
              <label>margin<input name="margin" type="number" min="0" max="16384" step="2" required></label>
              <label>原始宽度<input name="width" type="number" min="1" max="16384" step="1" required></label>
              <label>原始高度<input name="height" type="number" min="1" max="16384" step="1" required></label>
            </div>
            <label class="option"><span>反色</span><input class="switch" name="invert" type="checkbox" role="switch"></label>
            <label class="option"><span>音频频谱翻转</span><input class="switch" name="audioMirror" type="checkbox" role="switch"></label>
            <label>旧版音频分块倒放（ms，0 为无）<input name="audioMs" type="number" min="0" max="9999" step="1" required></label>
            <div class="actions">
              <button id="from-description" class="btn" type="button">读取简介</button>
              <button id="reset" class="btn" type="button">恢复默认</button>
              <button class="btn primary" type="submit">应用</button>
            </div>
          </div>
        </details>
      </form></dialog>`;
    shadow.getElementById('build-version').textContent = `v${scriptVersion}`;
    for (const id of ['brand-icon', 'panel-icon']) {
      const icon = shadow.getElementById(id);
      if (iconUrl) icon.src = iconUrl;
      else icon.hidden = true;
    }
    if (hydrated()) toolbar.after(ui);
    const form = shadow.querySelector('form');
    const manual = shadow.getElementById('manual');
    const dialog = shadow.getElementById('panel');
    const status = shadow.getElementById('status');
    const toggle = shadow.getElementById('toggle');
    const openButton = shadow.getElementById('open');
    let gl = null;
    let restorer = null;
    let frameHandle = null;
    let frameKind = null;
    let hasDrawn = false;
    let dead = false;

    const on = (target, name, callback, options = {}) => target.addEventListener(name, callback, { ...options, signal: listeners.signal });
    function message(text, error = false) {
      status.textContent = text;
      status.dataset.error = String(error);
    }
    function positionDialog() {
      if (!dialog.open) return;
      const anchor = openButton.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      // Prefer directly below the button; keep a usable scroll area on very short viewports.
      const top = Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - 172));
      dialog.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))}px`;
      dialog.style.top = `${top}px`;
      dialog.style.maxHeight = `${Math.max(80, window.innerHeight - top - 12)}px`;
    }
    function open(show = true) {
      if (show && !dialog.open && ui.isConnected) {
        const anchor = openButton.getBoundingClientRect();
        if (anchor.top < 0 || anchor.bottom > window.innerHeight) {
          ui.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
        dialog.showModal();
        // Make room below the toolbar instead of hiding the enable button
        // below a tiny scroll area when the player nearly fills the viewport.
        const desiredHeight = Math.min(dialog.scrollHeight + 2, window.innerHeight - 100);
        const shortfall = openButton.getBoundingClientRect().bottom + 8 + desiredHeight + 12 - window.innerHeight;
        if (shortfall > 0) window.scrollBy({ top: shortfall, behavior: 'instant' });
        positionDialog();
      } else if (!show && dialog.open) {
        dialog.close();
      }
      openButton.setAttribute('aria-expanded', String(dialog.open));
    }
    function fill(values = settings) {
      for (const name of ['seed', 'tile', 'margin', 'width', 'height', 'audioMs']) form.elements.namedItem(name).value = values[name];
      form.elements.namedItem('invert').checked = values.invert;
      form.elements.namedItem('audioMirror').checked = values.audioMirror;
      form.elements.namedItem('autoIntro').checked = values.autoIntro;
    }
    // The first second of a Vatrix upload is a QR code carrying the plan.
    // Read it while the playhead is still inside that window, then apply and
    // switch the restorer on: only our own header parses, so nothing happens
    // on ordinary videos.
    let introReader = null;
    const scanButton = shadow.getElementById('scan-intro');
    function introReport(state, error) {
      const label = shadow.getElementById('intro-status');
      ui.dataset.intro = state;
      label.dataset.error = String(state === 'error');
      scanButton.textContent = state === 'scanning' ? '识别中…' : '识别当前画面';
      label.textContent = {
        off: '片头识别已关闭，可手动识别当前画面。',
        waiting: '等待片头二维码；从中途进入可拖回开头。',
        scanning: '正在识别片头二维码…',
        found: '已读取片头二维码，参数已应用。',
        missing: '没有识别到片头二维码。可暂停在二维码处再识别。',
        error: `二维码读取失败：${error?.message ?? error ?? '未知原因'}`,
      }[state];
    }
    function initializeIntroReader() {
      if (introReader) return true;
      try {
        if ([createIntroReader, scanIntro, decodeQr].some((part) => typeof part !== 'function')) throw new Error('二维码识别组件未加载完整');
        introReader = createIntroReader(video, {
          scan: scanIntro, decode: decodeQr, enabled: () => settings.autoIntro,
          isCurrent: () => !dead && video.isConnected && videoPageKey(location.href) === mountedPageKey,
          onHeader: applyIntroHeader, report: introReport, signal: listeners.signal,
        });
        return true;
      } catch (error) {
        introReport('error', error);
        return false;
      }
    }
    function applyIntroHeader(header) {
      if (dead) return false;
      fill({
        ...settings,
        width: header.width,
        height: header.height,
        tile: header.tile,
        margin: header.margin,
        invert: header.invert,
        audioMs: header.audioMs,
        audioMirror: header.audioMirror,
        seed: header.seed === null ? settings.seed : String(header.seed),
      });
      if (!apply()) return false;
      if (!enabled) {
        enabled = true;
        startRenderer();
        updateToggle();
      }
      if (!enabled) return false;
      rememberPage(settings, 'intro');
      message(header.seed === null
        ? '已按片头二维码开启；片头不含 seed，沿用上面填的 seed。'
        : '已按片头二维码开启，本视频的参数已记住。');
      return true;
    }
    const audioStatus = shadow.getElementById('audio-status');
    let audioRestorer = null;
    let audioSource = '';
    function audioReport(state, text) {
      ui.dataset.audio = state;
      if (audioRestorer) ui.dataset.audioMode = audioRestorer.mode;
      audioStatus.textContent = text;
      audioStatus.hidden = !text;
      audioStatus.dataset.error = String(state === 'error');
    }
    /** Keeps the audio restorer in line with `enabled`, the block length and the mirror. */
    function syncAudio() {
      const wanted = !dead && enabled && (settings.audioMs > 0 || settings.audioMirror) && Boolean(audio);
      const source = video.currentSrc || video.src || '';
      if (audioRestorer && (audioRestorer.blockMs !== settings.audioMs || audioRestorer.mirror !== settings.audioMirror
        || audioSource !== source)) {
        audioRestorer.destroy();
        audioRestorer = null;
      }
      if (!wanted) {
        audioRestorer?.disable();
        audioReport('off', '');
        delete ui.dataset.audioMode;
        return;
      }
      const since = navigatedAt;
      try {
        if (audioRestorer) {
          audioRestorer.enable();
          ui.dataset.audioMode = audioRestorer.mode;
          return;
        }
        audioSource = source;
        const download = () => audio.createAudioRestorer({
          video,
          blockMs: settings.audioMs,
          mirror: settings.audioMirror,
          host: shadow,
          locate: (signal) => audio.locateAudio(video, audioUrls, { since, signal }),
          report: audioReport,
        });
        // Mirror-only uploads are undone on the video's own sound; block reversal needs the whole track.
        audioRestorer = settings.audioMs === 0
          ? audio.createRealtimeMirror({ video, report: audioReport, fallback: download })
          : download();
        ui.dataset.audioMode = audioRestorer.mode;
      } catch (error) {
        audioReport('error', `音频初始化失败：${error.message ?? error}`);
      }
    }
    function updateToggle() {
      toggle.setAttribute('aria-checked', String(enabled));
      openButton.title = enabled ? '画面还原已开启' : '画面还原未开启';
      ui.dataset.enabled = String(enabled);
    }
    function cancelFrame() {
      if (frameHandle === null) return;
      if (frameKind === 'video') video.cancelVideoFrameCallback(frameHandle);
      else cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    function stopRenderer() {
      cancelFrame();
      canvas.style.visibility = 'hidden';
      restorer?.destroy();
      restorer = null;
      hasDrawn = false;
    }
    function fail(error) {
      enabled = false;
      stopRenderer();
      updateToggle();
      syncAudio();
      message(`已停止，显示原画面：${error.message ?? error}`, true);
      open();
    }
    function syncBox() {
      const bounds = video.getBoundingClientRect();
      const parent = wrapper.getBoundingClientRect();
      const scaleX = wrapper.offsetWidth ? parent.width / wrapper.offsetWidth : 1;
      const scaleY = wrapper.offsetHeight ? parent.height / wrapper.offsetHeight : 1;
      if (!scaleX || !scaleY) return;
      canvas.style.left = `${(bounds.left - parent.left) / scaleX - wrapper.clientLeft + wrapper.scrollLeft}px`;
      canvas.style.top = `${(bounds.top - parent.top) / scaleY - wrapper.clientTop + wrapper.scrollTop}px`;
      canvas.style.width = `${bounds.width / scaleX}px`;
      canvas.style.height = `${bounds.height / scaleY}px`;
    }
    function scheduleFrame() {
      if (frameHandle !== null || dead || !enabled || !restorer || video.paused || video.ended || document.hidden) return;
      const callback = () => { frameHandle = null; render(); };
      frameKind = typeof video.requestVideoFrameCallback === 'function' ? 'video' : 'animation';
      frameHandle = frameKind === 'video' ? video.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
    }
    function render() {
      if (dead || !enabled || !restorer || document.hidden) return;
      if (video.readyState >= 2 && !video.seeking && video.videoWidth && video.videoHeight) {
        try {
          restorer.draw(video);
          if (!hasDrawn) {
            if (gl.getError() !== gl.NO_ERROR) throw new Error('视频纹理上传失败');
            hasDrawn = true;
            const memory = pageMemory()?.source === 'intro' ? ' · 已记住本视频的参数' : '';
            message(`还原中 · 视频 ${video.videoWidth}×${video.videoHeight}${memory}${settingsNotice ? ` · ${settingsNotice}` : ''}`);
          }
          canvas.style.visibility = 'visible';
        } catch (error) { fail(error); return; }
      }
      scheduleFrame();
    }
    function startRenderer() {
      stopRenderer();
      if (!enabled) return;
      try {
        gl ??= canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });
        if (!gl || gl.isContextLost()) throw new Error('WebGL2 暂不可用');
        const maximum = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        if (settings.width > maximum || settings.height > maximum) throw new Error('原始尺寸超过 GPU 画布上限');
        canvas.width = settings.width;
        canvas.height = settings.height;
        restorer = createRestorer(gl, settings);
        syncBox();
        message('等待视频帧…');
        render();
      } catch (error) { fail(error); return; }
      updateToggle();
      syncAudio();
    }
    function apply() {
      // The manual fields live in a collapsed section; open it so the browser can point at the bad one.
      if (!form.checkValidity()) {
        manual.open = true;
        form.reportValidity();
        message('手动参数有误，请检查标红的一项。', true);
        return false;
      }
      const previousAutoIntro = settings.autoIntro;
      try {
        const values = Object.fromEntries(new FormData(form));
        values.invert = form.elements.namedItem('invert').checked;
        values.audioMirror = form.elements.namedItem('audioMirror').checked;
        values.autoIntro = form.elements.namedItem('autoIntro').checked;
        values.audioMs = form.elements.namedItem('audioMs').value;
        settings = validateSettings(values, defaults);
      } catch (error) { message(error.message, true); return false; }
      settingsNotice = '';
      try { storage.set(STORAGE_KEY, settings); }
      catch { settingsNotice = '设置保存失败，本次会话仍有效'; }
      // A seed the intro could not carry belongs to this video, not to the next one.
      rememberPage(settings, 'manual');
      if (enabled) startRenderer();
      else {
        message(`参数已应用，还原未开启。${settingsNotice}`);
        syncAudio();
      }
      if (settings.autoIntro !== previousAutoIntro) {
        introReader?.reset();
        void introReader?.request();
      }
      return true;
    }

    on(openButton, 'click', () => open(!dialog.open));
    on(shadow.getElementById('close'), 'click', () => open(false));
    on(dialog, 'cancel', (event) => { event.preventDefault(); open(false); });
    on(dialog, 'close', () => {
      if (dialog.open) return; // A toolbar remount may have already reopened the same dialog.
      openButton.setAttribute('aria-expanded', 'false');
      if (ui.isConnected && !dead) openButton.focus({ preventScroll: true });
    });
    on(dialog, 'click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) open(false);
    });
    on(shadow.getElementById('from-description'), 'click', () => {
      try {
        const description = document.querySelector('#v_desc');
        // innerText preserves <br> boundaries between the seed and later prose.
        const text = description?.innerText ?? description?.textContent ?? '';
        const imported = validateSettings(descriptionSettings(text), defaults);
        fill(imported);
        message('已填入简介里的参数，点「应用」或打开还原后生效。');
      } catch (error) { message(error.message, true); }
    });
    on(form, 'submit', (event) => { event.preventDefault(); apply(); });
    on(scanButton, 'click', async () => {
      // A click must respond even if a different component failed during mount.
      introReport('scanning');
      if (!initializeIntroReader()) return;
      try {
        const applied = await introReader.request({ manual: true });
        if (!applied && ui.dataset.intro === 'scanning') introReport('error', new Error('识别提前结束，请重试'));
      } catch (error) {
        introReport('error', error);
      }
    });
    on(toggle, 'click', () => {
      if (enabled) {
        enabled = false;
        stopRenderer();
        updateToggle();
        syncAudio();
        message('已关闭，显示原画面。');
      } else if (apply()) {
        enabled = true;
        startRenderer();
      }
    });
    on(shadow.getElementById('reset'), 'click', () => {
      settings = validateSettings({}, defaults);
      fill();
      apply();
      // "Default" also drops this video's memory, so it stops restoring by itself.
      forgetPage();
      introReader?.reset();
    });
    // Do not let the player's shortcuts intercept typing or buttons in the panel.
    for (const name of ['keydown', 'keyup', 'keypress', 'pointerdown', 'click', 'dblclick']) {
      on(ui, name, (event) => event.stopPropagation());
    }
    for (const name of ['play', 'playing', 'loadeddata', 'seeked']) on(video, name, render);
    for (const name of ['pause', 'ended']) on(video, name, () => { cancelFrame(); render(); });
    for (const name of ['loadstart', 'emptied']) on(video, name, () => {
      audioRestorer?.destroy();
      audioRestorer = null;
      cancelFrame();
      hasDrawn = false;
      canvas.style.visibility = 'hidden';
      if (enabled) message('视频源切换中…');
    });
    on(video, 'loadeddata', syncAudio);
    on(video, 'seeking', () => { canvas.style.visibility = 'hidden'; });
    for (const name of ['loadedmetadata', 'resize']) on(video, name, () => {
      hasDrawn = false;
      syncBox();
      render();
    });
    on(video, 'error', () => { if (enabled) fail(new Error('原视频加载失败')); });
    on(document, 'visibilitychange', () => { if (document.hidden) cancelFrame(); else render(); });
    on(document, 'fullscreenchange', () => { open(false); syncBox(); render(); });
    on(window, 'resize', () => { syncBox(); positionDialog(); });
    on(document, 'scroll', positionDialog, { capture: true, passive: true });
    on(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      fail(new Error('WebGL 上下文丢失，恢复后可重新启用'));
    });
    on(canvas, 'webglcontextrestored', () => message('WebGL 已恢复，可重新启用。'));
    const resizeObserver = new ResizeObserver(syncBox);
    resizeObserver.observe(video);
    resizeObserver.observe(wrapper);
    fill();
    updateToggle();
    message(settingsNotice || '未开启。带 Vatrix 片头的视频会自动开启。', Boolean(settingsNotice));
    if (settingsNotice) open();
    // Bind QR actions before starting optional media components. A synchronous
    // audio initialization failure must not leave a visible but inert QR button.
    initializeIntroReader();
    if (enabled) startRenderer();
    else syncAudio();

    return {
      video, wrapper, area, ui, canvas, open,
      place(anchor) {
        if (anchor.nextElementSibling === ui || !hydrated()) return;
        const reopen = dialog.open;
        open(false);
        anchor.after(ui);
        if (reopen) open();
      },
      dispose() {
        dead = true;
        open(false);
        listeners.abort();
        audioRestorer?.destroy();
        audioRestorer = null;
        resizeObserver.disconnect();
        stopRenderer();
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
        canvas.remove();
        ui.remove();
        for (const [element, position] of positioned) {
          if (element.style.position === 'relative') element.style.position = position;
        }
      },
    };
  }

  function scan() {
    scanHandle = null;
    if (disposed) return;
    const nextKey = videoPageKey(location.href);
    if (nextKey !== pageKey) {
      pageKey = nextKey;
      navigatedAt = performance.now();
      active?.dispose();
      active = null;
      settings = loadSettings();
      // A different BVID or part never inherits the previous video's state; it
      // restores only on its own verified memory.
      enabled = autoEnabled();
    }
    if (!pageKey) return;
    const toolbar = document.querySelector(TOOLBAR_SELECTOR);
    const candidates = [...document.querySelectorAll(SELECTOR)].filter((video) => video.getClientRects().length);
    candidates.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const video = candidates[0] ?? null;
    if (toolbar && active?.video === video && active.wrapper === video?.parentElement &&
        active.area === video?.closest('.bpx-player-primary-area') && active.canvas.isConnected) {
      active.place(toolbar);
      return;
    }
    active?.dispose();
    active = video && toolbar ? mount(video, toolbar) : null;
  }
  function queueScan() {
    if (scanHandle === null && !disposed) scanHandle = requestAnimationFrame(scan);
  }
  const observer = new MutationObserver((records) => {
    if (active && (!active.video.isConnected || !active.ui.isConnected || !active.canvas.isConnected)) queueScan();
    for (const record of records) {
      if (record.type === 'attributes') queueScan(); // hydration: the button may join the toolbar now
      for (const node of record.addedNodes) {
        const relevant = 'video, .bpx-player-primary-area, #arc_toolbar_report, .video-toolbar-left-main';
        if (node.nodeType === 1 && (node.matches(relevant) || node.querySelector(relevant))) queueScan();
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-server-rendered'] });
  // URL changes from history.pushState have no native event. Also recover when
  // a preloaded player becomes visible without replacing its video node.
  const timer = setInterval(queueScan, 1000);
  const menuId = menu.register('Vatrix：还原参数', () => { scan(); active?.open(); });
  const lifetime = new AbortController();
  window.addEventListener('pageshow', queueScan, { signal: lifetime.signal });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) dispose(); }, { signal: lifetime.signal });
  function dispose() {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    observer.disconnect();
    audioUrls?.stop();
    clearInterval(timer);
    if (scanHandle !== null) cancelAnimationFrame(scanHandle);
    active?.dispose();
    active = null;
    if (menuId !== undefined) menu.unregister(menuId);
  }
  scan();
  return { dispose };
}
