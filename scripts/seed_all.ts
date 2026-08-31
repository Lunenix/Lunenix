import { SYSTEM_TEMPLATES } from "../src/lib/email/systemTemplates";
import { readFileSync } from "fs";

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) {
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1);
  }
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(path: string, init?: RequestInit) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  const ws = await rest("workspaces?select=id,name");
  const workspaces: { id: string; name: string }[] = JSON.parse(ws.body);
  for (const w of workspaces) {
    const existRes = await rest(
      `email_templates?select=template_key&workspace_id=eq.${w.id}&template_key=not.is.null`
    );
    const existing = new Set(
      JSON.parse(existRes.body).map((r: { template_key: string }) => r.template_key)
    );
    const toInsert = SYSTEM_TEMPLATES.filter((t) => !existing.has(t.template_key)).map(
      (t) => ({
        workspace_id: w.id,
        name: t.name,
        subject: t.subject,
        body: t.body,
        variables: [],
        is_system_default: true,
        template_key: t.template_key,
      })
    );
    if (toInsert.length === 0) {
      console.log(`${w.name}: already has all ${SYSTEM_TEMPLATES.length}`);
      continue;
    }
    const ins = await rest("email_templates", {
      method: "POST",
      body: JSON.stringify(toInsert),
    });
    console.log(`${w.name}: inserted ${toInsert.length} -> HTTP ${ins.status}`);
    if (ins.status >= 300) console.log("   ", ins.body.slice(0, 300));
  }
}
main();
