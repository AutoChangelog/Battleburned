import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { PullRequestClosedPayload } from "./types.js";
import { shouldIgnore, parseConfig } from "./config.js";
import { summarizePR } from "./summarizer.js";
import { publishToReleases } from "./publisher.js";

/**
 * Handle pull_request.closed webhook events.
 * Only processes merged PRs.
 */
export async function handlePullRequestClosed(
  event: EmitterWebhookEvent<"pull_request.closed">,
) {
  const payload = event.payload as PullRequestClosedPayload;

  // Only process merged PRs
  if (!payload.pull_request.merged) {
    console.log(
      `PR #${payload.pull_request.number} closed without merge — skipping`,
    );
    return;
  }

  const pr = payload.pull_request;
  const repo = payload.repository;

  console.log(`Processing merged PR #${pr.number} in ${repo.full_name}`);

  // Load repo config
  // TODO: fetch .changelog.yml from the repo using GitHub API
  // For now, uses default config
  const config = parseConfig("");

  // Check ignore rules
  if (
    shouldIgnore(config, {
      title: pr.title,
      labels: pr.labels,
      author: pr.user.login,
    })
  ) {
    console.log(`PR #${pr.number} matched ignore rules — skipping`);
    return;
  }

  // Summarize with LLM
  let entry;
  try {
    entry = await summarizePR(pr, repo);
  } catch (err) {
    console.error(`Summarization failed for PR #${pr.number}:`, err);
    return;
  }

  // Publish to GitHub Releases
  try {
    await publishToReleases(entry, repo, payload.installation?.id);
    console.log(`Published changelog entry for PR #${pr.number}`);
  } catch (err) {
    console.error(`Publishing failed for PR #${pr.number}:`, err);
    return;
  }
}
