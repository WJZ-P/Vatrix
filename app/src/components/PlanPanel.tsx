import { useEffect, useState } from "react";
import { styled } from "@linaria/react";

import { type EncoderInfo, type PlanPreview, hardwareEncoder, planPreview } from "../ipc";
import { Badge, Card, CardTitle, Field, Input, Label, Note, Row, Stepper, Switch } from "./ui";

export interface PlanSettings {
  /** The source size, always taken from the loaded file. */
  width: number;
  height: number;
  tile: number;
  margin: number;
  seed: string;
  invert: boolean;
  intro: boolean;
  seedInIntro: boolean;
  gpu: boolean;
  /** Mirror the audio spectrum, which hides whose voice it is; viewers undo it in real time. */
  audio: boolean;
  /**
   * Block reversal of an older file, taken from its tag or intro and only
   * used to restore it; new files are never reversed. 0 otherwise.
   */
  audioMs: number;
}

interface Props {
  settings: PlanSettings;
  onChange: (settings: PlanSettings) => void;
  /** The grid only means something once a file supplies the size. */
  hasFile: boolean;
}

/** The grid the settings produce, as validated by the core crate. */
const Summary = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding: 10px 12px;
  border-left: 2px solid;
  border-image: var(--accent-grad) 1;
  background: linear-gradient(90deg, var(--accent-soft), rgba(99, 102, 241, 0.05) 70%, transparent);
  animation: vx-fade 240ms var(--ease);

  b {
    font-size: 20px;
    font-weight: 600;
    color: #bae6fd;
    font-variant-numeric: tabular-nums;
  }

  span {
    font-size: 12px;
    color: var(--text-3);
  }
`;

function PlanSummary({ preview, error, hasFile }: { preview: PlanPreview | null; error: string | null; hasFile: boolean }) {
  if (!hasFile) return <Note data-tone="muted">载入视频后，按它的尺寸计算分块。</Note>;
  if (error) return <Note data-tone="error">{error}</Note>;
  if (!preview) return null;
  const { work } = preview;
  const padded = work.pad_right || work.pad_bottom;
  return (
    <Summary key={`${preview.tile_count}-${preview.upload_width}`}>
      <b>{preview.tile_count.toLocaleString()}</b>
      <span>
        块 · {preview.columns} × {preview.rows} · 上传 {preview.upload_width} × {preview.upload_height}
        {padded ? ` · 补边 ${work.pad_right} / ${work.pad_bottom}` : ""}
      </span>
    </Summary>
  );
}

/** Every setting that decides how a video is scrambled, in one list. */
export function PlanPanel({ settings, onChange, hasFile }: Props) {
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  // undefined while detecting, null when no hardware encoder initialises.
  const [encoder, setEncoder] = useState<EncoderInfo | null | undefined>(undefined);
  const { width, height, tile, margin } = settings;
  const set = (patch: Partial<PlanSettings>) => onChange({ ...settings, ...patch });

  useEffect(() => {
    let cancelled = false;
    hardwareEncoder()
      .then((result) => {
        if (!cancelled) setEncoder(result);
      })
      .catch(() => {
        if (!cancelled) setEncoder(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    planPreview({ width, height, tile, margin })
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setPreview(null);
        setError(String(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [width, height, tile, margin]);

  return (
    <Card>
      <CardTitle>编码参数</CardTitle>
      <Row>
        <Field as="div">
          <Label>tile（偶数）</Label>
          <Stepper label="tile" value={tile} step={2} min={2} onChange={(value) => set({ tile: value })} />
        </Field>
        <Field as="div">
          <Label>margin（偶数）</Label>
          <Stepper label="margin" value={margin} step={2} onChange={(value) => set({ margin: value })} />
        </Field>
      </Row>
      <PlanSummary preview={preview} error={error} hasFile={hasFile} />
      <Field>
        <Label>seed（数字或任意文字）</Label>
        <Input type="text" spellCheck={false} value={settings.seed} onChange={(e) => set({ seed: e.currentTarget.value })} />
      </Field>

      <div>
        <Switch
          title="反色"
          description="加密与还原两端需要保持一致"
          checked={settings.invert}
          onChange={(invert) => set({ invert })}
        />
        <Switch
          title="片头二维码"
          description="在片头第一秒显示含编码参数的二维码，供解码方读取"
          checked={settings.intro}
          onChange={(intro) => set({ intro })}
        />
        <Switch
          title="把 seed 也写进二维码"
          description={settings.intro ? "任何装了脚本的人都能直接观看" : "需要先打开片头二维码"}
          checked={settings.seedInIntro}
          disabled={!settings.intro}
          onChange={(seedInIntro) => set({ seedInIntro })}
        />
        <Switch
          title="音频频谱翻转"
          description="164 Hz–10 kHz 上下颠倒；观众端实时还原"
          checked={settings.audio}
          onChange={(audio) => set({ audio })}
        />
        <Switch
          title={
            <>
              显卡编码{" "}
              {encoder === undefined ? (
                <Badge>检测中…</Badge>
              ) : encoder ? (
                <Badge data-tone="success">{encoder.label}</Badge>
              ) : (
                <Badge>仅 CPU</Badge>
              )}
            </>
          }
          description={encoder ? `使用 ${encoder.codec}，失败时自动回退 CPU` : "未检测到可用的显卡编码器，将使用 CPU（libx264）"}
          checked={settings.gpu}
          disabled={encoder === null}
          onChange={(gpu) => set({ gpu })}
        />
      </div>
      {settings.audioMs > 0 && (
        <Note data-tone="muted">
          旧版文件：音频还做了 {settings.audioMs} ms 分块倒放{settings.audio ? "和频谱翻转" : ""}，解密时一并还原。
        </Note>
      )}
    </Card>
  );
}
