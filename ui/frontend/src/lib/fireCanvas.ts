// ---------------------------------------------------------------------------
// Eternal Flame — Procedural Canvas 2D fire renderer
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
}

export interface FlameConfig {
  spawnRate: number;   // particles per frame (40-120)
  intensity: number;   // 0-1 brightness multiplier
  baseWidth: number;   // horizontal spread of spawn area
  flaring: boolean;    // new-block flare active
}

export interface FlameRenderer {
  start: () => void;
  stop: () => void;
  setConfig: (c: Partial<FlameConfig>) => void;
  flare: () => void;
  resize: (w: number, h: number) => void;
}

// Fire color palette: base → mid → tip
const COLORS: [number, number, number][] = [
  [255, 69, 0],    // #FF4500 — deep orange-red (base)
  [255, 120, 0],   // mid orange
  [255, 140, 0],   // #FF8C00 — amber
  [255, 180, 30],  // warm gold
  [255, 191, 0],   // #FFBF00 — bright gold (tip)
];

function lerpColor(t: number): [number, number, number] {
  const idx = t * (COLORS.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, COLORS.length - 1);
  const f = idx - lo;
  return [
    COLORS[lo][0] + (COLORS[hi][0] - COLORS[lo][0]) * f,
    COLORS[lo][1] + (COLORS[hi][1] - COLORS[lo][1]) * f,
    COLORS[lo][2] + (COLORS[hi][2] - COLORS[lo][2]) * f,
  ];
}

export function createFlameRenderer(canvas: HTMLCanvasElement): FlameRenderer {
  const ctx = canvas.getContext("2d")!;
  const particles: Particle[] = [];
  let animId = 0;
  let lastTime = 0;
  let flareTimer = 0;

  let config: FlameConfig = {
    spawnRate: 60,
    intensity: 1,
    baseWidth: 100,
    flaring: false,
  };

  // Check reduced motion preference
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spawn(count: number, isFlare: boolean) {
    const cx = canvas.width / 2;
    const baseY = canvas.height - 10;

    for (let i = 0; i < count; i++) {
      const spread = isFlare ? config.baseWidth * 1.5 : config.baseWidth;
      const x = cx + (Math.random() - 0.5) * spread;

      const speed = isFlare
        ? -(6 + Math.random() * 6)
        : -(1.5 + Math.random() * 3.5);

      const maxLife = isFlare
        ? 40 + Math.random() * 30
        : 50 + Math.random() * 40;

      const colorT = isFlare ? 0.6 + Math.random() * 0.4 : Math.random();
      const [r, g, b] = lerpColor(colorT);

      particles.push({
        x,
        y: baseY + Math.random() * 5,
        vx: (Math.random() - 0.5) * 1.2,
        vy: speed,
        life: maxLife,
        maxLife,
        size: isFlare ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
        r, g, b,
      });
    }
  }

  function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy *= 0.985; // decelerate upward
      p.vx += (Math.random() - 0.5) * 0.15; // flicker drift
      p.life -= 1;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Additive blending for fire glow
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
      const alpha = (p.life / p.maxLife) * config.intensity;
      const sz = p.size * (p.life / p.maxLife);
      if (alpha < 0.01 || sz < 0.5) continue;

      // Soft glow circle
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, sz * 2);
      gradient.addColorStop(0, `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${alpha * 0.8})`);
      gradient.addColorStop(0.4, `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, ${alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(${p.r | 0}, ${p.g | 0}, ${p.b | 0}, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  function loop(time: number) {
    animId = requestAnimationFrame(loop);

    // Throttle to ~30fps
    if (time - lastTime < 33) return;
    lastTime = time;

    // Flare countdown
    if (flareTimer > 0) {
      spawn(8, true);
      flareTimer--;
      if (flareTimer <= 0) config.flaring = false;
    }

    // Normal spawn
    const rate = prefersReduced ? 5 : Math.round(config.spawnRate / 30); // per frame at 30fps
    spawn(rate, false);

    update();
    draw();
  }

  return {
    start() {
      if (prefersReduced) {
        // Still render but minimal
        spawn(20, false);
        draw();
      }
      animId = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(animId);
    },
    setConfig(c: Partial<FlameConfig>) {
      Object.assign(config, c);
    },
    flare() {
      config.flaring = true;
      flareTimer = 60; // ~2 seconds at 30fps
      spawn(40, true); // immediate burst
    },
    resize(w: number, h: number) {
      canvas.width = w;
      canvas.height = h;
    },
  };
}
