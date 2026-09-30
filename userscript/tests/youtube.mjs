const results = document.getElementById('results');
const summary = document.getElementById('summary');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
async function until(check, label) {
  for (let i = 0; i < 160; i++) { if (check()) return; await sleep(50); }
  throw new Error(`timeout: ${label}`);
}
function pass(message) {
  const item = document.createElement('li');
  item.dataset.result = 'pass';
  item.textContent = message;
  results.append(item);
}
const host = () => document.getElementById('vatrix-userscript-ui');
const panel = () => host()?.shadowRoot;
const restored = () => document.querySelector('canvas[data-vatrix-restored]');
const isEnabled = () => host()?.dataset.enabled === 'true';
// The page enforces Trusted Types, so the test builds its fixture through a policy of its own.
const testPolicy = trustedTypes.createPolicy('vatrix-test', { createHTML: (markup) => markup });
let tick;
let stream;

try {
  let enforced = false;
  try { document.createElement('div').innerHTML = '<b>x</b>'; } catch { enforced = true; }
  assert(enforced, 'the page must enforce Trusted Types like YouTube');

  const info = await fetch('/target/userscript-smoke/fixture.json').then((r) => r.json());
  const scrambled = new Uint8Array(await fetch('/target/userscript-smoke/scrambled.rgb').then((r) => r.arrayBuffer()));
  const original = new Uint8Array(await fetch('/target/userscript-smoke/original.rgb').then((r) => r.arrayBuffer()));
  const source = document.createElement('canvas');
  source.width = info.uploadWidth;
  source.height = info.uploadHeight;
  const context = source.getContext('2d');
  const image = context.createImageData(source.width, source.height);
  for (let i = 0; i < scrambled.length / 3; i++) {
    image.data.set(scrambled.subarray(i * 3, i * 3 + 3), i * 4);
    image.data[i * 4 + 3] = 255;
  }
  const paint = () => context.putImageData(image, 0, 0);
  paint();
  stream = source.captureStream(10);
  tick = setInterval(paint, 100);

  document.getElementById('fixture').innerHTML = testPolicy.createHTML(`
    <div id="movie_player" class="html5-video-player"><div class="html5-video-container">
      <video class="video-stream html5-main-video" muted playsinline></video>
    </div></div>
    <ytd-watch-metadata><div id="above-the-fold"><div id="top-row"><div id="actions"><div id="actions-inner"><div id="menu">
      <ytd-menu-renderer>
        <div id="top-level-buttons-computed">
          <segmented-like-dislike-button-view-model><button>👍 0</button></segmented-like-dislike-button-view-model>
          <yt-button-view-model><button>分享</button></yt-button-view-model>
        </div>
        <div id="flexible-item-buttons"></div>
      </ytd-menu-renderer>
    </div><div id="menu-during-ads"></div></div></div></div></div></ytd-watch-metadata>
    <ytd-video-preview><video class="video-stream html5-main-video" muted playsinline></video></ytd-video-preview>`);
  const video = document.querySelector('#movie_player video');
  const decoy = document.querySelector('ytd-video-preview video');
  video.srcObject = stream;
  decoy.srcObject = stream;
  await Promise.all([video.play(), decoy.play()]);
  await until(() => panel() && restored(), 'the player and the menu row');

  const renderer = document.querySelector('ytd-menu-renderer');
  assert(host().parentElement === renderer && host().nextElementSibling.id === 'top-level-buttons-computed', 'entry directly left of the like button');
  const like = document.querySelector('segmented-like-dislike-button-view-model button');
  const entry = panel().getElementById('open');
  assert(entry.offsetHeight === like.offsetHeight, `entry height ${entry.offsetHeight} = like ${like.offsetHeight}`);
  const offset = entry.getBoundingClientRect().top - like.getBoundingClientRect().top;
  assert(Math.abs(offset) < 0.5, `entry ${offset.toFixed(1)} px below the like button`);
  // The like button settles on its size late (36 or 40 px by layout): the entry follows.
  for (const button of document.querySelectorAll('#top-level-buttons-computed button')) button.style.height = '40px';
  await until(() => entry.offsetHeight === 40, 'entry follows the like button to 40 px');
  assert(Math.abs(entry.getBoundingClientRect().top - like.getBoundingClientRect().top) < 0.5, 'still level at 40 px');
  assert(restored().parentElement === video.parentElement, 'overlay in the main player');
  assert(!document.querySelector('ytd-video-preview canvas'), 'nothing on the hover preview, though it is bigger');
  assert(panel().getElementById('from-description').hidden, 'no description import on YouTube');
  pass('Trusted Types 强制下面板正常创建；入口在点赞左侧，与点赞同高且顶端对齐（点赞行带下边距时也对齐，尺寸变化时跟随）；只挂到 #movie_player，不碰悬停预览');

  panel().getElementById('open').click();
  const dialog = panel().getElementById('panel');
  assert(dialog.matches(':modal'), 'panel opens');
  const background = () => getComputedStyle(dialog).backgroundColor;
  assert(host().dataset.theme === 'light' && background() === 'rgb(255, 255, 255)', `light panel ${background()}`);
  document.documentElement.setAttribute('dark', '');
  await until(() => host().dataset.theme === 'dark', 'dark theme mirrored');
  assert(background() === 'rgb(40, 40, 40)', `dark panel ${background()}`);
  document.documentElement.removeAttribute('dark');
  await until(() => host().dataset.theme === 'light', 'light theme mirrored');
  pass('深浅色跟随 html[dark]：浅色白底，深色 #282828，切换即时生效');

  for (const [name, value] of Object.entries(info.params)) panel().querySelector(`[name=${name}]`).value = String(value);
  panel().querySelector('[name=invert]').checked = false;
  panel().querySelector('[name=audioMirror]').checked = false;
  panel().querySelector('form').requestSubmit();
  panel().getElementById('toggle').click();
  await until(() => isEnabled() && restored().style.visibility === 'visible', 'first restored frame');
  video.dispatchEvent(new Event('seeked'));
  const canvas = restored();
  const gl = canvas.getContext('webgl2');
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let maxError = 0;
  for (let y = 3; y < info.params.height - 2; y += 5) {
    for (let x = 3; x < info.params.width - 2; x += 5) {
      if (x % 16 < 2 || x % 16 > 13 || y % 16 < 2 || y % 16 > 13) continue;
      for (let c = 0; c < 3; c++) {
        const actual = pixels[((canvas.height - 1 - y) * canvas.width + x) * 4 + c];
        maxError = Math.max(maxError, Math.abs(actual - original[(y * info.workWidth + x) * 3 + c]));
      }
    }
  }
  assert(maxError <= 8, `pixel error ${maxError}`);
  pass(`手动参数还原：真实 Rust 打乱数据经 YouTube 结构的播放器还原，RGB 最大误差 ${maxError}`);

  document.getElementById('movie_player').classList.add('ad-showing');
  await until(() => restored().style.visibility === 'hidden' && panel().getElementById('status').textContent.includes('广告'), 'ad pause');
  document.getElementById('movie_player').classList.remove('ad-showing');
  await until(() => restored().style.visibility === 'visible', 'resume after the ad');
  pass('广告（#movie_player.ad-showing）期间撤下还原画面，广告结束自动恢复');

  history.pushState({}, '', '/watch?v=another-video');
  document.dispatchEvent(new CustomEvent('yt-navigate-finish'));
  await until(() => host() && !isEnabled() && host().parentElement === renderer, 'in-app navigation');
  assert(host().nextElementSibling.id === 'top-level-buttons-computed', 'entry placed again left of the like button');
  pass('站内跳转到另一个视频：关闭还原、入口重新就位，不继承上一个视频的状态');

  summary.dataset.result = 'pass';
  summary.textContent = `${results.children.length} 项 YouTube 集成检查通过`;
} catch (error) {
  summary.dataset.result = 'fail';
  summary.textContent = `FAIL: ${error.stack ?? error}`;
} finally {
  clearInterval(tick);
  for (const track of stream?.getTracks() ?? []) track.stop();
}
