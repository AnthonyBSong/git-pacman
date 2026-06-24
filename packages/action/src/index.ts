/**
 * GitHub Action entry point.
 *
 * Expected environment variables (set via GitHub Actions secrets/env):
 *   GH_TOKEN   — Personal Access Token with read:user scope
 *   USERNAME   — GitHub username to fetch contributions for
 *   OUTPUT_PATH — Where to write the SVG (default: dist/pacman.svg)
 */

import fs from "fs";
import path from "path";
import { fetchContributions } from "@git-pacman/github-contributions";
import { buildGrid } from "@git-pacman/grid";
import { createSvg } from "@git-pacman/svg-creator";

async function main(): Promise<void> {
  const token = process.env.GH_TOKEN;
  const username = process.env.USERNAME;
  const outputPath = process.env.OUTPUT_PATH ?? "dist/pacman.svg";

  if (!token) throw new Error("GH_TOKEN environment variable is required");
  if (!username) throw new Error("USERNAME environment variable is required");

  console.log(`Fetching contributions for ${username}…`);
  const contributions = await fetchContributions(username, token);
  console.log(`  Total contributions: ${contributions.totalContributions}`);

  console.log("Building grid and computing Pac-Man path…");
  const grid = buildGrid(contributions);
  console.log(`  Grid: ${grid.cols} cols × ${grid.rows} rows, ${grid.path.length} path steps`);

  console.log("Generating SVG…");
  const svg = createSvg(grid, {
    includeGhosts: true,
    colorScheme: "dark",
  });

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, svg, "utf8");
  console.log(`SVG written to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
