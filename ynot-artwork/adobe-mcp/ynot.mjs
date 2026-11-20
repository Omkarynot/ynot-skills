// Y-Not artwork tools on the adobe MCP, so apps without the skill or a shell (the Claude Desktop chat window, Codex)
// get everything from the MCP alone: the skill text, its helper scripts on disk, and file / PPT / colour helpers.
// Skill folder: ../skills/ynot-artwork-spec next to this server (plugin layout, and ~/.ynot after setup).
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const fwd = p => p.replace(/\\/g, '/');
export const SKILL = [join(HERE, '..', 'skills', 'ynot-artwork-spec')].map(p => resolve(p)).find(p => existsSync(join(p, 'SKILL.md')));
const CACHE = join(homedir(), '.ynot', 'pantone_cache.json'); // shared with scripts/color.py
const home = p => resolve(p.replace(/^~(?=$|[\\/])/, homedir()));
const text = t => ({ content: [{ type: 'text', text: t }] });
const fail = t => ({ content: [{ type: 'text', text: t }], isError: true });

export const INSTRUCTIONS = SKILL && `Y-Not artwork / spec sheets: when the user asks for an artwork, spec sheet, "specs" or PO artwork for a product, or gives a mockup PPT + logos to turn into a production artwork, call artwork_guide first and follow it exactly (skip that call if the ynot-artwork-spec skill is already loaded).`;

// ---- colour maths (same as scripts/color.py: sRGB -> Lab D50, CIEDE2000) ----
export function hexToLab(h) {
  h = h.replace('#', '');
  const lin = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const M = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]];
  const [X, Y, Z] = M.map(r => r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2]);
  const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.96422), fy = f(Y), fz = f(Z / 0.82521);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function de2000([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))), a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const h1p = ((Math.atan2(b1, a1p) * deg) % 360 + 360) % 360, h2p = ((Math.atan2(b2, a2p) * deg) % 360 + 360) % 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dh = h2p - h1p; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh / 2 * rad), Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2, hs = h1p + h2p;
  const hbp = C1p * C2p === 0 ? hs : Math.abs(h1p - h2p) <= 180 ? hs / 2 : hs < 360 ? (hs + 360) / 2 : (hs - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const SL = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * Math.sin(60 * Math.exp(-(((hbp - 275) / 25) ** 2)) * rad);
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
const loadCache = () => { try { return JSON.parse(readFileSync(CACHE, 'utf8')); } catch { return {}; } };

async function python(args) { // first Python 3 that has python-pptx
  const cands = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]];
  for (const [cmd, pre] of cands) {
    try { await promisify(execFile)(cmd, [...pre, '-c', 'import pptx'], { timeout: 20000 }); }
    catch { continue; }
    return (await promisify(execFile)(cmd, [...pre, '-I', ...args], { timeout: 120000, maxBuffer: 20e6 })).stdout;
  }
  throw new Error('Python 3 with python-pptx not found. Install Python 3, then: pip install python-pptx (or ask the user to drop the PPT into the chat).');
}

