import { Octokit } from "octokit";
import type { ChangelogEntry } from "./types.js";
import { createInstallationClient } from "./github.js";

const CHANGELOG_TAG = "changelog";
const CHANGELOG_TITLE = "Changelog";
const FREE_FOOTER =
  "\n\n---\n*Powered by [AutoChangelog](https://cc390b0202c121dc4c0c8252fb4af838.ctonew.app)*";

/**
 * Publish a changelog entry to the repo's GitHub Releases.
 *
 * Uses a single continuous "Changelog" release tagged `changelog`.
 * New entries are prepended to keep the most recent changes at the top.
 */
export async function publishToReleases(
  entry: ChangelogEntry,
  repo: { full_name: string; name: string; owner: { login: string } },
  installationId?: number,
  tier: "free" | "pro" = "free",
): Promise<void> {
  if (!installationId) {
    console.warn("[publisher] No installation ID — skipping release publish");
    return;
  }

  const [owner, repoName] = repo.full_name.split("/");
  const octokit = await createInstallationClient(installationId);

  // Format the changelog entry line
  const line = `- ${entry.category} ${entry.summary} ([#${entry.prNumber}](${entry.prUrl})) by @${entry.author}`;

  // Try to find an existing changelog release by tag
  let release: Awaited<
    ReturnType<typeof octokit.rest.repos.getReleaseByTag>
  > | null = null;

  try {
    release = await octokit.rest.repos.getReleaseByTag({
      owner,
      repo: repoName,
      tag: CHANGELOG_TAG,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      // Release doesn't exist yet — we'll create one below
    } else {
      throw err;
    }
  }

  if (release) {
    // Update existing release: strip any existing footer, prepend new entry
    let existingBody = release.data.body ?? "";
    // Remove any existing footer
    existingBody = existingBody.replace(FREE_FOOTER, "").trimEnd();
    let newBody = [line, existingBody].filter(Boolean).join("\n\n");
    if (tier === "free") {
      newBody += FREE_FOOTER;
    }

    await octokit.rest.repos.updateRelease({
      owner,
      repo: repoName,
      release_id: release.data.id,
      body: newBody,
    });

    console.log(
      `[publisher] Prepended entry to release "${CHANGELOG_TITLE}" (tag: ${CHANGELOG_TAG}) in ${repo.full_name}`,
    );
  } else {
    // Create a new changelog release — visible immediately (draft: false)
    let body = line;
    if (tier === "free") {
      body += FREE_FOOTER;
    }

    await octokit.rest.repos.createRelease({
      owner,
      repo: repoName,
      tag_name: CHANGELOG_TAG,
      name: CHANGELOG_TITLE,
      body,
      draft: false,
    });

    console.log(
      `[publisher] Created release "${CHANGELOG_TITLE}" (tag: ${CHANGELOG_TAG}) in ${repo.full_name} with first entry`,
    );
  }
}
