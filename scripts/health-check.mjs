#!/usr/bin/env node
// Environment health check: Node, Vercel link + env vars, Supabase reachability,
// the Obsidian docs vault (links, orphans, format) and the OpenAPI contract.
// Run: node scripts/health-check.mjs — exits 1 if any check fails. Never prints secret values.
// shortcut: plain JS because the repo has no TypeScript toolchain yet; port to .ts once the app is scaffolded.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as util from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIN_NODE_MAJOR = 22; // AI SDK 7 needs 22+; Vercel builds on 24 and deprecated 20 on 2026-10-01
// Names the Supabase Vercel Marketplace integration sets:
// https://supabase.com/docs/guides/integrations/vercel-marketplace
const SUPABASE_ENV = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  db: "POSTGRES_URL", // pooled (transaction mode): server code
  dbDirect: "POSTGRES_URL_NON_POOLING", // direct: migrations and seed
};
// https://supabase.com/docs/guides/troubleshooting/how-do-i-check-gotrueapi-version-of-a-supabase-project-lQAnOR
const SUPABASE_HEALTH_PATH = "/auth/v1/health";
const HTTP_OK = 200;
const FETCH_TIMEOUT_MS = 10_000;
const ENV_FILES = [".env", ".env.local"]; // later file wins; the process env wins over both, as in Next.js
const VAULT_SKIP = new Set(["node_modules"]); // Obsidian already hides dot-folders such as .claude/ and .next/
const TAGGED_DIR = "docs"; // notes here must start with a `tags` property
const OPENAPI_FILE = join("docs", "openapi.json");
const OPENAPI_VERSION_PREFIX = "3.1.";
const HTTP_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
const STATUS = { pass: "PASS", warn: "WARN", fail: "FAIL" };
const CODE_SPANS = /```[\s\S]*?```|`[^`\n]*`/g;
const MD_LINK = /\]\(([^)\s]+)\)/g;
const WIKILINK = /\[\[[^\]]+\]\]/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const results = [];
const pass = (name, detail) => results.push({ status: STATUS.pass, name, detail });
const warn = (name, detail) => results.push({ status: STATUS.warn, name, detail });
const fail = (name, detail) => results.push({ status: STATUS.fail, name, detail });
const print = (line) => process.stdout.write(`${line}\n`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  const stdout = result.stdout ?? "";
  return { ok: result.status === 0, stdout, out: `${stdout}${result.stderr ?? ""}` };
}

function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= MIN_NODE_MAJOR) pass("Node", process.version);
  else warn("Node", `${process.version}, use ${MIN_NODE_MAJOR}+ (AI SDK 7 needs it; Vercel builds on 24)`);
}

function checkVercel() {
  const who = run("vercel", ["whoami"]);
  if (!who.ok) return fail("Vercel CLI", "not installed or not logged in: run `npm i -g vercel`, then `vercel login`");
  // The CLI writes hints and progress to stderr, so the username comes from stdout only.
  pass("Vercel CLI", `logged in as ${who.stdout.trim().split("\n").pop()}`);

  const linkFile = join(ROOT, ".vercel", "project.json");
  if (!existsSync(linkFile)) return fail("Vercel link", "repo not linked: run `vercel link`");
  pass("Vercel link", `project ${JSON.parse(readFileSync(linkFile, "utf8")).projectName}`);

  const envs = run("vercel", ["env", "ls"]);
  if (!envs.ok) return fail("Vercel env", "could not list env vars: check login and network");
  const missing = Object.values(SUPABASE_ENV).filter((name) => !new RegExp(`\\b${name}\\b`).test(envs.out));
  if (missing.length) fail("Vercel env", `missing ${missing.join(", ")}: add with \`vercel env add\``);
  else pass("Vercel env", "Supabase vars present");
}

function loadEnv() {
  const files = ENV_FILES.map((file) => join(ROOT, file)).filter((path) => existsSync(path));
  return Object.assign({}, ...files.map((path) => util.parseEnv(readFileSync(path, "utf8"))), process.env);
}

