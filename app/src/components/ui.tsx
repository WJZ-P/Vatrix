import type { ButtonHTMLAttributes, ReactNode } from "react";
import { styled } from "@linaria/react";

/** A raised block on the page background; rises into place when it mounts. */
export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-l);
  background: var(--surface-panel);
  box-shadow: var(--highlight), var(--shadow-panel);
  animation: vx-rise 420ms var(--ease) both;
`;

const Heading = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;

  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  /* A small lit tile before each title, a fading rule after it. */
  h2::before {
    content: "";
    flex: none;
    width: 8px;
    height: 8px;
    background: var(--accent-grad);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.55);
  }

  h2::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--border-strong), transparent);
  }
`;

/** Title of a card, with an optional badge or action on the right. */
export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <Heading>
      <h2>{children}</h2>
      {aside}
    </Heading>
  );
}

export const Label = styled.span`
  font-size: 12px;
  color: var(--text-2);
`;

export const Input = styled.input`
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-s);
  background: var(--well);
  box-shadow: var(--well-shadow);
  color: var(--text);
  font-size: 14px;
  transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);

  &:hover {
    border-color: var(--border-hover);
  }

  &:focus-visible {
    border-color: var(--accent);
    box-shadow: var(--well-shadow), 0 0 0 3px var(--accent-soft);
  }
`;

/** A labelled control stacked vertically. */
export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1 1 0;
`;

export const Row = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
`;

const StepperBox = styled.div`
  display: flex;
  height: 34px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-s);
  background: var(--well);
  box-shadow: var(--well-shadow);
  overflow: hidden;
  transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);

  &:hover {
    border-color: var(--border-hover);
  }

  &:focus-within {
    border-color: var(--accent);
    box-shadow: var(--well-shadow), 0 0 0 3px var(--accent-soft);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    text-align: center;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  input:focus-visible {
    box-shadow: none;
  }

  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  button {
    width: 32px;
    border: 0;
    background-color: var(--raised);
    background-image: var(--sheen);
    box-shadow: var(--highlight);
    color: var(--text-2);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: background-color 200ms var(--ease), color 200ms var(--ease);
  }

  button:hover:not(:disabled) {
    background-color: var(--raised-hover);
    color: var(--accent);
  }

  button:active:not(:disabled) {
    background: var(--accent-soft);
  }

  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;

/** Number input with − / + buttons that move by `step` and stay at or above `min`. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  label: string;
}) {
  return (
    <StepperBox>
      <button type="button" aria-label={`${label} 减 ${step}`} disabled={value - step < min} onClick={() => onChange(value - step)}>
        −
      </button>
      <input
        type="number"
        aria-label={label}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <button type="button" aria-label={`${label} 加 ${step}`} onClick={() => onChange(value + step)}>
        +
      </button>
    </StepperBox>
  );
}

const SwitchLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 -8px;
  padding: 11px 8px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  transition: background 200ms var(--ease);

  &:hover:not([data-disabled="true"]) {
    background: linear-gradient(90deg, rgba(56, 189, 248, 0.05), transparent 80%);
  }

  &[data-disabled="true"] {
    opacity: 0.45;
    cursor: default;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: 14px;
    color: var(--text);
    transition: color 160ms var(--ease);
  }

  &:hover:not([data-disabled="true"]) .title {
    color: #fff;
  }

  .description {
    font-size: 12px;
    color: var(--text-3);
  }

  /* A square well with a tile inside. */
  input {
    appearance: none;
    position: relative;
    flex: none;
    width: 46px;
    height: 24px;
    margin: 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--well);
    box-shadow: var(--well-shadow);
    cursor: inherit;
    transition: border-color 240ms var(--ease), box-shadow 420ms var(--ease);
  }

  /*
   * The lit fill is its own layer: switching on reveals it from the left,
   * switching off draws it back behind the tile. A background change cannot
   * be animated; a clip can.
   */
  input::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: var(--accent-grad);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    clip-path: inset(0 100% 0 0);
    transition: clip-path 420ms var(--ease);
  }

  /*
   * The tile tumbles over: half a turn on the way across, back again on the
   * way home. translate, rotate and scale are separate properties so the
   * press, the hover nudge and the roll each keep their own timing. The sheen
   * is symmetric, so it looks the same after the half turn, and the colour
   * underneath fades between grey and white.
   */
  input::before {
    content: "";
    position: absolute;
    z-index: 1;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    background-color: #75829e;
    background-image: radial-gradient(circle, rgba(255, 255, 255, 0.16), rgba(0, 0, 0, 0.14));
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    transition:
      translate 480ms var(--spring),
      rotate 480ms var(--spring),
      scale 160ms var(--ease),
      background-color 360ms var(--ease),
      box-shadow 360ms var(--ease);
  }

  &:hover:not([data-disabled="true"]) input {
    border-color: var(--border-hover);
  }

  /* Leans toward the other side, as if about to go. */
  &:hover:not([data-disabled="true"]) input::before {
    translate: 2px 0;
  }

  &:active:not([data-disabled="true"]) input::before {
    scale: 0.8;
  }

  input:checked {
    box-shadow: var(--accent-glow);
  }

  input:checked::after {
    clip-path: inset(0 0 0 0);
  }

  /* Upside down after the half turn, so its shadow is set upward to fall downward. */
  input:checked::before {
    translate: 22px 0;
    rotate: 180deg;
    background-color: #f2f7ff;
    box-shadow: 0 -2px 6px rgba(8, 30, 80, 0.5);
  }

  &:hover:not([data-disabled="true"]) input:checked::before {
    translate: 20px 0;
  }
`;

