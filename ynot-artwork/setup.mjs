#!/usr/bin/env node
// Y-Not artwork plugin setup, Windows + macOS. Run once per PC (and after plugin updates):  node setup.mjs
//   - Adobe: copies the MCP Bridge extension into the CEP extensions folder, enables unsigned CEP extensions.
//   - Claude Desktop + Codex: copies the adobe MCP to ~/.ynot/adobe-mcp and registers it; copies the skill to
//     ~/.codex/skills; writes ~/.ynot/ynot-artwork-spec.zip to upload in the Claude Desktop chat app.
//   - Claude Code: inside the installed plugin nothing is needed (the plugin brings the skill + MCP); run from a
//     plain clone of the repo it registers the MCP and copies the skill like for Codex.
// Replaced folders/configs are backed up to ~/.ynot-skills-backup first.
//   --check   print one line only when setup is missing or older than this plugin (used by the SessionStart hook)
//   --no-debug-mode   skip the PlayerDebugMode step
import { execFileSync, execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url)), HOME = homedir(), WIN = process.platform === 'win32';
const MCP = join(ROOT, 'adobe-mcp'), SKILL = join(ROOT, 'skills', 'ynot-artwork-spec');
const YNOT = join(HOME, '.ynot'), STAMP = join(YNOT, 'installed.json'), BAK = join(HOME, '.ynot-skills-backup');
const CEP = WIN ? join(process.env.APPDATA, 'Adobe', 'CEP', 'extensions') : join(HOME, 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
const EXT_AT = join(CEP, 'com.adobemcp.bridge');
const fwd = p => p.replace(/\\/g, '/'), NODE = fwd(process.execPath), RUNTIME = fwd(join(YNOT, 'adobe-mcp', 'server.bundle.mjs'));
const AS_PLUGIN = /[\\/]\.claude[\\/]plugins[\\/]/.test(ROOT);
const say = m => console.log('  ' + m);

// Version of what this script installs = hash of those files.
function hashInto(h, p) {
  if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) hashInto(h, join(p, f));
  else h.update(p.slice(ROOT.length)).update(readFileSync(p));
}
const h = createHash('sha1');
for (const p of [join(MCP, 'extension'), join(MCP, 'server.bundle.mjs'), join(MCP, 'prelude.jsx'), SKILL]) hashInto(h, p);
const VERSION = h.digest('hex').slice(0, 12);

if (process.argv.includes('--check')) {
  let st = null; try { st = JSON.parse(readFileSync(STAMP, 'utf8')); } catch {}
  if (!st || !existsSync(EXT_AT)) console.log('Y-Not artwork plugin: the Adobe MCP Bridge is not set up on this PC yet. Run the ynot-setup skill, then restart Illustrator/Photoshop.');
  else if (st.version !== VERSION) console.log('Y-Not artwork plugin was updated: run the ynot-setup skill again, then restart Illustrator/Photoshop.');
  process.exit(0);
}

function backup(p) { mkdirSync(BAK, { recursive: true }); const to = join(BAK, `${basename(p)}-${Date.now()}`); renameSync(p, to); say(`backup  ${to}`); }
function backupCopy(f) { if (existsSync(f)) { mkdirSync(BAK, { recursive: true }); writeFileSync(join(BAK, `${basename(f)}-${Date.now()}`), readFileSync(f)); } }
function unlink(p) { try { unlinkSync(p); } catch { rmdirSync(p); } } // removes only the link (Windows junctions need rmdir)
// Put a fresh copy of src at dst. A link (old dev install) is removed; a folder we didn't install is backed up.
function place(src, dst, ours) {
  let st = null; try { st = lstatSync(dst); } catch {}
  if (st?.isSymbolicLink()) unlink(dst);
  else if (st && ours) rmSync(dst, { recursive: true, force: true });
  else if (st) backup(dst);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  say(`copied  ${dst}`);
}
// .cmd tools (npm, claude) need a shell on Windows; pass one quoted command line.
const q = a => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const run = (cmd, args) => execSync([cmd, ...args].map(q).join(' '), { stdio: 'pipe', encoding: 'utf8' });
let prev = null; try { prev = JSON.parse(readFileSync(STAMP, 'utf8')); } catch {}

