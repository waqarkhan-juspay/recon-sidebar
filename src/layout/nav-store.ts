import { useSyncExternalStore } from 'react'
import { DEFAULT_SECTIONS, MODULES } from './navigation'

/**
 * Everyone's edits to the sidebar on this branch: the order of modules, their names, the ones
 * deleted, and each page's tabs — added, renamed or deleted.
 *
 * Kept in localStorage, so there is no sign-in and no permission gate — anyone who opens the
 * link can edit. It is per browser: one person's edits are not seen by another. Other tabs in
 * the same browser stay in sync through the `storage` event.
 */

/** One rename, kept so the sidebar and tab row can show what an item used to be called. */
export type Change = { from: string; to: string; at: number }

export type DeletedModule = {
  kind: 'module'
  /** Unique within the deleted list. */
  key: string
  id: string
  /** The name it had when deleted, which may not be the default. */
  name: string
  sectionId: string
  /** Zero-based position in that section at the moment of deleting. */
  index: number
  /** How many modules the section had then, so "4 of 19" can be said later. */
  sectionSize: number
  deletedAt: number
}

export type DeletedTab = {
  kind: 'tab'
  key: string
  moduleId: string
  label: string
  /** Zero-based position in the page's tab row at the moment of deleting. */
  index: number
  rowSize: number
  deletedAt: number
  /** The tab's rename history, carried while it is deleted and put back on restore. */
  history?: Change[]
}

export type DeletedEntry = DeletedModule | DeletedTab

export type NavState = {
  sections: { id: string; itemIds: string[] }[]
  names: Record<string, string>
  /** Newest first. */
  deleted: DeletedEntry[]
  /** A page's whole tab row, once anyone has changed it. Absent means the registry's tabs. */
  tabs: Record<string, string[]>
  /**
   * Renames, oldest first, keyed `module:<id>` or `tab:<moduleId>:<label>`. A tab is known only
   * by its label, so its history moves to the new key whenever it is renamed.
   */
  history: Record<string, Change[]>
}

const STORAGE_KEY = 'recon-demos:sidebar:v1'

const defaultState = (): NavState => ({
  sections: DEFAULT_SECTIONS.map(({ id, itemIds }) => ({ id, itemIds: [...itemIds] })),
  names: {},
  deleted: [],
  tabs: {},
  history: {},
})

type StoredState = Partial<Omit<NavState, 'deleted'>> & {
  deleted?: (DeletedEntry | (Omit<DeletedModule, 'kind' | 'key'> & { kind?: undefined }))[]
  addedTabs?: Record<string, string[]>
}

/**
 * Reconcile what was stored with the registry as it is now: drop modules and sections that
 * no longer exist, and put back any module that is in neither the sidebar nor the deleted
 * list — a new route added after someone saved.
 */
function normalise(raw: StoredState | null): NavState {
  const base = defaultState()
  if (!raw || !Array.isArray(raw.sections)) return base

  // Saved before tabs could be renamed or deleted: added tabs were kept on their own, and
  // deleted entries were all modules.
  const tabs: Record<string, string[]> = { ...raw.tabs }
  for (const [id, added] of Object.entries(raw.addedTabs ?? {})) {
    tabs[id] ??= [...(MODULES[id]?.tabs ?? []), ...added]
  }
  raw = {
    ...raw,
    tabs,
    deleted: (raw.deleted ?? []).map((d) =>
      d.kind ? d : ({ ...d, kind: 'module', key: `module:${d.id}:${d.deletedAt}` } as DeletedModule),
    ),
  }

  const seen = new Set<string>()
  const keep = (id: string) => !!MODULES[id] && !seen.has(id) && !!seen.add(id)

  const stored = new Map((raw.sections ?? []).map((s) => [s.id, s.itemIds ?? []]))
  const sections = base.sections.map(({ id }) => ({
    id,
    itemIds: (stored.get(id) ?? []).filter(keep),
  }))
  const deleted = (raw.deleted as DeletedEntry[]).filter((d) =>
    d.kind === 'tab' ? !!MODULES[d.moduleId] : keep(d.id),
  )

  for (const section of DEFAULT_SECTIONS) {
    for (const id of section.itemIds) {
      if (!seen.has(id)) {
        seen.add(id)
        sections.find((s) => s.id === section.id)!.itemIds.push(id)
      }
    }
  }

  return {
    sections,
    names: raw.names ?? {},
    deleted,
    tabs: Object.fromEntries(Object.entries(raw.tabs ?? {}).filter(([id]) => !!MODULES[id])),
    history: raw.history ?? {},
  }
}

