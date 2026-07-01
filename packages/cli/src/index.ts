import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import prompts from "prompts";

const bold  = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const cyan  = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

function detectUsername(): string {
  try {
    const url = execSync("git remote get-url origin", { stdio: ["pipe", "pipe", "pipe"] })
      .toString().trim();
    const m = url.match(/github\.com[:/]([^/]+)\//);
    return m?.[1] ?? "";
  } catch {
    return "";
  }
}

const CRON: Record<string, string> = {
  daily:   "0 0 * * *",
  weekly:  "0 0 * * 1",
  monthly: "0 0 1 * *",
};

function generateWorkflow(opts: {
  username: string;
  colorScheme: "dark" | "light";
  schedule: "daily" | "weekly" | "monthly" | "manual";
}): string {
  const scheduleLine = opts.schedule !== "manual"
    ? `  schedule:\n    - cron: "${CRON[opts.schedule]}"\n`
    : "";

  return `name: Generate Pac-Man contribution animation

on:
${scheduleLine}  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: AnthonyBSong/git-pacman@v1
        with:
          github_user_name: \${{ github.repository_owner }}
          github_token: \${{ secrets.GITHUB_TOKEN }}
          svg_out_path: dist/pacman.svg
          color_scheme: ${opts.colorScheme}

      - name: Push SVG to output branch
        run: |
          cd dist
          git init -b output
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add pacman.svg
          git commit -m "chore: update pacman animation [skip ci]"
          git push -f "https://x-access-token:\${{ secrets.GITHUB_TOKEN }}@github.com/\${{ github.repository }}.git" output:output
`;
}

async function main(): Promise<void> {
  console.log();
  console.log(yellow(bold("  ·ᗣ· · ·  git-contrib-viz  · · · ·ᗣ·")));
  console.log(dim("  Pac-Man eats your GitHub contribution dots\n"));

  const detectedUser = detectUsername();

  const answers = await prompts(
    [
      {
        type: "text",
        name: "username",
        message: "GitHub username",
        initial: detectedUser,
        validate: (v: string) => v.trim().length > 0 || "Username is required",
      },
      {
        type: "select",
        name: "colorScheme",
        message: "Color scheme",
        choices: [
          {
            title: `${bold("Dark")}  ${dim("— GitHub dark mode (#0d1117)")}`,
            value: "dark",
          },
          {
            title: `${bold("Light")} ${dim("— GitHub light mode (#ffffff)")}`,
            value: "light",
          },
        ],
        initial: 0,
      },
      {
        type: "select",
        name: "schedule",
        message: "Update frequency",
        choices: [
          { title: `${bold("Daily")}   ${dim("— fresh every morning at midnight UTC")}`, value: "daily" },
          { title: `${bold("Weekly")}  ${dim("— every Monday")}`,                        value: "weekly" },
          { title: `${bold("Monthly")} ${dim("— 1st of each month")}`,                   value: "monthly" },
          { title: `${bold("Manual")}  ${dim("— only via workflow_dispatch")}`,           value: "manual" },
        ],
        initial: 0,
      },
    ],
    { onCancel: () => { console.log("\nCancelled."); process.exit(0); } }
  );

  const { username, colorScheme, schedule } = answers as {
    username: string;
    colorScheme: "dark" | "light";
    schedule: "daily" | "weekly" | "monthly" | "manual";
  };

  const workflowDir = path.join(process.cwd(), ".github", "workflows");
  const workflowPath = path.join(workflowDir, "pacman.yml");

  const alreadyExists = fs.existsSync(workflowPath);
  if (alreadyExists) {
    const { overwrite } = await prompts({
      type: "confirm",
      name: "overwrite",
      message: yellow(".github/workflows/pacman.yml already exists — overwrite?"),
      initial: false,
    });
    if (!overwrite) { console.log("\nAborted."); process.exit(0); }
  }

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(workflowPath, generateWorkflow({ username, colorScheme, schedule }), "utf8");

  const embed = `![Pac-Man contributions](https://raw.githubusercontent.com/${username}/${username}/output/pacman.svg)`;

  console.log();
  console.log(green("✓") + "  " + bold(".github/workflows/pacman.yml") + " created");
  console.log();
  console.log(bold("  Add this to your profile README.md:"));
  console.log();
  console.log("  " + cyan(embed));
  console.log();
  console.log(dim("  Then push, and run:"));
  console.log(dim("  Actions → Generate Pac-Man contribution animation → Run workflow"));
  console.log();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
