import type { ContributionGrid } from "@git-pacman/github-contributions";

export type CellType = "active" | "floor" | "wall";

export interface Cell {
  col: number;
  row: number;
  contributionCount: number;
  cellType: CellType;
}

export type Direction = "right" | "left" | "up" | "down";

export interface PathStep {
  col: number;
  row: number;
  direction: Direction;
  eating: boolean;
}

export interface PacmanGrid {
  cells: Cell[][];
  cols: number;
  rows: number;
  path: PathStep[];
}

const CARDINAL: { dc: number; dr: number; dir: Direction }[] = [
  { dc: 1, dr: 0, dir: "right" },
  { dc: 0, dr: 1, dir: "down" },
  { dc: -1, dr: 0, dir: "left" },
  { dc: 0, dr: -1, dir: "up" },
];

const MAX_WALL_CLUSTER = 8; // largest allowed contiguous wall blob

export function buildGrid(contributions: ContributionGrid): PacmanGrid {
  const rows = 7;
  const cols = contributions.weeks.length;

  // All inactive cells start as "wall" — only promoted to "floor" when needed.
  const cells: Cell[][] = Array.from({ length: cols }, (_, col) =>
    Array.from({ length: rows }, (_, row) => {
      const count =
        contributions.weeks[col]?.contributionDays[row]?.contributionCount ?? 0;
      return {
        col, row, contributionCount: count,
        cellType: (count > 0 ? "active" : "wall") as CellType,
      };
    })
  );

  const activeCells: [number, number][] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      if (cells[c][r].cellType === "active") activeCells.push([c, r]);

  if (activeCells.length === 0) return { cells, cols, rows, path: [] };

  // Try 6 evenly-spaced BFS starting points; pick the one that leaves the most walls.
  const candidateCount = Math.min(6, activeCells.length);
  const candidates = Array.from({ length: candidateCount }, (_, i) =>
    activeCells[Math.round((i / candidateCount) * (activeCells.length - 1))]
  );

  let bestCorridors: Set<string> | null = null;
  let bestWallCount = -1;

  for (const [sc, sr] of candidates) {
    const corridors = findMinimumCorridors(cells, cols, rows, sc, sr);
    const wallCount = cols * rows - activeCells.length - corridors.size;
    if (wallCount > bestWallCount) {
      bestWallCount = wallCount;
      bestCorridors = corridors;
    }
  }

  // Promote winning corridor set: inactive cells on shortest BFS paths become floor.
  for (const key of bestCorridors!) {
    const [c, r] = key.split(",").map(Number);
    cells[c][r].cellType = "floor";
  }

  // Break up any remaining wall blobs larger than MAX_WALL_CLUSTER by punching
  // floor holes at each blob's geometric centroid, iterating until all blobs
  // are small enough.
  limitWallClusters(cells, cols, rows);

  return { cells, cols, rows, path: computePath(cells, cols, rows) };
}

/**
 * BFS from (startC, startR) through the entire grid.
 * Traces every active cell back to the BFS root via parent pointers and
 * collects the inactive cells on each shortest path as required corridors.
 */
function findMinimumCorridors(
  cells: Cell[][],
  cols: number,
  rows: number,
  startC: number,
  startR: number
): Set<string> {
  const parent: ([number, number] | null)[][] = Array.from({ length: cols }, () =>
    new Array<[number, number] | null>(rows).fill(null)
  );
  const visited = Array.from({ length: cols }, () =>
    new Array<boolean>(rows).fill(false)
  );

  visited[startC][startR] = true;
  const queue: [number, number][] = [[startC, startR]];
  let qi = 0;
  while (qi < queue.length) {
    const [cc, rr] = queue[qi++];
    for (const { dc, dr } of CARDINAL) {
      const nc = cc + dc, nr = rr + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !visited[nc][nr]) {
        visited[nc][nr] = true;
        parent[nc][nr] = [cc, rr];
        queue.push([nc, nr]);
      }
    }
  }

  const corridors = new Set<string>();
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (cells[c][r].cellType !== "active") continue;
      let cc = c, rr = r;
      while (parent[cc][rr] !== null) {
        const [pc, pr] = parent[cc][rr]!;
        if (cells[pc][pr].cellType !== "active") corridors.add(`${pc},${pr}`);
        cc = pc; rr = pr;
      }
    }
  }
  return corridors;
}

