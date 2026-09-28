import { type CSSProperties, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { styled } from "@linaria/react";

import { type FramePair, type Mode, type VideoInfo, snapshotUrl } from "../ipc";
import { Badge, Button, Card, Note } from "./ui";

const VIDEO_EXTENSIONS = ["mp4", "mkv", "mov", "webm", "m4v"];

/** The empty state: the whole column is a drop target on a slowly drifting tile grid. */
const Drop = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  min-height: 320px;
  padding: 32px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-l);
  background-color: var(--surface);
  background-image:
    radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.1), transparent 60%),
    linear-gradient(rgba(56, 189, 248, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.06) 1px, transparent 1px);
  background-size: auto, 28px 28px, 28px 28px;
  background-position: center, 0 0, 0 0;
  text-align: center;
  animation: vx-rise 420ms var(--ease) both, vx-grid-drift 6s linear infinite;
  transition: border-color 200ms var(--ease), background-color 200ms var(--ease), transform 200ms var(--ease);

  &:hover {
    border-color: #3d4f78;
  }

  &[data-active="true"] {
    border-color: var(--accent);
    background-color: rgba(19, 32, 56, 0.9);
    transform: scale(0.99);
  }

  img {
    width: 64px;
    height: 64px;
    margin-bottom: 6px;
    filter: drop-shadow(0 8px 24px rgba(34, 211, 238, 0.3));
    animation: vx-float 3.2s ease-in-out infinite;
  }

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0 0 10px;
    color: var(--text-3);
    font-size: 13px;
  }
`;

const Loaded = styled(Card)`
  position: relative;
  height: 100%;
  min-height: 320px;
`;

const FileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  .names {
    flex: 1;
    min-width: 0;
  }

  .name,
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    font-size: 15px;
    font-weight: 600;
  }

  .path {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-3);
  }
`;

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

/** The picture area: one frame, or an input/output pair stacked or side by side. */
const Stage = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;

  &[data-layout="row"] {
    flex-direction: row;
  }
`;

const Slot = styled.figure`
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  margin: 0;
  border: 1px solid var(--border);
  background: #03060c;
  animation: vx-fade 260ms var(--ease);

  img,
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  figcaption {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-left: 2px solid var(--accent);
    background: rgba(7, 11, 22, 0.8);
    color: var(--text-2);
    font-size: 12px;
    z-index: 1;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--text-3);
    font-size: 13px;
  }

  &[data-live="true"] figcaption::after {
    content: "LIVE";
    margin-left: 8px;
    color: var(--accent);
    font-size: 10px;
    letter-spacing: 0.1em;
  }
`;

const Timeline = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  input {
    appearance: none;
    flex: 1;
    height: 16px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  input::-webkit-slider-runnable-track {
    height: 4px;
    background: linear-gradient(90deg, var(--accent) var(--progress), var(--surface-3) var(--progress));
  }

  input::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.35);
    transition: transform 160ms var(--spring), box-shadow 160ms var(--ease);
  }

  input:hover::-webkit-slider-thumb,
  input:active::-webkit-slider-thumb {
    transform: scale(1.3);
    box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.5);
  }

  input:disabled {
    opacity: 0.4;
    cursor: default;
  }

  span {
    min-width: 84px;
    color: var(--text-3);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 1px dashed var(--accent);
  background: rgba(7, 11, 22, 0.85);
  color: var(--accent);
  font-size: 16px;
  font-weight: 600;
  z-index: 2;
  animation: vx-fade 160ms var(--ease);
`;

export interface JobView {
  running: boolean;
  mode: Mode | null;
  /** The file the last successful job wrote. */
  output: string | null;
  /** The newest frame pair from the running (or just finished) job. */
  live: FramePair | null;
}

interface Props {
  file: string | null;
  info: VideoInfo | null;
  error: string | null;
  job: JobView;
  /** Seconds the output's timeline runs ahead of (+) or behind (−) the input's: the intro. */
  outputOffset: number;
  onFile: (path: string) => void;
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * A frame of `path` at `seconds`, as a blob URL. Requests never pile up while
 * the timeline is dragged: one runs at a time and only the newest wish is
 * fetched next.
 */
function useSnapshot(path: string | null, seconds: number): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const wanted = useRef<{ path: string; seconds: number } | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    wanted.current = path ? { path, seconds } : null;
    if (!path) {
      setUrl(null);
      return;
    }
    if (busy.current) return;
    busy.current = true;
    (async () => {
      while (wanted.current && alive.current) {
        const next = wanted.current;
        wanted.current = null;
        try {
          const fresh = await snapshotUrl(next.path, next.seconds);
          if (!alive.current) URL.revokeObjectURL(fresh);
          else setUrl(fresh);
        } catch {
          // A frame past the end, or a file that went away: keep the last picture.
        }
      }
      busy.current = false;
    })();
  }, [path, seconds]);

  // Each picture's blob URL is released once the next one replaces it.
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

/** Stack the pair when that shows the frames larger, else put them side by side. */
function useLayout(aspect: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"column" | "row">("column");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const stacked = Math.min(width, (height / 2) * aspect);
      const sideBySide = Math.min(width / 2, height * aspect);
      setLayout(stacked >= sideBySide ? "column" : "row");
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);
  return { ref, layout };
}

