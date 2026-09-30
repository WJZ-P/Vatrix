/**
 * What differs between the video sites: where the player and its video are,
 * where the toolbar entry goes, and how the page themes itself. Everything
 * else in the userscript is shared.
 */
export const SITES = {
  bilibili: {
    id: 'bilibili',
    video: '.bpx-player-primary-area video',
    area: '.bpx-player-primary-area',
    // Right of the like / coin / favourite / share group.
    anchor: '#arc_toolbar_report .video-toolbar-left-main',
    place(anchor, ui) { anchor.after(ui); },
    placed(anchor, ui) { return anchor.nextElementSibling === ui; },
    fit() {},
    hostStyle: 'margin-left:16px;',
    // Nodes whose arrival may mean a new player or toolbar.
    relevant: 'video, .bpx-player-primary-area, #arc_toolbar_report, .video-toolbar-left-main',
    // Vue removes this from its root when hydration starts; see main.js.
    ssrMarker: '[data-server-rendered]',
    description() {
      const element = document.querySelector('#v_desc');
      // innerText preserves <br> boundaries between the seed and later prose.
      return element ? element.innerText ?? element.textContent ?? '' : null;
    },
    // Colours come from the page's own bili-theme variables, which inherit into the shadow root.
    theme: null,
    suspended: () => false,
  },
  youtube: {
    id: 'youtube',
    // Hover previews elsewhere on the page use the same classes; only the main player counts.
    video: '#movie_player video.video-stream',
    area: '#movie_player',
    // #actions-inner stacks its children in a column; the button row is the menu renderer.
    anchor: 'ytd-watch-metadata #menu ytd-menu-renderer',
    place(anchor, ui) {
      // Left of the like button, but outside the list YouTube renders itself.
      anchor.insertBefore(ui, anchor.querySelector(':scope > #top-level-buttons-computed') ?? anchor.firstChild);
    },
    placed(anchor, ui) {
      return ui.parentElement === anchor && ui.nextElementSibling === anchor.querySelector(':scope > #top-level-buttons-computed');
    },
    // As tall as the like button, which is 36 or 40 px depending on the layout and may render late.
    fit(anchor, ui) {
      const height = anchor.querySelector('#top-level-buttons-computed button')?.offsetHeight;
      const value = height ? `${height}px` : '';
      if (ui.style.getPropertyValue('--vx-entry-height') !== value) ui.style.setProperty('--vx-entry-height', value);
    },
    // The button row carries a bottom margin and the renderer stretches its children to that
    // taller line; sit at the top of it like the row does instead of centring in it.
    hostStyle: 'margin-right:8px;align-self:flex-start;',
    relevant: 'video, #movie_player, ytd-watch-metadata, ytd-menu-renderer',
    ssrMarker: null,
    description: null,
    // YouTube's colour variables are resolved by its CSS shim and never reach real CSS,
    // so the panel follows the dark attribute on <html> instead (set from the system by default).
    theme: { attribute: 'dark', read: () => (document.documentElement.hasAttribute('dark') ? 'dark' : 'light') },
    // Ads play in the same video element; restoring one would only scramble it.
    suspended: () => Boolean(document.querySelector('#movie_player.ad-showing')),
  },
};

/**
 * The site for a page. The host decides on the real sites; anywhere else (the
 * local test pages) a YouTube-style /watch path means YouTube.
 */
export function siteFor(href) {
  const url = new URL(href);
  if (/(^|\.)youtube\.com$/.test(url.hostname)) return SITES.youtube;
  if (/(^|\.)bilibili\.com$/.test(url.hostname)) return SITES.bilibili;
  return url.pathname === '/watch' ? SITES.youtube : SITES.bilibili;
}
