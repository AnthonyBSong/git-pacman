/**
 * Generates an animated SVG of Pac-Man eating GitHub contribution dots.
 *
 * Sprite placeholders:
 *   - PACMAN_SPRITE: replace with your Pac-Man SVG artwork
 *   - GHOST_SPRITE:  replace with your ghost SVG artwork
 *   - DOT_SPRITE:    replace with your dot/pellet SVG artwork
 *
 * Layout constants can be tuned below.
 */

import type { PacmanGrid, PathStep, Direction } from "@git-pacman/grid";

// ─── Layout constants ────────────────────────────────────────────────────────
const CELL_SIZE = 14;    // px per cell (matches GitHub's contribution square size)
const CELL_GAP = 2;      // px gap between cells
const PADDING = 20;      // outer padding
const STEP_DURATION = 0.08; // seconds per path step

// ─── Sprite placeholders ─────────────────────────────────────────────────────
// Replace the content inside each <g> with your custom SVG artwork.
// Each sprite is rendered at CELL_SIZE × CELL_SIZE with (0,0) at top-left.

function pacmanSprite(): string {
  // TODO: replace with custom Pac-Man artwork
  return `
  <g id="sprite-pacman">
    <circle cx="7" cy="7" r="6" fill="#FFD700"/>
    <polygon points="7,7 13,4 13,10" fill="#1a1a2e" id="pacman-mouth"/>
  </g>`;
}

function ghostSprite(id: string, color: string): string {
  // TODO: replace with custom ghost artwork (one per ghost color)
  return `
  <g id="sprite-ghost-${id}">
    <rect x="1" y="4" width="12" height="8" rx="6" fill="${color}"/>
    <circle cx="5" cy="7" r="2" fill="white"/>
    <circle cx="9" cy="7" r="2" fill="white"/>
    <circle cx="5.5" cy="7.5" r="1" fill="#333"/>
    <circle cx="9.5" cy="7.5" r="1" fill="#333"/>
    <path d="M1,12 L1,14 L3.5,12 L5,14 L7,12 L9,14 L10.5,12 L13,14 L13,12" fill="${color}"/>
  </g>`;
}

function dotSprite(): string {
  // TODO: replace with custom dot/pellet artwork
  return `
  <g id="sprite-dot">
    <circle cx="7" cy="7" r="2.5" fill="#58a6ff"/>
  </g>`;
}

function emptySprite(): string {
  // Inactive cell — rendered as a faint square (no dot)
  // TODO: replace or remove to match your aesthetic
  return `
  <g id="sprite-empty">
    <rect x="2" y="2" width="10" height="10" rx="2" fill="#161b22" opacity="0.6"/>
  </g>`;
}

// ─── Direction → rotation angle ──────────────────────────────────────────────
const DIR_ANGLE: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

// ─── Main export ─────────────────────────────────────────────────────────────
export interface SvgOptions {
  /** Include decorative ghost sprites chasing Pac-Man. Default: true */
  includeGhosts?: boolean;
  /** Dark or light background. Default: "dark" */
  colorScheme?: "dark" | "light";
}

