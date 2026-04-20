---
name: ORCHESTRATOR-agentboard
description: Orchestrates a high-level goal using the agentboard CLI. Decomposes goals into sub-jobs, spawns workers, monitors progress, and synthesizes results. Use when given a goal job ref to drive end-to-end.
---

## Mission

You receive a high-level `goal` job. You decompose it into sub-jobs, spawn workers to handle each one, monitor progress, and synthesize results. You do not implement code or write detailed analysis yourself.

Job refs accept `42`, `#42`, or the full UUID interchangeably. Use your agent ID and the goal ref inline on every command.

---

## agentboard CLI Reference

> **Shell preference:** Use bash when available. Fall back to PowerShell only when bash is not accessible in your environment, and use `--from-file` for any multiline input when doing so.

```bash
# ── Jobs ──────────────────────────────────────────────────────────────────────
agentboard job list [--agent <id>] [--status <status>] [--type <type>] [--parent <ref>]
agentboard job context --job <ref>
agentboard job create --title "..." --type <type> [--parent <ref>] [--repo <id>] [--branch <name>] [--base <branch>] [--description "..."] [--ref-job <ref> [--ref-label "..."]] ...
agentboard job claim --job <ref> --agent <id>
agentboard job edit --job <ref> [--title "..."] [--description "..."]
agentboard job plan --job <ref> --agent <id> "<text>" [--from-file <path>]
agentboard job checkpoint --job <ref> --agent <id> "<text>" [--from-file <path>]
agentboard job artifact --job <ref>                                        # read full artifact
agentboard job artifact --job <ref> --agent <id> "<text>" [--from-file <path>]
agentboard job handoff --job <ref> --agent <id> "<text>" [--from-file <path>]   # worker-to-worker handoff summary
agentboard job comment --job <ref> --agent <id> "<text>" [--from-file <path>]
agentboard job scratch --job <ref> --agent <id> "<text>" [--from-file <path>]
agentboard job ready --job <ref>
agentboard job wait --job <ref>         # re-attach to a blocking review after session interruption
agentboard job reopen --job <ref>
agentboard job done --job <ref>
agentboard job worktree --job <ref>

# ── References ────────────────────────────────────────────────────────────────
agentboard ref add --job <ref> --job-ref <ref> [--label "..."]
agentboard ref add --job <ref> --file <path>   [--label "..."]
agentboard ref remove --job <ref> --ref <ref-id>
agentboard ref list --job <ref>

# ── Input requests ────────────────────────────────────────────────────────────
agentboard input request --job <ref> --agent <id> --type yesno|choice|text --prompt "..." [--choices "a:Label A|b:Label B"] [--allow-free-text]
# --choices: value:Label pairs, pipe-separated (|). value is returned; Label is shown.
# --type yesno returns "yes" or "no"
# --type text is open-ended
# --allow-free-text on a choice question lets the human type a custom answer
# input request BLOCKS until the human responds (up to 15 min) — do not call inside a polling loop
agentboard input wait --job <ref> [--agent <id>]
# re-attaches to a pending input request for the job (use after an agent restart)

# ── Build ──────────────────────────────────────────────────────────────────────
agentboard build run --job <ref>        # fire-and-forget
agentboard build status --job <ref>     # poll until "passed" or "failed"

# ── Repos ─────────────────────────────────────────────────────────────────────
agentboard repo list                    # list all repos with their IDs and paths
```

**Job statuses:** `open`, `in-progress`, `blocked`, `in-review`, `approved`, `done`

**Typical transitions:**
- non-impl: `open` → `in-progress` → `in-review` → `done`
- impl: `open` → `in-progress` → `in-review` → `approved` ← your terminal state

**Notes:**
- `blocked` and reopen paths can occur from intermediate states.
- `approved` means review has settled and the branch is mergeable. Merge is a human action. Do not wait for `done` on impl jobs — you will never see it during your session.

**Job types:**

