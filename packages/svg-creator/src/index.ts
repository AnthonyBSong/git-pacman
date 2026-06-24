import type { PacmanGrid, Direction } from "@git-pacman/grid";

// ─── Layout ──────────────────────────────────────────────────────────────────
const CELL_SIZE = 14;
const CELL_GAP = 2;
const PADDING = 20;
const STEP_DURATION = 0.08; // seconds per path step

// ─── Direction → rotation angle (Pac-Man faces right at 0°) ─────────────────
const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

// ─── Cell renderers ───────────────────────────────────────────────────────────
// SPRITE: replace rect/circle shapes with custom artwork. Canvas is 14×14px.

function renderWall(x: number, y: number): string {
  // Blue-outlined rect — classic Pac-Man maze wall look
  return `<rect x="${x + 1}" y="${y + 1}" width="12" height="12" rx="1.5"
    fill="#0f1b3d" stroke="#3b82f6" stroke-width="1.5"/>`;
}

function renderFloor(x: number, y: number): string {
  return `<rect x="${x + 2}" y="${y + 2}" width="10" height="10" rx="2" fill="#161b22"/>`;
}

function renderDot(x: number, y: number, opacityAnim: string): string {
  // SPRITE: yellow pellet dot — replace circle with custom artwork
  return `<circle cx="${x + 7}" cy="${y + 7}" r="2.5" fill="#FFD700">${opacityAnim}</circle>`;
}

// ─── Character renderers ──────────────────────────────────────────────────────
// Each character uses nested <g> elements:
//   outer <g>: animateTransform translate → moves to grid position
//   inner <g>: animateTransform rotate   → faces movement direction
//
// SPRITE: replace shape elements inside inner <g> with custom artwork (14×14 canvas,
// character should face RIGHT at 0°, centered at (7,7)).

function renderPacman(
  translateValues: string,
  rotateValues: string,
  keyTimes: string,
  dur: number
): string {
  return `
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="${translateValues}" keyTimes="${keyTimes}"
      dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values="${rotateValues}" keyTimes="${keyTimes}"
        dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>
      <!-- SPRITE: Pac-Man body — facing right, centered at (7,7) -->
      <path fill="#FFD700">
        <animate attributeName="d"
          values="M7,7 L13,4 A6,6 0,1,0 13,10 Z;M7,7 L13,6.8 A6,6 0,1,0 13,7.2 Z;M7,7 L13,4 A6,6 0,1,0 13,10 Z"
          dur="0.3s" repeatCount="indefinite"/>
      </path>
    </g>
  </g>`;
}

