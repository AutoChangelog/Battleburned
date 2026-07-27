import OpenAI from "openai";
import type { ChangelogEntry } from "./types.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
});

const MODEL = process.env.LLM_MODEL ?? "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a changelog writer for a software project.
Given a pull request's title, description, and code diff, write a single concise bullet-point summary suitable for a public changelog.

Rules:
- One line only, no more than 120 characters.
- Use past tense ("Added", "Fixed", "Removed", "Changed").
- Focus on user-visible impact, not implementation details.
- If the PR is a dependency update or chore, say what it does, not just "updated deps".
- Return ONLY the summary line with no extra text, no quotes, no markdown.`;

/**
 * Summarize a merged pull request using an LLM.
 *
 * TODO: this is a stub — it currently makes a real API call but with
 *       placeholder PR data. The real implementation will:
 *       1. Fetch the PR diff from the GitHub API
 *       2. Send title + description + diff to the LLM
 *       3. Parse the response into a ChangelogEntry with the correct category
 */
export async function summarizePR(
  pr: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: { login: string };
    merged_at: string | null;
  },
  _repo: { full_name: string },
): Promise<ChangelogEntry> {
  const userMessage = `PR title: ${pr.title}\nPR description: ${pr.body ?? "(no description)"}\n\nDiff: (TODO: fetch diff from GitHub API)`;

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

  // TODO: categorize the PR based on .changelog.yml category rules
  const category = "🔧 Other";

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    category,
    summary,
    author: pr.user.login,
    mergedAt: pr.merged_at ?? new Date().toISOString(),
  };
}
