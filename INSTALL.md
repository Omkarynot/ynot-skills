# Install the Y-Not artwork tools

**For people:** open the Claude desktop app, click the **Code** tab (not the chat), paste this and answer its questions.
Codex or Claude Code in a terminal work too.

> Install the Y-Not artwork tools by following https://github.com/Omkarynot/ynot-skills/blob/main/INSTALL.md

---

## For the AI agent doing the install

**First: can you run terminal commands on the user's computer?** If you can't (for example you are the Claude
Desktop *chat* window, or claude.ai in a browser), don't try the steps below. Tell the user, in plain words:
"I can't install things from this chat window. In this same Claude app, click the **Code** tab at the top, choose a
folder (any folder, e.g. Documents), and paste the same sentence there. It will install everything, and afterwards this chat
window can make artworks too." Then stop.

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

   It installs the Adobe extension, enables it, and registers the adobe MCP for Claude Desktop and Codex. The MCP
   carries the artwork skill itself (`artwork_guide` tool), so no skill upload is needed anywhere.
   With the plugin installed it leaves Claude Code to the plugin (nothing shows twice). Backups go to `~/.ynot-skills-backup`.
4. **Python for PPT reading** (optional, needed to read mockup .pptx files): macOS `python3 -m pip install --user python-pptx`,
   Windows `py -m pip install --user python-pptx` (install Python 3 from python.org first if missing, after asking).
5. **Tell the user** (plain words, as a short list):
   - Quit and reopen Illustrator and Photoshop (macOS: Cmd+Q, not just closing the window).
   - Restart Claude Desktop / Codex / Claude Code if they use them.
   - macOS: if asked, allow Screen Recording for Claude (System Settings > Privacy & Security), used for screenshots.
   - For Pantone matching, sign in to https://connect.pantone.com in Chrome with the company account.
6. **Check** after the restart: call the adobe MCP `status` tool. Illustrator should show its version. If it says
   "not running" while Illustrator is open, run step 3 again and restart Illustrator once more.

**Updates:** Claude Code updates the plugin from `/plugin` (and re-runs setup by itself at the next session start).
Codex / Desktop: run step 3 again.