function renderGhost(
  color: string,
  translateValues: string,
  keyTimes: string,
  dur: number
): string {
  return `
  <g>
    <animateTransform attributeName="transform" type="translate"
      values="${translateValues}" keyTimes="${keyTimes}"
      dur="${dur}s" repeatCount="indefinite" calcMode="discrete"/>
    <!-- SPRITE: Ghost — replace shapes with custom artwork (14×14 canvas) -->
    <rect x="1" y="4" width="12" height="8" rx="6" fill="${color}"/>
    <circle cx="5" cy="7" r="2" fill="white"/>
    <circle cx="9" cy="7" r="2" fill="white"/>
    <circle cx="5.5" cy="7.5" r="1" fill="#222"/>
    <circle cx="9.5" cy="7.5" r="1" fill="#222"/>
    <path d="M1,12 L1,14 L3.5,12 L5,14 L7,12 L9,14 L10.5,12 L13,14 L13,12 Z" fill="${color}"/>
  </g>`;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export interface SvgOptions {
  includeGhosts?: boolean;
  colorScheme?: "dark" | "light";
}

export function createSvg(grid: PacmanGrid, options: SvgOptions = {}): string {
  const { includeGhosts = true, colorScheme = "dark" } = options;

  const step = CELL_SIZE + CELL_GAP;
  const width = grid.cols * step + PADDING * 2;
  const height = grid.rows * step + PADDING * 2;
  const bg = colorScheme === "dark" ? "#0d1117" : "#ffffff";

  const n = grid.path.length;
  if (n === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${bg}"/></svg>`;

  const totalDuration = n * STEP_DURATION;

  // Shared keyTimes string — same for Pac-Man AND all ghosts
  const keyTimes = grid.path
    .map((_, i) => (n === 1 ? "0" : (i / (n - 1)).toFixed(4)))
    .join(";");

  // ── Eat-time lookup: "col,row" → step index ──
  const eatTime = new Map<string, number>();
  grid.path.forEach((s, i) => {
    if (s.eating) eatTime.set(`${s.col},${s.row}`, i);
  });

  // ── All 52×7 cells ──
  const wallCells: string[] = [];
  const floorCells: string[] = [];
  const dotCells: string[] = [];

  for (let c = 0; c < grid.cols; c++) {
    for (let r = 0; r < grid.rows; r++) {
      const cell = grid.cells[c][r];
      const x = PADDING + c * step;
      const y = PADDING + r * step;

      if (cell.cellType === "wall") {
        wallCells.push(renderWall(x, y));
      } else if (cell.cellType === "floor") {
        floorCells.push(renderFloor(x, y));
      } else {
        // active dot — disappears when Pac-Man arrives
        const arrival = eatTime.get(`${c},${r}`);
        let opacityAnim = "";
        if (arrival !== undefined) {
          const t0 = Math.max(0.0001, arrival / Math.max(1, n - 1));
          const t1 = Math.min(t0 + 0.005, 0.9999);
          opacityAnim = `<animate attributeName="opacity" values="1;1;0;0"
            keyTimes="0;${t0.toFixed(4)};${t1.toFixed(4)};1"
            dur="${totalDuration}s" repeatCount="indefinite"/>`;
        }
        dotCells.push(renderDot(x, y, opacityAnim));
      }
    }
  }

  // ── Pac-Man ──
  const pacTranslate = grid.path
    .map((s) => `${PADDING + s.col * step},${PADDING + s.row * step}`)
    .join(";");
  const pacRotate = grid.path
    .map((s) => `${DIR_ANGLE[s.direction]},7,7`)
    .join(";");

  const pacman = renderPacman(pacTranslate, pacRotate, keyTimes, totalDuration);

  // ── Ghosts — snake chain: ghost k is always exactly `offset` steps behind Pac-Man ──
  const GHOST_COLORS = ["#FF0000", "#FFB8FF", "#FFB852", "#00FFFF"];
  const GHOST_OFFSETS = [4, 8, 12, 16];

  let ghosts = "";
  if (includeGhosts) {
    ghosts = GHOST_COLORS.map((color, gi) => {
      const offset = GHOST_OFFSETS[gi];
      // At step i, this ghost is at path[max(0, i - offset)]
      const translateValues = grid.path
        .map((_, i) => {
          const src = grid.path[Math.max(0, i - offset)];
          return `${PADDING + src.col * step},${PADDING + src.row * step}`;
        })
        .join(";");
      return renderGhost(color, translateValues, keyTimes, totalDuration);
    }).join("\n");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>GitHub Contributions — Pac-Man</title>
  <rect width="${width}" height="${height}" fill="${bg}" rx="6"/>

  <!-- Walls (inactive, no active neighbors) -->
  ${wallCells.join("\n  ")}

  <!-- Floor / corridors (inactive, adjacent to active) -->
  ${floorCells.join("\n  ")}

  <!-- Active dots (disappear as Pac-Man eats them) -->
  ${dotCells.join("\n  ")}

  <!-- Ghosts — trailing Pac-Man at fixed offsets (snake chain, no growth) -->
  ${ghosts}

  <!-- Pac-Man -->
  ${pacman}
</svg>`;
}
