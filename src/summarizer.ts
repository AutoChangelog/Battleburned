import OpenAI from "openai";
import type { ChangelogEntry, ChangelogConfig, CategoryRule } from "./types.js";
import { fetchPRDiff } from "./github.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
});

const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

/** Maximum diff length sent to the LLM before truncation. */
const MAX_DIFF_CHARS = 8000;

const SYSTEM_PROMPT = `You are a changelog writer for a software project.
Given a pull request's title, description, and code diff, write a single concise bullet-point summary suitable for a public changelog.

Rules:
- One line only, no more than 120 characters.
- Use past tense ("Added", "Fixed", "Removed", "Changed").
- Focus on user-visible impact, not implementation details.
- If the PR is a dependency update or chore, say what it does, not just "updated deps".
- Return ONLY the summary line with no extra text, no quotes, no markdown.`;

/**
 * Choose the default category label based on the config's tone setting.
 */
function defaultCategory(tone: ChangelogConfig["tone"]): string {
  switch (tone) {
    case "casual":
      return "🛠️ Miscellaneous";
    case "formal":
      return "🔧 Other";
    case "neutral":
    default:
      return "🔧 Other";
  }
}

/**
 * Categorize a PR by checking each rule's match conditions against the PR.
 * Returns the matching category label, or a tone-appropriate default.
 */
function categorizePR(
  pr: {
    title: string;
    labels: Array<{ name: string }>;
  },
  config: ChangelogConfig,
): string {
  const prLabels = new Set(pr.labels.map((l) => l.name));

  for (const rule of config.categories) {
    // A rule with an empty match array is the fallback — skip it during matching
    if (rule.match.length === 0) continue;

    if (matchesRule(pr, prLabels, rule)) {
      return rule.label;
    }
  }

  return defaultCategory(config.tone);
}

/**
 * Check whether a PR matches a single category rule.
 * A rule matches if ANY of its match conditions match.
 */
function matchesRule(
  pr: { title: string },
  prLabels: Set<string>,
  rule: CategoryRule,
): boolean {
  return rule.match.some((condition) => {
    // Check labels
    if (condition.labels && condition.labels.some((l) => prLabels.has(l))) {
      return true;
    }
    // Check title prefix
    if (
      condition.title_prefix &&
      pr.title.toLowerCase().startsWith(condition.title_prefix.toLowerCase())
    ) {
      return true;
    }
    // Check title contains
    if (
      condition.title_contains &&
      pr.title.toLowerCase().includes(condition.title_contains.toLowerCase())
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Summarize a merged pull request using an LLM.
 *
 * 1. Fetches the PR diff from the GitHub API
 * 2. Sends title + description + (possibly truncated) diff to the LLM
 * 3. Categorizes the result using .changelog.yml rules
 */
export async function summarizePR(
  pr: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: { login: string };
    merged_at: string | null;
    labels: Array<{ name: string }>;
  },
  repo: { full_name: string },
  installationId: number,
  config: ChangelogConfig,
): Promise<ChangelogEntry> {
  const [owner, repoName] = repo.full_name.split("/");

  // Fetch the real PR diff
  let diff: string;
  try {
    diff = await fetchPRDiff(installationId, owner, repoName, pr.number);
  } catch (err) {
    console.warn(
      `Failed to fetch diff for PR #${pr.number}:`,
      err instanceof Error ? err.message : err,
    );
    diff = "";
  }

  // Build the user message for the LLM
  let truncated = false;
  let diffForLLM = diff;

  if (!diffForLLM) {
    diffForLLM = "(diff unavailable)";
  } else if (diffForLLM.length > MAX_DIFF_CHARS) {
    diffForLLM =
      diffForLLM.slice(0, MAX_DIFF_CHARS) +
      `\n\n[... diff truncated to ${MAX_DIFF_CHARS} characters ...]`;
    truncated = true;
  }

  const userMessage = [
    `PR title: ${pr.title}`,
    `PR description: ${pr.body ?? "(no description)"}`,
    `Diff: ${diffForLLM}`,
    truncated ? "(Note: the diff was truncated due to size)" : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Call the LLM
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 150,
    temperature: 0.3,
  });

  const summary =
    response.choices[0]?.message?.content?.trim() ?? pr.title;

  // Categorize using the config rules
  const category = categorizePR(pr, config);

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    category,
    summary,
    author: pr.user.login,
    mergedAt: pr.merged_at ?? new Date().toISOString(),
  };
}
