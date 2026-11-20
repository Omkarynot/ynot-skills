# Install the Y-Not artwork tools

**For people:** open Claude Code, Codex, or the Claude desktop app (Code tab), paste this, and answer its questions:

> Install the Y-Not artwork tools by following https://github.com/Omkarynot/ynot-skills/blob/main/INSTALL.md

---

## For the AI agent doing the install

Works on macOS and Windows. Explain each step to the user in one plain sentence, ask before installing software,
and never ask for passwords (if a step needs one, the user types it themselves).

1. **Node.js 18+.** Run `node -v`. If it's missing or older than 18, ask the user, then install the LTS version:
   macOS `brew install node` (if Homebrew exists), Windows `winget install OpenJS.NodeJS.LTS`; otherwise send the
   user to https://nodejs.org (LTS installer) and wait. Open a new terminal afterwards so `node` is on PATH.
2. **Claude Code plugin** (only if the `claude` command exists):
   `claude plugin install ynot-artwork --marketplace Omkarynot/ynot-skills`
   (older Claude Code: `claude plugin marketplace add Omkarynot/ynot-skills` then `claude plugin install ynot-artwork@ynot-skills`).
3. **Setup** (all apps). Download the repo and run its setup now:
   - macOS: `mkdir -p ~/.ynot && cd ~/.ynot && curl -fsSL -o src.zip https://github.com/Omkarynot/ynot-skills/archive/refs/heads/main.zip && rm -rf src && unzip -q src.zip && mv ynot-skills-main src && node src/ynot-artwork/setup.mjs`
   - Windows (PowerShell): `mkdir -Force $HOME\.ynot | Out-Null; cd $HOME\.ynot; curl.exe -fsSL -o src.zip https://github.com/Omkarynot/ynot-skills/archive/refs/heads/main.zip; if (Test-Path src) { Remove-Item -Recurse -Force src }; tar -xf src.zip; Rename-Item ynot-skills-main src; node src\ynot-artwork\setup.mjs`

   It installs the Adobe extension, enables it, and registers the adobe MCP + skill for Claude Desktop and Codex.
   With the plugin installed it leaves Claude Code to the plugin (nothing shows twice). Backups go to `~/.ynot-skills-backup`.
4. **Python for PPT reading** (optional, needed to read mockup .pptx files): macOS `python3 -m pip install --user python-pptx`,
   Windows `py -m pip install --user python-pptx` (install Python 3 from python.org first if missing, after asking).
5. **Tell the user** (plain words, as a short list):
   - Quit and reopen Illustrator and Photoshop (macOS: Cmd+Q, not just closing the window).
   - Restart Claude Desktop / Codex / Claude Code if they use them.
   - Claude Desktop chat window only: upload `~/.ynot/ynot-artwork-spec.zip` in Settings > Capabilities > Skills (one time).
   - macOS: if asked, allow Screen Recording for Claude (System Settings > Privacy & Security), used for screenshots.
   - For Pantone matching, sign in to https://connect.pantone.com in Chrome with the company account.
6. **Check** after the restart: call the adobe MCP `status` tool. Illustrator should show its version. If it says
   "not running" while Illustrator is open, run step 3 again and restart Illustrator once more.

**Updates:** Claude Code updates the plugin from `/plugin` (and re-runs setup by itself at the next session start).
Codex / Desktop: run step 3 again.
