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
  display: flex;
  align-items: center;
  gap: 20px;
  flex: none;
  min-height: 68px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-chrome);
  backdrop-filter: blur(10px);
`;

const Output = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: clamp(170px, 22vw, 260px);
  min-width: 0;
  flex: none;

  .label {
    font-size: 11px;
    color: var(--text-3);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .path {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--text-2);
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
        <ProgressBar ratio={ratio} />
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
        <span className="label">输出到</span>
        <div className="line">
          <span className="path" title={outputDir || undefined}>
            {outputDir || "与视频相同的文件夹"}
          </span>
          <Button variant="ghost" size="small" onClick={pickDir} disabled={busy}>
            更改
          </Button>
          {outputDir && (
            <Button variant="ghost" size="small" aria-label="恢复为视频所在文件夹" onClick={() => onOutputDir("")} disabled={busy}>
              ×
            </Button>
          )}
        </div>
      </Output>
      <Status aria-live="polite">{status}</Status>
      <Actions>
        <Button size="large" disabled={!canRun || busy} onClick={() => onRun("restore")}>
          解密还原
        </Button>
        <Button variant="primary" size="large" disabled={!canRun || busy} onClick={() => onRun("scramble")}>
          加密打乱
        </Button>
      </Actions>
    </Bar>
  );
}
