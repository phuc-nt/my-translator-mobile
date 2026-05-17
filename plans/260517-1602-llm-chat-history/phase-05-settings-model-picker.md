# Phase 05 — Settings chatModel picker

## Context Links
- `src/state/settings-context.tsx` (pref pattern: sonioxKey/openaiKey/targetLang/engine/fontSize/panelMode)
- `src/lib/secure-keys.ts` (PREF_KEYS map, getPref/setPref/clearAllPrefs)
- `app/settings.tsx` (Section/Row/Choice components — reuse)
- `src/lib/openai-chat.ts` (DEFAULT_CHAT_MODEL — P01)
- Depends on: P01 (DEFAULT_CHAT_MODEL). Independent of P02/P03/P04 — parallelizable after P01.

## Overview
- Priority: P2
- Status: pending
- Add a `chatModel` preference + picker. Controls model for summary + chat.
  Only meaningful when an OpenAI key exists.

## OTA-Safety Statement
Reuses existing SecureStore pref pattern + RN Pressable. No native deps/config.
OTA-safe. Live screen untouched.

## Key Insights
- KISS: model list = small editable constant `CHAT_MODELS` in openai-chat.ts
  (single source of truth, same file as DEFAULT_CHAT_MODEL). Picker = existing
  `Choice` row pattern (DRY — no new UI primitive).
- Pref plumbing mirrors `engine` exactly: PREF_KEYS entry, context state +
  setter (`setChatModel`), load in the Promise.all batch, default
  `DEFAULT_CHAT_MODEL`.
- Gate visibility: only render the model Section when `openaiKey` is set
  (consistent with "only matters when an OpenAI key exists").
- summarizeTranscript currently uses DEFAULT_CHAT_MODEL — to honor the pref,
  callers (SummaryPanel, chat tab) pass `model: chatModel` to chatCompletion.
  SummaryPanel uses `summarizeTranscript`; add optional `model` param to it
  (defaulting to DEFAULT_CHAT_MODEL) so SummaryPanel can pass `chatModel`.
  This is a P05-owned 1-line tweak to openai-chat.ts signature (additive,
  optional — does NOT violate P01 single-writer since it is a new optional
  param, but NOTE: to keep single-writer strict, this signature change is
  pre-included in P01's summarizeTranscript as optional `model?`).

## Requirements
- Functional: pick model in Settings → persists → summary + chat use it.
- Non-functional: settings.tsx stays <200 LOC (currently 207 incl. helpers —
  CAUTION: already over; add picker as a separate component file to avoid growth).

## Architecture / Data Flow
```
CHAT_MODELS (const, openai-chat.ts) = ["gpt-5-mini","gpt-5","gpt-5-nano"]
secure-keys: PREF_KEYS.chatModel = "pref.chatModel"
settings-context: state.chatModel (default DEFAULT_CHAT_MODEL),
                  setChatModel (mirror setEngine), load in Promise.all
settings.tsx: <ChatModelSection/> rendered only if openaiKey
SummaryPanel/chat tab: pass chatModel to chatCompletion / summarizeTranscript
```

## Related Code Files
- Modify: `src/lib/secure-keys.ts` (~+2 LOC) — `chatModel: "pref.chatModel"` in PREF_KEYS
- Modify: `src/state/settings-context.tsx` (~+10 LOC) — chatModel state/setter/load
- Modify: `app/settings.tsx` (~+4 LOC) — render `<ChatModelSection/>` when openaiKey
- Create: `src/components/chat-model-section.tsx` (~45 LOC) — Section + Choice row over CHAT_MODELS (keeps settings.tsx from growing past 200)
- Modify: `src/lib/openai-chat.ts` — `CHAT_MODELS` const (signature `model?` already in P01)
- Modify: `src/components/session-summary.tsx` (~1 LOC) — pass `chatModel` into summarizeTranscript

## Implementation Steps
1. Add `CHAT_MODELS` const to `openai-chat.ts`.
2. Add `chatModel` to `PREF_KEYS` in secure-keys.ts.
3. Add `chatModel` state + `setChatModel` + load (mirror `engine`) in settings-context.
4. Create `chat-model-section.tsx`: Section "Chat / summary model" + Choice row;
   note "Used by Summary & Chat. Needs an OpenAI key."
5. In settings.tsx render `{openaiKey ? <ChatModelSection/> : null}` (Section
   helper is local to settings.tsx — pass needed props or lift Choice; KISS:
   chat-model-section re-implements the tiny Choice row to avoid coupling).
6. SummaryPanel + chat tab pass `chatModel` to chatCompletion/summarizeTranscript.
7. Typecheck + manual: change model → persists across app restart → chat call uses it.

## Todo
- [ ] CHAT_MODELS const
- [ ] PREF_KEYS.chatModel
- [ ] settings-context chatModel state/setter/load
- [ ] chat-model-section.tsx component
- [ ] Wire into settings.tsx (gated by openaiKey)
- [ ] SummaryPanel + chat tab pass chatModel
- [ ] Typecheck + restart-persistence check

## Success Criteria
- Picker visible only with OpenAI key; selection persists across restart.
- Summary + chat requests use selected model (verify via error/text change).
- settings.tsx + new component each <200 LOC.

## Risks
- settings.tsx already 207 LOC. Mitigation: extract picker to own file; only +4
  LOC in settings.tsx (the conditional render).
- Wrong model id rejected. Mitigation: error surfaced verbatim; list editable.

## Unresolved Questions
- Confirm exact model ids before production `eas update` (see plan.md).