/**
 * Iteratively finds wall blobs larger than MAX_WALL_CLUSTER and promotes
 * their geometric centroid to floor, splitting the blob. Repeats until
 * every wall blob is within the size limit.
 */
function limitWallClusters(cells: Cell[][], cols: number, rows: number): void {
  let changed = true;
  while (changed) {
    changed = false;
    const wallVis = Array.from({ length: cols }, () =>
      new Array<boolean>(rows).fill(false)
    );

    for (let c0 = 0; c0 < cols; c0++) {
      for (let r0 = 0; r0 < rows; r0++) {
        if (cells[c0][r0].cellType !== "wall" || wallVis[c0][r0]) continue;

        // BFS-collect this wall blob
        const blob: [number, number][] = [];
        const q: [number, number][] = [[c0, r0]];
        wallVis[c0][r0] = true;
        let qi = 0;
        while (qi < q.length) {
          const [cc, rr] = q[qi++];
          blob.push([cc, rr]);
          for (const { dc, dr } of CARDINAL) {
            const nc = cc + dc, nr = rr + dr;
            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows &&
                !wallVis[nc][nr] && cells[nc][nr].cellType === "wall") {
              wallVis[nc][nr] = true;
              q.push([nc, nr]);
            }
          }
        }

        if (blob.length <= MAX_WALL_CLUSTER) continue;

        // Promote the geometric centroid of the blob to floor — this punches
        // a hole through the middle, splitting it into smaller pieces.
        const avgC = blob.reduce((s, [c]) => s + c, 0) / blob.length;
        const avgR = blob.reduce((s, [, r]) => s + r, 0) / blob.length;
        let best = blob[0];
        let bestDist = Infinity;
        for (const cell of blob) {
          const d = (cell[0] - avgC) ** 2 + (cell[1] - avgR) ** 2;
          if (d < bestDist) { bestDist = d; best = cell; }
        }
        cells[best[0]][best[1]].cellType = "floor";
        changed = true;
      }
    }
  }
}

/**
 * DFS through all non-wall cells starting from the cell closest to the
 * grid's center. With BFS corridor promotion guaranteeing connectivity,
 * this produces one continuous walk with no teleporting.
 */
function computePath(cells: Cell[][], cols: number, rows: number): PathStep[] {
  // Pick starting cell: non-wall cell nearest to grid center
  const centerC = cols / 2, centerR = rows / 2;
  let startC = -1, startR = -1, bestDist = Infinity;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (cells[c][r].cellType === "wall") continue;
      const d = Math.abs(c - centerC) + Math.abs(r - centerR);
      if (d < bestDist) { bestDist = d; startC = c; startR = r; }
    }
  }
  if (startC === -1) return [];

  const visited = Array.from({ length: cols }, () =>
    new Array<boolean>(rows).fill(false)
  );
  const path: PathStep[] = [];

  function dfs(col: number, row: number, dir: Direction): void {
    visited[col][row] = true;
    path.push({ col, row, direction: dir, eating: cells[col][row].cellType === "active" });
    for (const { dc, dr, dir: nextDir } of CARDINAL) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows &&
          !visited[nc][nr] && cells[nc][nr].cellType !== "wall") {
        dfs(nc, nr, nextDir);
      }
    }
  }

  dfs(startC, startR, "right");

  // Safety fallback — should never fire after BFS corridor promotion
  let more = true;
  while (more) {
    more = false;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (!visited[c][r] && cells[c][r].cellType !== "wall") {
          dfs(c, r, path[path.length - 1].direction);
          more = true; break;
        }
      }
      if (more) break;
    }
  }

  return path;
}