async function checkSupabase() {
  if (typeof util.parseEnv !== "function") return fail("Supabase", "Node 20.12+ is needed to read .env files");
  const env = loadEnv();
  const url = env[SUPABASE_ENV.url];
  const key = env[SUPABASE_ENV.key];
  if (!url || !key) {
    return fail("Supabase", `${SUPABASE_ENV.url} or ${SUPABASE_ENV.key} not set: run \`vercel env pull .env\``);
  }
  try {
    const response = await fetch(new URL(SUPABASE_HEALTH_PATH, url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status === HTTP_OK) pass("Supabase", `auth healthy at ${new URL(url).host}`);
    else fail("Supabase", `auth health returned HTTP ${response.status} (401 means a wrong key)`);
  } catch (error) {
    fail("Supabase", `unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function listNotes(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || VAULT_SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listNotes(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

function hasTagsProperty(text) {
  if (!text.startsWith("---\n")) return false;
  const end = text.indexOf("\n---", 4);
  return end > 0 && /^tags:/m.test(text.slice(4, end));
}

function checkDocs() {
  const notes = listNotes(ROOT);
  const connected = new Set();
  const problems = [];
  for (const note of notes) {
    const name = relative(ROOT, note);
    const text = readFileSync(note, "utf8");
    const prose = text.replace(CODE_SPANS, "");
    if (WIKILINK.test(prose)) problems.push(`${name} uses [[wikilinks]], which GitHub can't render`);
    if (name.split(sep)[0] === TAGGED_DIR && !hasTagsProperty(text)) problems.push(`${name} has no tags property`);
    for (const [, target] of prose.matchAll(MD_LINK)) {
      const path = decodeURIComponent(target.split("#")[0]);
      if (URL_SCHEME.test(path) || !path.endsWith(".md")) continue;
      const linked = resolve(dirname(note), path);
      if (existsSync(linked)) connected.add(note).add(linked);
      else problems.push(`${name} has a broken link to ${target}`);
    }
  }
  const orphans = notes.filter((note) => !connected.has(note)).map((note) => relative(ROOT, note));
  if (orphans.length) problems.push(`orphan notes (no links in or out): ${orphans.join(", ")}`);
  if (problems.length) fail("Docs vault", problems.join("; "));
  else pass("Docs vault", `${notes.length} notes, all linked, Obsidian format OK`);
}

// shortcut: structural check only, not full OpenAPI schema validation; add a real validator once routes multiply.
function checkOpenApi() {
  const file = join(ROOT, OPENAPI_FILE);
  if (!existsSync(file)) return fail("OpenAPI", `${OPENAPI_FILE} is missing`);
  let spec;
  try {
    spec = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    return fail("OpenAPI", `${OPENAPI_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const problems = [];
  if (!String(spec.openapi).startsWith(OPENAPI_VERSION_PREFIX)) problems.push(`openapi must be ${OPENAPI_VERSION_PREFIX}x`);
  if (!spec.info?.title || !spec.info?.version) problems.push("info.title and info.version are required");
  const routes = Object.entries(spec.paths ?? {});
  for (const [route, operations] of routes) {
    if (!route.startsWith("/")) problems.push(`path ${route} must start with /`);
    for (const [method, operation] of Object.entries(operations)) {
      if (HTTP_METHODS.has(method) && !operation.responses) problems.push(`${method.toUpperCase()} ${route} has no responses`);
    }
  }
  if (problems.length) fail("OpenAPI", problems.join("; "));
  else pass("OpenAPI", `${OPENAPI_FILE} valid, ${routes.length} route(s)`);
}

checkNode();
checkVercel();
await checkSupabase();
checkDocs();
checkOpenApi();
for (const { status, name, detail } of results) print(`${status}  ${name}: ${detail}`);
print("INFO  MCP sign-in (Vercel, Supabase, GitHub) is checked in Claude Code with /mcp, not from the shell.");
process.exitCode = results.some(({ status }) => status === STATUS.fail) ? 1 : 0;
