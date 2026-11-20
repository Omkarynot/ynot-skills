#!/usr/bin/env node
// Installs everything in this repo on Windows or macOS:  node install.mjs
//  1. adobe-mcp: npm install, links the MCP Bridge extension into Adobe's CEP folder, allows unsigned CEP
//     extensions (PlayerDebugMode=1), registers the MCP with Claude Code, Claude Desktop and Codex.
//  2. every skill folder (has a SKILL.md): links it into ~/.claude/skills and ~/.codex/skills.
// Links, not copies: after `git pull` everything is up to date. Re-running is safe. Existing real folders are
// moved to ~/.ynot-skills-backup, never deleted; configs are backed up there before editing. Restart Adobe apps and Claude afterwards.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, symlinkSync, unlinkSync, writeFileSync, readlinkSync, rmdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)), HOME = homedir(), WIN = process.platform === 'win32';
const MCP = join(ROOT, 'adobe-mcp'), SERVER = join(MCP, 'server.mjs').replace(/\\/g, '/'), NODE = process.execPath.replace(/\\/g, '/');
const say = m => console.log('  ' + m);
// npm/claude are .cmd files on Windows, so they need a shell there; quote args with spaces for it.
const sh = (cmd, args, opts = {}) => {
  const shell = WIN && cmd !== 'reg';
  return execFileSync(cmd, shell ? args.map(a => (/ /.test(a) ? `"${a}"` : a)) : args, { stdio: 'pipe', encoding: 'utf8', shell, ...opts });
};
const BAK = join(HOME, '.ynot-skills-backup'); // outside the skills folders, so a backup is never loaded as a skill
const stamp = n => join(BAK, `${basename(n)}-${Date.now()}`);
function backup(f) { mkdirSync(BAK, { recursive: true }); const to = stamp(f); renameSync(f, to); say(`backup  ${to}`); }
function backupCopy(f) { if (existsSync(f)) { mkdirSync(BAK, { recursive: true }); writeFileSync(stamp(f), readFileSync(f)); } }

function link(target, at) {
  mkdirSync(dirname(at), { recursive: true });
  let st = null; try { st = lstatSync(at); } catch {}
  if (st?.isSymbolicLink()) {
    let cur = ''; try { cur = resolve(dirname(at), readlinkSync(at)); } catch {}
    if (cur.toLowerCase() === resolve(target).toLowerCase()) return say(`ok      ${at}`);
    WIN ? rmdirSync(at) : unlinkSync(at); // removes the link only, never the target
  } else if (st) backup(at);
  symlinkSync(target, at, WIN ? 'junction' : 'dir');
  say(`linked  ${at} -> ${target}`);
}

console.log('adobe-mcp');
sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: MCP }); say('npm install done');
const CEP = WIN ? join(process.env.APPDATA, 'Adobe', 'CEP', 'extensions') : join(HOME, 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
link(join(MCP, 'extension'), join(CEP, 'com.adobemcp.bridge'));
if (process.argv.includes('--no-debug-mode')) say('PlayerDebugMode: skipped');
else {
  for (let v = 9; v <= 12; v++) { // unsigned extensions need debug mode, per CSXS version
    if (WIN) sh('reg', ['add', `HKCU\\Software\\Adobe\\CSXS.${v}`, '/v', 'PlayerDebugMode', '/t', 'REG_SZ', '/d', '1', '/f']);
    else sh('defaults', ['write', `com.adobe.CSXS.${v}`, 'PlayerDebugMode', '1']);
  }
  say('PlayerDebugMode=1 for CSXS 9-12');
}

try { // Claude Code (user scope, so it works from any folder)
  try { sh('claude', ['mcp', 'remove', 'adobe', '-s', 'user']); } catch {}
  sh('claude', ['mcp', 'add', '-s', 'user', 'adobe', '--', NODE, SERVER]); say('Claude Code: adobe MCP added (user scope)');
} catch { say('Claude Code CLI not found: skipped'); }

const desk = WIN ? join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json') : join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
if (existsSync(dirname(desk))) {
  backupCopy(desk);
  const cfg = existsSync(desk) ? JSON.parse(readFileSync(desk, 'utf8')) : {};
  cfg.mcpServers = { ...cfg.mcpServers, adobe: { command: NODE, args: [SERVER] } };
  writeFileSync(desk, JSON.stringify(cfg, null, 2)); say('Claude Desktop: adobe MCP set');
} else say('Claude Desktop not found: skipped');

const codex = join(HOME, '.codex', 'config.toml');
if (existsSync(dirname(codex))) {
  backupCopy(codex);
  let t = existsSync(codex) ? readFileSync(codex, 'utf8') : '';
  const block = `[mcp_servers.adobe]\ncommand = "${NODE}"\nargs = ["${SERVER}"]\n`;
  t = /^\[mcp_servers\.adobe\]/m.test(t) ? t.replace(/^\[mcp_servers\.adobe\]\n(?:(?!\[)[^\n]*\n?)*/m, block + '\n') : t + (t.endsWith('\n') || !t ? '' : '\n') + '\n' + block;
  writeFileSync(codex, t); say('Codex: adobe MCP set');
} else say('Codex not found: skipped');

console.log('skills');
for (const name of readdirSync(ROOT)) {
  if (!existsSync(join(ROOT, name, 'SKILL.md'))) continue;
  link(join(ROOT, name), join(HOME, '.claude', 'skills', name));
  if (existsSync(join(HOME, '.codex'))) link(join(ROOT, name), join(HOME, '.codex', 'skills', name));
}
console.log('\nDone. Restart Illustrator/Photoshop and Claude. Claude Desktop (chat app) skills: zip a skill folder and upload it in Settings > Capabilities.');
