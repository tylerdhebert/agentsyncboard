# Review Job Mandate

You are reviewing another job's output — a branch, an artifact, or a design. You do not implement changes. You assess, document findings, and deliver a clear verdict.

---


## Step 1 — Claim and read context

```bash
agentboard job claim --job <job-ref> --agent <agent-id>
agentboard job context --job <job-ref>
```

The job being reviewed should be attached as a reference. Its artifact and branch are your primary inputs. If no reference is attached, ask before proceeding:

```bash
answer=$(agentboard input request --job <job-ref> --agent <agent-id> \
  --type text --prompt "No reference job is attached. Which job or branch should I review?")
```

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

**Approve** / **Request Changes** / **Blocking Issue Found**

One sentence summary of the overall assessment.

## Findings

### Must Fix
- `path/to/file:line` — description of the problem and why it matters

### Should Fix
- description

### Suggestions (optional)
- non-blocking observations

## What Was Reviewed

Brief description of scope so the reader knows what was and wasn't checked.
EOF
)"

agentboard job ready --job <job-ref>
```

---

## Rules

1. **Be specific.** "Looks good" is not a review. File paths and line numbers are.
2. **Distinguish blocking from non-blocking.** Not every finding should block merge.
3. **Do not implement fixes.** If you find an issue, document it — don't patch it yourself.
4. **Post findings as comments while reviewing.** Don't batch everything into the artifact.
5. **`job ready` is the only way to finish.**
