// Y-Not tools on the adobe MCP; no Adobe app needed. Usage: node test/ynot-tools.mjs [path/to/server.bundle.mjs]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { hexToLab, de2000 } from '../ynot.mjs';

assert(Math.abs(de2000(hexToLab('FFC72C'), [84.11, 12.65, 77.81]) - 0.91) < 0.01, 'same dE as color.py');
assert(Math.abs(de2000([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-3, 'Sharma pair 1');

const server = process.argv[2] || fileURLToPath(new URL('../server.bundle.mjs', import.meta.url));
const c = new Client({ name: 'ynot-test', version: '1' });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
assert.match(c.getInstructions() || '', /artwork_guide/, 'server instructions point at artwork_guide');
const names = (await c.listTools()).tools.map(t => t.name);
for (const n of ['run_jsx', 'preview', 'status', 'artwork_guide', 'files', 'view_image', 'read_pptx', 'pantone_score']) assert(names.includes(n), n);
const call = async (name, args) => (await c.callTool({ name, arguments: args })).content;
const guide = (await call('artwork_guide', {}))[0].text;
assert.match(guide, /Skill folder on this computer: .+ynot-artwork-spec/); assert(!guide.includes('<skill>'), 'paths filled in');
assert.match((await call('artwork_guide', { part: 'product-types' }))[0].text, /tuck/i);
assert.match((await call('files', { folder: fileURLToPath(new URL('..', import.meta.url)) }))[0].text, /server\.mjs/);
const s = JSON.parse((await call('pantone_score', { hex: '#FFC72C', lab: [84.11, 12.65, 77.81] }))[0].text);
assert(Math.abs(s.dE00 - 0.91) < 0.01 && s.saved === false);
console.log('ok', server);
await c.close();
