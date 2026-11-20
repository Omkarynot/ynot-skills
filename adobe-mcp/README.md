# adobe-mcp

MCP server (`server.mjs`) + CEP extension (`extension/`, "MCP Bridge"). The extension starts hidden with each Adobe app
and listens on 127.0.0.1 only: Photoshop 8701, Illustrator 8702, After Effects 8703, Premiere 8704, Audition 8705.
It refuses browser requests (Origin header / no `x-adobe-mcp` header), so web pages can't drive your apps.

## Tools
- `run_jsx {app, code | file, include?, rollbackOnError?}`: run ExtendScript. Objects come back as JSON; errors give file, line and source line;
  `include` preloads libraries; `rollbackOnError` closes documents the failed script created. Alerts are off while a script runs.
- `preview {app: illustrator|photoshop, region?, artboard?, scale?}`: sharp PNG of the document (Illustrator region in inches).
- `status`: which apps are running, versions, open documents.
- `screenshot`: whole screen (Windows and macOS).

`prelude.jsx` is sent in front of every script (JSON polyfill, error formatting, rollback, alert suppression). ES3 only.

## Test
With Photoshop or Illustrator open (a document open in it for the preview check):
```sh
node test/selftest.mjs photoshop      # or illustrator
node test/call.mjs status             # call any tool by hand
```
After changing `extension/`, restart the Adobe app. After changing `server.mjs`/`prelude.jsx`, restart Claude.
