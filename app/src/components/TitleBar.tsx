import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { styled } from "@linaria/react";

const Bar = styled.header`
  position: relative;
  display: flex;
  align-items: stretch;
  height: var(--titlebar);
  flex: none;
  background: var(--bg-chrome);
  backdrop-filter: blur(10px);

  /* A lit seam along the bottom edge. */
  &::before,
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    height: 1px;
    pointer-events: none;
  }

  &::before {
    left: 0;
    right: 0;
    background: var(--border);
  }

  &::after {
    left: 0;
    width: 45%;
    background: linear-gradient(90deg, rgba(34, 211, 238, 0.5), rgba(99, 102, 241, 0.35) 60%, transparent);
  }
`;

/** Everything left of the window buttons drags the window; double-click maximizes. */
const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding-left: 14px;

  img {
    width: 18px;
    height: 18px;
    pointer-events: none;
  }

  strong {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    background: linear-gradient(90deg, #e0f7ff, #7dd3fc 55%, #a5b4fc);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    pointer-events: none;
  }

  span {
    font-size: 12px;
    color: var(--text-3);
    pointer-events: none;
  }
`;

const Controls = styled.div`
  display: flex;

  button {
    display: grid;
    place-items: center;
    width: 46px;
    border: 0;
    background: transparent;
    color: var(--text-2);
    cursor: default;
    transition: background 100ms ease, color 100ms ease;
  }

  button:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text);
  }

  button:active {
    background: rgba(255, 255, 255, 0.04);
  }

  button[data-close]:hover {
    background: #c42b1c;
    color: #fff;
  }

  svg {
    width: 10px;
    height: 10px;
    stroke: currentColor;
    stroke-width: 1;
    fill: none;
    shape-rendering: crispEdges;
  }
`;

/** The window's own title bar: the app draws it so it matches the rest of the UI. */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const window = getCurrentWindow();
    const sync = () => window.isMaximized().then(setMaximized).catch(() => {});
    sync();
    const unlisten = window.onResized(sync);
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  const window = getCurrentWindow();
  return (
    <Bar>
      <Brand data-tauri-drag-region>
        <img src="/icon.png" alt="" aria-hidden="true" />
        <strong>Vatrix</strong>
        <span>混映</span>
      </Brand>
      <Controls>
        <button type="button" aria-label="最小化" onClick={() => window.minimize()}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5.5h10" />
          </svg>
        </button>
        <button type="button" aria-label={maximized ? "还原" : "最大化"} onClick={() => window.toggleMaximize()}>
          {maximized ? (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2.5 2.5V0.5h7v7h-2" />
              <rect x="0.5" y="2.5" width="7" height="7" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          )}
        </button>
        <button type="button" data-close aria-label="关闭" onClick={() => window.close()}>
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
          </svg>
        </button>
      </Controls>
    </Bar>
  );
}
