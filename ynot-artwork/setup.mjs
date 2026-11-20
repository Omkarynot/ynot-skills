#!/usr/bin/env node
// Y-Not artwork plugin setup, Windows + macOS.  node setup.mjs
// The plugin's SessionStart hook runs it with --auto, so installing the plugin is all a user has to do.
//   - Adobe: copies the MCP Bridge extension into the CEP extensions folder, enables unsigned CEP extensions.
//   - Claude Desktop + Codex: copies the adobe MCP to ~/.ynot/adobe-mcp and registers it; copies the skill to
//     ~/.codex/skills. The MCP also serves the skill (artwork_guide), so the Desktop chat window needs no upload.
//   - Claude Code: when the plugin is installed it brings the skill + MCP itself (older copies are removed so nothing
//     shows twice); run from a plain download of the repo it registers the MCP and copies the skill instead.
// Replaced folders/configs are backed up to ~/.ynot-skills-backup first.
//   --auto    nothing when up to date; else the whole setup, quietly, then one line for Claude to relay to the user
//   --check   print one line only when setup is missing or older than this plugin
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
const DESK = WIN ? join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json') : join(HOME, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
const CODEX = join(HOME, '.codex'), ZIP = join(YNOT, 'ynot-artwork-spec.zip');
const fwd = p => p.replace(/\\/g, '/'), NODE = fwd(process.execPath), RUNTIME = fwd(join(YNOT, 'adobe-mcp', 'server.bundle.mjs'));
const AUTO = process.argv.includes('--auto'), out = [];
const log = m => (AUTO ? out.push(m) : console.log(m)), say = m => log('  ' + m);
if (AUTO) process.on('uncaughtException', e => { // never break the user's session: report and stop
  console.log(`Y-Not artwork plugin: automatic setup failed (${String(e.message).split('\n')[0]}). Tell the user in plain words, and offer to run the ynot-setup skill.`);
  process.exit(0);
});

