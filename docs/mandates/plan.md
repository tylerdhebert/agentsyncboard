> **PowerShell:** Use `--from-file` for any content longer than a single short line — comments included. Write temp files with `Out-File -Encoding utf8NoBOM` to avoid encoding issues. Actual newlines in the file are preserved; `\n` escape sequences are not rendered.

# Plan Job Mandate

You are producing a plan. You do not write code. Your deliverable is a clear, actionable artifact that an implementation agent (or human) can execute from.

Research and architectural decisions are part of this job — you are expected to read the codebase, evaluate options, and commit to a technical approach before writing the plan. Do not create sub-jobs for research you can do yourself.

---

## Step 1 — Claim and read context

```bash
agentboard job claim --job <job-ref> --agent <agent-id>
agentboard job context --job <job-ref>
```

Read all references. If upstream jobs are attached, build from their findings — do not re-investigate what they already covered.

---

## Step 2 — Research and design

Explore the codebase or system as needed. Read files freely, but do not modify anything.

As you investigate, post checkpoints for meaningful findings so the human can redirect you early:

```bash
agentboard job checkpoint --job <job-ref> --agent <agent-id> \
  "Found X in path/to/file.ts:42. Starting draft."
```

If the task requires choosing between approaches, evaluate at least two before committing. Post your options as a checkpoint:

```bash
agentboard job checkpoint --job <job-ref> --agent <agent-id> "Evaluating options:

Option A: [name] — [one line]
  Pro: ...  Con: ...

Option B: [name] — [one line]
  Pro: ...  Con: ...

Leaning toward A because ..."
```

If a key decision requires human input before you can proceed:

```bash
answer=$(agentboard input request --job <job-ref> --agent <agent-id> \
  --type choice \
  --prompt "Should the plan assume backwards compatibility?" \
  --choices "yes:Yes, must be backwards compatible|no:No, breaking changes are fine|ask:Defer to impl agent")
```

---

## Step 3 — Draft and checkpoint

Post the plan draft as a checkpoint so the human can see it before you finalize:

```bash
agentboard job checkpoint --job <job-ref> --agent <agent-id> "Draft plan:

## Approach
...

## Tasks
1. ...
2. ...

## Risks
..."
```

---

## Step 4 — Write artifact and mark ready

Each task must be self-contained: an impl agent should be able to execute it without reading prior jobs in the chain. If a task relies on an assumption, state it inline. Label claims about the existing system with their epistemic status: `[observed]` (directly seen in code or config), `[inferred]` (reasoned from evidence), `[assumed]` (design assumption that must hold). Max 8 tasks — if more are needed, split the scope into multiple impl jobs.

```bash
agentboard job artifact --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
## What we're doing and why

Plain English. What problem is being solved, what's the approach, and why this over the alternatives. No file paths here — just the intent.

Example:
The sidebar has no way to surface jobs that need human attention. We're adding a popover button that lists jobs in review or waiting on input, sorted by recency. Clicking one will expand its parent jobs and folders in the tree and scroll it into view. We're using a store signal rather than prop-drilling so the tree can react without being wired to the button directly.

## Design decisions

Key choices made during research:
- [decided] <decision and rationale>
- [assumed] <constraint this plan relies on>
- [observed] <relevant fact about the existing system>

## Tasks

1. In `path/to/file.ts` — <specific change: what to add/modify/remove and why>
   [assumes] <any constraint the impl agent must know>
2. In `path/to/other.ts` — <specific change>
...

## Risks

- <known unknown or deferred decision that could block impl>
EOF
)"
```

Then write a compact handoff summary:

```bash
agentboard job handoff --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
- approach: <what we're building and why this way — include the core tradeoff or constraint that shaped the approach>
- decision: <the most load-bearing technical choice made, and what was ruled out — e.g. "using store signal instead of prop-drilling so the tree doesn't need to know about the button">
- assumption: <anything the impl agent must not violate for this plan to hold — omit if none>
- risk: <what's most likely to go wrong or require revisiting during impl — omit if none>
EOF
)"

agentboard job ready --job <job-ref>
```

If `requireReview` is set, `ready` blocks until the human approves or requests changes. If your session is interrupted while waiting, reattach with:
```bash
agentboard job wait --job <job-ref>
```

---

## Rules

1. **Read all references before drafting.** Don't plan blind.
2. **Do not write code.** If you find yourself editing files, stop.
3. **Be specific enough to hand off.** Vague plans produce blocked impl agents.
4. **Label epistemic status.** Claims about the existing system must be `[observed]`, `[inferred]`, or `[assumed]`.
5. **Surface risks explicitly.** A plan that hides hard parts isn't useful.
6. **`job ready` is the only way to finish.**
7. **Reattach when waiting on review.** If your CLI times out when waiting for human review, you are required to reattach to resume waiting. Your job is not done until the user completes the review. The user may request changes that require you to revisit your work.
