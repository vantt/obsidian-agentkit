#!/usr/bin/env node
// Credential-injecting proxy for one E8 agent session (cc-run.sh starts it, outside the sandbox).
// Usage: node cred-proxy.mjs <openrouter|claude>
//   env E8_PROXY_NONCE  required: the placeholder credential the agent's `claude` sends; anything else is refused
//   env E8_PROXY_MODEL  optional: the only model a request may name (set for OpenRouter runs)
//   env E8_CRED_DIR     optional: where the *.env files live (default ~/.config/obsidian-agentkit)
// Prints the port it listens on (127.0.0.1, random) as its first stdout line, then serves until its parent exits.
//
// Why (E8, round 0): with the key in `claude`'s environment, the agent's Bash tool could print it (`printenv`),
// and it then went to the model provider in the transcript. Here the secret lives only in this process, which
// runs outside the sandbox; the agent's `claude` gets ANTHROPIC_BASE_URL=http://127.0.0.1:<port> and a
// per-session placeholder.
// - openrouter: upstream $OPENROUTER_BASE_URL (https://openrouter.ai/api); the placeholder `x-api-key` is replaced
//   by the real key, as `claude` itself sends it with ANTHROPIC_API_KEY.
// - claude: upstream https://api.anthropic.com; the placeholder `Authorization: Bearer` is replaced by the
//   CLAUDE_CODE_OAUTH_TOKEN, as `claude` sends it with that variable (it also sends `anthropic-beta: oauth-...`).
// Only the model API is forwarded (POST /v1/messages, /v1/messages/count_tokens), so the agent cannot use the
// proxy as a general authenticated gateway. Secrets are never printed or logged; the log names method, path and
// status only.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

const kind = process.argv[2];
const CFG = process.env.E8_CRED_DIR || path.join(os.homedir(), '.config/obsidian-agentkit');
const NONCE = process.env.E8_PROXY_NONCE || '';
const MODEL = process.env.E8_PROXY_MODEL || '';
const die = (msg) => { process.stderr.write(`cred-proxy: ${msg}\n`); process.exit(5); };
if (!/^[a-f0-9]{32,}$/.test(NONCE)) die('E8_PROXY_NONCE missing or too short');

const readEnv = (f) => {
  const e = {};
  if (!fs.existsSync(f)) return e;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) e[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
  return e;
};

let upstream, secret, placeholder, inject;
if (kind === 'openrouter') {
  const e = readEnv(path.join(CFG, 'openrouter.env'));
  secret = e.OPENROUTER_API_KEY;
  upstream = new URL(e.OPENROUTER_BASE_URL || 'https://openrouter.ai/api');
  placeholder = (h) => h['x-api-key'] === `sk-e8proxy-${NONCE}`;
  inject = (h) => { h['x-api-key'] = secret; };
} else if (kind === 'claude') {
  secret = readEnv(path.join(CFG, 'claude.env')).CLAUDE_CODE_OAUTH_TOKEN;
  upstream = new URL('https://api.anthropic.com');
  placeholder = (h) => h.authorization === `Bearer sk-ant-oat01-e8proxy-${NONCE}`;
  inject = (h) => {
    h.authorization = `Bearer ${secret}`;
    const beta = String(h['anthropic-beta'] || '').split(',').filter(Boolean);
    if (!beta.some((b) => b.startsWith('oauth-'))) h['anthropic-beta'] = ['oauth-2025-04-20', ...beta].join(',');
  };
} else die('usage: cred-proxy.mjs <openrouter|claude>');
if (!secret) die(`no credential in ${path.join(CFG, kind + '.env')}`);
if (upstream.protocol !== 'https:') die('upstream must be https');
const base = upstream.pathname.replace(/\/$/, '');

// Exactly the calls `claude -p` makes to the model API (seen with a logging proxy: POST /v1/messages?beta=true).
const ALLOWED = new Set(['/v1/messages', '/v1/messages/count_tokens']);
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
const CRED = new Set(['authorization', 'x-api-key', 'cookie', 'anthropic-api-key']);
const agent = new https.Agent({ keepAlive: true });
const log = (s) => process.stderr.write(`cred-proxy: ${new Date().toISOString()} ${s}\n`);

function refuse(res, code, msg) {
  if (res.headersSent) { res.destroy(); return; }
  const body = JSON.stringify({ type: 'error', error: { type: code === 403 ? 'permission_error' : 'api_error', message: `e8 proxy: ${msg}` } });
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const where = `${req.method} ${u.pathname.slice(0, 80)}`;
  const queryOk = [...u.searchParams.keys()].every((k) => k === 'beta');
  if (req.method !== 'POST' || !ALLOWED.has(u.pathname) || !queryOk) { log(`refused ${where}: not a model API call`); req.resume(); return refuse(res, 403, 'only the model API is forwarded'); }
  if (!placeholder(req.headers)) { log(`refused ${where}: wrong placeholder credential`); req.resume(); return refuse(res, 403, 'wrong session credential'); }
  // Buffer the body (a few MB at most): the model it names is checked before anything goes upstream.
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('error', () => res.destroy());
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (MODEL) {
      let m; try { m = JSON.parse(body.toString('utf8')).model; } catch { /* refused below */ }
      if (m !== MODEL) { log(`refused ${where}: model ${JSON.stringify(String(m).slice(0, 80))} is not the model under test`); return refuse(res, 403, 'only the model under test may be called'); }
    }
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && !CRED.has(k)) headers[k] = v;
    inject(headers);
    headers['content-length'] = body.length;
    const up = https.request({ host: upstream.hostname, port: upstream.port || 443, method: 'POST', path: base + u.pathname + u.search, headers, agent }, (ur) => {
      log(`${where} -> ${ur.statusCode}`);
      const h = {};
      for (const [k, v] of Object.entries(ur.headers)) if (!HOP.has(k)) h[k] = v;
      res.writeHead(ur.statusCode, h);
      res.flushHeaders();
      ur.pipe(res); // SSE chunks pass through as they arrive
      ur.on('error', () => res.destroy());
    });
    up.on('error', (e) => { log(`${where}: upstream error ${e.code || 'unknown'}`); refuse(res, 502, 'upstream unreachable'); });
    res.on('close', () => { if (!res.writableFinished) up.destroy(); });
    up.end(body);
  });
});
server.requestTimeout = 0; // long streamed responses; claude has its own timeout
server.keepAliveTimeout = 120000;
server.listen(0, '127.0.0.1', () => process.stdout.write(`${server.address().port}\n`));
// Die with the session: cc-run.sh kills this process on exit; if it is killed itself, notice the new parent.
const parent = process.ppid;
setInterval(() => { if (process.ppid !== parent) process.exit(0); }, 2000).unref();
process.on('SIGTERM', () => process.exit(0));
