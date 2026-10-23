#!/usr/bin/env node
// Screenshot one part of the Obsidian window (never the whole window: the file tree shows real note names).
// Usage: node shot.mjs <out.png> <css selector> [padding px]
// Uses the CLI's dev:cdp Page.captureScreenshot with a clip around the element.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [outPng, selector, pad = '8'] = process.argv.slice(2);
const cli = fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').trim();
const run = (...a) => spawnSync(cli, ['vault=vault-copy', ...a], { cwd: '/mnt/c', encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
const rect = run('eval', `code=JSON.stringify((()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})())`).replace(/^=> /, '').trim();
const r = JSON.parse(rect);
if (!r) { console.error(`no element for ${selector}`); process.exit(1); }
const p = Number(pad);
const clip = { x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.w + 2 * p, height: r.h + 2 * p, scale: 2 };
const res = JSON.parse(run('dev:cdp', 'method=Page.captureScreenshot', `params=${JSON.stringify({ format: 'png', clip, captureBeyondViewport: true })}`));
fs.writeFileSync(outPng, Buffer.from(res.data, 'base64'));
console.log(`${outPng} ${Math.round(clip.width)}x${Math.round(clip.height)}`);