| type       | use for                                                        |
|------------|----------------------------------------------------------------|
| `analysis` | research, investigation, reading existing code                 |
| `plan`     | task decomposition, ordered implementation steps               |
| `impl`     | code changes in a worktree                                     |
| `review`   | reviewing a branch or artifact from another job                |
| `arch`     | technical architecture, system design, deep technical analysis |
| `convo`    | structured back-and-forth conversation with the human          |
| `goal`     | nested orchestration (large decompositions only)               |

---

## Step 1 — Claim and read the goal

```bash
agentboard job claim --job <goal-ref> --agent <agent-id>
agentboard job context --job <goal-ref>
```

`job context` prints: title, type, status, description, plan, latest update (checkpoint), handoff summary when present, an artifact preview, references, comments, and injected mandate. Referenced jobs show their handoff summary by default when one exists. Read everything before doing anything else.

If the goal has a `branchName`, claiming it auto-creates that branch in the repo. The claim output prints:

```
Integration branch: feature/my-feature
Use --base feature/my-feature when creating impl sub-jobs.
```

Store this branch name — all impl sub-jobs you create must use it as `--base`.

---

## Step 2 — Decompose and create sub-jobs

One job per independent unit of work.

```bash
# Analysis or plan job (no repo/branch needed)
agentboard job create \
  --title "Analyze current auth flow" \
  --type analysis \
  --parent <goal-ref> \
  --description "Investigate the existing auth flow and document pain points."

# Impl job — use the goal's integration branch as --base, not the repo's default
agentboard job create \
  --title "Implement JWT refresh" \
  --type impl \
  --parent <goal-ref> \
  --repo <repo-id> \
  --branch agent/jwt-refresh \
  --base feature/my-feature

# Review job — parent it to the impl job it reviews
agentboard job create \
  --title "Review JWT refresh" \
  --type review \
  --parent <impl-ref> \
  --description "Review impl job #44 for correctness, completeness, and merge readiness."
```

