---
name: rename
description: This skill should be used when the user asks to "rename this terminal", "set terminal title", "give this tab a name", or invokes "/ominiterm:rename". Generates a concise title from recent conversation context and sets it on the OminiTerm terminal tab via the ominiterm CLI.
---

# Rename Terminal Tab

Generate a concise title for the current OminiTerm terminal tab based on the
conversation so far, then apply it.

## Steps

1. Review the recent conversation context (last few exchanges)
2. Generate a short, descriptive title (3-8 words) that captures the main task
   or topic. Match the language of the conversation (e.g. Chinese if the user
   writes in Chinese).
3. Read the terminal ID from the environment variable `$OMINITERM_TERMINAL_ID`
4. Run:

```bash
ominiterm terminal set-title "$OMINITERM_TERMINAL_ID" "<generated title>"
```

## Rules

- If `$OMINITERM_TERMINAL_ID` is not set, inform the user that this command
  only works inside a OminiTerm terminal.
- The title should describe the work being done, not be generic
  (e.g. "fix auth token refresh" not "coding session").
- Do NOT ask the user what title they want — generate it yourself from context.
- Keep it concise: 3-8 words max.

