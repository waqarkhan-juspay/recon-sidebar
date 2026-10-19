import './suppress-blend-noise'

import {
  FOUNDATION_THEME,
  SnackbarV2,
  SnackbarV2Position,
  ThemeProvider,
} from '@juspay/blend-design-system'
import '@juspay/blend-design-system/style.css'
import { Agentation } from 'agentation'
import { DialRoot } from 'dialkit'
import 'dialkit/styles.css'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { SHOW_DIALKIT, SHOW_MESURER } from './dev-tools'
import AuthGate from './auth/AuthGate'
import { router } from './router.tsx'
import { componentTokens } from './theme'

/**
 * TEMPORARY — agentation's toolbar (bottom right), hidden on 2026-09-18 to clear it out of a
 * demo. Flip back to `true` when the demo is over; nothing else about the mount changed.
 *
 * Its two companions moved to src/dev-tools.ts, which is where SHOW_DIALKIT and SHOW_MESURER
 * are set: both are read by more files than this one. This flag is read only here and in
 * vite.config.ts, so it stays put.
 */
const SHOW_AGENTATION = false

/**
 * Mesurer — the inspector that replaced spacingjs on 2026-09-21. Where spacingjs did one
 * thing (Alt-hover two elements, read the gap), this brings guides, rulers, measurements,
 * X-ray, colour and type sampling, and annotations that can be handed to an agent. Press M
 * to toggle it; its other single-key shortcuts stand down inside inputs, textareas and
 * contenteditable, so they do not fight the forms in this app.
 *
 * Dev only, and the ternary is what makes that true rather than merely intended. Gating the
 * *render* is not enough: `lazy()` is called while this module evaluates, so the factory —
 * and the `import()` inside it — survives into the build as its own chunk however dead the
 * JSX below is. Verified: that shape emitted a 365 KB chunk and a 31 KB stylesheet into
 * `dist/`. Putting the whole `lazy(…)` call in the true branch of a condition that
 * `import.meta.env.DEV` inlines to `false` is what lets the bundler fold it away, which is
 * the same trick the spacingjs line used — the import has to sit inside the dead code, not
 * beside it.
 *
 * A top-level `import { Mesurer } from 'mesurer'` would be worse still: the package marks
 * `sideEffects: ["*.css"]`, so the stylesheet ships to production even with nothing left to
 * render it.
 */
const Mesurer = SHOW_MESURER && import.meta.env.DEV
  ? lazy(async () => {
      try {
        const [mesurer] = await Promise.all([
          import('mesurer'),
          import('mesurer/styles.css'),
          // Our one correction to its CSS — see src/mesurer.css. It loads here rather than
          // from index.css so that it too stays out of the production stylesheet; a rule
          // for an overlay that cannot exist in prod has no business shipping there.
          import('./mesurer.css'),
        ])
        return { default: mesurer.Mesurer }
      } catch (error) {
        // A rejected `lazy` factory throws during render, and with no error boundary above
        // it that unmounts the entire app — a blank page, caused by a tool that is only
        // here to look at the app. Vite's own dep optimizer is enough to trigger it: install
        // a package while the dev server is up and the next load is a 504 Outdated Optimize
        // Dep. So the failure degrades to "no inspector" and says why.
        console.warn('[mesurer] inspector did not load; continuing without it.', error)
        return { default: () => null }
      }
    })
  : null

/**
 * The one colour the document itself needs, handed to index.css rather than written there.
 *
 * `body { background-color: var(--app-surface) }` is the consumer; see the comment on that
 * rule for why the app needs to name its own canvas at all. It is set here because this is
 * the file that already owns the document — and because rule 1 puts every colour in a token,
 * which a stylesheet cannot read.
 *
 * Before `createRoot`, so the surface is in place for the first paint rather than arriving a
 * commit later.
 */
// `!` because the token map is indexed and so types every ramp step as possibly missing;
// gray[0] is white and has shipped in every version of the foundation.
document.documentElement.style.setProperty('--app-surface', FOUNDATION_THEME.colors.gray[0]!)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider componentTokens={componentTokens}>
      {/* Sign in, or continue as a guest, before any of the app renders. */}
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
      {/* Collapsed on load. DialRoot's own default is `defaultOpen = true`, which puts an
          open panel over the top-right of every page before anyone has asked for one —
          the toolbar's launcher button is enough of an affordance. */}
      {SHOW_DIALKIT && <DialRoot defaultOpen={false} />}
      {/* The app's one toaster — `addSnackbarV2()` is a function call, not a component, so
          something has to be mounted for it to render into. Once, here, rather than per
          screen: two hosts would mean two stacks racing for the same corner.

          Bottom *left*. Blend defaults to bottom-right, which is where this app's one
          persistent overlay lives — the config detail sheet is 600px of right-hand column,
          and the toast it raises would open underneath it. The left corner is the one that
          is free whatever is on screen.

          Inside ThemeProvider, because the toast reads SNACKBARV2 tokens like anything else
          Blend draws. */}
      <SnackbarV2 position={SnackbarV2Position.BOTTOM_LEFT} />
    </ThemeProvider>
    {/* Visual feedback toolbar. Dev only — `import.meta.env.DEV` is inlined as
        `false` at build time, so the whole subtree is dropped from prod bundles.

        The endpoint is origin-relative on purpose. The toolbar polls `<endpoint>/health`
        every 10 seconds and the prop is the only gate on it (agentation/dist/index.mjs:
        `if (!endpoint || !mounted) return`), so a hardcoded localhost:4747 — which is
        what this used to be — meant a failed request every 10s for the life of the tab
        whenever nothing was listening there.

        `/agentation` is served by the dev server itself (vite.config.ts), which starts
        the feedback server and proxies to it. Being same-origin, it follows the app to
        whatever port Vite is bound to and needs no CORS. */}
    {SHOW_AGENTATION && import.meta.env.DEV && <Agentation endpoint="/agentation" />}
    {/* Outside ThemeProvider: Mesurer measures the app, it is not part of it, and it
        renders through its own portal rather than into this tree. `fallback={null}`
        because there is nothing to show while a dev tool loads — it simply appears. */}
    {Mesurer && (
      <Suspense fallback={null}>
        {/* Collapsed and inert on load, the same bargain DialRoot gets above: a tool that
            is occasionally wanted should not be occupying the page before it is asked for.

            Both flags, because they turn off different things. `minimized` is the visual
            half — it shrinks the toolbar to the single icon that expands it again. `enabled`
            is the behavioural half, and it is the one that matters: left on, Mesurer's
            overlay takes pointer events across the whole viewport, so the first click
            anywhere in the app is spent on the inspector instead of the app. */}
        <Mesurer initialState={{ enabled: false, minimized: true }} />
      </Suspense>
    )}
  </StrictMode>,
)
