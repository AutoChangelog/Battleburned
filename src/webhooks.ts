import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { PullRequestClosedPayload } from "./types.js";
import { shouldIgnore, parseConfig } from "./config.js";
import { fetchRepoFile } from "./github.js";
import { summarizePR } from "./summarizer.js";
import { publishToReleases } from "./publisher.js";
import { getLicenseTier, canProcessRepo } from "./license.js";

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
  const installationId = payload.installation?.id;

  if (!installationId) {
    console.log(
      `PR #${pr.number} in ${repo.full_name} has no installation ID — skipping`,
    );
    return;
  }

  console.log(`Processing merged PR #${pr.number} in ${repo.full_name}`);

  // License tier enforcement
  const tier = getLicenseTier(installationId);

  if (tier === "free") {
    const { allowed, isFirstRepo } = canProcessRepo(
      installationId,
      repo.full_name,
    );
    if (!isFirstRepo && !allowed) {
      console.warn(
        `[license] Free tier limited to 1 repo — skipping ${repo.full_name} (installation ${installationId})`,
      );
      return;
    }
  }

  // Load repo config from .changelog.yml
  let configYaml: string | null = null;
  try {
    configYaml = await fetchRepoFile(
      installationId,
      repo.owner.login,
      repo.name,
      ".changelog.yml",
      pr.base.ref,
    );
  } catch (err) {
    console.warn(
      `Failed to fetch .changelog.yml for ${repo.full_name}, using defaults:`,
      err instanceof Error ? err.message : err,
    );
  }

  const config = parseConfig(configYaml ?? "");

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
    entry = await summarizePR(pr, repo, installationId, config);
  } catch (err) {
    console.error(`Summarization failed for PR #${pr.number}:`, err);
    return;
  }

  // Publish to GitHub Releases
  try {
    await publishToReleases(entry, repo, installationId, tier);
    console.log(`Published changelog entry for PR #${pr.number}`);
  } catch (err) {
    console.error(`Publishing failed for PR #${pr.number}:`, err);
    return;
  }
}
