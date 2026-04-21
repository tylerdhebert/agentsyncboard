> **PowerShell:** Use `--from-file` for any content longer than a single short line — comments included. Write temp files with `Out-File -Encoding utf8NoBOM` to avoid encoding issues. Actual newlines in the file are preserved; `\n` escape sequences are not rendered.

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

Prints: title, description, plan, references, and comments. Read everything. Referenced jobs show their handoff summary by default — if you need the full artifact of a referenced job, run `agentboard job artifact --job <ref-job>` directly.

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

Use `job scratch` for working notes that don't belong in the official checkpoint trail — dead ends, things to revisit, context you want to preserve across restarts.

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
## What was built

One section per logical piece of work. Lead each section with a plain-English sentence describing what the feature or change *does* from a user or system perspective — not what files changed. Follow with the relevant file paths.

Example:
**Reveal on click** — when the user clicks a job in the needs-attention popover, the sidebar expands all ancestor jobs and folders and scrolls that job into view.
- `client/src/components/JobTree.tsx` — useEffect watches revealJobId, uncollapses ancestors, scrolls after render
- `client/src/store/index.ts` — added revealJobId/setRevealJobId

## Notes
Caveats, deferred work, or decisions worth flagging.
EOF
)"

```

Then write a compact handoff summary before marking ready:

```bash
agentboard job handoff --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
- built: <what was implemented and what it does — include the user-facing or system-level effect, not just the file names>
- decision: <any significant choice made during impl that wasn't in the plan, and why — omit if nothing notable>
- caveat: <anything a reviewer should know going in: shortcuts taken, assumptions that held, known rough edges — omit if none>
EOF
)"

agentboard job ready --job <job-ref>
```

`job ready` checks for merge conflicts. If conflicts are detected, resolve them in the worktree and re-run. If `requireReview` is set, `ready` blocks until the human either leaves an `LGTM` or requests changes.

If your session is interrupted while waiting (connection drop, tool timeout, etc.), reattach with:
```bash
agentboard job wait --job <job-ref>
```
This resumes waiting from wherever review stands — safe to run even if review already completed.

For impl jobs, human `LGTM` is **not** terminal. It records signoff, ends your turn, and can leave the job in `in-review` while downstream child review work happens. An accepted review outcome can then either move the job forward toward merge or send it back to `in-progress`. Only merge makes an impl job `done`.

---

## Step 7 — Address reviewer feedback (if any)

If a review pass requests changes, that review work belongs to a review job parented under this impl job. The orchestrator or human may summarize the findings here, and you may be re-assigned to this job after it returns to `in-progress`.

If an accepted child review passes with an `Approve` verdict, this impl job moves forward toward merge without more action from you. If the accepted review verdict requests changes, this impl job moves back to `in-progress`.

**Do not create a new job.** Fix the issues in the same worktree, on the same branch:

```bash
# Read latest context and comments
agentboard job context --job <job-ref>
```

Use `job scratch` to log your progress across review cycles so context isn't lost:
```bash
agentboard job scratch --job <job-ref> --agent <agent-id> \
  "Review cycle 2: addressed X and Y. Still investigating Z."
```

```bash
# Fix, commit, checkpoint
agentboard job checkpoint --job <job-ref> --agent <agent-id> \
  "Addressed review findings: fixed X and Y."

# Update artifact and handoff summary, then mark ready again
agentboard job artifact --job <job-ref> --agent <agent-id> "..."
agentboard job handoff --job <job-ref> --agent <agent-id> "..."
agentboard job ready --job <job-ref>
```

The job and branch are reused across as many review/fix cycles as needed. Child review jobs may come and go underneath this impl job, but the impl job remains the canonical unit of implementation work. This is by design.

---

## Code style

Write code that trusts its context. Defensive patterns add noise without value:

- **No guards for things already guaranteed.** If the type system or surrounding logic makes a state impossible, don't check for it. `if (!user) return` when `user` is always set is dead weight.
- **No try/catch unless the plan explicitly calls for it.** If error handling isn't in scope, don't add it. Wrapping code in try/catch silently buries failures that should surface loudly.
- **Inline types for one-off shapes.** If a type is only used in one place, write it inline — don't create a named export for it.
- **No type assertion helpers.** Avoid `assertIsString(x)`, `isNumericType(val: unknown)`, and similar wrappers. Use type assertions directly (`x as Foo`) when needed, or restructure so they aren't needed. Reserve runtime validation for true external boundaries: API responses, user input, CLI args.
- **Null coalescing and optional chaining are fine.** `x?.y ?? z` is idiomatic — not a sign of missing validation.
- **No abstraction layers unless the plan calls for them.** Don't introduce interfaces, wrapper classes, or indirection because it feels cleaner. If the repo already has a pattern (e.g. a repository layer), follow it — but don't extend it beyond what the task requires.

**If the codebase is C#, also avoid:**
- Validating values the framework or ORM already guarantees — `ArgumentNullException.ThrowIfNull` and guard clauses belong at public API surfaces, not internal methods
- Defensive LINQ — `.Where(x => x != null)` on collections that can't contain nulls, or `.ToList()` everywhere to "avoid multiple enumeration" on things that are already materialized

---

## Rules

1. **Claim before touching files.**
2. **Stay in your worktree.** Never read or write outside `<worktree-path>`.
3. **Commit regularly.** Small, meaningful commits.
4. **Check comments at every checkpoint.** Human feedback arrives there.
5. **No failing builds at ready time.**
6. **`job ready` is the only way to hand off your turn.**
7. **Reattach when waiting on review.** If your CLI times out when waiting for human review, you are required to reattach to resume waiting. Your job is not done until the user completes the review. The user may request changes that require you to revisit your work.
8. **Don't create sub-jobs or new jobs.** If the task is too large, block and ask. If review requests changes, fix in this job.
