import type { RealtimeChannel, Session as AuthSession } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import {
  connect,
  getNavState,
  loadLocal,
  receive,
  saveLocal,
  type Edit,
  type NavState,
} from '../layout/nav-store'
import { key, supabase, url } from './supabase'

/**
 * Who is looking at the app, and the wiring between the sidebar store and Supabase.
 *
 *   loading       working out whether there is a session
 *   signed-out    the sign-in screen, opened from the footer's Sign in
 *   denied        signed in with an email that is not an editor
 *   guest         where everyone starts: everything visible, nothing editable
 *   editor        one of the whitelisted emails
 *   unconfigured  a production build without Supabase settings — refuses to run
 *
 * Local development without Supabase settings skips sign-in and edits a local copy, so the
 * app can still be worked on. A production build never does that.
 */
export type Session =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'denied'; email: string }
  | { status: 'guest' }
  | { status: 'editor'; email: string }
  | { status: 'unconfigured' }

/** One line of the version history. */
export type HistoryEvent = {
  id: string
  at: number
  actor: string
  kind: string
  summary: string
  snapshot: unknown
}

const LOCAL_HISTORY_KEY = 'recon-demos:history:v1'
const LOCAL_ACTOR = 'you@localhost'

let session: Session = { status: 'loading' }
let history: HistoryEvent[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useSession = () => useSyncExternalStore(subscribe, () => session)
/** Newest first. Empty for guests, who are not shown it. */
export const useHistory = () => useSyncExternalStore(subscribe, () => history)

function set(next: Session) {
  session = next
  emit()
}

/** "jane.doe@juspay.in" → "Jane Doe". */
export function displayName(email: string) {
  const local = email.split('@')[0] ?? email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

// --- Sign-in ---------------------------------------------------------------------------

/**
 * Off to Google's account picker, limited to juspay.in accounts, and back to the page the
 * visitor was on. Returns a problem to show if it cannot go.
 *
 * Whether the account may edit is decided after it comes back (`is_editor`, in the
 * database): anyone at juspay.in can sign in, only the whitelist gets past `denied`.
 */
export async function signInWithGoogle(): Promise<string | null> {
  if (!supabase) return 'Sign-in is not set up'
  // Leaving for a provider Supabase has switched off lands on a bare JSON error page.
  try {
    const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } })
    const settings = (await response.json()) as { external?: { google?: boolean } }
    if (!settings.external?.google) return 'Google sign-in isn’t switched on yet.'
  } catch {
    return 'Couldn’t reach the sign-in server. Try again.'
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      queryParams: { hd: 'juspay.in', prompt: 'select_account' },
    },
  })
  return error ? error.message : null
}

export function continueAsGuest() {
  void enter({ status: 'guest' })
}

/** The sign-in screen, for a guest who wants to edit (the footer's Sign in). */
export function showSignIn() {
  set({ status: 'signed-out' })
}

async function leave() {
  disconnect()
  if (supabase) await supabase.auth.signOut()
}

/** Sign out, and carry on looking as a guest. */
export async function signOut() {
  await leave()
  continueAsGuest()
}

/** Sign out, and back to the sign-in screen to choose another Google account. */
export async function switchAccount() {
  await leave()
  showSignIn()
}

// --- Start-up --------------------------------------------------------------------------

let started = false

/** Called once, from AuthGate. */
export function start() {
  if (started) return
  started = true

  if (!supabase) {
    if (import.meta.env.DEV) startLocal()
    else set({ status: 'unconfigured' })
    return
  }

  supabase.auth.onAuthStateChange((event, authSession) => {
    // Supabase calls back inside its own lock; anything that queries must run after it.
    setTimeout(() => {
      if (event === 'SIGNED_OUT') return
      if (authSession && session.status !== 'editor') void fromAuth(authSession)
    }, 0)
  })

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) return fromAuth(data.session)
    // No sign-in screen up front: everyone lands in the dashboard as a guest, and editors
    // sign in from the sidebar footer when they want to make changes.
    return enter({ status: 'guest' })
  })
}