console.log('Adobe');
place(join(MCP, 'extension'), EXT_AT, !!prev);
if (process.argv.includes('--no-debug-mode')) say('PlayerDebugMode: skipped');
else {
  for (let v = 9; v <= 13; v++) { // unsigned CEP extensions need debug mode, per CSXS version
    if (WIN) execFileSync('reg', ['add', `HKCU\\Software\\Adobe\\CSXS.${v}`, '/v', 'PlayerDebugMode', '/t', 'REG_SZ', '/d', '1', '/f'], { stdio: 'pipe' });
    else execFileSync('defaults', ['write', `com.adobe.CSXS.${v}`, 'PlayerDebugMode', '1']);
  }
  say('PlayerDebugMode=1 (CSXS 9-13)');
}

console.log('adobe MCP runtime');
mkdirSync(join(YNOT, 'adobe-mcp'), { recursive: true });
for (const f of ['server.bundle.mjs', 'prelude.jsx']) cpSync(join(MCP, f), join(YNOT, 'adobe-mcp', f));
say(`copied  ${join(YNOT, 'adobe-mcp')}`);

console.log('Claude Desktop');
const desk = WIN ? join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json') : join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
if (existsSync(dirname(desk))) {
  backupCopy(desk);
  const cfg = existsSync(desk) ? JSON.parse(readFileSync(desk, 'utf8')) : {};
  cfg.mcpServers = { ...cfg.mcpServers, adobe: { command: NODE, args: [RUNTIME] } };
  writeFileSync(desk, JSON.stringify(cfg, null, 2)); say('adobe MCP registered');
} else say('not installed: skipped');
const zip = join(YNOT, 'ynot-artwork-spec.zip');
try {
  rmSync(zip, { force: true });
  if (WIN) execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -LiteralPath '${SKILL}' -DestinationPath '${zip}' -Force`], { stdio: 'pipe' });
  else execFileSync('zip', ['-qr', zip, basename(SKILL)], { cwd: dirname(SKILL) });
  say(`skill zip for the chat app: ${zip} (upload it in Settings > Capabilities > Skills)`);
} catch (e) { say('skill zip failed: ' + e.message.split('\n')[0]); }

console.log('Codex');
const codexDir = join(HOME, '.codex');
if (existsSync(codexDir)) {
  const toml = join(codexDir, 'config.toml'); backupCopy(toml);
  let t = existsSync(toml) ? readFileSync(toml, 'utf8') : '';
  const block = `[mcp_servers.adobe]\ncommand = "${NODE}"\nargs = ["${RUNTIME}"]\n`;
  t = /^\[mcp_servers\.adobe\]/m.test(t) ? t.replace(/^\[mcp_servers\.adobe\]\n(?:(?!\[)[^\n]*\n?)*/m, block + '\n') : t + (t && !t.endsWith('\n') ? '\n' : '') + '\n' + block;
  writeFileSync(toml, t); say('adobe MCP registered');
  place(SKILL, join(codexDir, 'skills', 'ynot-artwork-spec'), !!prev);
} else say('not installed: skipped');

console.log('Claude Code');
const ccSkill = join(HOME, '.claude', 'skills', 'ynot-artwork-spec');
let cli = true; try { run('claude', ['--version']); } catch { cli = false; }
if (AS_PLUGIN) { // the plugin already provides skill + MCP: remove copies from older installs so nothing is doubled
  let st = null; try { st = lstatSync(ccSkill); } catch {}
  if (st?.isSymbolicLink()) { unlink(ccSkill); say('removed old skill link (the plugin provides it)'); }
  else if (st) backup(ccSkill);
  if (cli) { try { run('claude', ['mcp', 'remove', 'adobe', '-s', 'user']); say('removed old user-scope adobe MCP (the plugin provides it)'); } catch {} }
  say('plugin provides the skill and the adobe MCP');
} else {
  place(SKILL, ccSkill, !!prev);
  if (cli) { try { run('claude', ['mcp', 'remove', 'adobe', '-s', 'user']); } catch {} run('claude', ['mcp', 'add', '-s', 'user', 'adobe', '--', NODE, RUNTIME]); say('adobe MCP registered (user scope)'); }
  else say('claude CLI not found: skipped');
}

mkdirSync(YNOT, { recursive: true });
writeFileSync(STAMP, JSON.stringify({ version: VERSION, at: new Date().toISOString(), from: fwd(ROOT) }, null, 2));
console.log(`\nDone (version ${VERSION}). Restart Illustrator/Photoshop${existsSync(dirname(desk)) ? ', Claude Desktop' : ''}${existsSync(codexDir) ? ', Codex' : ''}.`);
