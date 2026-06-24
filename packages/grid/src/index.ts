/**
 * Converts a ContributionGrid into a sparse dot grid and computes
 * a DFS traversal path for Pac-Man to follow through all active cells.
 *
 * Grid coordinates: col = week index (0..52), row = day index (0..6, Sunday=0).
 */

import type { ContributionGrid } from "@git-pacman/github-contributions";

export interface Cell {
  col: number; // week index
  row: number; // day index (0=Sunday)
  active: boolean;
}

export type Direction = "right" | "left" | "up" | "down";

export interface PathStep {
  col: number;
  row: number;
  direction: Direction;
  eating: boolean; // true when an active dot is consumed here
}

export interface PacmanGrid {
  cells: Cell[][];      // [col][row]
  cols: number;
  rows: number;
  path: PathStep[];
}

export function buildGrid(contributions: ContributionGrid): PacmanGrid {
  const rows = 7;
  const cols = contributions.weeks.length;

  const cells: Cell[][] = Array.from({ length: cols }, (_, col) =>
    Array.from({ length: rows }, (_, row) => ({
      col,
      row,
      active: (contributions.weeks[col]?.contributionDays[row]?.contributionCount ?? 0) > 0,
    }))
  );

  const path = computePath(cells, cols, rows);

  return { cells, cols, rows, path };
}

function computePath(cells: Cell[][], cols: number, rows: number): PathStep[] {
  // DFS from top-left active cell, visiting all active cells.
  // Falls back to nearest unvisited cell when stuck (teleport, no animation gap).
  const visited = Array.from({ length: cols }, () => new Array(rows).fill(false));
  const path: PathStep[] = [];

  // Find first active cell (scan left-to-right, top-to-bottom)
  let startCol = -1;
  let startRow = -1;
  outer: for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (cells[c][r].active) {
        startCol = c;
        startRow = r;
        break outer;
      }
    }
  }

  if (startCol === -1) return path; // no active cells

  // Neighbour order: right, down, left, up — prefer horizontal movement
  const DIRS: { dc: number; dr: number; dir: Direction }[] = [
    { dc: 1, dr: 0, dir: "right" },
    { dc: 0, dr: 1, dir: "down" },
    { dc: -1, dr: 0, dir: "left" },
    { dc: 0, dr: -1, dir: "up" },
  ];

  function dfs(col: number, row: number, lastDir: Direction): void {
    visited[col][row] = true;
    path.push({ col, row, direction: lastDir, eating: cells[col][row].active });

    for (const { dc, dr, dir } of DIRS) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && !visited[nc][nr]) {
        // Walk through inactive cells too so Pac-Man moves continuously
        dfs(nc, nr, dir);
      }
    }
  }

  dfs(startCol, startRow, "right");

  return path;
}
