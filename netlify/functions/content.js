const fs = require("fs");
const path = require("path");

const CONTENT_PATH = process.env.GITHUB_CONTENT_PATH || "content.json";

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    const github = await getGithubContent().catch(() => null);
    if (github?.content) return json(github.content);
    return json(readFallbackContent());
  }

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json({ ok: false, message: "Données envoyées invalides." }, 400);
    }

    const scope = body.scope === "kitchen" ? "kitchen" : "admin";
    const expected = scope === "kitchen"
      ? process.env.KITCHEN_PIN || "cuisine2026"
      : process.env.ADMIN_PIN || "presles2026";

    if (body.pin !== expected) {
      return json({ ok: false, message: "Code incorrect." }, 401);
    }

    if (!body.content || typeof body.content !== "object") {
      return json({ ok: false, message: "Contenu invalide." }, 400);
    }

    const missing = requiredGithubEnv().filter((key) => !process.env[key]);
    if (missing.length) {
      return json({
        ok: false,
        message: `Configuration GitHub manquante dans Netlify : ${missing.join(", ")}.`
      }, 500);
    }

    const current = await getGithubContent();
    const nextContent = scope === "kitchen"
      ? { ...current.content, kitchen: body.content.kitchen }
      : body.content;

    await putGithubContent(nextContent, current.sha, scope);
    return json({ ok: true });
  }

  return json({ ok: false }, 405);
};

function requiredGithubEnv() {
  return ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_BRANCH"];
}

async function getGithubContent() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !branch || !token) {
    return { content: readFallbackContent(), sha: undefined };
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    throw new Error(`GitHub GET ${response.status}`);
  }

  const data = await response.json();
  const decoded = Buffer.from(data.content || "", "base64").toString("utf8");
  return {
    content: JSON.parse(decoded),
    sha: data.sha
  };
}

async function putGithubContent(content, sha, scope) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${CONTENT_PATH}`;
  const message = scope === "kitchen"
    ? "Met à jour le menu cuisine"
    : "Met à jour le contenu du site";

  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(content, null, 2), "utf8").toString("base64"),
      sha,
      branch
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub PUT ${response.status}: ${detail}`);
  }
}

function readFallbackContent() {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content.json"), "utf8"));
}

function githubHeaders(token) {
  return {
    "accept": "application/vnd.github+json",
    "authorization": `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "chateau-presles-admin",
    "x-github-api-version": "2022-11-28"
  };
}

function json(value, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
    body: JSON.stringify(value)
  };
}
