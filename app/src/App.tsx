import { useCallback, useEffect, useState } from "react";
import { styled } from "@linaria/react";

import { ActionBar, type JobState } from "./components/ActionBar";
import { PixelField } from "./components/PixelField";
import { PlanPanel, type PlanSettings } from "./components/PlanPanel";
import { SourcePanel } from "./components/SourcePanel";
import { TitleBar } from "./components/TitleBar";
import { type FramePair, type Mode, type VideoInfo, initialFile, probeVideo, runJob } from "./ipc";
import defaultSettings from "./default-settings.json";

/** Above the pixel field. */
const Frame = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

/** The video on the left, its settings in a column of their own on the right. */
const Main = styled.main`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  flex: 1;
  min-height: 0;
  padding: 16px;
`;

const SourceColumn = styled.div`
  min-height: 0;
`;

const SettingsColumn = styled.div`
  min-height: 0;
  margin-right: -8px;
  padding-right: 8px;
  overflow-y: auto;
`;

/** Seconds of the QR intro the desktop prepends (intro::INTRO_SECONDS). */
const INTRO_SECONDS = 1;
// v3: tile now defaults to 32; values saved under an older key would hide that.
const SETTINGS_KEY = "vatrix.settings.v3";
const DEFAULT_SETTINGS: PlanSettings & { outputDir: string } = defaultSettings;

function loadSettings(): typeof DEFAULT_SETTINGS {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    // audioMs describes the loaded file, never a preference.
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored), audioMs: 0 } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const IDLE_JOB: JobState = { running: false, mode: null, progress: null, result: null, error: null };

function App() {
  const [file, setFile] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [settings, setSettings] = useState(loadSettings);
  const [job, setJob] = useState<JobState>(IDLE_JOB);
  const [live, setLive] = useState<FramePair | null>(null);
  // How far the output's timeline is shifted by the intro, fixed when the job starts.
  const [outputOffset, setOutputOffset] = useState(0);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const onFile = useCallback(async (path: string) => {
    setFile(path);
    setInfo(null);
    setProbeError(null);
    setJob(IDLE_JOB);
    setLive(null);
    try {
      const probed = await probeVideo(path);
      setInfo(probed);
      // A scrambled file knows its own geometry; anything else is treated as an original.
      const hint = probed.hint;
      setSettings((current) => ({
        ...current,
        width: hint ? hint.width : probed.width,
        height: hint ? hint.height : probed.height,
        ...(hint
          ? {
              tile: hint.tile,
              margin: hint.margin,
              invert: hint.invert ?? false,
              intro: hint.intro_ms > 0,
              audio: hint.audio_mirror,
              audioMs: hint.audio_ms,
              ...(hint.seed ? { seed: hint.seed } : {}),
            }
          : { audioMs: 0 }),
      }));
    } catch (reason) {
      setProbeError(String(reason));
    }
  }, []);

  useEffect(() => {
    initialFile().then((path) => {
      if (path) onFile(path);
    });
  }, [onFile]);

  async function run(mode: Mode) {
    if (!file) return;
    setJob({ running: true, mode, progress: null, result: null, error: null });
    setLive(null);
    const inputIntro = (info?.hint?.intro_ms ?? 0) / 1000;
    setOutputOffset(mode === "scramble" ? (settings.intro ? INTRO_SECONDS : 0) : -inputIntro);
    try {
      const result = await runJob(
        {
          input: file,
          outputDir: settings.outputDir,
          mode,
          width: settings.width,
          height: settings.height,
          tile: settings.tile,
          margin: settings.margin,
          seed: settings.seed,
          invert: settings.invert,
          intro: settings.intro,
          seedInIntro: settings.intro && settings.seedInIntro,
          gpu: settings.gpu,
          // New files are mirrored only; an older file's reversal is undone on restore.
          audioMs: mode === "restore" ? settings.audioMs : 0,
          audioMirror: settings.audio,
        },
        (progress) => setJob((current) => ({ ...current, progress })),
        setLive,
      );
      setJob((current) => ({ ...current, running: false, result }));
    } catch (reason) {
      setJob((current) => ({ ...current, running: false, error: String(reason) }));
    }
  }

  return (
    <>
      <PixelField />
      <Frame>
        <TitleBar />
        <Main>
          <SourceColumn>
            <SourcePanel
              file={file}
              info={info}
              error={probeError}
              job={{ running: job.running, mode: job.mode, output: job.result?.output ?? null, live }}
              outputOffset={outputOffset}
              onFile={onFile}
            />
          </SourceColumn>
          <SettingsColumn>
            <PlanPanel
              settings={settings}
              onChange={(next) => setSettings((current) => ({ ...current, ...next }))}
            />
          </SettingsColumn>
        </Main>
        <ActionBar
          outputDir={settings.outputDir}
          onOutputDir={(outputDir) => setSettings((current) => ({ ...current, outputDir }))}
          canRun={Boolean(file && info)}
          job={job}
          onRun={run}
        />
      </Frame>
    </>
  );
}

export default App;
