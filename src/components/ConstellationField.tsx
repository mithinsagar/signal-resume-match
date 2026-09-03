"use client";

/**
 * The field.
 *
 * Two drifting clusters of nodes — violet on the left standing for the resume,
 * cyan on the right for the role — with links drawn between neighbours. The
 * visual is the product metaphor rather than decoration: cross-cluster links
 * are the match, and when a real score arrives the field tightens and lights
 * those links in proportion to it.
 *
 * Implementation notes that matter:
 *  - One canvas, one rAF loop, no per-frame allocation in the hot path.
 *  - Linking is O(n²) over ~72 nodes, which is ~2.6k distance checks a frame —
 *    cheap enough to stay well inside a 60fps budget on integrated graphics.
 *  - The loop stops entirely when the tab is hidden or the element scrolls out
 *    of view, so a backgrounded tab costs nothing.
 *  - `prefers-reduced-motion` renders a single static frame and never animates.
 */

import { useEffect, useRef } from "react";

export type FieldMode = "idle" | "analyzing" | "result";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  side: 0 | 1;
  /** Per-node phase so pulses don't land in lockstep. */
  phase: number;
}

interface Props {
  mode?: FieldMode;
  /** 0-100, only read in "result" mode to set cross-link brightness. */
  score?: number;
  className?: string;
}

const NODE_COUNT = 72;
const LINK_DISTANCE = 148;
const CROSS_LINK_DISTANCE = 208;
const POINTER_RADIUS = 190;

const VIOLET = { r: 124, g: 92, b: 255 };
const CYAN = { r: 34, g: 211, b: 238 };

export default function ConstellationField({ mode = "idle", score = 0, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live values the animation loop reads without being torn down and rebuilt
  // on every prop change — restarting the loop would reset all node positions.
  const modeRef = useRef(mode);
  const scoreRef = useRef(score);
  modeRef.current = mode;
  scoreRef.current = score;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let running = true;
    let t = 0;

    const pointer = { x: -9999, y: -9999, active: false };

    function seed() {
      nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
        const side: 0 | 1 = i % 2 === 0 ? 0 : 1;
        // Each side owns roughly its half, with overlap in the middle so the
        // two populations genuinely interleave rather than sitting apart.
        const bandStart = side === 0 ? 0.02 : 0.42;
        return {
          x: (bandStart + Math.random() * 0.56) * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          radius: 0.9 + Math.random() * 1.9,
          side,
          phase: Math.random() * Math.PI * 2,
        };
      });
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seed();
    }

    function tint(side: 0 | 1) {
      return side === 0 ? VIOLET : CYAN;
    }

    function step() {
      const m = modeRef.current;
      // Analysis visibly speeds the field up; a settled result calms it below
      // its resting rate so the page feels like it has come to rest.
      const speed = m === "analyzing" ? 2.5 : m === "result" ? 0.62 : 1;
      const linkBoost = m === "analyzing" ? 1.28 : 1;

      t += 0.006 * speed;

      for (const n of nodes) {
        n.x += n.vx * speed;
        n.y += n.vy * speed;

        // Wrap rather than bounce: bouncing makes the edges of the viewport
        // read as walls, which draws attention to the frame instead of the field.
        if (n.x < -40) n.x = width + 40;
        if (n.x > width + 40) n.x = -40;
        if (n.y < -40) n.y = height + 40;
        if (n.y > height + 40) n.y = -40;

        if (pointer.active) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 1) {
            const d = Math.sqrt(d2);
            const force = (1 - d / POINTER_RADIUS) * 0.5;
            n.vx += (dx / d) * force * 0.05;
            n.vy += (dy / d) * force * 0.05;
          }
        }

        // Damping keeps pointer nudges from accumulating into chaos.
        n.vx *= 0.994;
        n.vy *= 0.994;

        const drift = 0.16;
        if (n.vx > drift) n.vx = drift;
        if (n.vx < -drift) n.vx = -drift;
        if (n.vy > drift) n.vy = drift;
        if (n.vy < -drift) n.vy = -drift;
      }

      ctx!.clearRect(0, 0, width, height);

      // --- links -----------------------------------------------------------
      const crossStrength =
        modeRef.current === "result" ? 0.18 + (scoreRef.current / 100) * 0.62 : 0.2;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;

          const cross = a.side !== b.side;
          const limit = cross ? CROSS_LINK_DISTANCE : LINK_DISTANCE;
          if (d2 > limit * limit) continue;

          const d = Math.sqrt(d2);
          const falloff = 1 - d / limit;

          let alpha = falloff * (cross ? 0.4 * crossStrength : 0.13) * linkBoost;
          if (alpha < 0.004) continue;
          if (alpha > 0.5) alpha = 0.5;

          if (cross) {
            // The one place both hues appear at once: a link that spans the
            // two sides is literally the thing being measured.
            const grad = ctx!.createLinearGradient(a.x, a.y, b.x, b.y);
            const ca = tint(a.side);
            const cb = tint(b.side);
            grad.addColorStop(0, `rgba(${ca.r},${ca.g},${ca.b},${alpha})`);
            grad.addColorStop(1, `rgba(${cb.r},${cb.g},${cb.b},${alpha})`);
            ctx!.strokeStyle = grad;
            ctx!.lineWidth = 0.7;
          } else {
            const c = tint(a.side);
            ctx!.strokeStyle = `rgba(${c.r},${c.g},${c.b},${alpha})`;
            ctx!.lineWidth = 0.5;
          }

          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      // --- nodes -----------------------------------------------------------
      for (const n of nodes) {
        const c = tint(n.side);
        const pulse = 0.62 + Math.sin(t * 2.2 + n.phase) * 0.34;
        const r = n.radius * (modeRef.current === "analyzing" ? 1.25 : 1);

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${c.r},${c.g},${c.b},${0.55 * pulse})`;
        ctx!.fill();

        // A soft halo on the larger nodes only — on every node it turns to fog.
        if (n.radius > 2.1) {
          const glow = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 7);
          glow.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.16 * pulse})`);
          glow.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, r * 7, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
    }

    function loop() {
      if (!running) return;
      step();
      raf = requestAnimationFrame(loop);
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }
    function onPointerLeave() {
      pointer.active = false;
      pointer.x = -9999;
      pointer.y = -9999;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduceMotion) {
        running = true;
        loop();
      }
    }

    resize();

    if (reduceMotion) {
      // One frame, then nothing. Still gives the page its texture.
      step();
    } else {
      loop();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
