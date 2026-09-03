#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function repoRoot(payload) {
  const roots = payload.workspace_roots;
  if (Array.isArray(roots) && typeof roots[0] === "string" && roots[0]) {
    return roots[0];
  }
  return process.cwd();
}

const raw = readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

if (payload.status !== "completed") {
  process.stdout.write("{}\n");
  process.exit(0);
}

const stampPath = path.join(
  repoRoot(payload),
  ".cursor",
  "hooks",
  ".state",
  "pending-prod-deploy.json"
);

if (!fs.existsSync(stampPath)) {
  process.stdout.write("{}\n");
  process.exit(0);
}

try {
  fs.unlinkSync(stampPath);
} catch {
  // still follow up
}

const followup_message =
  "A push to main just finished. Confirm production on Vercel for this SHA: if a Git-connected deployment is already running, wait and report its URL. If none started, run `npm run deploy:prod` from the repo root (needs a logged-in Vercel CLI or VERCEL_TOKEN). Do not start a second production deploy for the same commit. Then stop.";

process.stdout.write(JSON.stringify({ followup_message }) + "\n");