// Plugin mode when run from the installed plugin, or when the plugin is installed at all.
let pluginInstalled = false;
try { pluginInstalled = /"ynot-artwork@/.test(readFileSync(join(HOME, '.claude', 'plugins', 'installed_plugins.json'), 'utf8')); } catch {}
const AS_PLUGIN = /[\\/]\.claude[\\/]plugins[\\/]/.test(ROOT) || pluginInstalled;

// Version of what this script installs = hash of those files.
function hashInto(h, p) {
  if (statSync(p).isDirectory()) for (const f of readdirSync(p).sort()) hashInto(h, join(p, f));
  else h.update(fwd(p.slice(ROOT.length))).update(readFileSync(p));
}
const h = createHash('sha1');
for (const p of [join(MCP, 'extension'), join(MCP, 'server.bundle.mjs'), join(MCP, 'prelude.jsx'), SKILL]) hashInto(h, p);
const VERSION = h.digest('hex').slice(0, 12);
let prev = null; try { prev = JSON.parse(readFileSync(STAMP, 'utf8')); } catch {}
const upToDate = !!prev && prev.version === VERSION && existsSync(EXT_AT);

if (AUTO && upToDate) process.exit(0);
if (process.argv.includes('--check')) {
  if (!prev || !existsSync(EXT_AT)) console.log('Y-Not artwork plugin: the Adobe MCP Bridge is not set up on this PC yet. Run the ynot-setup skill, then restart Illustrator/Photoshop.');
  else if (!upToDate) console.log('Y-Not artwork plugin was updated: run the ynot-setup skill again, then restart Illustrator/Photoshop.');
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
// .cmd tools (claude) need a shell on Windows; pass one quoted command line.
const q = a => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const run = (cmd, args) => execSync([cmd, ...args].map(q).join(' '), { stdio: 'pipe', encoding: 'utf8' });

log('Adobe');
place(join(MCP, 'extension'), EXT_AT, !!prev);
if (process.argv.includes('--no-debug-mode')) say('PlayerDebugMode: skipped');
else {
  for (let v = 9; v <= 13; v++) { // unsigned CEP extensions need debug mode, per CSXS version
    if (WIN) execFileSync('reg', ['add', `HKCU\\Software\\Adobe\\CSXS.${v}`, '/v', 'PlayerDebugMode', '/t', 'REG_SZ', '/d', '1', '/f'], { stdio: 'pipe' });
    else execFileSync('defaults', ['write', `com.adobe.CSXS.${v}`, 'PlayerDebugMode', '1']);
  }
  // macOS caches preferences: restart the user's prefs daemon so Adobe sees the change without a logout
  if (!WIN) try { execFileSync('killall', ['-u', process.env.USER || '', 'cfprefsd'], { stdio: 'pipe' }); } catch {}
  say('PlayerDebugMode=1 (CSXS 9-13)');
}

log('adobe MCP runtime');
mkdirSync(join(YNOT, 'adobe-mcp'), { recursive: true });
for (const f of ['server.bundle.mjs', 'prelude.jsx']) cpSync(join(MCP, f), join(YNOT, 'adobe-mcp', f));
say(`copied  ${join(YNOT, 'adobe-mcp')}`);
// The MCP serves the skill itself (artwork_guide + scripts), so the Desktop chat window needs no skill upload.
place(SKILL, join(YNOT, 'skills', 'ynot-artwork-spec'), true);

log('Claude Desktop');
const hasDesk = existsSync(dirname(DESK));
if (hasDesk) {
  backupCopy(DESK);
  const cfg = existsSync(DESK) ? JSON.parse(readFileSync(DESK, 'utf8')) : {};
  cfg.mcpServers = { ...cfg.mcpServers, adobe: { command: NODE, args: [RUNTIME] } };
  writeFileSync(DESK, JSON.stringify(cfg, null, 2)); say('adobe MCP registered');
} else say('not installed: skipped');
try {
  rmSync(ZIP, { force: true });
  // Windows 10+ tar writes a standard zip with "/" paths (PowerShell 5's Compress-Archive writes "\", which breaks elsewhere)
  if (WIN) execFileSync(join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe'), ['-a', '-cf', ZIP, basename(SKILL)], { cwd: dirname(SKILL), stdio: 'pipe' });
  else execFileSync('zip', ['-qr', ZIP, basename(SKILL)], { cwd: dirname(SKILL) });
  say(`skill zip (optional, for an org-wide skill upload): ${ZIP}`);
} catch (e) { say('skill zip failed: ' + e.message.split('\n')[0]); }

log('Codex');
const hasCodex = existsSync(CODEX);
if (hasCodex) {
  const toml = join(CODEX, 'config.toml'); backupCopy(toml);
  let t = existsSync(toml) ? readFileSync(toml, 'utf8') : '';
  const block = `[mcp_servers.adobe]\ncommand = "${NODE}"\nargs = ["${RUNTIME}"]\n`;
  t = /^\[mcp_servers\.adobe\]/m.test(t) ? t.replace(/^\[mcp_servers\.adobe\]\n(?:(?!\[)[^\n]*\n?)*/m, block + '\n') : t + (t && !t.endsWith('\n') ? '\n' : '') + '\n' + block;
  writeFileSync(toml, t); say('adobe MCP registered');
  place(SKILL, join(CODEX, 'skills', 'ynot-artwork-spec'), !!prev);
} else say('not installed: skipped');

log('Claude Code');
const ccSkill = join(HOME, '.claude', 'skills', 'ynot-artwork-spec');
let cli = true; try { run('claude', ['--version']); } catch { cli = false; }
if (AS_PLUGIN) { // the plugin provides skill + MCP: remove copies from older installs so nothing is doubled
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
const apps = ['Illustrator/Photoshop', hasDesk && 'Claude Desktop', hasCodex && 'Codex'].filter(Boolean).join(', ');
if (AUTO) console.log(`Y-Not artwork plugin: ${prev ? 'updated' : 'installed'} the Adobe MCP Bridge${hasDesk ? ', Claude Desktop' : ''}${hasCodex ? ', Codex' : ''} setup (version ${VERSION}). ` +
  `Tell the user once, in plain words: restart ${apps} so it takes effect.`);
else console.log(`\nDone (version ${VERSION}). Restart ${apps}.`);
