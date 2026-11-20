// Call one tool of the server, for development: node test/call.mjs run_jsx '{"app":"illustrator","code":"1+1"}'
// Images are saved to the path in env PNG_OUT (default ./call-out.png).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const c = new Client({ name: 'call', version: '1' });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server.bundle.mjs', import.meta.url))] }));
const r = await c.callTool({ name: process.argv[2], arguments: JSON.parse(process.argv[3] || '{}') }, undefined, { timeout: 600000 });
for (const x of r.content) x.type === 'image' ? (writeFileSync(process.env.PNG_OUT || 'call-out.png', Buffer.from(x.data, 'base64')), console.log('[image saved]')) : console.log(x.text);
await c.close(); process.exit(r.isError ? 1 : 0);