export function registerYnot(server) {
  if (!SKILL) return;
  server.tool(
    'artwork_guide',
    'Y-Not artwork / spec sheet instructions (the ynot-artwork-spec skill). Call FIRST for any Y-Not artwork, spec sheet or PO artwork request and follow it exactly. part "product-types" returns the per-product reference it tells you to read.',
    { part: z.enum(['skill', 'product-types']).optional() },
    async ({ part }) => {
      if (part === 'product-types') return text(readFileSync(join(SKILL, 'references', 'product-types.md'), 'utf8'));
      const body = readFileSync(join(SKILL, 'SKILL.md'), 'utf8').replace(/^---[\s\S]*?---\s*/, '').split('<skill>').join(fwd(SKILL));
      return text(`Skill folder on this computer: ${fwd(SKILL)} (already filled into every path below).
Without a shell (e.g. the Claude Desktop chat window), use these adobe MCP tools instead of the shell commands in the guide:
files (list the job folder), view_image (look at mockups/photos), read_pptx (scripts/extract_pptx.py), pantone_score
(scripts/color.py: ΔE + cache). Pantone Connect lookups need a browser tool; without one, ask the user to open the
convert link from the guide and paste the Best Match + Lab values. Save the job folder next to the mockup files.

${body}`);
    }
  );

  server.tool(
    'files',
    'List a folder on this computer, e.g. the job folder with the mockup PPT, logos and photos. "~" is the home folder. depth 1 = also list subfolders.',
    { folder: z.string(), depth: z.number().int().min(0).max(2).optional() },
    async ({ folder, depth = 0 }) => {
      const root = home(folder), lines = [];
      const walk = (d, lvl) => {
        for (const n of readdirSync(d).sort()) {
          if (n.startsWith('.')) continue;
          const p = join(d, n); let st; try { st = statSync(p); } catch { continue; }
          lines.push(`${'  '.repeat(lvl)}${n}${st.isDirectory() ? '/' : `  (${Math.round(st.size / 1024)} KB)`}`);
          if (st.isDirectory() && lvl < depth && lines.length < 500) walk(p, lvl + 1);
        }
      };
      try { walk(root, 0); } catch (e) { return fail(`Can't list ${root}: ${e.message}`); }
      return text(`${fwd(root)}\n${lines.join('\n') || '(empty)'}`);
    }
  );

  const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
  server.tool(
    'view_image',
    'Show an image file from this computer (PNG/JPG/GIF/WEBP): mockups, product photos, images extracted from a PPT. For .ai/.svg/.pdf logos, place them in Illustrator and use preview instead.',
    { path: z.string() },
    async ({ path }) => {
      const p = home(path), mime = MIME[extname(p).toLowerCase()];
      if (!mime) return fail('Only PNG/JPG/GIF/WEBP. For vectors, place the file in Illustrator and call preview.');
      let buf; try { buf = readFileSync(p); } catch (e) { return fail(`Can't read ${p}: ${e.message}`); }
      if (buf.length > 8e6) return fail('Image over 8 MB: place it in Illustrator and use preview with a region instead.');
      return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: mime }, { type: 'text', text: fwd(p) }] };
    }
  );

  server.tool(
    'read_pptx',
    'Extract a mockup .pptx on this computer: slide text, tables and notes (returned) and every image (saved to outDir/media, view them with view_image). Needs Python 3 + python-pptx on the computer.',
    { path: z.string(), outDir: z.string().describe('Job folder, e.g. next to the PPT: <OPP>_work') },
    async ({ path, outDir }) => {
      try { mkdirSync(home(outDir), { recursive: true }); return text(await python([join(SKILL, 'scripts', 'extract_pptx.py'), home(path), home(outDir)])); }
      catch (e) { return fail(e.message); }
    }
  );

  server.tool(
    'pantone_score',
    `Pantone matching helper (scripts/color.py). With hex only: cached Pantone Connect result for that exact hex, or "miss".
With hex + lab (the Pantone Lab from Pantone Connect): ΔE00 between them (under 2 fine, 2-3 tell the user, over 3 flag it).
Add code (e.g. "1795 C") to also save it to the shared cache. Never invent Lab values: they come from Pantone Connect.`,
    { hex: z.string().regex(/^#?[0-9a-fA-F]{6}$/), lab: z.array(z.number()).length(3).optional(), code: z.string().optional() },
    async ({ hex, lab, code }) => {
      const H = hex.replace('#', '').toUpperCase(), mine = hexToLab(H).map(v => Math.round(v * 100) / 100);
      if (!lab) { const hit = loadCache()[H]; return text(hit ? JSON.stringify(hit) : `miss (logo Lab D50: ${mine.join(', ')})`); }
      const dE = Math.round(de2000(hexToLab(H), lab) * 100) / 100;
      if (code) { const c = loadCache(); c[H] = { code, lab, dE00: dE }; mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(c, null, 0)); }
      return text(JSON.stringify({ hex: '#' + H, logoLab: mine, pantoneLab: lab, dE00: dE, saved: !!code }));
    }
  );
}
