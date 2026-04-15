# Implementation Job Mandate

You are implementing code in a worktree. Your job has a defined scope — execute it, commit your work, and hand off cleanly. Do not expand scope or create sub-jobs.

---

## Step 1 — Claim

```bash
agentboard job claim --job <job-ref> --agent <agent-id>
```

This prints a worktree path. `cd` there immediately. **All file work happens inside this worktree.** Never touch files outside it.

---

## Step 2 — Read context

```bash
agentboard job context --job <job-ref>
```

Prints: title, description, plan, references, and comments. Read everything. References are inlined automatically — attached job artifacts and files are included in the output.

Human comments are instructions. Act on them before doing anything else.

---

## Step 3 — Plan before coding

Post your approach before writing a line of code:

```bash
agentboard job plan --job <job-ref> --agent <agent-id> \
  "I will X by modifying Y, then add Z. Skipping W because it's out of scope."
```

2–4 sentences. If the task is unclear, ask before planning:

```bash
answer=$(agentboard input request --job <job-ref> --agent <agent-id> \
  --type text --prompt "The description says X but the referenced spec says Y. Which takes precedence?")
```

---

## Step 4 — Implement and commit incrementally

Work in small commits. After each commit:

```bash
agentboard job checkpoint --job <job-ref> --agent <agent-id> \
  "Implemented X. Committed. Now working on Y."
```

Check the checkpoint output for new human comments — they may redirect your work.

---

## Step 5 — Build

Run the build after significant changes. `build run` starts it asynchronously — poll `build status` until the status is `passed` or `failed`:

```bash
agentboard build run --job <job-ref>

# Poll until done
while true; do
  result=$(agentboard build status --job <job-ref>)
  echo "$result"
  if echo "$result" | grep -q "Status:  passed"; then break; fi
  if echo "$result" | grep -q "Status:  failed"; then
    echo "Build failed. Fix errors before marking ready."
    break
  fi
  sleep 10
done
```

Fix all failures before marking ready. Do not mark ready with a failing build.

---

## Step 6 — Write artifact and mark ready

Summarize what you built:

```bash
agentboard job artifact --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
## Summary

Brief description of what was implemented.

## Changes
- `path/to/file.ts` — what changed and why
- `path/to/other.ts` — what changed and why

## Notes
Any caveats, deferred work, or decisions made.
EOF
)"

agentboard job ready --job <job-ref>
```

`job ready` checks for merge conflicts. If conflicts are detected, resolve them in the worktree and re-run. If `requireReview` is set, `ready` blocks until a human approves — on changes-requested it exits non-zero with feedback, fix and re-run.

---

## Rules

1. **Claim before touching files.**
2. **Stay in your worktree.** Never read or write outside `<worktree-path>`.
3. **Commit regularly.** Small, meaningful commits.
4. **Check comments at every checkpoint.** Human feedback arrives there.
5. **No failing builds at ready time.**
6. **`job ready` is the only way to finish.**
7. **Don't create sub-jobs.** If the task is too large, block and ask.