function load(): NavState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return normalise(text ? JSON.parse(text) : null)
  } catch {
    return defaultState()
  }
}

let state = load()
const listeners = new Set<() => void>()

function commit(next: NavState) {
  state = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: the edit still applies for this session.
  }
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    state = load()
    listeners.forEach((l) => l())
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useNavState = () => useSyncExternalStore(subscribe, () => state)

export const nameOf = (s: NavState, id: string) => s.names[id] ?? MODULES[id]?.label ?? id

export const moduleKey = (id: string) => `module:${id}`
export const tabKey = (moduleId: string, label: string) => `tab:${moduleId}:${label}`

/** Renames of one item, newest first. */
export const historyOf = (s: NavState, key: string): Change[] => [...(s.history[key] ?? [])].reverse()

const logged = (s: NavState, key: string, change: Change) => ({
  ...s.history,
  [key]: [...(s.history[key] ?? []), change],
})

/** Move a tab's history from one key to another, optionally adding a change. */
function rekey(s: NavState, from: string, to: string, change?: Change) {
  const { [from]: moved = [], ...rest } = s.history
  const next = change ? [...moved, change] : moved
  return next.length ? { ...rest, [to]: next } : rest
}

const liveIds = (s: NavState) => s.sections.flatMap((section) => section.itemIds)

/** Returns an error to show, or null when the rename went through. */
export function renameModule(id: string, raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return 'Name can’t be empty'
  if (name.length > 40) return 'Too long — 40 characters max'
  const clash = liveIds(state).some(
    (other) => other !== id && nameOf(state, other).toLowerCase() === name.toLowerCase(),
  )
  if (clash) return 'That name is taken'

  const was = nameOf(state, id)
  if (name === was) return null
  const names = { ...state.names }
  if (name === MODULES[id]?.label) delete names[id]
  else names[id] = name
  const history = logged(state, moduleKey(id), { from: was, to: name, at: Date.now() })
  commit({ ...state, names, history })
  return null
}

/** Move a module to `toIndex` in `toSectionId`, the index counted before it is taken out. */
export function moveModule(id: string, toSectionId: string, toIndex: number) {
  const from = state.sections.find((s) => s.itemIds.includes(id))
  if (!from) return
  const fromIndex = from.itemIds.indexOf(id)
  let index = toIndex
  if (from.id === toSectionId && fromIndex < toIndex) index -= 1
  if (from.id === toSectionId && index === fromIndex) return

  const sections = state.sections.map((s) => ({
    ...s,
    itemIds: s.itemIds.filter((other) => other !== id),
  }))
  const target = sections.find((s) => s.id === toSectionId)!
  target.itemIds.splice(Math.max(0, Math.min(index, target.itemIds.length)), 0, id)
  commit({ ...state, sections })
}

export function deleteModule(id: string) {
  const from = state.sections.find((s) => s.itemIds.includes(id))
  if (!from) return
  const deletedAt = Date.now()
  const entry: DeletedModule = {
    kind: 'module',
    key: `module:${id}:${deletedAt}`,
    id,
    name: nameOf(state, id),
    sectionId: from.id,
    index: from.itemIds.indexOf(id),
    sectionSize: from.itemIds.length,
    deletedAt,
  }
  commit({
    ...state,
    sections: state.sections.map((s) =>
      s.id === from.id ? { ...s, itemIds: s.itemIds.filter((other) => other !== id) } : s,
    ),
    deleted: [entry, ...state.deleted],
  })
}

