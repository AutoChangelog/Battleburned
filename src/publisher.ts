import { Octokit } from "octokit";
import type { ChangelogEntry } from "./types.js";

/**
 * Publish a changelog entry to the repo's GitHub Releases.
 *
 * Uses an installation-authenticated Octokit client so the GitHub App
 * can act on behalf of the installed repo.
 *
 * TODO: this is a stub. The real implementation will:
 *   1. Obtain an installation access token
 *   2. Look up the latest release (or create a new one)
 *   3. Append the new entry to the release body
 *   4. Update the release via the GitHub API
 */
export async function publishToReleases(
  entry: ChangelogEntry,
  repo: { full_name: string; name: string; owner: { login: string } },
  installationId?: number,
): Promise<void> {
  const [owner, repoName] = repo.full_name.split("/");

  const line = `- ${entry.category} ${entry.summary} (#${entry.prNumber}) by @${entry.author}`;

  console.log(
    `[publisher] Would append to release in ${repo.full_name}: ${line}`,
    installationId ? `(installation: ${installationId})` : "",
  );

  // TODO: implement release creation/update
  // const appId = process.env.GITHUB_APP_ID;
  // const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  // const appOctokit = new Octokit({ authStrategy: createAppAuth(...) });
  // const installationOctokit = await appOctokit.auth({ type: "installation", installationId });
  // ...
}
