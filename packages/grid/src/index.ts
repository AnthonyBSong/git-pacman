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
  eating: boolean; // true = active dot consumed here
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

export function buildGrid(contributions: ContributionGrid): PacmanGrid {
  const rows = 7;
  const cols = contributions.weeks.length;

  const cells: Cell[][] = Array.from({ length: cols }, (_, col) =>
    Array.from({ length: rows }, (_, row) => {
      const count =
        contributions.weeks[col]?.contributionDays[row]?.contributionCount ?? 0;
      return { col, row, contributionCount: count, cellType: "floor" as CellType };
    })
  );

  // Mark active cells
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      if (cells[c][r].contributionCount > 0) cells[c][r].cellType = "active";

  // Inactive cells with no active cardinal neighbor become walls
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (cells[c][r].cellType === "active") continue;
      const hasActiveNeighbor = CARDINAL.some(({ dc, dr }) => {
        const nc = c + dc, nr = r + dr;
        return (
          nc >= 0 && nc < cols && nr >= 0 && nr < rows &&
          cells[nc][nr].cellType === "active"
        );
      });
      cells[c][r].cellType = hasActiveNeighbor ? "floor" : "wall";
    }
  }

  return { cells, cols, rows, path: computePath(cells, cols, rows) };
}

function computePath(cells: Cell[][], cols: number, rows: number): PathStep[] {
  const visited = Array.from({ length: cols }, () =>
    new Array<boolean>(rows).fill(false)
  );
  const path: PathStep[] = [];

  function canVisit(c: number, r: number): boolean {
    return (
      c >= 0 && c < cols && r >= 0 && r < rows &&
      !visited[c][r] && cells[c][r].cellType !== "wall"
    );
  }

  function dfs(col: number, row: number, dir: Direction): void {
    visited[col][row] = true;
    path.push({ col, row, direction: dir, eating: cells[col][row].cellType === "active" });
    for (const { dc, dr, dir: nextDir } of CARDINAL)
      if (canVisit(col + dc, row + dr)) dfs(col + dc, row + dr, nextDir);
  }

  // Start DFS from first non-wall cell
  let started = false;
  for (let c = 0; c < cols && !started; c++) {
    for (let r = 0; r < rows && !started; r++) {
      if (cells[c][r].cellType !== "wall") { dfs(c, r, "right"); started = true; }
    }
  }

  // Teleport between disconnected components
  let more = true;
  while (more) {
    more = false;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (!visited[c][r] && cells[c][r].cellType !== "wall") {
          const lastDir = path.length ? path[path.length - 1].direction : "right" as Direction;
          dfs(c, r, lastDir);
          more = true;
          break;
        }
      }
      if (more) break;
    }
  }

  return path;
}
