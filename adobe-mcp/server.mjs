import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORTS = { photoshop: 8701, illustrator: 8702, aftereffects: 8703, premiere: 8704, audition: 8705 };
const run = promisify(execFile);
const q = s => JSON.stringify(String(s)); // ExtendScript string literal
const fwd = p => p.replace(/\\/g, '/');

// Sent before every script (ES3). Adds JSON (ExtendScript has none), returns objects/arrays as JSON,
// reports errors with file + line + the failing source line, and can close docs a failed script created.
const PRELUDE = readFileSync(new URL('./prelude.jsx', import.meta.url), 'utf8');

async function bridge(app, body, ms) {
  const r = await fetch(`http://127.0.0.1:${PORTS[app]}`, {
    method: 'POST', headers: { 'x-adobe-mcp': '1' }, body, signal: ms ? AbortSignal.timeout(ms) : undefined,
  });
  return (await r.text()).trim(); // bridge pads long jobs with keep-alive spaces
}

export function wrap(code, { include = [], rollbackOnError = false } = {}) {
  const inc = include.map(p => `$.evalFile(${q(fwd(p))});`).join('\n');
  return `${PRELUDE}
var __mcpD = ${rollbackOnError ? '__mcpDocs()' : 'null'}, __mcpR;
try { ${inc}
__mcpR = __mcpOut(eval(${q(code)})); } catch (__e) { __mcpRollback(__mcpD); __mcpR = __mcpErr(__e, ${q(code)}); }
__mcpRestore(); __mcpR;`;
}

const server = new McpServer({ name: 'adobe', version: '1.2.0' });
const unreachable = app => `${app} isn't reachable. Open it (the MCP Bridge extension starts with the app), or call the status tool.`;
const fail = text => ({ content: [{ type: 'text', text }], isError: true });

server.tool(
  'run_jsx',
  `Run ExtendScript (ES3: no let/const/arrow functions) inside a running Adobe app and return the value of the last expression.
Objects and arrays come back as JSON; JSON.stringify/parse work in every script.
Pass the script inline as "code", or a .jsx path as "file" (better for long build scripts; error lines then match the file).
"include" loads helper libraries first (e.g. a skill's yn_lib.jsx). "rollbackOnError" closes, unsaved, any document the script created if it fails.
Use the host's DOM: Photoshop/Illustrator app.activeDocument, After Effects app.project (wrap edits in app.beginUndoGroup/endUndoGroup), Premiere app.project.activeSequence.
New text inherits the app's Character panel settings (tracking, leading, etc.), so set them explicitly. Inspect before editing, e.g. "app.activeDocument.layers.length".
Check visual results with the preview tool (sharp render of the document), not screenshot.`,
  {
    app: z.enum(Object.keys(PORTS)),
    code: z.string().optional().describe('Inline script'),
    file: z.string().optional().describe('Absolute path of a .jsx file to run instead of code'),
    include: z.array(z.string()).optional().describe('Absolute paths of .jsx libraries to load first'),
    rollbackOnError: z.boolean().optional(),
  },
  async ({ app, code, file, include, rollbackOnError }) => {
    if (!code && !file) return fail('Pass code or file.');
    let src = code;
    if (file) { try { src = readFileSync(file, 'utf8'); } catch (e) { return fail(`Can't read ${file}: ${e.message}`); } }
    try {
      const text = await bridge(app, wrap(src, { include, rollbackOnError }));
      return { content: [{ type: 'text', text }], isError: text.startsWith('ERROR:') || text === 'EvalScript error.' };
    } catch { return fail(unreachable(app)); }
  }
);

const STATUS_JSX = `var s = app.name + ' ' + app.version;
try { var n = []; for (var i = 0; i < app.documents.length; i++) n.push(app.documents[i].name);
  s += ' | open: ' + (n.join(', ') || 'none'); try { s += ' | active: ' + app.activeDocument.name; } catch (e) {}
} catch (e) { try { s += ' | project: ' + (app.project.file ? app.project.file.name : 'unsaved'); } catch (e2) {} }
s`;

server.tool('status', 'List which Adobe apps have the MCP Bridge running, their versions and open documents.', {}, async () => {
  const lines = await Promise.all(Object.keys(PORTS).map(async app => {
    try { return `${app}: ${await bridge(app, STATUS_JSX, 4000)}`; }
    catch (e) { return `${app}: ${e.name === 'TimeoutError' ? 'busy (running a long script) or frozen' : 'not running'}`; }
  }));
  return { content: [{ type: 'text', text: lines.join('\n') }] };
});

