// Typed wrappers around the Tauri commands in src-tauri/src/lib.rs.
import { Channel, invoke } from "@tauri-apps/api/core";

export interface PlanParams {
  width: number;
  height: number;
  tile: number;
  margin: number;
}

/** Source padded up to a tile multiple (replicated edge pixels), cropped back on restore. */
export interface WorkSize {
  width: number;
  height: number;
  pad_right: number;
  pad_bottom: number;
}

export interface PlanPreview {
  work: WorkSize;
  columns: number;
  rows: number;
  tile_count: number;
  upload_width: number;
  upload_height: number;
}

/** Geometry a scrambled file carries in its metadata (never the seed). */
export interface PlanHint {
  width: number;
  height: number;
  tile: number;
  margin: number;
  invert: boolean;
  /** Length of the QR intro at the start of the file; 0 when there is none. */
  intro_ms: number;
  /** Numeric seed carried by the intro QR code, as a decimal string. */
  seed: string | null;
  /** Audio block length in ms, 0 = untouched. */
  audio_ms: number;
  /** The audio spectrum was mirrored too; false for files from before the mirror. */
  audio_mirror: boolean;
}

export interface VideoInfo {
  path: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  codec: string;
  has_audio: boolean;
  audio_channels: number;
  hint: PlanHint | null;
}

export type Mode = "scramble" | "restore";

export interface JobParams extends PlanParams {
  input: string;
  outputDir: string;
  mode: Mode;
  seed: string;
  invert: boolean;
  /** Scramble: prepend the one-second QR intro. Restore: skip the intro of the input. */
  intro: boolean;
  /** Scramble only: put the numeric seed into the intro QR code. */
  seedInIntro: boolean;
  /** Encode with the machine's hardware encoder if one works; otherwise libx264. */
  gpu: boolean;
  /** Reverse time inside audio blocks of this many ms (older files only); 0 = no reversal. Self-inverse. */
  audioMs: number;
  /** Mirror the 164 Hz–10 kHz spectrum so voices are unrecognisable. Self-inverse. */
  audioMirror: boolean;
}

export interface Progress {
  done: number;
  total: number;
}

export interface JobResult {
  output: string;
  frames: number;
  intro_frames: number;
  work: WorkSize;
  upload_width: number;
  upload_height: number;
  /** ffmpeg encoder name actually used, e.g. "libx264" or "h264_nvenc". */
  encoder: string;
  /** Audio block length applied; 0 when the audio was left alone. */
  audio_ms: number;
  /** Whether the spectrum mirror ran as well. */
  audio_mirror: boolean;
}

/** "频谱翻转", "分块倒放 250 ms", both joined, or "未处理". */
export function describeAudio(result: Pick<JobResult, "audio_ms" | "audio_mirror">): string {
  const parts = [result.audio_mirror && "频谱翻转", result.audio_ms > 0 && `分块倒放 ${result.audio_ms} ms`].filter(Boolean);
  return parts.length ? parts.join(" + ") : "未处理";
}

/** The hardware encoder `gpu` jobs will use on this machine. */
export interface EncoderInfo {
  codec: string;
  label: string;
}

/** Rejects with the core crate's error message when the parameters are invalid. */
export function planPreview(params: PlanParams): Promise<PlanPreview> {
  return invoke<PlanPreview>("plan_preview", { ...params });
}

/** A file passed on the command line or via VATRIX_OPEN, if any. */
export function initialFile(): Promise<string | null> {
  return invoke<string | null>("initial_file");
}

/** Detected once per process by test-encoding a frame; null means jobs use libx264. */
export function hardwareEncoder(): Promise<EncoderInfo | null> {
  return invoke<EncoderInfo | null>("hardware_encoder");
}

export function probeVideo(path: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("probe_video", { path });
}

/** The frame a running job last read and the frame it wrote for it, downscaled. */
export interface FramePair {
  input: ImageData;
  output: ImageData;
}

/** Wire format from src-tauri/src/preview.rs: four u16 sizes, then two RGBA blocks. */
function parseFramePair(buffer: ArrayBuffer): FramePair {
  const view = new DataView(buffer);
  const [inWidth, inHeight, outWidth, outHeight] = [0, 2, 4, 6].map((at) => view.getUint16(at, true));
  const inBytes = inWidth * inHeight * 4;
  return {
    input: new ImageData(new Uint8ClampedArray(buffer, 8, inBytes), inWidth, inHeight),
    output: new ImageData(new Uint8ClampedArray(buffer, 8 + inBytes, outWidth * outHeight * 4), outWidth, outHeight),
  };
}

/**
 * Runs one scramble/restore job; `onProgress` fires from the worker thread as
 * frames go by, and `onPreview` about ten times a second with the current pair.
 */
export function runJob(
  params: JobParams,
  onProgress: (progress: Progress) => void,
  onPreview: (pair: FramePair) => void = () => {},
): Promise<JobResult> {
  const progress = new Channel<Progress>();
  progress.onmessage = onProgress;
  const preview = new Channel<ArrayBuffer>();
  preview.onmessage = (buffer) => onPreview(parseFramePair(buffer));
  return invoke<JobResult>("run_job", { params, onProgress: progress, onPreview: preview });
}

/** A blob URL for one frame of `path`; revoke it when done. */
export async function snapshotUrl(path: string, seconds: number): Promise<string> {
  const bytes = await invoke<ArrayBuffer>("snapshot", { path, seconds });
  return URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
}
