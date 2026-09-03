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

function looksLikeSuccessfulMainPush(command, output) {
  const cmd = String(command || "");
  const out = String(output || "");
  if (!/\bgit(\.exe)?\s+push\b/i.test(cmd)) return false;
  if (/error:|rejected|authentication failed|permission denied/i.test(out)) {
    return false;
  }
  if (/HEAD\s*->\s*main\b/.test(out)) return true;
  if (/\borigin\/main\b/.test(out) && /->/.test(out)) return true;
  if (/\bgit(\.exe)?\s+push\b/i.test(cmd) && /\bmain\b/.test(cmd) && /To https?:\/\//.test(out)) {
    return true;
  }
  return false;
}

const raw = readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  payload = {};
}

if (looksLikeSuccessfulMainPush(payload.command, payload.output)) {
  const dir = path.join(repoRoot(payload), ".cursor", "hooks", ".state");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "pending-prod-deploy.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        command: String(payload.command || "").slice(0, 400),
      },
      null,
      2
    )
  );
}

process.stdout.write("{}\n");
