---
name: ynot-setup
description: One-time (and after-update) setup of the Y-Not artwork plugin on this PC - installs the Adobe MCP Bridge extension into Illustrator/Photoshop and registers the adobe MCP + artwork skill for Claude Desktop and Codex. Use when the user says set up / install / update ynot, when the adobe MCP status shows apps "not running" although they are open, or when a session-start message says the Bridge is missing or outdated.
---

# Y-Not setup

Normally nothing to do: the plugin runs this setup by itself at session start (first session, and after updates) and
prints one line saying what to restart. Use this skill when that line said it failed, or the user asks.

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/setup.mjs"` and show the user its output.
   It copies the Adobe extension into the CEP extensions folder, enables unsigned CEP extensions (PlayerDebugMode),
   copies the adobe MCP to `~/.ynot/adobe-mcp` and registers it for Claude Desktop and Codex, copies the artwork skill
   to `~/.codex/skills`, and writes `~/.ynot/ynot-artwork-spec.zip` for the Claude Desktop chat app.
   Anything it replaces is backed up to `~/.ynot-skills-backup` first.
2. Tell the user to restart Illustrator / Photoshop (the extension loads at app start) and Claude Desktop / Codex if they use them.
3. Claude Desktop chat only: upload `~/.ynot/ynot-artwork-spec.zip` in Settings > Capabilities > Skills (Claude can't do this step).
4. Check: after the restart, call the adobe MCP `status` tool; the open Adobe apps must show their version.

If `node` is missing, the user must install Node.js 18+ from nodejs.org first. On a Mac, the `screenshot` tool also needs
Screen Recording permission for Claude (System Settings > Privacy & Security).
