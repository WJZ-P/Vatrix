import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { styled } from "@linaria/react";

import { type JobResult, type Mode, type Progress, describeAudio } from "../ipc";
import { Button, ProgressBar } from "./ui";

export interface JobState {
  running: boolean;
  mode: Mode | null;
  progress: Progress | null;
  result: JobResult | null;
  error: string | null;
}

const Bar = styled.footer`
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  flex: none;
  min-height: 68px;
  padding: 12px 16px;
  background: var(--bg-chrome);
  backdrop-filter: blur(10px);

  /* A lit seam along the top edge. */
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--border);
  }

  &::after {
    content: "";
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: var(--accent-line);
  }
`;

/** One line: the label, the folder in a box that grows with it up to a limit, and its buttons. */
const Output = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
  padding-right: 20px;
  border-right: 1px solid var(--border);

  .label {
    flex: none;
    font-size: 14px;
    color: var(--text-2);
  }

  .path {
    flex: 0 1 auto;
    min-width: 160px;
    max-width: 260px;
    height: 30px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--well);
    box-shadow: var(--well-shadow);
    color: var(--text);
    font-size: 13px;
    line-height: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .path[data-default="true"] {
    color: var(--text-3);
  }
`;

const Status = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  flex: 1;
  min-width: 0;

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
    color: var(--text-2);
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    flex: none;
  }

  .percent {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .done {
    flex: none;
    white-space: nowrap;
    color: var(--success);
  }

  .error {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: var(--danger);
    font-size: 12px;
    user-select: text;
  }

  .hint {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--text-3);
  }
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex: none;
`;

interface Props {
  outputDir: string;
  onOutputDir: (dir: string) => void;
  canRun: boolean;
  job: JobState;
  onRun: (mode: Mode) => void;
}

/** Where results go, how the current job is doing, and the two things the app does. */
export function ActionBar({ outputDir, onOutputDir, canRun, job, onRun }: Props) {
  async function pickDir() {
    const chosen = await open({ directory: true, multiple: false, defaultPath: outputDir || undefined });
    if (typeof chosen === "string") onOutputDir(chosen);
  }

  const busy = job.running;
  const verb = job.mode === "restore" ? "解密" : "加密";
  const done = job.progress?.done ?? 0;
  const total = job.progress?.total ?? 0;
  const ratio = total ? done / total : 0;

  let status;
  if (busy) {
    status = (
      <>
        <div className="line">
          <span className="text">
            {verb}中… {total ? `${done} / ${total} 帧` : "准备中"}
          </span>
          <span className="percent">{Math.round(ratio * 100)}%</span>
        </div>
        <ProgressBar ratio={ratio} tone={job.mode === "restore" ? "violet" : "accent"} />
      </>
    );
  } else if (job.error) {
    status = (
      <div className="error" title={job.error}>
        {verb}失败：{job.error}
      </div>
    );
  } else if (job.result) {
    const result = job.result;
    status = (
      <div className="line">
        <span className="done">✓ {verb}完成</span>
        <span className="text" title={result.output}>
          {result.frames} 帧 · {result.encoder} · 音频{describeAudio(result)}
          {job.mode === "scramble" && ` · 上传尺寸 ${result.upload_width} × ${result.upload_height}`}
        </span>
        <Button variant="ghost" size="small" onClick={() => revealItemInDir(result.output)}>
          打开文件夹
        </Button>
      </div>
    );
  } else {
    status = <span className="hint">{canRun ? "参数确认后，选择加密或解密" : "先在左侧选择一个视频"}</span>;
  }

  return (
    <Bar>
      <Output>
        <span className="label">输出到：</span>
        <span className="path" data-default={!outputDir} title={outputDir || undefined}>
          {outputDir || "与视频相同的文件夹"}
        </span>
        <Button size="small" onClick={pickDir} disabled={busy}>
          更改
        </Button>
        {outputDir && (
          <Button variant="ghost" size="small" aria-label="恢复为视频所在文件夹" title="恢复为视频所在文件夹" onClick={() => onOutputDir("")} disabled={busy}>
            ×
          </Button>
        )}
      </Output>
      <Status aria-live="polite">{status}</Status>
      <Actions>
        <Button variant="violet" size="large" disabled={!canRun || busy} onClick={() => onRun("restore")}>
          解密还原
        </Button>
        <Button variant="primary" size="large" disabled={!canRun || busy} onClick={() => onRun("scramble")}>
          加密打乱
        </Button>
      </Actions>
    </Bar>
  );
}