function LiveCanvas({ image }: { image: ImageData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (canvas.width !== image.width) canvas.width = image.width;
    if (canvas.height !== image.height) canvas.height = image.height;
    canvas.getContext("2d")?.putImageData(image, 0, 0);
  }, [image]);
  return <canvas ref={ref} />;
}

/** The video being worked on: a drop target while empty, then its details and live or scrubbable frames. */
export function SourcePanel({ file, info, error, job, outputOffset, onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const duration = info?.duration ?? 0;

  // A new file opens at its middle, like the old single snapshot did.
  useEffect(() => setSeconds(duration / 2), [file, duration]);

  const inputUrl = useSnapshot(file && info ? file : null, seconds);
  const outputUrl = useSnapshot(!job.running ? job.output : null, Math.max(0, seconds + outputOffset));
  const { ref: stageRef, layout } = useLayout(info ? info.width / info.height : 16 / 9);

  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      switch (event.payload.type) {
        case "enter":
        case "over":
          setDragging(true);
          break;
        case "leave":
          setDragging(false);
          break;
        case "drop":
          setDragging(false);
          if (event.payload.paths[0]) onFile(event.payload.paths[0]);
          break;
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, [onFile]);

  async function pick() {
    const chosen = await open({ multiple: false, filters: [{ name: "视频", extensions: VIDEO_EXTENSIONS }] });
    if (typeof chosen === "string") onFile(chosen);
  }

  if (!file) {
    return (
      <Drop data-active={dragging}>
        <img src="/icon.png" alt="" aria-hidden="true" />
        <h3>{dragging ? "松开即可载入" : "把视频拖到这里"}</h3>
        <p>支持 {VIDEO_EXTENSIONS.join(" · ")}；加密后的文件拖进来会自动识别参数</p>
        <Button variant="primary" onClick={pick}>
          选择视频…
        </Button>
      </Drop>
    );
  }

  const name = file.split(/[\\/]/).pop() ?? file;
  const scrambledInput = job.mode ? job.mode === "restore" : Boolean(info?.hint);
  const labels = scrambledInput ? ["加密画面", "还原后"] : ["原画面", "加密后"];
  const paired = job.running || Boolean(job.output);
  const placeholder = error ? "无法读取这个文件" : "正在读取…";

  return (
    <Loaded>
      {dragging && <Overlay>松开以更换视频</Overlay>}
      <FileHeader>
        <div className="names">
          <div className="name" title={name}>
            {name}
          </div>
          <div className="path" title={file}>
            {file}
          </div>
        </div>
        <Button variant="ghost" size="small" onClick={pick} disabled={job.running}>
          更换视频
        </Button>
      </FileHeader>

      {info && (
        <Badges>
          {info.hint && <Badge data-tone="accent">{info.hint.intro_ms > 0 ? "加密文件 · 已读取片头二维码" : "加密文件"}</Badge>}
          <Badge>
            {info.width} × {info.height}
          </Badge>
          <Badge>{info.fps.toFixed(info.fps % 1 ? 2 : 0)} fps</Badge>
          <Badge>{clock(info.duration)}</Badge>
          <Badge>{info.codec.toUpperCase()}</Badge>
          <Badge>{info.has_audio ? `音轨 ${info.audio_channels} 声道` : "无音轨"}</Badge>
        </Badges>
      )}
      {error && <Note data-tone="error">{error}</Note>}

      <Stage ref={stageRef} data-layout={paired ? layout : "column"}>
        {job.running ? (
          <>
            <Slot data-live="true">
              <figcaption>{labels[0]}</figcaption>
              {job.live ? <LiveCanvas image={job.live.input} /> : <span className="placeholder">准备中…</span>}
            </Slot>
            <Slot data-live="true">
              <figcaption>{labels[1]}</figcaption>
              {job.live ? <LiveCanvas image={job.live.output} /> : <span className="placeholder">准备中…</span>}
            </Slot>
          </>
        ) : (
          <>
            <Slot>
              <figcaption>{labels[0]}</figcaption>
              {inputUrl ? <img src={inputUrl} alt={labels[0]} /> : <span className="placeholder">{placeholder}</span>}
            </Slot>
            {paired && (
              <Slot>
                <figcaption>{labels[1]}</figcaption>
                {outputUrl ? <img src={outputUrl} alt={labels[1]} /> : <span className="placeholder">正在读取…</span>}
              </Slot>
            )}
          </>
        )}
      </Stage>

      {info && (
        <Timeline>
          <input
            type="range"
            aria-label="预览时间"
            min={0}
            max={duration}
            step={0.04}
            value={seconds}
            disabled={job.running}
            style={{ "--progress": `${duration ? (seconds / duration) * 100 : 0}%` } as CSSProperties}
            onChange={(e) => setSeconds(Number(e.currentTarget.value))}
          />
          <span>
            {clock(seconds)} / {clock(duration)}
          </span>
        </Timeline>
      )}
    </Loaded>
  );
}
