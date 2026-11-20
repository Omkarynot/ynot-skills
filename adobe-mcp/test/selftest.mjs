// End-to-end check through a real MCP client. Needs the target app open. Usage: node test/selftest.mjs [photoshop|illustrator]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = process.argv[2] || 'photoshop';
const c = new Client({ name: 'selftest', version: '1' });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.mjs', import.meta.url))] }));
const call = async (name, args) => { const r = await c.callTool({ name, arguments: args }); return { ...r, text: r.content.find(x => x.type === 'text')?.text }; };

const st = await call('status', {}); console.log(st.text);
assert.match(st.text, new RegExp(app + ': Adobe'));

let r = await call('run_jsx', { app, code: 'var o = {n: 1 + 1, s: "a\\"b", list: [true, null]}; o' });
assert.deepStrictEqual(JSON.parse(r.text), { n: 2, s: 'a"b', list: [true, null] }); assert(!r.isError);

r = await call('run_jsx', { app, code: 'var a = 1;\nundefinedFn();' });
assert(r.isError); assert.match(r.text, /line 2/); assert.match(r.text, /> undefinedFn\(\);/); console.log(r.text);

const lib = join(tmpdir(), 'mcp_selftest_lib.jsx'), job = join(tmpdir(), 'mcp_selftest_job.jsx');
writeFileSync(lib, 'function twice(x) { return x * 2; }\nfunction boom() {\n  return nope.x;\n}');
writeFileSync(job, 'twice(21)');
r = await call('run_jsx', { app, file: job, include: [lib] }); assert.strictEqual(r.text, '42');
r = await call('run_jsx', { app, code: 'boom()', include: [lib] });
assert.match(r.text, /mcp_selftest_lib\.jsx, line 3/); console.log(r.text);

const newDoc = app === 'illustrator' ? 'app.documents.add();' : 'app.documents.add(100, 100);';
const n0 = Number((await call('run_jsx', { app, code: 'app.documents.length' })).text);
r = await call('run_jsx', { app, code: newDoc + ' throw new Error("fail");', rollbackOnError: true }); assert(r.isError);
assert.strictEqual(Number((await call('run_jsx', { app, code: 'app.documents.length' })).text), n0, 'rollback closed the new doc');

if (n0 > 0) { r = await call('preview', { app }); assert(r.content[0].type === 'image' && r.content[0].data.length > 1000); console.log('preview', r.text); }
console.log('ok');
await c.close();
