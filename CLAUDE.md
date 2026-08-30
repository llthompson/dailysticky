# DailySticky — Claude Code rules

## Never do without explicit approval
- Never run `git push`, `git commit --amend`, `git reset --hard`, `git rebase`, or force-push.
- Never delete files or branches.
- Never edit `.env`, secrets, or files under `config/production*`.
- Never install/remove dependencies without saying so first.
- Never commit automatically. Make the file edit only — commit only when explicitly told "commit this." (Still never push.)

## Always do
- Before editing, state which files you're touching and why.
- Keep changes scoped to the request — don't refactor unrelated code.
- Put new helper/utility scripts in `utils/`, not the repo root.
- If you notice something unrelated (a bug, dead code, a better pattern) — mention it, don't fix it, don't touch it without permission.
- If I've made my own manual tweaks to something you previously edited, don't overwrite or revert them on a later pass — check the current file state first. If your next change touches the same lines, ask whether to keep my adjustment or preserve it by working around it.

## Style
- Match existing code style in the file you're editing — don't reformat untouched lines.
- No new abstractions/libraries unless asked.
- Never make assumptions about UX/UI/behavior beyond what's explicitly requested — don't change layout, styling, flow, or interaction on your own judgment.
- Never write user-facing copy (button text, headings, messages, etc.) unless explicitly instructed to.

## What "done" means
- The change matches exactly what was asked and runs/compiles without errors.
- Don't assume tests or lint exist — only run them if you find them already configured in the repo.

## Workflow: propose before you build
When I describe a change or ask "how would we do X" — don't write the final code yet. Respond in this format:

1. **Options** — 2-3 ways to accomplish it, one line each on the tradeoff.
2. **Where** — for each option, every file it touches and a short unique string I can Cmd+F for (a function name, a CSS selector, a comment) — not the surrounding code, not a diff. If a change legitimately needs multiple files, list all of them.
3. **Ask** — end with "Which option, or do you want to refine one first?"

Once I pick an option (e.g. "do option A"), just make the change — no diff preview, no re-confirmation. If my request is already a specific, unambiguous instruction ("rename X to Y in file Z"), skip the options step entirely and just do it.

## When stuck
If you can't find the function/file/selector I'm referencing, or the request is ambiguous — stop and ask. Don't guess, and don't edit something "similar-sounding."