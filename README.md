# git-pacman

Turns your GitHub contribution chart into an animated Pac-Man eating dots. Embed in any GitHub profile README.

## Embed in your README

After the Action runs, copy this into your profile `README.md`:

```md
![Pac-Man contributions](https://raw.githubusercontent.com/AnthonyBSong/git-pacman/output/pacman.svg)
```

## How it works

1. A GitHub Action fetches your contribution calendar via the GraphQL API.
2. Active days become dots on a 52×7 grid; inactive days are empty cells.
3. A DFS traversal computes an ordered path through all active cells.
4. An animated SVG is generated: Pac-Man moves along the path eating dots, with ghosts trailing behind.
5. The SVG is pushed to the `output` branch and served via raw.githubusercontent.com.

## Setup

### 1. Add a secret

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `GH_TOKEN` | Personal Access Token with `read:user` scope |

### 2. Trigger the Action

Push to `main` or run **Actions → Generate Pac-Man contribution animation → Run workflow**.

The Action runs automatically every day at midnight UTC after that.

## Customizing sprites

Replace the placeholder files in [assets/sprites/](assets/sprites/) with your own artwork:

| File | Used for |
|------|----------|
| `pacman.svg` | Pac-Man character (14×14px, facing right) |
| `ghost.svg` | Ghost template (recolored per ghost in code) |
| `dot.svg` | Active contribution day pellet |
| `empty.svg` | Inactive day background cell |

After replacing sprites, update the inline `<g>` blocks in
[packages/svg-creator/src/index.ts](packages/svg-creator/src/index.ts)
to embed your artwork directly (SVG `<use>` references only work within a single document).

## Project structure

```
.github/workflows/main.yml          — Scheduled GitHub Action
packages/
  github-contributions/             — GraphQL API client
  grid/                             — Grid builder + DFS path algorithm
  svg-creator/                      — Animated SVG generator
  action/                           — Action entry point (ties it all together)
assets/sprites/                     — Placeholder sprite artwork
```

## Local development

```bash
npm install
npm run build
GH_TOKEN=<token> USERNAME=AnthonyBSong OUTPUT_PATH=dist/pacman.svg \
  node packages/action/dist/index.js
open dist/pacman.svg
```