# Phase 06 — Auto-name affordance in detail view

## Context Links
- `src/components/session-detail-view.tsx` (shell from P03 — header has Back/Rename/lines)
- `src/lib/openai-chat.ts` (chatCompletion — P01)
- `src/lib/history-store.ts` (renameSession — existing; persists meta.name)
- `src/state/session-context.tsx` (stop() path — DELIBERATELY NOT TOUCHED)
- Depends on: P01 (chatCompletion), P03 (shell header to host the button). After P05 to use chatModel pref.

## Overview
- Priority: P3
- Status: pending
- Add an "Auto-name" affordance in the History detail header (near Rename) that
  asks the LLM for a short session name and persists it via `renameSession`.

## OTA-Safety Statement
RN Pressable + existing fetch + existing renameSession. No native deps/config.
OTA-safe. Live screen / session-context.tsx UNTOUCHED.

## Consistency With Prior Decision (justification)
The prior batch deliberately kept `stop()` in `session-context.tsx` free of
summary/extras generation to avoid cross-screen stale-id coupling (summary is
generated only from the History detail view). Auto-name follows the SAME rule:
it is a detail-view affordance calling the LLM on demand against a concrete
`session.meta.id`, persisted with the existing `renameSession`. NOT added to
the live stop() path. This keeps a single, consistent "extras are generated in
History detail, never in the hot path" model. Zero hot-path regression.

## Key Insights
- Reuse `chatCompletion` with a tiny system prompt: "Return a 3-6 word title
  for this session, no quotes/punctuation." User content = same context
  selector as chat (summary if present else truncated transcript) — reuse
  `buildChatContext` from P04 (DRY). Fallback model = chatModel pref (P05) or
  DEFAULT_CHAT_MODEL.
- On success: set local `name`, call `renameSession(id, title)`, `onChanged()`
  (same pattern as submitRename). On failure: inline error, no crash.
- KISS: button shows spinner while running; disabled if no openaiKey.

## Requirements
- Functional: tap Auto-name → LLM title → persisted → list reflects on Back.
- Non-functional: session-detail-view.tsx stays <200 LOC (shell ~110 + ~25).

## Architecture / Data Flow
```
Header: ‹Back        [Auto-name] Rename     {rowCount} lines
Auto-name onPress:
  ctx = buildChatContext(session, session.rows)
  title = await chatCompletion({apiKey, model: chatModel,
            system:"Return a short 3-6 word title, no quotes/punctuation.",
            messages:[{role:"user", content: ctx}]})
  setName(title); await renameSession(session.meta.id, title); onChanged()
  catch → inline error text
```

## Related Code Files
- Modify: `src/components/session-detail-view.tsx` (~+25 LOC) — Auto-name Pressable + handler + error state
- Create (if shell would exceed ~180 LOC): `src/components/auto-name-button.tsx` (~50 LOC) — encapsulate call + spinner + error; shell just renders it and passes `onNamed`
- Reuse: `buildChatContext` (P04), `chatCompletion` (P01), `renameSession` (existing)
- NOT modified: `src/state/session-context.tsx`, `app/index.tsx`, `app/history.tsx`

## Implementation Steps
1. Create `auto-name-button.tsx`: props `{session, onNamed}`; runs chatCompletion
   with title prompt + buildChatContext; spinner; inline error; disabled w/o key.
2. In shell header, render `<AutoNameButton session={session} onNamed={(n)=>{setName(n); renameSession(session.meta.id,n); onChanged();}}/>`
   (or button calls renameSession itself and shell passes setName+onChanged).
3. Confirm `session-context.tsx` diff is empty (grep — must remain untouched).
4. Typecheck + manual: tap Auto-name → name appears → Back → list shows new name.

## Todo
- [ ] auto-name-button.tsx (LLM title + spinner + error + key gate)
- [ ] Wire into shell header near Rename
- [ ] Verify session-context.tsx untouched (empty diff)
- [ ] Typecheck + manual E2E

## Success Criteria
- Auto-name produces a short title, persists via renameSession, list updates.
- No OpenAI key → button disabled/hidden with hint.
- `git diff src/state/session-context.tsx app/index.tsx` empty.
- Files <200 LOC.

## Risks
- LLM returns long/quoted title. Mitigation: trimField (existing rename cap)
  via renameSession already trims to MAX_FIELD_CHARS; optionally strip quotes.
- Confusion with manual Rename. Mitigation: place adjacent; Auto-name just
  pre-fills the same name field path.

## Unresolved Questions
- Should Auto-name open RenameSessionModal prefilled (let user edit) instead of
  committing directly? Proposed: commit directly (KISS); revisit if users want
  review-before-save.
