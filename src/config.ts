import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";
import type { ChangelogConfig } from "./types.js";

const DEFAULT_CONFIG: ChangelogConfig = {
  tone: "neutral",
  categories: [
    {
      label: "🚀 Features",
      match: [
        { labels: ["feature", "enhancement"] },
        { title_prefix: "feat" },
      ],
    },
    {
      label: "🐛 Fixes",
      match: [
        { labels: ["bug", "fix"] },
        { title_prefix: "fix" },
      ],
    },
    {
      label: "💥 Breaking Changes",
      match: [
        { labels: ["breaking"] },
        { title_contains: "BREAKING CHANGE" },
      ],
    },
    {
      label: "📝 Documentation",
      match: [
        { labels: ["docs", "documentation"] },
        { title_prefix: "docs" },
      ],
    },
    {
      label: "🧹 Chores",
      match: [
        { labels: ["chore", "dependencies"] },
        { title_prefix: "chore" },
      ],
    },
    { label: "🔧 Other", match: [] },
  ],
  ignore: {
    labels: ["skip-changelog", "no-release-note"],
    title_patterns: ["^WIP:", "^Draft:"],
  },
};

/**
 * Load .changelog.yml from a directory path (usually the repo root).
 * Returns default config if the file doesn't exist.
 */
export function loadConfig(repoDir: string): ChangelogConfig {
  const configPath = path.join(repoDir, ".changelog.yml");
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = parseYaml(raw) as Partial<ChangelogConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

/** Parse config from a raw string (e.g. from the GitHub API contents endpoint). */
export function parseConfig(raw: string): ChangelogConfig {
  const parsed = parseYaml(raw) as Partial<ChangelogConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

/** Check whether a PR should be ignored based on config rules. */
export function shouldIgnore(
  config: ChangelogConfig,
  pr: {
    title: string;
    labels: Array<{ name: string }>;
    author: string;
  },
): boolean {
  const { ignore } = config;
  if (ignore.labels) {
    const prLabels = new Set(pr.labels.map((l) => l.name));
    if (ignore.labels.some((l) => prLabels.has(l))) return true;
  }
  if (ignore.title_patterns) {
    if (
      ignore.title_patterns.some((pattern) =>
        new RegExp(pattern, "i").test(pr.title),
      )
    )
      return true;
  }
  if (ignore.authors) {
    if (ignore.authors.includes(pr.author)) return true;
  }
  return false;
}
