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
  background: var(--surface);
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
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--text-2);
  }

  /* A small tile before each title. */
  h2::before {
    content: "";
    width: 6px;
    height: 6px;
    background: var(--accent-grad);
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
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);

  &:hover {
    border-color: #3d4f78;
  }

  &:focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
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
  background: var(--bg);
  overflow: hidden;
  transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);

  &:hover {
    border-color: #3d4f78;
  }

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
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
    background: var(--surface-2);
    color: var(--text-2);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    transition: background 140ms var(--ease), color 140ms var(--ease);
  }

  button:hover:not(:disabled) {
    background: var(--surface-3);
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
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--border);
  cursor: pointer;

  &[data-disabled="true"] {
    opacity: 0.45;
    cursor: default;
  }

  &[data-nested="true"] {
    padding-left: 14px;
    border-top-style: dashed;
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

  /* A square track with a square thumb: a pixel sliding between two cells. */
  input {
    appearance: none;
    position: relative;
    flex: none;
    width: 38px;
    height: 20px;
    margin: 1px 0 0;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-s);
    background: var(--bg);
    cursor: inherit;
    transition: background 200ms var(--ease), border-color 200ms var(--ease), box-shadow 200ms var(--ease);
  }

  input::before {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 12px;
    height: 12px;
    background: var(--text-3);
    transition: transform 260ms var(--spring), background 200ms var(--ease), width 260ms var(--spring);
  }

  &:hover:not([data-disabled="true"]) input {
    border-color: #3d4f78;
  }

  &:active:not([data-disabled="true"]) input::before {
    width: 16px;
  }

  input:checked {
    border-color: transparent;
    background: var(--accent-grad);
    box-shadow: var(--accent-glow);
  }

  input:checked::before {
    transform: translateX(18px);
    background: #fff;
  }

  &:active:not([data-disabled="true"]) input:checked::before {
    transform: translateX(14px);
  }
`;

/** An on/off setting with a one-line explanation under its title. */
export function Switch({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  nested = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  nested?: boolean;
}) {
  return (
    <SwitchLabel data-disabled={disabled} data-nested={nested}>
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
  background: var(--surface-2);
  color: var(--text);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 160ms var(--ease),
    box-shadow 200ms var(--ease),
    background 160ms var(--ease),
    border-color 160ms var(--ease),
    color 160ms var(--ease);

  &:hover:not(:disabled) {
    border-color: #3d4f78;
    background: var(--surface-3);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &[data-variant="primary"] {
    border-color: transparent;
    background: var(--accent-grad);
    color: #fff;
    font-weight: 600;
  }

  &[data-variant="primary"]:hover:not(:disabled) {
    box-shadow: var(--accent-glow);
  }

  /* A light sweep across the primary button on hover. */
  &[data-variant="primary"]::after {
    content: "";
    position: absolute;
    inset: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
    transform: translateX(-120%) skewX(-20deg);
    pointer-events: none;
  }

  &[data-variant="primary"]:hover:not(:disabled)::after {
    animation: vx-sheen 700ms var(--ease);
  }

  &[data-variant="ghost"] {
    border-color: transparent;
    background: transparent;
    color: var(--text-2);
  }

  &[data-variant="ghost"]:hover:not(:disabled) {
    background: var(--surface-2);
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
  variant?: "primary" | "secondary" | "ghost";
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
  background: rgba(24, 34, 58, 0.7);
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
  background: var(--surface-3);
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
`;

/** Moving stripes while work is in progress. */
export function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <Track role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <div style={{ width: `${Math.round(ratio * 100)}%` }} />
    </Track>
  );
}
