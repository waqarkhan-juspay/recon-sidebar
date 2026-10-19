/**
 * The in-app development tools, and whether this build shows them.
 *
 * Both are off on the `sidebar` branch (2026-10-19) — it is a demo for the reconciliation
 * team. They were also off on 2026-09-22 for a demo and back on the same day. Flip either
 * back to `true` to bring it back; nothing is uninstalled and no code is deleted.
 *
 * They live here rather than in `src/main.tsx` because `SHOW_DIALKIT` is read in three
 * places: main.tsx mounts (or does not mount) `DialRoot`, and the two dial panels under
 * `src/pages/create-report-config/` have to know as well. A panel nobody can open still
 * *reads* its persisted value, so hiding the launcher alone would leave a browser pinned to
 * whatever version it last chose, with no UI left to change it back — see the note on the
 * clamp in fields-layout.tsx.
 */

/** DialKit — the version/spacing panels, launched from the button at top right. */
export const SHOW_DIALKIT = false

/**
 * Mesurer — the measure-and-annotate inspector, toggled with `M`.
 *
 * Read in main.tsx *inside* the condition that guards its `lazy()` factory, not beside it:
 * the `import()` has to sit in the dead branch or it survives into the build as its own
 * 365 KB chunk however dead the JSX is. Same reason `import.meta.env.DEV` is spelled out
 * there rather than here.
 */
export const SHOW_MESURER = false
