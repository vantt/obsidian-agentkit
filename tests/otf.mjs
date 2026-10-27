// Path to the `otf` CLI of obsidian-test-fixture, the vault generator and file-only ground truth
// (pinned by tag in tests/package.json; run `npm ci` in tests/ first). Spawn it with node.
import { fileURLToPath } from 'node:url';

export const OTF = fileURLToPath(new URL('../bin/otf.mjs', import.meta.resolve('obsidian-test-fixture')));
