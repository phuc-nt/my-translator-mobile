# Phase 01 — openai-chat refactor + types + blob (foundation)

## Context Links
- `src/lib/openai-summary.ts` (current one-shot REST call, model "gpt-5-mini")
- `src/lib/history-blob.ts` (Blob envelope, normalizeBlob, caps)
- `src/types/index.ts` (TranscriptRow, SessionMeta, SavedSession)
- `src/components/session-summary.tsx` (only importer of summarizeTranscript)

## Overview
- Priority: P1 (foundation — everything depends on this)
- Status: pending
- DRY the OpenAI REST call into one `chatCompletion(...)`. Re-express
  `summarizeTranscript` on top of it. Extend Blob + types with `chat`.

## OTA-Safety Statement
Pure TypeScript. `fetch` to existing endpoint. No native deps, no config files.
Fully OTA-safe via `eas update`. Live screen untouched.

## Key Insights
- Error contract MUST stay verbatim: `OpenAI <status>: <message>`, never log
  apiKey/headers/body. Empty-content guard preserved.
- Model currently hardcoded; make it a required `model` arg (caller supplies;
  default constant `DEFAULT_CHAT_MODEL = "gpt-5-mini"` kept here for callers
  that have no pref yet).
- normalizeBlob must keep legacy bare-array + envelope detection; add `chat`
  passthrough only when array of `{role,content}`.

## Requirements
- Functional: `chatCompletion({apiKey, model, system, messages})` → string.
  `summarizeTranscript` returns identical output/errors as before.
- Non-functional: <200 LOC per file; no behavior change for summary callers.

## Architecture / Data Flow
```
caller → chatCompletion({apiKey,model,system,messages})
  → POST https://api.openai.com/v1/chat/completions
     body { model, messages:[{role:"system",content:system}, ...messages] }
  → 200 → choices[0].message.content (trim, empty-guard)
  → !ok  → throw Error("OpenAI <status>[: <detail>]")

summarizeTranscript(args) = chatCompletion({
  apiKey, model: DEFAULT_CHAT_MODEL,
  system: <existing summary system prompt w/ targetLang>,
  messages: [{role:"user", content: truncated transcript}]
})
```

## Related Code Files
- Create: `src/lib/openai-chat.ts` (~70 LOC) — chatCompletion + summarizeTranscript + DEFAULT_CHAT_MODEL + MAX_INPUT_CHARS
- Delete: `src/lib/openai-summary.ts`
- Modify: `src/components/session-summary.tsx` — change import path only (`@/src/lib/openai-chat`)
- Modify: `src/types/index.ts` (~+6 LOC) — add `ChatMessage` + `SavedSession.chat?`
- Modify: `src/lib/history-blob.ts` (~+8 LOC) — `Blob.chat?`, normalizeBlob passthrough, `MAX_CHAT_CHARS`

## Type Additions (types/index.ts)
```ts
export interface ChatMessage { role: "user" | "assistant"; content: string; }
// SavedSession gains:  chat?: ChatMessage[];
```

## Blob Additions (history-blob.ts)
```ts
export const MAX_CHAT_CHARS = 6000; // ~3× MAX_SUMMARY_CHARS, well under Keychain item cap
export interface Blob { rows: TranscriptRow[]; summary?: string; chat?: ChatMessage[]; }
// normalizeBlob: if Array.isArray(b.chat) → carry b.chat through; else omit
```

## Implementation Steps
1. Create `src/lib/openai-chat.ts`: export `DEFAULT_CHAT_MODEL`, `MAX_INPUT_CHARS=12000`,
   `chatCompletion({apiKey,model,system,messages})` (generic POST, exact error mapping
   + empty-content guard), and `summarizeTranscript({apiKey,text,targetLang})` calling
   chatCompletion with the existing summary system prompt + truncation.
2. Update `session-summary.tsx` import to `@/src/lib/openai-chat`.
3. Delete `src/lib/openai-summary.ts`.
4. Add `ChatMessage` + `SavedSession.chat?` to `types/index.ts`.
5. Add `MAX_CHAT_CHARS`, `Blob.chat?`, normalizeBlob chat passthrough to `history-blob.ts`.
6. Run `npx tsc --noEmit` (or project typecheck script) — zero errors.

## Todo
- [ ] Create openai-chat.ts (chatCompletion + summarizeTranscript)
- [ ] Repoint session-summary.tsx import
- [ ] Delete openai-summary.ts
- [ ] Add ChatMessage + SavedSession.chat?
- [ ] Extend Blob + normalizeBlob + MAX_CHAT_CHARS
- [ ] Typecheck passes

## Success Criteria
- Typecheck clean. `grep -r openai-summary src` returns nothing.
- summarizeTranscript output + error strings byte-identical to before (manual
  reasoning / unit test with mocked fetch: 200, 401, empty content).
- normalizeBlob: legacy `[]`, `{rows}`, `{rows,summary}`, `{rows,summary,chat}`
  all return correct shape; junk → null.

## Risks
- Hidden behavior diff in summary. Mitigation: keep system prompt + truncation
  byte-identical; unit-test all three fetch outcomes.

## Unresolved Questions
- None blocking. DEFAULT_CHAT_MODEL stays "gpt-5-mini" (proven in prod).