/** An on/off setting with a one-line explanation under its title. */
export function Switch({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SwitchLabel data-disabled={disabled}>
      <span className="text">
        <span className="title">{title}</span>
        {description && <span className="description">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
    </SwitchLabel>
  );
}

/*
 * Every variant keeps its gradient layer fixed and changes only properties
 * that animate (background-color, border, shadow, filter) on hover, so
 * nothing snaps. Variant rules sit on [data-variant] so a generic :hover
 * never outranks them.
 */
const ButtonBase = styled.button`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  background-color: var(--raised);
  background-image: var(--sheen);
  box-shadow: var(--highlight), 0 8px 24px -10px transparent;
  color: var(--text);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 220ms var(--ease),
    box-shadow 280ms var(--ease),
    background-color 220ms var(--ease),
    border-color 220ms var(--ease),
    color 220ms var(--ease),
    filter 220ms var(--ease);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    transition-duration: 90ms;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &[data-variant="secondary"]:hover:not(:disabled) {
    border-color: var(--border-hover);
    background-color: var(--raised-hover);
  }

  &[data-variant="primary"] {
    border-color: transparent;
    background-image: var(--accent-grad);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 8px 24px -10px rgba(56, 189, 248, 0);
    color: #fff;
    font-weight: 600;
  }

  &[data-variant="primary"]:hover:not(:disabled) {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 8px 24px -10px rgba(56, 189, 248, 0.75);
    filter: brightness(1.1) saturate(1.1);
  }

  /* A light sweep across the primary button on hover. */
  &[data-variant="primary"]::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transform: translateX(-120%) skewX(-20deg);
    pointer-events: none;
  }

  &[data-variant="primary"]:hover:not(:disabled)::after {
    animation: vx-sheen 900ms var(--ease);
  }

  /* The other half of a pair of actions, in the second colour. */
  &[data-variant="violet"] {
    border-color: rgba(139, 92, 246, 0.45);
    background-color: rgba(139, 92, 246, 0.16);
    box-shadow: inset 0 1px 0 rgba(221, 214, 254, 0.12), 0 8px 24px -10px rgba(139, 92, 246, 0);
    color: #ddd6fe;
    font-weight: 600;
  }

  &[data-variant="violet"]:hover:not(:disabled) {
    border-color: rgba(167, 139, 250, 0.85);
    background-color: rgba(139, 92, 246, 0.3);
    box-shadow: inset 0 1px 0 rgba(221, 214, 254, 0.12), 0 8px 24px -10px rgba(139, 92, 246, 0.8);
  }

  &[data-variant="ghost"] {
    border-color: transparent;
    background-color: transparent;
    background-image: none;
    box-shadow: none;
    color: var(--text-2);
  }

  &[data-variant="ghost"]:hover:not(:disabled) {
    background-color: var(--accent-soft);
    color: var(--accent);
  }

  &[data-size="large"] {
    height: 40px;
    padding: 0 22px;
    font-size: 15px;
  }

  &[data-size="small"] {
    height: 28px;
    padding: 0 10px;
    font-size: 13px;
  }
`;

export function Button({
  variant = "secondary",
  size = "medium",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "violet" | "ghost";
  size?: "small" | "medium" | "large";
}) {
  return <ButtonBase type="button" data-variant={variant} data-size={size} {...rest} />;
}

/** A short piece of status: a resolution, a detected encoder, a warning. */
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-s);
  background: rgba(22, 32, 58, 0.75);
  color: var(--text-2);
  font-size: 12px;
  white-space: nowrap;

  &[data-tone="accent"] {
    border-color: rgba(56, 189, 248, 0.35);
    background: var(--accent-soft);
    color: var(--accent);
  }

  &[data-tone="success"] {
    border-color: rgba(52, 211, 153, 0.35);
    background: var(--success-soft);
    color: var(--success);
  }

  &[data-tone="violet"] {
    border-color: rgba(139, 92, 246, 0.4);
    background: var(--violet-soft);
    color: var(--violet);
  }
`;

export const Note = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--text-2);
  overflow-wrap: anywhere;

  &[data-tone="error"] {
    color: var(--danger);
  }

  &[data-tone="muted"] {
    color: var(--text-3);
  }
`;

const Track = styled.div`
  height: 6px;
  background: var(--well);
  box-shadow: var(--well-shadow);
  overflow: hidden;

  div {
    height: 100%;
    background-image:
      repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.18) 0 6px, transparent 6px 12px),
      var(--accent-grad);
    background-size: 24px 100%, 100% 100%;
    animation: vx-stripes 700ms linear infinite;
    transition: width 200ms var(--ease);
  }

  &[data-tone="violet"] div {
    background-image:
      repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.18) 0 6px, transparent 6px 12px),
      linear-gradient(135deg, var(--violet) 0%, var(--accent-3) 100%);
  }
`;

/** Moving stripes while work is in progress. */
export function ProgressBar({ ratio, tone = "accent" }: { ratio: number; tone?: "accent" | "violet" }) {
  return (
    <Track role="progressbar" data-tone={tone} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div style={{ width: `${Math.round(ratio * 100)}%` }} />
    </Track>
  );
}