export function createSvg(grid: PacmanGrid, options: SvgOptions = {}): string {
  const { includeGhosts = true, colorScheme = "dark" } = options;

  const step = CELL_SIZE + CELL_GAP;
  const width = grid.cols * step + PADDING * 2;
  const height = grid.rows * step + PADDING * 2;

  const totalDuration = grid.path.length * STEP_DURATION;
  const bg = colorScheme === "dark" ? "#0d1117" : "#ffffff";

  // Build a lookup: "col,row" → step index when Pac-Man arrives
  const eatTime: Map<string, number> = new Map();
  grid.path.forEach((step, i) => {
    if (step.eating) eatTime.set(`${step.col},${step.row}`, i);
  });

  // ── Dot elements with timed disappear animations ──
  const dots: string[] = [];
  for (let c = 0; c < grid.cols; c++) {
    for (let r = 0; r < grid.rows; r++) {
      const cell = grid.cells[c][r];
      const x = PADDING + c * step;
      const y = PADDING + r * step;
      const key = `${c},${r}`;
      const arrivalIndex = eatTime.get(key);

      if (cell.active) {
        const disappearAt =
          arrivalIndex !== undefined
            ? (arrivalIndex * STEP_DURATION) / totalDuration
            : 1;

        dots.push(`
        <use href="#sprite-dot" x="${x}" y="${y}">
          <animate attributeName="opacity" values="1;1;0;0"
            keyTimes="0;${disappearAt.toFixed(4)};${Math.min(disappearAt + 0.001, 1).toFixed(4)};1"
            dur="${totalDuration}s" repeatCount="indefinite"/>
        </use>`);
      } else {
        dots.push(`<use href="#sprite-empty" x="${x}" y="${y}"/>`);
      }
    }
  }

  // ── Pac-Man position keyframe animation ──
  const pacKeyTimes = grid.path.map((_, i) => (i / (grid.path.length - 1)).toFixed(4));
  const pacX = grid.path.map((s) => PADDING + s.col * step);
  const pacY = grid.path.map((s) => PADDING + s.row * step);
  const pacAngles = grid.path.map((s) => DIR_ANGLE[s.direction]);

  const pacAnimX = `<animate attributeName="x" values="${pacX.join(";")}" keyTimes="${pacKeyTimes.join(";")}" dur="${totalDuration}s" repeatCount="indefinite" calcMode="discrete"/>`;
  const pacAnimY = `<animate attributeName="y" values="${pacY.join(";")}" keyTimes="${pacKeyTimes.join(";")}" dur="${totalDuration}s" repeatCount="indefinite" calcMode="discrete"/>`;
  const pacAnimR = `<animateTransform attributeName="transform" type="rotate" values="${pacAngles.map((a) => `${a} 7 7`).join(";")}" keyTimes="${pacKeyTimes.join(";")}" dur="${totalDuration}s" repeatCount="indefinite" calcMode="discrete" additive="sum"/>`;

  const pacman = `
  <use href="#sprite-pacman" x="${pacX[0]}" y="${pacY[0]}">
    ${pacAnimX}
    ${pacAnimY}
    ${pacAnimR}
  </use>`;

  // ── Ghost sprites trailing Pac-Man ──
  const ghostColors = ["#FF0000", "#FFB8FF", "#FFB852", "#00FFFF"];
  const ghostIds = ["blinky", "pinky", "clyde", "inky"];
  const ghostOffset = [3, 6, 9, 12]; // steps behind Pac-Man

  let ghosts = "";
  if (includeGhosts) {
    ghosts = ghostIds
      .map((id, gi) => {
        const offset = ghostOffset[gi];
        const gPath = grid.path.slice(0, -offset); // lag behind
        if (gPath.length === 0) return "";
        const gX = gPath.map((s) => PADDING + s.col * step);
        const gY = gPath.map((s) => PADDING + s.row * step);
        const gTimes = gPath.map((_, i) => (i / (gPath.length - 1)).toFixed(4));
        return `
        <use href="#sprite-ghost-${id}" x="${gX[0]}" y="${gY[0]}">
          <animate attributeName="x" values="${gX.join(";")}" keyTimes="${gTimes.join(";")}" dur="${totalDuration}s" repeatCount="indefinite" calcMode="discrete"/>
          <animate attributeName="y" values="${gY.join(";")}" keyTimes="${gTimes.join(";")}" dur="${totalDuration}s" repeatCount="indefinite" calcMode="discrete"/>
        </use>`;
      })
      .join("\n");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${width} ${height}"
     width="${width}" height="${height}">

  <title>GitHub Contributions — Pac-Man</title>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${bg}" rx="6"/>

  <!-- ── Sprite definitions (replace with custom artwork) ── -->
  <defs>
    ${pacmanSprite()}
    ${ghostSprite("blinky", ghostColors[0])}
    ${ghostSprite("pinky", ghostColors[1])}
    ${ghostSprite("clyde", ghostColors[2])}
    ${ghostSprite("inky", ghostColors[3])}
    ${dotSprite()}
    ${emptySprite()}
  </defs>

  <!-- Inactive cells -->
  ${dots.filter((_, i) => !grid.cells[Math.floor(i / grid.rows)][i % grid.rows].active).join("\n")}

  <!-- Active dots -->
  ${dots.filter((_, i) => grid.cells[Math.floor(i / grid.rows)][i % grid.rows].active).join("\n")}

  <!-- Ghosts -->
  ${ghosts}

  <!-- Pac-Man -->
  ${pacman}
</svg>`;
}
