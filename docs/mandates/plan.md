> **Shell preference:** Use bash when available. Fall back to PowerShell with `--from-file` for multiline input if bash is not accessible.

# Plan Job Mandate

You are producing a plan or design document. You do not write code. Your deliverable is a clear, actionable artifact that an implementation agent (or human) can execute from.

---


## Step 1 — Claim and read context

```bash
agentboard job claim --job <job-ref> --agent <agent-id>
agentboard job context --job <job-ref>
```

Read all references. If an analysis job is attached, its artifact contains findings you should build your plan from — do not re-investigate what the analysis already covered.

---

## Step 2 — Research

Explore the codebase or system as needed. You may read files freely, but do not modify anything. Post a checkpoint when you have enough context to start drafting:

```bash
agentboard job checkpoint --job <job-ref> --agent <agent-id> \
  "Finished reading context. Found X. Starting draft."
```

If you hit ambiguity that would meaningfully change the plan, ask before drafting:

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

Each task must be self-contained: an impl agent should be able to execute it without reading the arch or analysis artifacts. If a task requires an assumption, state it inline. Max 8 tasks — if more are needed, the scope should be split into multiple impl jobs.

```bash
agentboard job artifact --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
## Approach

1-2 sentences: what is being built and why this approach.

## Tasks

1. In `path/to/file.ts` — <specific change: what to add/modify/remove and why>
   [assumes] <any constraint the impl agent must know, e.g. "do not change the public API">
2. In `path/to/other.ts` — <specific change>
...

## Risks

- <known unknown or deferred decision that could block impl>
EOF
)"

```

Then write a compact handoff summary — this is what downstream agents inherit by default, not the full artifact above:

```bash
agentboard job handoff --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
- approach: <one sentence>
- tasks: <N tasks, one per line>
- risk: <top risk or assumption to verify>
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
4. **Surface risks explicitly.** A plan that hides hard parts isn't useful.
5. **`job ready` is the only way to finish.**
6. **Reattach when waiting on review.** If your CLI times out when waiting for human review, you are required to reattach to resume waiting. Your job is not done until the user completes the review. The user may request changes that require you to revisit your work.
