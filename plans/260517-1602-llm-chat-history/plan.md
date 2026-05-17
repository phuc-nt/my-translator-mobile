---
title: "Chat with LLM about a saved session"
description: "Tabbed history detail (Transcript/Summary/Chat) + persisted LLM chat, model picker, auto-name — OTA-safe"
status: pending
priority: P2
effort: 9h
branch: feature/openai-realtime
tags: [ota, chat, history, openai, settings, refactor]
created: 2026-05-17
---

# Chat with LLM about a saved session

Replace many single-purpose buttons with ONE chat per saved session covering Q&A,
action items, re-translation, cleanup. History detail becomes 3 tabs. DRY the
OpenAI REST call into one generic function. Add chat persistence, a model picker,
and an Auto-name affordance.

## OTA Safety (HARD CONSTRAINT)

All work is JS/TSX only. NO native deps, NO app.json/package.json/eas.json/
permission edits. Ships via `eas update` to runtime 0.2.0. Live screen
(`app/index.tsx`, `src/state/session-context.tsx`) is UNTOUCHED — zero hot-path
regression. Reuses existing `expo-secure-store` only.

| Phase | Touches native? | OTA-safe | Notes |
|---|---|---|---|
| 01 openai-chat refactor + blob/types | No | ✅ | Pure TS, fetch only |
| 02 history-store chat mutator | No | ✅ | SecureStore JSON only |
| 03 tabbed detail shell | No | ✅ | RN View/Pressable |
| 04 chat tab | No | ✅ | RN TextInput/ScrollView |
| 05 settings model picker | No | ✅ | Reuses pref pattern |
| 06 auto-name affordance | No | ✅ | Reuses renameSession |

## Dependency Graph

```
P01 (openai-chat + types + blob)  ── foundation, no deps
  │
  ├─► P02 (history-store: saveChat)         needs Blob.chat type
  │      │
  │      └─► P04 (Chat tab)                 needs chatCompletion + saveChat
  │             ▲
  ├─► P03 (Tabbed detail shell) ────────────┘  (P04 fills the Chat tab)
  │
  └─► P05 (Settings model picker)           needs nothing from P02-04;
                                            P01/P04 consume `chatModel`
P06 (Auto-name)  needs P01 (chatCompletion) + P03 (place button in shell)
```

Critical path: P01 → P03 → P04. P05 parallelizable after P01. P06 last.

## Single-Writer Sequencing (shared files)

These files are edited by multiple phases — ONE phase owns each at a time,
strictly sequenced (no parallel edits):

| File | Writers (in order) | Rule |
|---|---|---|
| `src/types/index.ts` | P01 only | All type additions land in P01 |
| `src/lib/history-blob.ts` | P01 only | Blob.chat + cap constant in P01 |
| `src/lib/history-store.ts` | P02 only | saveChat added in P02 |
| `src/components/session-detail-view.tsx` | P03 (rewrite to shell) → P06 (add Auto-name button) | P03 fully lands before P06 |
| `app/settings.tsx` | P05 only | Model picker section |
| `src/state/settings-context.tsx` | P05 only | chatModel pref |
| `src/lib/secure-keys.ts` | P05 only | chatModel pref key |
| `app/history.tsx` | NOT modified | Detail rendering stays via SessionDetailView |

`openai-summary.ts` is deleted in P01 (replaced by openai-chat.ts); P01 also
updates the only importer (`session-summary.tsx`).

## Context Strategy (token economy)

Per chat turn: if session HAS saved summary → send summary as context; ELSE
send `formatTranscript(rows)` truncated to last `MAX_INPUT_CHARS` (12000) chars.
Documented in P04. Same `MAX_INPUT_CHARS` precedent from openai-summary.ts.

## Risks (likelihood × impact)

| Risk | L×I | Mitigation |
|---|---|---|
| Refactor regresses summary | M×H | P01 keeps `summarizeTranscript` signature identical, same error string |
| Chat blob exceeds Keychain item cap | M×M | MAX_CHAT_CHARS cap + drop-oldest-turns trim in P02; saveChat returns false (never throws) |
| Tab rewrite breaks history detail | M×H | P03 preserves Back/Rename/lines header + onChanged contract; manual nav test |
| Stale-id coupling if auto-name in live path | L×H | P06 places Auto-name in detail view ONLY (consistent w/ prior batch) |
| Model id wrong/rejected by OpenAI | M×M | P05 ships editable constant list; error surfaced verbatim "OpenAI <status>" |
| Old app reads new blob (chat field) | L×L | normalizeBlob ignores unknown; forward-compat preserved |

## Rollback

Per OTA guide §7: republish prior good bundle to channel, or expo.dev dashboard
promote previous update. Each phase is an independent commit — revert single
commit + re-`eas update --channel preview` then `production`. No data migration:
new `chat` field is additive; reverting code leaves orphan field that
normalizeBlob safely ignores (forward-compat by design).

## Test Matrix

| Area | Unit | Integration | E2E (manual on preview) |
|---|---|---|---|
| openai-chat fetch + error mapping | ✅ mocked fetch | summarize still works | — |
| Blob chat normalize (legacy/array/envelope) | ✅ | — | open old session |
| saveChat cap + trim + never-throws | ✅ | round-trip get/save | — |
| Tab switching, role isolation | — | — | ✅ 3 tabs, no mixed scroll |
| Chat send + chips + persist + reopen | — | — | ✅ send, reopen, history kept |
| Context = summary vs transcript | ✅ selector fn | — | ✅ with/without summary |
| Model picker persists + drives calls | ✅ pref | — | ✅ change → chat uses it |
| Auto-name writes meta.name | — | renameSession | ✅ tap → list updates |
| Live screen unchanged | — | — | ✅ start/stop translate OK |

## Phases

- [phase-01](phase-01-openai-chat-refactor-types-blob.md) — openai-chat.ts + types + blob (foundation)
- [phase-02](phase-02-history-store-savechat.md) — saveChat store mutator
- [phase-03](phase-03-tabbed-detail-shell.md) — 3-tab detail shell + split components
- [phase-04](phase-04-chat-tab.md) — Chat tab: chips + free-text + persist
- [phase-05](phase-05-settings-model-picker.md) — Settings chatModel picker
- [phase-06](phase-06-auto-name.md) — Auto-name affordance in detail view

## Unresolved Questions

- Exact OpenAI model ids (gpt-5 / gpt-5-mini / gpt-5-nano): current code hardcodes
  "gpt-5-mini" and works in production, so list treated as valid; P05 ships an
  editable constant — verify before production `eas update`.
- MAX_CHAT_CHARS final value: P02 proposes 6000 (3× MAX_SUMMARY_CHARS) — confirm
  against real Keychain per-item ceiling during preview testing.
