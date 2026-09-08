## Writing

**No em dashes or en dashes (`—` `–`) in user-facing copy.** UI strings, button
labels, empty states, marketing and landing text, legal pages. Recast the
sentence so it reads correctly without one (a period, comma, colon, semicolon,
or parentheses), do not just swap the character, and check the grammar of the
result. A `PostToolUse` hook (`.claude/hooks/no-em-dash.sh`) blocks any commit
of a non-comment em/en dash under `packages/*/src`; comments are exempt.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