/** Put a deleted module or tab back where it was — or as near as that place now allows. */
export function restore(key: string) {
  const entry = state.deleted.find((d) => d.key === key)
  if (!entry) return
  const deleted = state.deleted.filter((d) => d.key !== key)

  if (entry.kind === 'tab') {
    const row = tabsOf(state, entry.moduleId)
    let label = entry.label
    // Someone may have added a tab with the same name since.
    while (row.some((tab) => tab.toLowerCase() === label.toLowerCase())) label += ' (restored)'
    const next = [...row]
    next.splice(Math.min(entry.index, next.length), 0, label)
    const history = entry.history?.length
      ? { ...state.history, [tabKey(entry.moduleId, label)]: entry.history }
      : state.history
    commit({ ...state, deleted, history, tabs: { ...state.tabs, [entry.moduleId]: next } })
    return
  }

  commit({
    ...state,
    deleted,
    sections: state.sections.map((s) => {
      if (s.id !== entry.sectionId) return s
      const itemIds = [...s.itemIds]
      itemIds.splice(Math.min(entry.index, itemIds.length), 0, entry.id)
      return { ...s, itemIds }
    }),
  })
}

/** A page's tab row as it stands — the registry's, unless someone has changed it. */
export const tabsOf = (s: NavState, moduleId: string) =>
  s.tabs[moduleId] ?? MODULES[moduleId]?.tabs ?? []

const cleanLabel = (raw: string) => raw.trim().replace(/\s+/g, ' ')

function tabProblem(moduleId: string, label: string, except?: string): string | null {
  if (!label) return 'Name the tab'
  if (label.length > 40) return 'Too long — 40 characters max'
  const clash = tabsOf(state, moduleId).some(
    (tab) => tab !== except && tab.toLowerCase() === label.toLowerCase(),
  )
  return clash ? 'This page already has that tab' : null
}

/** Returns an error to show, or null when the tab was added. */
export function addTab(moduleId: string, raw: string): string | null {
  const label = cleanLabel(raw)
  const problem = tabProblem(moduleId, label)
  if (problem) return problem
  commit({ ...state, tabs: { ...state.tabs, [moduleId]: [...tabsOf(state, moduleId), label] } })
  return null
}

/** Returns an error to show, or null when the tab was renamed. */
export function renameTab(moduleId: string, from: string, raw: string): string | null {
  const label = cleanLabel(raw)
  if (label === from) return null
  const problem = tabProblem(moduleId, label, from)
  if (problem) return problem
  commit({
    ...state,
    tabs: {
      ...state.tabs,
      [moduleId]: tabsOf(state, moduleId).map((tab) => (tab === from ? label : tab)),
    },
    history: rekey(state, tabKey(moduleId, from), tabKey(moduleId, label), {
      from,
      to: label,
      at: Date.now(),
    }),
  })
  return null
}

/** Move a tab to `toIndex` in its row, the index counted before it is taken out. */
export function moveTab(moduleId: string, label: string, toIndex: number) {
  const row = tabsOf(state, moduleId)
  const from = row.indexOf(label)
  if (from === -1) return
  const index = from < toIndex ? toIndex - 1 : toIndex
  if (index === from) return
  const next = row.filter((tab) => tab !== label)
  next.splice(Math.max(0, Math.min(index, next.length)), 0, label)
  commit({ ...state, tabs: { ...state.tabs, [moduleId]: next } })
}

export function deleteTab(moduleId: string, label: string) {
  const row = tabsOf(state, moduleId)
  const index = row.indexOf(label)
  if (index === -1) return
  const deletedAt = Date.now()
  const entry: DeletedTab = {
    kind: 'tab',
    key: `tab:${moduleId}:${label}:${deletedAt}`,
    moduleId,
    label,
    index,
    rowSize: row.length,
    deletedAt,
    history: state.history[tabKey(moduleId, label)],
  }
  const { [tabKey(moduleId, label)]: _carried, ...history } = state.history
  commit({
    ...state,
    history,
    deleted: [entry, ...state.deleted],
    tabs: { ...state.tabs, [moduleId]: row.filter((tab) => tab !== label) },
  })
}
