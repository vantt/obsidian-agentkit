#!/usr/bin/env node
// Stand-in for Obsidian.com in bridge tests. FAKE_MODE picks the canned behaviour.
// Every mode echoes nothing about argv except "args", which prints the argv as JSON.
const mode = process.env.FAKE_MODE || 'ok';
const out = (s, code = 0) => { process.stdout.write(s); process.exit(code); };
switch (mode) {
  case 'ok': out('result line\n');
  case 'args': out(JSON.stringify(process.argv.slice(2)) + '\n');
  case 'closed': out('The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.\n', 1);
  case 'closed-stderr': process.stderr.write('The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.\n'); process.exit(1);
  case 'error':out('Error: File "x.md" not found.\n');
  case 'vault-missing': out('Vault not found.\n');
  case 'empty-msg': out('No matches found.\n');
  case 'empty-out': out('');
  case 'not-ready': out('Error: Command "eval" not found. It may require a plugin to be enabled.\n');
  case 'exe-127': out('', 127);
  case 'leading-blank': out('\nreal output\n');
  case 'hang': setTimeout(() => out('late\n'), 60000); break;
  case 'vault-path': out('C:\\Some Dir\\Vault Đà Nẵng\n');
  default: out(`unknown FAKE_MODE ${mode}\n`, 9);
}
