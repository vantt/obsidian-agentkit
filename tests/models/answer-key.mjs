// The S6 answer key of the synthetic vault, kept where the agent under test cannot read it (E8.12).
// obsidian-test-fixture >= 0.3.0 writes it with `otf generate --preset personal-vault --answers-out <file>`;
// the vault's `.e8-synthetic` marker then only says `{"synthetic": true, ...}`.
// Lookup: $E8_ANSWER_KEY, else $E8_STATE/answer-key.json (default ~/.local/state/obs-e8), else the legacy
// marker inside the vault (vaults made before 0.3.0, so round-0 runs can still be judged again).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MARKER = '.e8-synthetic';
export const answerKeyPath = () => process.env.E8_ANSWER_KEY
  || path.join(process.env.E8_STATE || path.join(os.homedir(), '.local/state/obs-e8'), 'answer-key.json');

const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);

// Returns the key ({about, generator, seed, s6}) or null when there is none.
export function loadAnswerKey(vaultDir) {
  const marker = vaultDir ? read(path.join(vaultDir, MARKER)) : null;
  if (marker?.s6) return marker; // legacy vault: the key is in the marker
  const key = read(answerKeyPath());
  if (!key?.s6) return null;
  // A key from another generation of the vault would judge against the wrong notes.
  if (marker && marker.seed !== undefined && key.seed !== marker.seed) {
    throw new Error(`answer key ${answerKeyPath()} has seed ${key.seed}, vault marker has seed ${marker.seed}`);
  }
  return key;
}
