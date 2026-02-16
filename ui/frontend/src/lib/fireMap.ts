// ---------------------------------------------------------------------------
// Fire World Map — Leaflet dark tiles + Canvas overlay for Bitcoin animations
// ---------------------------------------------------------------------------

import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPeer {
  lat: number;
  lon: number;
  inbound: boolean;
}

export interface FireMapRenderer {
  start: () => void;
  stop: () => void;
  setPeers: (peers: MapPeer[]) => void;
  setNodeLocation: (lat: number, lon: number) => void;
}

// ---------------------------------------------------------------------------
// Quadratic bezier helper
// ---------------------------------------------------------------------------

function bezierPoint(
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  t: number
): [number, number] {
  const u = 1 - t;
  return [
    u * u * x0 + 2 * u * t * cx + t * t * x1,
    u * u * y0 + 2 * u * t * cy + t * t * y1,
  ];
}

// ---------------------------------------------------------------------------
// Bitcoin symbol drawing
// ---------------------------------------------------------------------------

function drawBitcoinB(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number,
  color: string,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "#000";
  ctx.font = `bold ${size * 1.1}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("\u20BF", 0, 0.5);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function createFireMap(container: HTMLElement): FireMapRenderer {
  let peers: MapPeer[] = [];
  let nodeLat = 51.5;
  let nodeLon = -0.1;
  let raf = 0;
  let frame = 0;

  // --- Create Leaflet map ---
  // Match tile background so no grey seams show between tiles
  container.style.backgroundColor = "#0d0d0d";

  const map = L.map(container, {
    center: [25, 10],
    zoom: 3,
    minZoom: 3,
    maxZoom: 6,
    zoomControl: false,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    touchZoom: true,
    keyboard: true,
    boxZoom: false,
    maxBounds: [[-85, -200], [85, 200]],
    maxBoundsViscosity: 0.8,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    noWrap: true,
  }).addTo(map);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  // --- Create Canvas overlay ---
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "500";
  container.style.position = "relative";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d")!;

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
  }

  // --- Convert lat/lon to pixel via Leaflet ---
  function toPixel(lat: number, lon: number): [number, number] {
    const pt = map.latLngToContainerPoint([lat, lon]);
    return [pt.x, pt.y];
  }

  // --- Redraw on map move/zoom ---
  map.on("move zoom", () => { /* animation loop handles it */ });

  // --- Animation loop ---
  function draw() {
    sizeCanvas();
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const [nx, ny] = toPixel(nodeLat, nodeLon);
    const time = frame * 0.008;

    // --- Node glow ---
    ctx.globalCompositeOperation = "lighter";
    const nodeGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 22);
    nodeGrad.addColorStop(0, "rgba(255, 160, 0, 0.7)");
    nodeGrad.addColorStop(0.3, "rgba(255, 100, 0, 0.35)");
    nodeGrad.addColorStop(1, "rgba(255, 69, 0, 0)");
    ctx.fillStyle = nodeGrad;
    ctx.beginPath();
    ctx.arc(nx, ny, 22, 0, Math.PI * 2);
    ctx.fill();

    // Node marker
    ctx.globalCompositeOperation = "source-over";
    drawBitcoinB(ctx, nx, ny, 10, "#FFBF00", 1);
    ctx.globalCompositeOperation = "lighter";

    // --- Arcs + travelling symbols ---
    for (let pi = 0; pi < peers.length; pi++) {
      const p = peers[pi];
      const [px, py] = toPixel(p.lat, p.lon);

      // Control point
      const mx = (nx + px) / 2;
      const my = (ny + py) / 2;
      const dist = Math.hypot(px - nx, py - ny);
      const lift = Math.min(dist * 0.3, 50);
      const cpx = mx;
      const cpy = my - lift;

      // Arc stroke
      ctx.strokeStyle = p.inbound
        ? "rgba(255, 140, 0, 0.2)"
        : "rgba(255, 180, 0, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(cpx, cpy, px, py);
      ctx.stroke();

      // Travelling symbol
      const sparkT = (time + pi * 0.37) % 1;
      const [sx, sy] = bezierPoint(nx, ny, cpx, cpy, px, py, sparkT);
      const bGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
      bGlow.addColorStop(0, "rgba(255, 160, 0, 0.45)");
      bGlow.addColorStop(1, "rgba(255, 69, 0, 0)");
      ctx.fillStyle = bGlow;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      drawBitcoinB(ctx, sx, sy, 8, "#FF8C00", 0.85);
      ctx.globalCompositeOperation = "lighter";
    }

    // --- Peer markers ---
    for (let pi = 0; pi < peers.length; pi++) {
      const p = peers[pi];
      const [px, py] = toPixel(p.lat, p.lon);
      const pulse = 0.7 + 0.3 * Math.sin(time * 2 + pi * 1.3);
      const r = p.inbound ? 7 : 8;

      // Glow
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.5);
      g.addColorStop(0, `rgba(255, 160, 0, ${0.45 * pulse})`);
      g.addColorStop(0.5, `rgba(255, 80, 0, ${0.15 * pulse})`);
      g.addColorStop(1, "rgba(255, 69, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Marker
      ctx.globalCompositeOperation = "source-over";
      drawBitcoinB(ctx, px, py, r, p.inbound ? "#FF8C00" : "#FFBF00", pulse);
      ctx.globalCompositeOperation = "lighter";
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    frame++;
    raf = requestAnimationFrame(draw);
  }

  return {
    start() {
      sizeCanvas();
      map.invalidateSize();
      frame = 0;
      raf = requestAnimationFrame(draw);
    },
    stop() {
      cancelAnimationFrame(raf);
      map.remove();
    },
    setPeers(newPeers: MapPeer[]) {
      peers = newPeers;
    },
    setNodeLocation(lat: number, lon: number) {
      nodeLat = lat;
      nodeLon = lon;
      map.setView([lat, lon], map.getZoom(), { animate: true });
    },
  };
}
