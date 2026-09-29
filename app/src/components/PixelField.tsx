import { useEffect, useRef } from "react";
import { styled } from "@linaria/react";

const Canvas = styled.canvas`
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% -10%, rgba(59, 130, 246, 0.2), transparent 55%),
    radial-gradient(circle at 100% 108%, rgba(139, 92, 246, 0.16), transparent 50%),
    radial-gradient(circle at 60% 55%, rgba(34, 211, 238, 0.04), transparent 45%);
`;

/** RGB triples from the icon's band, cyan through indigo, and a little violet. */
const COLORS = ["34,211,238", "56,189,248", "56,189,248", "59,130,246", "99,102,241", "139,92,246"];
const SIZES = [2, 2, 3, 3, 4, 4, 5, 6, 8];

interface Pixel {
  x: number;
  y: number;
  size: number;
  rise: number;
  drift: number;
  phase: number;
  alpha: number;
  twinkle: number;
  color: string;
}

function spawn(width: number, height: number, anywhere: boolean): Pixel {
  const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : height + 8,
    size: pick(SIZES),
    rise: 5 + Math.random() * 16,
    drift: (Math.random() - 0.5) * 6,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.06 + Math.random() * 0.34,
    twinkle: 0.3 + Math.random() * 1.1,
    color: pick(COLORS),
  };
}

/**
 * The window's backdrop: loose tiles drifting upward, sparse and slow enough
 * to stay behind the content. Drawn every frame at sub-pixel positions, so
 * slow tiles glide instead of stepping; paused while the window is hidden,
 * and a single still frame when the system asks for reduced motion.
 */
export function PixelField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let pixels: Pixel[] = [];
    let handle = 0;
    let last = performance.now();
    let clock = 0;

    const resize = () => {
      const ratio = devicePixelRatio || 1;
      width = innerWidth;
      height = innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round((width * height) / 9000);
      while (pixels.length < count) pixels.push(spawn(width, height, true));
      pixels = pixels.slice(0, count);
    };

    const draw = (seconds: number) => {
      context.clearRect(0, 0, width, height);
      for (const pixel of pixels) {
        pixel.y -= pixel.rise * seconds;
        pixel.x += (pixel.drift + Math.sin(clock * 0.5 + pixel.phase) * 4) * seconds;
        if (pixel.y < -12 || pixel.x < -12 || pixel.x > width + 12) Object.assign(pixel, spawn(width, height, false));
        const alpha = pixel.alpha * (0.55 + 0.45 * Math.sin(clock * pixel.twinkle + pixel.phase));
        context.fillStyle = `rgba(${pixel.color},${alpha.toFixed(3)})`;
        context.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
      }
    };

    const frame = (now: number) => {
      handle = requestAnimationFrame(frame);
      const seconds = Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      clock += seconds;
      draw(seconds);
    };

    const onVisibility = () => {
      cancelAnimationFrame(handle);
      if (!document.hidden && !still) {
        last = performance.now();
        handle = requestAnimationFrame(frame);
      }
    };

    resize();
    draw(0);
    if (!still) handle = requestAnimationFrame(frame);
    const onResize = () => {
      resize();
      draw(0);
    };
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(handle);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <Canvas ref={ref} aria-hidden="true" />;
}