async function fromAuth(authSession: AuthSession) {
  const email = authSession.user.email ?? ''
  const { data: isEditor, error } = await supabase!.rpc('is_editor')
  if (error || !isEditor) {
    set({ status: 'denied', email })
    return
  }
  await enter({ status: 'editor', email })
}

// --- Shared sync -----------------------------------------------------------------------

let channel: RealtimeChannel | null = null
/** Saves of ours still in flight. Our own echoes are ignored until they have all landed. */
let pending = 0

function disconnect() {
  if (channel && supabase) void supabase.removeChannel(channel)
  channel = null
  history = []
}

/**
 * One entry at a time. Supabase reports a sign-in from more than one place (the redirect's
 * auth event and `getSession` both fire on the way back from Google), and two entries racing
 * would each find no shared sidebar and each seed one.
 */
let entering: Promise<void> | null = null

function enter(next: Session & { status: 'guest' | 'editor' }) {
  entering ??= connectAs(next).finally(() => {
    entering = null
  })
  return entering
}

async function connectAs(next: Session & { status: 'guest' | 'editor' }) {
  const db = supabase!
  const me = next.status === 'editor' ? next.email : undefined

  const { data: row } = await db.from('nav_state').select('state').eq('id', 1).maybeSingle()

  let initial: unknown = row?.state ?? null
  // The very first editor in seeds the shared sidebar from what their browser had.
  const seed = !row && me ? loadLocal() : null
  if (seed) initial = seed

  connect({
    role: next.status,
    actor: me,
    initial,
    save: (state, edit) => void push(state, edit),
  })
  if (seed) void push(getNavState(), { kind: 'seed', summary: 'Started the shared sidebar' })

  disconnect()
  if (me) await loadHistory()
  channel = db
    .channel('sidebar')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nav_state' }, (payload) => {
      const updated = payload.new as { state?: unknown; updated_by?: string } | undefined
      if (!updated?.state) return
      if (pending > 0 && updated.updated_by === me) return
      receive(updated.state)
    })
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'nav_events' },
      (payload) => {
        const event = toEvent(payload.new as EventRow)
        if (history.some((h) => h.id === event.id)) return
        history = [event, ...history]
        emit()
      },
    )
    .subscribe()

  set(next)
}

type EventRow = {
  id: number
  at: string
  actor_email: string
  kind: string
  summary: string
  snapshot: unknown
}

const toEvent = (row: EventRow): HistoryEvent => ({
  id: String(row.id),
  at: new Date(row.at).getTime(),
  actor: row.actor_email,
  kind: row.kind,
  summary: row.summary,
  snapshot: row.snapshot,
})

async function loadHistory() {
  const { data } = await supabase!
    .from('nav_events')
    .select('id, at, actor_email, kind, summary, snapshot')
    .order('id', { ascending: false })
    .limit(200)
  history = (data ?? []).map((row) => toEvent(row as EventRow))
  emit()
}

async function push(state: NavState, edit: Edit) {
  pending += 1
  const { error } = await supabase!.rpc('save_nav', {
    new_state: state,
    change_kind: edit.kind,
    change_summary: edit.summary,
  })
  pending -= 1
  if (error) {
    console.error('[sidebar] Save failed, reloading the shared copy.', error)
    const { data: row } = await supabase!
      .from('nav_state')
      .select('state')
      .eq('id', 1)
      .maybeSingle()
    receive(row?.state ?? null)
  }
}

// --- Local development without Supabase -----------------------------------------------

function startLocal() {
  try {
    history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) ?? '[]')
  } catch {
    history = []
  }
  connect({
    role: 'editor',
    actor: LOCAL_ACTOR,
    initial: loadLocal(),
    save: (state, edit) => {
      saveLocal(state)
      history = [
        {
          id: String(Date.now()),
          at: Date.now(),
          actor: LOCAL_ACTOR,
          kind: edit.kind,
          summary: edit.summary,
          snapshot: state,
        },
        ...history,
      ].slice(0, 200)
      try {
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history))
      } catch {
        // History is a nicety locally; losing it is fine.
      }
      emit()
    },
  })
  set({ status: 'editor', email: LOCAL_ACTOR })
}
