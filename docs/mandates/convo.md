# Convo Job Mandate

A `convo` job is a structured conversation with the human. Use it to gather requirements, explore a decision, or get direction on something that needs back-and-forth dialogue. You ask questions using `input request` — the human's replies appear inline in the conversation thread.

---


## Flow

```bash
# Claim the job
agentboard job claim --job <job-ref> --agent <agent-id>

# Post an opening message (informational, no reply needed)
agentboard job comment --job <job-ref> --agent <agent-id> "Opening context or framing..."

# Ask a question — blocks until the human replies (up to 15 minutes)
answer=$(agentboard input request \
  --job <job-ref> \
  --agent <agent-id> \
  --type text \
  --prompt "Your question here" \
  --allow-free-text)

# Read $answer, decide what to ask next or whether to wrap up
# Keep looping until the conversation is done

# Write the summary and close
agentboard job artifact --job <job-ref> --agent <agent-id> "$(cat <<'EOF'
## Conversation Summary

**Topic:** [what was discussed]
**Outcome:** [what was decided or concluded]

### Key Points
- ...

### Decisions Made
- ...

### Open Questions
- ... (if any — omit section if none)
EOF
)"

agentboard job ready --job <job-ref>
```

---

## When to Wrap Up

Close the conversation when the human:
- Explicitly signals done: "okay thanks", "I'm good", "I have enough", "that's all"
- Asks for a summary: "summarize our discussion", "wrap it up", "can you summarize"
- Does not reply and the `input request` times out (exit code 1)

Use judgment — "got it" in context may mean "continue", while "got it, thanks" usually means done.

---

## Input Request Types

Pick the type that fits your question:

```bash
# Open-ended question
agentboard input request --job <job-ref> --agent <agent-id> \
  --type text \
  --prompt "What constraints should I be aware of?"

# Binary decision
agentboard input request --job <job-ref> --agent <agent-id> \
  --type yesno \
  --prompt "Should this be backwards compatible?"

# Multiple choice
agentboard input request --job <job-ref> --agent <agent-id> \
  --type choice \
  --prompt "Which approach do you prefer?" \
  --choices "simple:Keep it simple and direct|flexible:Add configurability|defer:Decide later"
```

`--choices` format: `value:Label` pairs, pipe-separated (`|`). `value` is what gets returned; `Label` is what the human sees. Use `|` not `,` — labels often contain commas.

---

## Using Comments vs. Input Requests

- `job comment` — post something informational that doesn't need a reply (context, reasoning, interim findings)
- `input request` — ask a question and wait for the human's answer

Both appear in the conversation thread. Use `job comment` sparingly in convo jobs — if you're posting, you usually want a reply.

---

## Rules

1. **Always call `job ready` to finish.** Do not just stop.
2. **One question at a time.** Don't fire multiple `input request` calls before reading the reply.
3. **Timeout means wrap up.** Exit code 1 from `input request` means the human didn't respond — write your best summary with available information and call `job ready`.
4. **The artifact is required.** Every convo job must end with a written summary artifact.
