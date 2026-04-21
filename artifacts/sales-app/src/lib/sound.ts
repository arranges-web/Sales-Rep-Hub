// Lightweight Web Audio synthesizer for celebration SFX.
// Keeps zero binary deps and avoids autoplay issues by lazy-resuming.

const STORAGE_KEY = "jt-sound-enabled";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v == null ? true : v === "1";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  window.dispatchEvent(new CustomEvent("jt-sound-changed", { detail: on }));
}

export function onSoundChanged(cb: (on: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener("jt-sound-changed", handler as EventListener);
  return () => window.removeEventListener("jt-sound-changed", handler as EventListener);
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(opts: {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gn = ac.createGain();
  osc.type = opts.type ?? "sine";
  const start = ac.currentTime + (opts.delay ?? 0);
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + opts.duration);
  }
  const peak = opts.gain ?? 0.18;
  gn.gain.setValueAtTime(0.0001, start);
  gn.gain.exponentialRampToValueAtTime(peak, start + 0.015);
  gn.gain.exponentialRampToValueAtTime(0.0001, start + opts.duration);
  osc.connect(gn);
  gn.connect(ac.destination);
  osc.start(start);
  osc.stop(start + opts.duration + 0.05);
}

export function playDealSfx(): void {
  if (!isSoundEnabled()) return;
  // Bright two-note success ding.
  tone({ freq: 660, duration: 0.18, type: "triangle", gain: 0.18 });
  tone({ freq: 990, duration: 0.32, type: "triangle", gain: 0.18, delay: 0.12 });
}

export function playBadgeSfx(): void {
  if (!isSoundEnabled()) return;
  // Sparkle: 3 quick rising notes.
  tone({ freq: 880, duration: 0.12, type: "sine", gain: 0.16 });
  tone({ freq: 1175, duration: 0.12, type: "sine", gain: 0.16, delay: 0.09 });
  tone({ freq: 1568, duration: 0.22, type: "sine", gain: 0.16, delay: 0.18 });
}

export function playLevelUpSfx(): void {
  if (!isSoundEnabled()) return;
  // Big triumphant fanfare.
  tone({ freq: 523, duration: 0.18, type: "triangle", gain: 0.2 });
  tone({ freq: 659, duration: 0.18, type: "triangle", gain: 0.2, delay: 0.12 });
  tone({ freq: 784, duration: 0.18, type: "triangle", gain: 0.2, delay: 0.24 });
  tone({ freq: 1047, duration: 0.45, type: "triangle", gain: 0.22, delay: 0.36 });
}
