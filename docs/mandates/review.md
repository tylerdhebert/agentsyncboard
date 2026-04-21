> **PowerShell:** Use `--from-file` for any content longer than a single short line — comments included. Write temp files with `Out-File -Encoding utf8NoBOM` to avoid encoding issues. Actual newlines in the file are preserved; `\n` escape sequences are not rendered.

# Review Job Mandate

You are reviewing another job's output — a branch, an artifact, or a design. You do not implement changes. You assess, document findings, and deliver a clear verdict.

---

## Step 1 — Claim, read context, and navigate

```bash
agentboard job claim --job <job-ref> --agent <agent-id>
agentboard job context --job <job-ref>
```

Review jobs are children of the job they are reviewing. For impl reviews, your parent job should be the impl job under review, and that impl job should also be attached as a reference.

The subject of the review will be in the references. If no reference is attached, ask before proceeding:

```bash
answer=$(agentboard input request --job <job-ref> --agent <agent-id> \
  --type text --prompt "No reference job is attached. Which job or branch should I review?")
```

If the referenced job is an impl job, get its worktree path and `cd` there:

```bash
agentboard job worktree --job <impl-job-ref>
# cd <path printed above>
```

The impl job owns the branch and worktree. Your review job does not.

---

## Step 2 — Review systematically

Work through the subject matter methodically. Post a comment for each significant finding as you go — don't save them all for the end:

```bash
agentboard job comment --job <job-ref> --agent <agent-id> \
  "Finding: path/to/file.ts:88 — the error case returns null but callers expect an empty array. Could cause a crash downstream."
```

Review dimensions to consider (adapt to the job type being reviewed):

- **Correctness** — does it do what was asked?
- **Completeness** — are there missing cases, edge conditions, or gaps in the spec?
- **Consistency** — does it match the existing codebase conventions and patterns?
- **Risk** — what could go wrong, and how bad would it be?
- **Scope** — did it stay within the defined task, or did it drift?

---

## Step 3 — Write verdict and mark ready

```bash
agentboard job artifact --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
## Verdict

**Approve** / **Request Changes**

One sentence overall assessment.

## What was flagged and why

One section per meaningful finding. Lead with what the problem *means* in practice — not just where the code is. Follow with the location.

### Must Fix

Example:
**Null return in error path** — when the fetch helper fails it returns null, but every caller expects an empty array. Any page that hits this error path will crash instead of showing an empty state.
- `client/src/api/client.ts:88`

### Should Fix

Example:
**Missing loading state** — the button stays enabled while the request is in flight, so the user can submit twice. Low risk but worth a fix before ship.
- `client/src/components/Form.tsx:34`

### Suggestions (optional)
Non-blocking observations.

## What Was Reviewed

Brief description of scope so the reader knows what wasn't checked.
EOF
)"

```

Then write a compact handoff summary before marking ready:

```bash
agentboard job handoff --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
- verdict: APPROVE / REQUEST CHANGES
- blocking: <if requesting changes: what specifically must be fixed and why it matters — enough for the impl agent to act without reading the full artifact>
- concern: <a should-fix or notable observation worth flagging even on approve — omit if none>
- scope: <what was and wasn't checked, so the orchestrator knows if anything was skipped>
EOF
)"

agentboard job ready --job <job-ref>
```

If `requireReview` is set on this review job, `ready` blocks until the human approves or requests changes. If your session is interrupted while waiting, reattach with:
```bash
agentboard job wait --job <job-ref>
```

Your artifact must contain an explicit verdict of `Approve` or `Request Changes`. The system uses that accepted review verdict to either move the parent impl job forward toward merge or send it back to `in-progress`.

If `requireReview` is set on the review job, your work is not accepted until the human leaves `LGTM` on the review job.

---

## Rules

1. **Be specific.** "Looks good" is not a review. File paths and line numbers are.
2. **Distinguish blocking from non-blocking.** Not every finding should block merge.
3. **Do not implement fixes.** If you find an issue, document it — don't patch it yourself.
4. **Post findings as comments while reviewing.** Don't batch everything into the artifact.
5. **`job ready` is the only way to hand off your review.**
6. **Reattach when waiting on review.** If your CLI times out when waiting for human review, you are required to reattach to resume waiting. Your job is not done until the user completes the review. The user may request changes that require you to revisit your work.