# Phase 02 — saveChat store mutator

## Context Links
- `src/lib/history-store.ts` (saveSummary precedent: read blob → mutate → write, never throws)
- `src/lib/history-blob.ts` (Blob.chat?, MAX_CHAT_CHARS — added in P01)
- Depends on: Phase 01 (Blob.chat type + MAX_CHAT_CHARS)

## Overview
- Priority: P1
- Status: pending
- Add `saveChat(id, messages)` mirroring `saveSummary`'s pattern exactly.

## OTA-Safety Statement
SecureStore JSON read/write only. No native deps/config. OTA-safe. Live screen
untouched (history-store only consumed by History detail).

## Key Insights
- Follow saveSummary verbatim: read raw → normalizeBlob → mutate → setItemAsync
  → return boolean; catch-all → false. Never throws.
- Cap strategy: enforce total chat size ≤ MAX_CHAT_CHARS by dropping OLDEST
  turns (preserve recent context) until JSON of chat fits. Keep at least the
  last message. Document the drop-oldest rule.
- `getSession` must also return `chat` (one-line change: include `blob.chat`).

## Requirements
- Functional: `saveChat(id, ChatMessage[]) → Promise<boolean>`. `getSession`
  returns `chat` so detail view can hydrate.
- Non-functional: history-store.ts stays <200 LOC (currently 165; ~+20).

## Architecture / Data Flow
```
saveChat(id, messages):
  raw = getItemAsync(sessionKey(id)); if !raw → false
  blob = normalizeBlob(JSON.parse(raw)); if !blob → false
  trimmed = capChat(messages)            // drop oldest until JSON ≤ MAX_CHAT_CHARS
  blob.chat = trimmed
  setItemAsync(sessionKey(id), JSON.stringify(blob))
  return true   // any throw → caught → false

getSession: return { meta, rows: blob.rows, summary: blob.summary, chat: blob.chat }
```

## Related Code Files
- Modify: `src/lib/history-store.ts` (~+20 LOC) — add `saveChat`, extend `getSession` return
- (capChat helper may live in history-blob.ts if cleaner — keep history-store <200 LOC)

## Implementation Steps
1. In `history-blob.ts` (or inline in store) add `capChat(messages): ChatMessage[]`
   — while `JSON.stringify(arr).length > MAX_CHAT_CHARS && arr.length > 1` shift oldest.
2. In `history-store.ts` add `saveChat(id, messages)` mirroring `saveSummary`,
   applying `capChat` before write.
3. Extend `getSession` return object with `chat: blob.chat`.
4. Typecheck.

## Todo
- [ ] capChat helper (drop-oldest until under MAX_CHAT_CHARS)
- [ ] saveChat (never-throws boolean)
- [ ] getSession returns chat
- [ ] Typecheck passes

## Success Criteria
- Round-trip: saveChat then getSession returns same (capped) messages.
- Oversized chat → capped, oldest dropped, still returns true.
- Missing/corrupt blob → false (no throw).
- Old session with no chat → getSession `chat` is undefined (no crash).

## Risks
- Cap too small loses useful history. Mitigation: 6000 chars ≈ many turns;
  configurable constant; flagged in plan.md unresolved.

## Unresolved Questions
- MAX_CHAT_CHARS=6000 vs real Keychain per-item ceiling — verify on preview.
