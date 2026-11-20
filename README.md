# Y-Not skills

Private. Claude skills and MCP servers for the Y-Not design team. **Each skill or MCP lives in its own folder.**
Change only the folder you are working on, and commit it on its own.

| Folder | What it is |
|---|---|
| `adobe-mcp/` | MCP server + Adobe "MCP Bridge" extension. Lets Claude run scripts in Illustrator, Photoshop, After Effects, Premiere and Audition, and preview the artwork. |
| `ynot-artwork-spec/` | Skill: builds a Y-Not artwork / spec sheet in Illustrator from a mockup PPT + logos (Design SOP). Needs `adobe-mcp`. |

## Install (Windows or Mac)

Needs: [Node.js 18+](https://nodejs.org), Git, Adobe Illustrator (and/or Photoshop), Python 3 with `pip install python-pptx`,
and Chrome signed in to connect.pantone.com for Pantone matching.

```sh
git clone https://github.com/Omkarynot/ynot-skills.git
cd ynot-skills
node install.mjs
```

The installer links the skills into `~/.claude/skills` (and `~/.codex/skills`), links the Bridge extension into Adobe's
CEP folder, allows unsigned CEP extensions, and registers the `adobe` MCP with Claude Code, Claude Desktop and Codex.
Anything it replaces is moved or copied to `~/.ynot-skills-backup` first. Then **restart Illustrator/Photoshop and Claude**.

- Mac: allow Screen Recording for Claude/Terminal (System Settings > Privacy & Security) for the `screenshot` tool.
- Claude Desktop chat app: skills are uploaded there separately: zip the skill folder and add it in Settings > Capabilities.
- Check it works: in Claude, ask it to call the adobe `status` tool; Illustrator should be listed with its version.

## Update

```sh
git pull
```
Everything is linked, so that's all (restart Claude if a skill changed; restart the Adobe app if `adobe-mcp/extension` changed).

## Adding a new skill or MCP
1. New folder at the top level, e.g. `ynot-hang-tag/` with a `SKILL.md` (skills) or its own `package.json` (MCPs).
2. Keep everything it needs inside that folder. No absolute paths to someone's PC: use the skill's base directory.
3. Run `node install.mjs` again to link it, test it, then commit just that folder.

Confidential: the SOP rules and `ynot-artwork-spec/references/` come from internal Y-Not artworks. Keep this repo private.
