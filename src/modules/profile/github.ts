/**
 * Fetch a public GitHub profile + repos into a text corpus for profile extract.
 * Uses the REST API (optional GITHUB_TOKEN for higher rate limits).
 */

const GITHUB_API = "https://api.github.com";
const MAX_REPOS = 20;
const MAX_README_REPOS = 8;
const MAX_README_CHARS = 2500;
const MAX_CORPUS_CHARS = 45_000;

type GithubUser = {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  html_url: string;
  public_repos: number;
};

type GithubRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  pushed_at: string | null;
  updated_at: string | null;
};

export function parseGithubUsername(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("Enter a GitHub username or profile URL");

  try {
    if (/^https?:\/\//i.test(raw) || raw.includes("github.com/")) {
      const url = new URL(
        raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`,
      );
      if (!/github\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
        throw new Error("URL must be a github.com profile");
      }
      const part = url.pathname.split("/").filter(Boolean)[0];
      if (!part) throw new Error("Could not find a username in that URL");
      return normalizeLogin(part);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("URL must")) throw err;
    if (err instanceof Error && err.message.startsWith("Could not")) throw err;
    // fall through to username parse
  }

  return normalizeLogin(raw.replace(/^@/, ""));
}

function normalizeLogin(login: string): string {
  const cleaned = login.trim().replace(/\/+$/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(cleaned)) {
    throw new Error("That doesn’t look like a valid GitHub username");
  }
  // Reserved path segments that are not users
  const reserved = new Set([
    "settings",
    "notifications",
    "marketplace",
    "explore",
    "topics",
    "organizations",
    "pulls",
    "issues",
    "codespaces",
    "sponsors",
  ]);
  if (reserved.has(cleaned.toLowerCase())) {
    throw new Error("Enter a user profile URL, not a GitHub site page");
  }
  return cleaned;
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "OptraProfileBot/0.1",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubGet<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new Error("GitHub user not found");
  }
  if (res.status === 403 || res.status === 429) {
    throw new Error(
      "GitHub rate limit hit. Add GITHUB_TOKEN to .env and try again.",
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status})`);
  }
  return (await res.json()) as T;
}

async function fetchReadmeExcerpt(
  fullName: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${fullName}/readme`, {
      headers: {
        ...authHeaders(),
        Accept: "application/vnd.github.raw",
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text) return null;
    return text.slice(0, MAX_README_CHARS);
  } catch {
    return null;
  }
}

function pickRepos(repos: GithubRepo[]): GithubRepo[] {
  return [...repos]
    .filter((r) => !r.fork && !r.archived)
    .sort((a, b) => {
      const starDiff = b.stargazers_count - a.stargazers_count;
      if (starDiff !== 0) return starDiff;
      const aTime = Date.parse(a.pushed_at ?? a.updated_at ?? "") || 0;
      const bTime = Date.parse(b.pushed_at ?? b.updated_at ?? "") || 0;
      return bTime - aTime;
    })
    .slice(0, MAX_REPOS);
}

/** Build a grounded text corpus from a public GitHub profile. */
export async function fetchGithubProfileCorpus(
  usernameOrUrl: string,
): Promise<{ username: string; sourceUrl: string; text: string }> {
  const username = parseGithubUsername(usernameOrUrl);
  const user = await githubGet<GithubUser>(
    `/users/${encodeURIComponent(username)}`,
  );
  const repos = await githubGet<GithubRepo[]>(
    `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100&type=owner`,
  );

  const selected = pickRepos(repos);
  const lines: string[] = [
    `# GitHub profile: ${user.login}`,
    `url: ${user.html_url}`,
  ];
  if (user.name) lines.push(`name: ${user.name}`);
  if (user.bio) lines.push(`bio: ${user.bio}`);
  if (user.company) lines.push(`company: ${user.company}`);
  if (user.location) lines.push(`location: ${user.location}`);
  if (user.blog) lines.push(`blog: ${user.blog}`);
  lines.push(`public_repos: ${user.public_repos}`);
  lines.push("");
  lines.push(
    "The following repositories are the user's own public projects (forks and archived repos omitted). Use them for relevantProjects — what each is about and how it was built (languages, topics, README).",
  );
  lines.push("");

  for (let i = 0; i < selected.length; i++) {
    const repo = selected[i]!;
    lines.push(`## Repo: ${repo.name}`);
    lines.push(`full_name: ${repo.full_name}`);
    lines.push(`url: ${repo.html_url}`);
    if (repo.description) lines.push(`description: ${repo.description}`);
    if (repo.language) lines.push(`primary_language: ${repo.language}`);
    if (repo.topics?.length) lines.push(`topics: ${repo.topics.join(", ")}`);
    if (repo.homepage) lines.push(`homepage: ${repo.homepage}`);
    lines.push(`stars: ${repo.stargazers_count}`);
    if (repo.pushed_at) lines.push(`last_push: ${repo.pushed_at}`);

    if (i < MAX_README_REPOS) {
      const readme = await fetchReadmeExcerpt(repo.full_name);
      if (readme) {
        lines.push("README excerpt:");
        lines.push(readme);
      }
    }
    lines.push("");
  }

  if (selected.length === 0) {
    lines.push(
      "(No non-fork public repositories found. Do not invent projects.)",
    );
  }

  let text = lines.join("\n").trim();
  if (text.length > MAX_CORPUS_CHARS) {
    text = `${text.slice(0, MAX_CORPUS_CHARS)}\n\n[truncated]`;
  }

  return {
    username: user.login,
    sourceUrl: user.html_url,
    text,
  };
}
