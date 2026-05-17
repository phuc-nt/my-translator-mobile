# Phase 03 — 3-tab detail shell + split components

## Context Links
- `src/components/session-detail-view.tsx` (~85 LOC: header Back/Rename/lines, name, TranscriptStream, SummaryPanel, RenameSessionModal)
- `src/components/session-summary.tsx` (SummaryPanel — reused as-is in Summary tab)
- `src/components/transcript-stream.tsx` (TranscriptStream — reused as-is in Transcript tab)
- `app/history.tsx` (renders `<SessionDetailView session onBack onChanged />` — contract MUST be preserved)
- Depends on: none (foundation not required for shell), but ordered after P01/P02 so P04 can fill Chat tab

## Overview
- Priority: P1
- Status: pending
- Convert detail view into a shell with a tab bar: `Transcript | Summary | Chat`.
  Each tab = one role, no mixed scrolling. Split tab contents into own files.

## OTA-Safety Statement
RN View/Pressable/state only. No nav lib changes (local `useState` tab index,
NOT a new native tab navigator). No native deps/config. OTA-safe. Live screen
(`app/index.tsx`) untouched — only the History detail component changes.

## Key Insights
- KISS: tab state is plain `useState<"transcript"|"summary"|"chat">`. No
  react-navigation tabs (would risk native/config). Pure conditional render.
- Preserve EXACT external contract: same props `{session,onBack,onChanged}`,
  same header (Back / Rename / "{n} lines"), same name line, same
  RenameSessionModal + submitRename + onSummarySaved behavior.
- Each tab content < ~120 LOC in its own file → shell stays thin (<120 LOC).
- Chat tab is a placeholder stub in P03 ("coming in P04") to keep P03
  shippable independently; P04 replaces the stub. This keeps single-writer
  on session-detail-view.tsx clean (P03 owns the rewrite, P04 only touches
  the chat-tab file, P06 adds one Auto-name button to the shell header).

## Requirements
- Functional: tab bar switches content; only active tab rendered (no mixed
  scroll); state retained while switching within a session.
- Non-functional: shell + each tab file <200 LOC (target <120 each).

## Architecture / Data Flow
```
SessionDetailView (shell, owns: tab state, rename modal, name, header)
 ├─ header: ‹Back   Rename   {rowCount} lines      (P06 adds Auto-name here)
 ├─ name line (if meta.name)
 ├─ TabBar (3 Pressables → setTab)
 └─ active tab:
     transcript → <DetailTranscriptTab rows fontSize/>      (wraps TranscriptStream)
     summary    → <DetailSummaryTab rows summary onSaved/>  (wraps SummaryPanel)
     chat       → <DetailChatTab .../>  (P03: stub; P04: real)
```
Props/contract unchanged → `app/history.tsx` NOT modified.

## Related Code Files
- Modify (rewrite): `src/components/session-detail-view.tsx` (~110 LOC) — shell + tab state, header, name, modal preserved
- Create: `src/components/detail-tab-bar.tsx` (~40 LOC) — 3-segment Pressable bar
- Create: `src/components/detail-transcript-tab.tsx` (~25 LOC) — wraps TranscriptStream
- Create: `src/components/detail-summary-tab.tsx` (~30 LOC) — wraps SummaryPanel + persists via onSummarySaved
- Create: `src/components/detail-chat-tab.tsx` (~20 LOC STUB) — placeholder text; replaced in P04
- NOT modified: `app/history.tsx`, `transcript-stream.tsx`, `session-summary.tsx`

## Implementation Steps
1. Create `detail-tab-bar.tsx`: props `{value, onChange}`; 3 Pressables, active
   style matches existing Choice pattern (zinc-900/white) — DRY visual language.
2. Create `detail-transcript-tab.tsx`: renders `<TranscriptStream rows fontSize panelMode="single"/>` in flex-1.
3. Create `detail-summary-tab.tsx`: renders `<SummaryPanel rows initialSummary onSaved/>` in a scroll-safe flex-1 container.
4. Create `detail-chat-tab.tsx`: stub View with centered "Chat — available soon" text (replaced P04).
5. Rewrite `session-detail-view.tsx`: keep state (renaming, name, summary),
   submitRename, onSummarySaved unchanged; add `tab` state; render header +
   name + `<DetailTabBar>` + active tab + RenameSessionModal.
6. Typecheck + manual nav: open session → 3 tabs switch → Back → Rename still works.

## Todo
- [ ] detail-tab-bar.tsx
- [ ] detail-transcript-tab.tsx
- [ ] detail-summary-tab.tsx
- [ ] detail-chat-tab.tsx (stub)
- [ ] Rewrite session-detail-view.tsx as shell (contract preserved)
- [ ] Typecheck + manual nav check

## Success Criteria
- `app/history.tsx` unchanged; opening a session shows Transcript tab default.
- Switching tabs shows only that role's content, no mixed/overlapping scroll.
- Back, Rename, summary generate+persist all still work identically.
- Each new/edited file <200 LOC.

## Risks
- Rewrite drops a behavior (e.g. summary persistence). Mitigation: lift
  submitRename/onSummarySaved verbatim; diff against original 85-LOC file.
- ScrollView nesting / flex height bugs across tabs. Mitigation: each tab owns
  its own flex-1 root; only one mounted at a time.

## Unresolved Questions
- None. Tab UI uses existing visual tokens; no design sign-off needed.