// Illustrator: export the active (or given) artboard, or a region of it in inches from its top-left.
// Photoshop: merged copy, region in pixels. Long side defaults to ~2000 px.
export const previewJsx = (app, out, { scale, region, artboard } = {}) => app === 'illustrator' ? `
var d = app.activeDocument, ab = d.artboards, prev = ab.getActiveArtboardIndex();
var idx = ${artboard ?? 'prev'}, r = ab[idx].artboardRect, tmp = null, R = ${JSON.stringify(region ?? null)};
if (R) { r = [r[0] + R.x * 72, r[1] - R.y * 72, r[0] + (R.x + R.w) * 72, r[1] - (R.y + R.h) * 72]; tmp = ab.add(r); idx = ab.length - 1; }
ab.setActiveArtboardIndex(idx);
var o = new ExportOptionsPNG24(); o.artBoardClipping = true; o.antiAliasing = true; o.transparency = false;
var s = ${scale ?? 0} || 2000 / Math.max(r[2] - r[0], r[1] - r[3]) * 100; s = Math.max(10, Math.min(776, s));
o.horizontalScale = o.verticalScale = s;
d.exportFile(new File(${q(out)}), ExportType.PNG24, o);
ab.setActiveArtboardIndex(prev); if (tmp) tmp.remove();
'scale ' + Math.round(s) + '%, area ' + Math.round((r[2] - r[0]) / 72 * 100) / 100 + ' x ' + Math.round((r[1] - r[3]) / 72 * 100) / 100 + ' in'` : `
var d = app.activeDocument.duplicate('mcp_preview', true), R = ${JSON.stringify(region ?? null)};
if (R) d.crop([UnitValue(R.x, 'px'), UnitValue(R.y, 'px'), UnitValue(R.x + R.w, 'px'), UnitValue(R.y + R.h, 'px')]);
var w = d.width.as('px'), h = d.height.as('px'), k = ${scale ? scale / 100 : 0} || Math.min(1, 2000 / Math.max(w, h));
if (k !== 1) d.resizeImage(UnitValue(w * k, 'px'), UnitValue(h * k, 'px'), null, ResampleMethod.BICUBIC);
d.saveAs(new File(${q(out)}), new PNGSaveOptions(), true); d.close(SaveOptions.DONOTSAVECHANGES);
Math.round(w * k) + ' x ' + Math.round(h * k) + ' px'`;

server.tool(
  'preview',
  `Render the active Illustrator or Photoshop document to a PNG and return it: a sharp image of the artwork itself, for checking layout and details.
Illustrator: region {x,y,w,h} in INCHES from the artboard's top-left zooms into part of the sheet; artboard picks an artboard index.
Photoshop: region in PIXELS. scale is a percentage (default: long side about 2000 px).`,
  {
    app: z.enum(['illustrator', 'photoshop']),
    region: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
    artboard: z.number().int().optional(),
    scale: z.number().optional(),
  },
  async ({ app, ...opts }) => {
    const out = join(tmpdir(), `adobe-mcp-preview-${Date.now()}.png`);
    let info;
    try { info = await bridge(app, wrap(previewJsx(app, fwd(out), opts))); } catch { return fail(unreachable(app)); }
    if (info.startsWith('ERROR:') || !existsSync(out)) return fail(info || 'Export failed.');
    const data = readFileSync(out).toString('base64'); unlinkSync(out);
    return { content: [{ type: 'image', data, mimeType: 'image/png' }, { type: 'text', text: info }] };
  }
);

// ponytail: whole desktop (all monitors), downscaled to 2000 px wide. For dialogs/timelines; preview is for artwork.
const SHOT_PS = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name U -Namespace W
[W.U]::SetProcessDPIAware() | Out-Null
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object Drawing.Bitmap $b.Width, $b.Height
[Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
$s = [Math]::Min(1, 2000 / $b.Width)
$out = New-Object Drawing.Bitmap $bmp, ([int]($b.Width * $s)), ([int]($b.Height * $s))
$ms = New-Object IO.MemoryStream
$out.Save($ms, [Drawing.Imaging.ImageFormat]::Jpeg)
[Convert]::ToBase64String($ms.ToArray())`;

async function screenshot() {
  if (process.platform === 'win32') return (await run('powershell', ['-NoProfile', '-Command', SHOT_PS], { maxBuffer: 50e6 })).stdout.trim();
  const f = join(tmpdir(), `adobe-mcp-shot-${Date.now()}.jpg`); // macOS
  await run('screencapture', ['-x', '-t', 'jpg', f]);
  await run('sips', ['-Z', '2000', f]);
  const data = readFileSync(f).toString('base64'); unlinkSync(f);
  return data;
}

server.tool(
  'screenshot',
  'Screenshot of the whole screen: app panels, timelines, error dialogs. For the artwork itself use preview (much sharper).',
  {},
  async () => {
    try { return { content: [{ type: 'image', data: await screenshot(), mimeType: 'image/jpeg' }] }; }
    catch (e) { return fail('Screenshot failed: ' + e.message + (process.platform === 'darwin' ? ' (allow Screen Recording for Claude/terminal in System Settings > Privacy & Security)' : '')); }
  }
);

await server.connect(new StdioServerTransport());
