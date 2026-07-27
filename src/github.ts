import { Octokit } from "octokit";
import jwt from "jsonwebtoken";

// ---- Helpers ----

function getAppId(): string {
  const id = process.env.GITHUB_APP_ID;
  if (!id) throw new Error("GITHUB_APP_ID is not set");
  return id;
}

function getPrivateKey(): string {
  const encoded = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!encoded) throw new Error("GITHUB_APP_PRIVATE_KEY is not set");
  // The key is stored base64-encoded with \n representing newlines
  return Buffer.from(encoded, "base64").toString("utf-8");
}

function generateAppJWT(): string {
  const appId = getAppId();
  const privateKey = getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: now - 60, // 60s clock drift allowance
      exp: now + 600, // 10-minute expiry (GitHub max)
      iss: appId,
    },
    privateKey,
    { algorithm: "RS256" },
  );
}

/**
 * Create an Octokit instance authenticated as a GitHub App installation.
 * Exchanges an app-signed JWT for an installation access token.
 */
export async function createInstallationClient(
  installationId: number,
): Promise<Octokit> {
  const appJwt = generateAppJWT();
  const appOctokit = new Octokit({ auth: appJwt });

  const { data } = await appOctokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  return new Octokit({ auth: data.token });
}

// ---- Public API ----

/**
 * Fetch a single file from a repository.
 * Returns the file contents as a UTF-8 string, or null if the file doesn't exist.
 */
export async function fetchRepoFile(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string | null> {
  const octokit = await createInstallationClient(installationId);

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });

    // getContent returns either an array (directory) or a single file object
    if (Array.isArray(data)) return null;

    if ("content" in data && typeof data.content === "string") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }

    return null;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch the unified diff of a pull request.
 */
export async function fetchPRDiff(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  const octokit = await createInstallationClient(installationId);

  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });

  return data as unknown as string;
}
