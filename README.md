# Y-Not skills

Claude plugins for the Y-Not design team. Each plugin is one folder; today there is one:

| Plugin | What it does |
|---|---|
| `ynot-artwork/` | Builds Y-Not artwork / spec sheets in Illustrator from a mockup PPT + logos (Design SOP): Pantone matching, logo sizes, mockup dimensions, box dielines, QC. Includes the **adobe MCP** that lets Claude drive Illustrator, Photoshop, After Effects, Premiere and Audition. |

## Install (Windows or Mac, 2 minutes)

Open the Claude desktop app, click the **Code** tab (the chat window can't install software), paste this and answer its
questions. Codex or Claude Code in a terminal work too:

> Install the Y-Not artwork tools by following https://github.com/Omkarynot/ynot-skills/blob/main/INSTALL.md

The agent installs Node.js if needed, the plugin, the Adobe extension, and the Claude Desktop / Codex setup.
Then quit and reopen Illustrator. Manual steps are in [INSTALL.md](INSTALL.md).

Already have Claude Code? `/plugin install ynot-artwork --marketplace Omkarynot/ynot-skills` is enough: the plugin
finishes its own setup at the next session start and tells you what to restart.

## Update
Claude Code: `/plugin` > Marketplaces > ynot-skills > Update (or turn on auto-update there); setup re-runs by itself.
Codex / Claude Desktop: paste the install sentence again.

## For whoever edits the plugin
- Everything for a plugin stays inside its folder. No absolute paths to someone's PC.
- `ynot-artwork/adobe-mcp`: edit `server.mjs` / `prelude.jsx`, then `npm install` once and `npm test` (rebuilds
  `server.bundle.mjs`, the file that ships, and runs the self-test; Illustrator or Photoshop must be open).
- Skill check: `ynot-artwork/skills/ynot-artwork-spec/test/selftest.jsx` (see the skill) must return `ok`.
- `claude plugin validate .` before pushing. Each pushed commit is a new plugin version.
