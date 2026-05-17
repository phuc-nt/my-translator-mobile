# Phase 04 — Chat tab: chips + free-text + persist

## Context Links
- `src/lib/openai-chat.ts` (chatCompletion — P01)
- `src/lib/history-store.ts` (saveChat — P02)
- `src/components/detail-chat-tab.tsx` (stub from P03 — replaced here)
- `src/lib/transcript-format.ts` (formatTranscript)
- `src/state/settings-context.tsx` (openaiKey, targetLang, chatModel — chatModel from P05; default-safe before P05)
- Depends on: P01 (chatCompletion), P02 (saveChat + getSession.chat), P03 (chat-tab slot + DetailChatTab wiring)

## Overview
- Priority: P1
- Status: pending
- Real chat UI: scrollable message list, preset chips, free-text input.
  Persist conversation into the session blob; rehydrate on reopen.

## OTA-Safety Statement
RN TextInput/ScrollView/Pressable + existing fetch via chatCompletion. No
native deps/config. OTA-safe. Live screen untouched.

## Key Insights
- Context economy (per turn): build `context` ONCE per send:
  `session.summary ? summary : formatTranscript(rows).slice(-MAX_INPUT_CHARS)`.
  Send as the system message; conversation messages as the `messages` array.
  Document this rule in-file.
- No-key state: mirror SummaryPanel — if `!openaiKey` show Settings link, no input.
- Persistence: after each assistant reply, call `saveChat(id, nextMessages)`;
  if it returns false, keep UI state but the conversation just won't survive
  reopen (consistent with saveSummary's silent-degrade contract — no throw,
  no scary alert; optional subtle "not saved" hint).
- Chips just prefill+send a fixed prompt string (KISS — no chip state machine).
- chatModel: read from settings; BEFORE P05 lands, settings has no chatModel —
  use `DEFAULT_CHAT_MODEL` fallback so P04 is shippable independent of P05.

## Requirements
- Functional: send message → assistant reply appended → persisted; chips
  ("Summarize", "Action items", "Translate to {targetLang}") send preset
  prompts; reopening session restores chat.
- Non-functional: each file <200 LOC; no live-screen impact.

## Architecture / Data Flow
```
DetailChatTab({ session, rows })
 state: messages: ChatMessage[]  (init from session.chat ?? [])
 send(text):
   user = {role:"user", content:text}; messages←[...m,user]
   ctx = session.summary ?? formatTranscript(rows).slice(-MAX_INPUT_CHARS)
   sys = "You answer questions about this session transcript/summary.
          Reply in language code <targetLang>. Context:\n" + ctx
   reply = await chatCompletion({apiKey, model: chatModel, system: sys,
                                 messages: messages})  // full turn history
   messages←[...messages,{role:"assistant",content:reply}]
   saveChat(session.meta.id, messages)   // boolean, never throws
 error → inline red text (verbatim "OpenAI <status>: …"); user msg retained
```

## Related Code Files
- Modify (replace stub): `src/components/detail-chat-tab.tsx` (~140 LOC) — list + chips + input + send/persist
- Create (if >200 LOC risk): `src/components/chat-message-list.tsx` (~50 LOC) — pure render of bubbles
- Create: `src/lib/chat-context.ts` (~15 LOC) — `buildChatContext(session, rows)` pure selector (testable, DRY)
- Modify: `src/components/detail-summary-tab.tsx`? NO — untouched
- Pass `session` + `rows` from `session-detail-view.tsx` shell to DetailChatTab (P03 wired the slot; if shell needs the extra `session` prop, that is a P03-owned tweak — coordinate: P03 passes full `session` to chat tab from the start)

## Implementation Steps
1. Create `src/lib/chat-context.ts`: `buildChatContext(session, rows)` returns
   summary or truncated transcript per rule above (import MAX_INPUT_CHARS).
2. Create `chat-message-list.tsx`: render user/assistant bubbles, auto-scroll bottom.
3. Replace `detail-chat-tab.tsx`: state from `session.chat ?? []`; chips row
   (preset prompts); TextInput + Send; KeyboardAvoidingView; loading spinner;
   on reply append + `saveChat`; no-key → Settings link (reuse SummaryPanel copy).
4. Ensure shell passes `session` (not just rows) to chat tab.
5. Typecheck + manual: send, get reply, switch tab + back (state kept), Back to
   list + reopen (chat restored), no-key state, error state.

## Todo
- [ ] chat-context.ts (buildChatContext pure selector)
- [ ] chat-message-list.tsx (bubbles + autoscroll)
- [ ] detail-chat-tab.tsx (chips + input + send + persist + no-key state)
- [ ] Shell passes full session to chat tab
- [ ] Typecheck + manual E2E on preview

## Success Criteria
- Send works; assistant reply shown; reopening session restores conversation.
- Chips prefill+send correct preset; free-text works.
- With summary present, context = summary; without, = truncated transcript
  (unit test buildChatContext both branches).
- Errors shown verbatim; apiKey never logged.
- No-key shows Settings link, no input. Each file <200 LOC.

## Risks
- Token blow-up sending full message history. Mitigation: capChat (P02) bounds
  persisted size; context picked once (summary preferred); MAX_INPUT_CHARS cap.
- Keyboard covering input on iOS. Mitigation: KeyboardAvoidingView (pattern
  already in settings.tsx).

## Unresolved Questions
- Should very long chats trim sent message history (not just stored)? Proposed:
  rely on capChat-bounded persisted list as the sent list — revisit if OpenAI
  token errors appear on preview.
