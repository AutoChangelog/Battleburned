import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default path for the license store — shared across the team.
const LICENSE_PATH = process.env.LICENSE_PATH ?? resolve(__dirname, "..", "licenses.json");

interface LicenseStore {
  licenses: Record<string, "pro_monthly" | "pro_yearly">;
  installations: Record<string, string[]>; // installationId → repo full names
}

function readStore(): LicenseStore {
  if (!existsSync(LICENSE_PATH)) {
    return { licenses: {}, installations: {} };
  }
  const raw = readFileSync(LICENSE_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return { licenses: {}, installations: {} };
  }
}

function writeStore(store: LicenseStore): void {
  const dir = dirname(LICENSE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(LICENSE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Get the license tier for a GitHub App installation.
 * Returns "free" if no license has been assigned.
 */
export function getLicenseTier(installationId: number): "free" | "pro" {
  const store = readStore();
  const tier = store.licenses[String(installationId)];
  if (tier === "pro_monthly" || tier === "pro_yearly") {
    return "pro";
  }
  return "free";
}

/**
 * Assign a license tier to a GitHub App installation.
 */
export function addLicense(
  installationId: number,
  tier: "pro_monthly" | "pro_yearly",
): void {
  const store = readStore();
  store.licenses[String(installationId)] = tier;
  writeStore(store);
}

/**
 * Track that an installation has used a repo, and return whether
 * it's the first repo (true = ok to process). Free tier only gets one repo.
 */
export function canProcessRepo(
  installationId: number,
  repoFullName: string,
): { allowed: boolean; isFirstRepo: boolean } {
  const store = readStore();
  const key = String(installationId);
  const repos = store.installations[key] ?? [];

  if (repos.includes(repoFullName)) {
    // Already using this repo — allow
    return { allowed: true, isFirstRepo: false };
  }

  const isFirstRepo = repos.length === 0;
  repos.push(repoFullName);
  store.installations[key] = repos;
  writeStore(store);

  return { allowed: true, isFirstRepo };
}
