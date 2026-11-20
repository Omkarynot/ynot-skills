# Y-Not skills

Claude plugins for the Y-Not design team. Each plugin is one folder; today there is one:

| Plugin | What it does |
|---|---|
| `ynot-artwork/` | Builds Y-Not artwork / spec sheets in Illustrator from a mockup PPT + logos (Design SOP): Pantone matching, logo sizes, mockup dimensions, box dielines, QC. Includes the **adobe MCP** that lets Claude drive Illustrator, Photoshop, After Effects, Premiere and Audition. |

## Install on a PC (Windows or Mac)

Needs [Node.js 18+](https://nodejs.org) and Adobe Illustrator. For PPT reading: Python 3 + `pip install python-pptx`.
For Pantone matching: Chrome signed in to connect.pantone.com.

**Claude Code** (terminal, or the Code tab of the Claude desktop app). Type in Claude:
```
/plugin install ynot-artwork --marketplace Omkarynot/ynot-skills
```
(older Claude Code: `/plugin marketplace add Omkarynot/ynot-skills`, then `/plugin install ynot-artwork@ynot-skills`)

Then ask Claude: **"run ynot setup"**. It installs the Adobe extension and also sets up Claude Desktop chat and
Codex if they're on the PC. Restart Illustrator/Photoshop afterwards. That's all.

**Only Claude Desktop chat or Codex, no Claude Code:** download this repo (Code > Download ZIP), unzip, and run
```
node ynot-skills-main/ynot-artwork/setup.mjs
```
then restart Illustrator and the app. For Claude Desktop chat, also upload `~/.ynot/ynot-artwork-spec.zip` in
Settings > Capabilities > Skills.

Check: ask Claude to call the adobe `status` tool; Illustrator should be listed with its version.

## Update
Claude Code: `/plugin` > Marketplaces > ynot-skills > Update (or turn on auto-update there). After an update Claude
reminds you to "run ynot setup" again if the Adobe extension changed. Desktop/Codex: download again and re-run `setup.mjs`.

## For whoever edits the plugin
- Everything for a plugin stays inside its folder. No absolute paths to someone's PC.
- `ynot-artwork/adobe-mcp`: edit `server.mjs` / `prelude.jsx`, then `npm install` once and `npm test` (rebuilds
  `server.bundle.mjs`, the file that ships, and runs the self-test; Illustrator or Photoshop must be open).
- Skill check: `ynot-artwork/skills/ynot-artwork-spec/test/selftest.jsx` (see the skill) must return `ok`.
- `claude plugin validate .` before pushing. Each pushed commit is a new plugin version.
