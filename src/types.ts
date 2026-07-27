// Shared types for the AutoChangelog pipeline.

/** Raw webhook payload from GitHub for a pull_request.closed event. */
export interface PullRequestClosedPayload {
  action: "closed";
  pull_request: {
    merged: boolean;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels: Array<{ name: string }>;
    user: { login: string };
    base: { ref: string; repo: { full_name: string } };
    head: { ref: string; sha: string };
    merged_at: string | null;
    merged_by?: { login: string } | null;
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
    default_branch: string;
  };
  installation?: {
    id: number;
  };
}

/** Parsed .changelog.yml configuration. */
export interface ChangelogConfig {
  tone: "formal" | "casual" | "neutral";
  categories: CategoryRule[];
  ignore: IgnoreRules;
}

export interface CategoryRule {
  label: string;
  match: MatchCondition[];
}

export interface MatchCondition {
  labels?: string[];
  title_prefix?: string;
  title_contains?: string;
}

export interface IgnoreRules {
  labels?: string[];
  title_patterns?: string[];
  authors?: string[];
}

/** Summarized PR info produced by the LLM pipeline. */
export interface ChangelogEntry {
  prNumber: number;
  prUrl: string;
  category: string;
  summary: string; // one-line human-readable summary
  author: string;
  mergedAt: string;
}

/** Accumulated changelog ready for publishing. */
export interface ChangelogDraft {
  repo: string;
  version: string; // e.g. "2026-07-27" or semver tag
  entries: ChangelogEntry[];
  generatedAt: string;
}