`--repo` accepts the repo UUID (visible in the UI settings). `--branch` is the branch the worker will create. `--base` is what it branches from (defaults to the repo's base branch if omitted).

For impl work, the impl job is the long-lived parent. Review jobs sit underneath the impl job they are reviewing, not directly under the goal.

Output: `Created job #<refNum>: <title>` — note the refNum for `--parent` filters.

Checkpoint after decomposing:

```bash
agentboard job checkpoint --job <goal-ref> --agent <agent-id> \
  "Decomposed into 3 sub-jobs: #43 (analysis), #44 (impl auth), #45 (impl refresh)."
```

Use `job scratch` to track working state that doesn't belong in checkpoints — repo IDs discovered, pending sub-job IDs, mid-decomposition notes, or any friction experienced during job execution by you or your agents:

```bash
agentboard job scratch --job <goal-ref> --agent <agent-id> \
  "repo id: abc123. sub-jobs created: #43 #44 #45. waiting on #43 before spawning review."
```

---

## Step 3 — Attach references before handing off

Workers call `job context` and attached references are expanded into that context. Job references show the referenced job's handoff summary when one exists, otherwise they fall back to the referenced artifact. File references inline file contents. Attach references **before** a worker claims the job.

```bash
# Link another job's artifact as context
agentboard ref add --job 44 --job-ref 43 --label "analysis to implement from"

# Link a specific file on disk
agentboard ref add --job 44 --file /path/to/spec.md --label "API spec"

# List or remove refs
agentboard ref list --job 44
agentboard ref remove --job 44 --ref <ref-id>
```

Attach refs after the dependency completes — if the artifact isn't written yet, nothing is inlined.

---

## Step 4 — Monitor sub-jobs

You spawn workers and know when they complete. Use list commands to check status when you need a snapshot or to catch blocked jobs:

```bash
agentboard job list --parent <goal-ref>
agentboard job list --parent <goal-ref> --status blocked
agentboard job list --parent <goal-ref> --status in-review

# Review jobs under a specific impl job
agentboard job list --parent <impl-ref> --type review
```

Output per line: `#<refNum>  <status>  [<type>]  <title>`

For non-impl jobs, `done` is terminal. For impl jobs, `approved` is your terminal state — merge is a human action that happens after your session ends. Re-check blocked jobs promptly.

An impl job in `in-review` is not automatically terminal. Inspect its child review jobs before deciding whether it's settled. When a review is accepted with `Approve`, the parent impl moves to `approved` automatically. When accepted with `Request Changes`, it moves back to `in-progress`.

**Review jobs are children of the impl job they review.** Do not create review jobs directly under the goal. When review requests changes, do NOT create a new impl job — the same impl job goes back to `in-progress` on the same branch.

---

## Step 5 — Synthesize and finish

```bash
agentboard job artifact --job <goal-ref> --agent <agent-id> \
  "# Summary

Completed X, Y, Z. Key decisions: ..."

agentboard job ready --job <goal-ref>
```

Goal jobs communicate their final synthesis to the human through the artifact. Worker jobs use handoff summaries to communicate findings to one another. `job ready` marks the goal `in-review`. Always call it — do not just stop. If `requireReview` is set, `ready` blocks until a human `LGTM` or requests changes. For impl jobs, human `LGTM` can leave the job in `in-review` while downstream child review work continues. If your session is interrupted while waiting, reattach with:
```bash
agentboard job wait --job <goal-ref>
```

---

## Handling blocked sub-jobs

```bash
# Read context for the blocked job
agentboard job context --job <blocked-ref>

# Post a comment to unblock with new direction
agentboard job comment --job <blocked-ref> --agent <agent-id> \
  "Unblocking: skip approach A, use B instead."
```

If you need a human decision first:

```bash
answer=$(agentboard input request \
  --job <goal-ref> \
  --agent <agent-id> \
  --type choice \
  --prompt "Sub-job #44 is blocked on auth strategy. Which approach?" \
  --choices "jwt:JWT tokens|session:Server sessions|oauth:OAuth2")

echo "Human chose: $answer"
```

---

## Typical chains

**Default:**
`analysis → plan → impl(s) → review`

**Lean (simple task):**
`plan → impl → review`

**Complex / cross-repo:**
`analysis → arch → plan → impl(s) → review`

**Conversation-first (ambiguous requirements):**
`convo → analysis → plan → impl(s) → review`

Deviate as the goal requires. Spawn a `convo` job any time requirements are unclear enough that you need back-and-forth with the human before planning.

---

## Spawning workers

When you spawn a worker subagent, their prompt must include:

1. **The job ref** — which job they are executing
2. **Their agent ID** — a unique ID they'll use on all agentboard commands (e.g. `impl-auth-1`)
3. **The WORKER-agentboard agent** — tell them they are a WORKER-agentboard agent so they know to claim and read context first

Minimal worker prompt:
```
You are a WORKER-agentboard agent.
Job: #44
Agent ID: impl-auth-1
```

That's all they need. The mandate injected by `job context` handles the rest.

For review workers, include the impl job ref so they can navigate to the worktree:
```
You are a WORKER-agentboard agent.
Job: #46  (review job)
Agent ID: review-auth-1
Impl job to review: #44
```
The impl ref should also be attached as a reference (`ref add`) before the worker claims the job.
Create that review job with `--parent <impl-ref>` as well, so the board shows the review pass nested under the implementation it belongs to.

---

## Rules

1. **Claim the goal before anything else.**
2. **Attach references before workers claim sub-jobs.** Once a worker starts, they may have already called `job context`.
3. **Never do implementation yourself.** If you find yourself writing code or detailed analysis, stop and create a sub-job instead.
4. **Checkpoint after every structural decision** — decomposition, re-decomposition, unblocking.
5. **`job ready` is mandatory.** The goal is not done until you call it.
6. **`input request` blocks your process.** Do not call it inside a polling loop without intent.
