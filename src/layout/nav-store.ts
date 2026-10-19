import { useSyncExternalStore } from 'react'
import { DEFAULT_SECTIONS, MODULES, customModule, sectionName, type NavModule } from './navigation'

/**
 * Everyone's edits to the sidebar on this branch: the order of modules, their names, the ones
 * deleted, and each page's tabs — added, renamed, reordered or deleted.
 *
 * The state lives here, in memory, and every change applies here first. src/auth/sync.ts then
 * saves it to Supabase along with a line for the version history, and feeds other people's
 * changes back in through `receive`. Only editors can change anything — guests get the
 * sidebar read-only, and the database refuses their writes regardless.
 *
 * Without Supabase configured (local development only), it falls back to localStorage and
 * a local history, so the app still runs.
 */

/** One rename, kept so the sidebar and tab row can show what an item used to be called. */
export type Change = { from: string; to: string; at: number; by?: string }

/** A line in the version history, describing a change in words. */
export type Edit = { kind: string; summary: string }

export type Role = 'editor' | 'guest'

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
  /** Who deleted it. Absent on entries from before this was recorded. */
  by?: string
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
  by?: string
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
  /** Modules people added from the sidebar, by id. Kept even once deleted, so they restore. */
  custom: Record<string, { label: string }>
}

const STORAGE_KEY = 'recon-demos:sidebar:v1'

const defaultState = (): NavState => ({
  sections: DEFAULT_SECTIONS.map(({ id, itemIds }) => ({ id, itemIds: [...itemIds] })),
  names: {},
  deleted: [],
  tabs: {},
  history: {},
  custom: {},
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
      d.kind
        ? d
        : ({ ...d, kind: 'module', key: `module:${d.id}:${d.deletedAt}` } as DeletedModule),
    ),
  }

  const custom = raw.custom ?? {}
  const known = (id: string) => !!MODULES[id] || !!custom[id]
  const seen = new Set<string>()
  const keep = (id: string) => known(id) && !seen.has(id) && !!seen.add(id)

  const stored = new Map((raw.sections ?? []).map((s) => [s.id, s.itemIds ?? []]))
  const sections = base.sections.map(({ id }) => ({
    id,
    itemIds: (stored.get(id) ?? []).filter(keep),
  }))
  const deleted = (raw.deleted as DeletedEntry[]).filter((d) =>
    d.kind === 'tab' ? known(d.moduleId) : keep(d.id),
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
    tabs: Object.fromEntries(Object.entries(raw.tabs ?? {}).filter(([id]) => known(id))),
    history: raw.history ?? {},
    custom,
  }
}

/** What this browser saved before the sidebar was shared — seeds the shared copy once. */
export function loadLocal(): NavState {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return normalise(text ? JSON.parse(text) : null)
  } catch {
    return defaultState()
  }
}

let state = defaultState()
let role: Role = 'guest'
let actor: string | undefined
/** Where a change goes once it has applied here. Null until sync connects. */
let save: ((next: NavState, edit: Edit) => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Called by sync once it knows who is here and where changes go. */
export function connect(options: {
  role: Role
  actor?: string
  initial: unknown
  save: (next: NavState, edit: Edit) => void
}) {
  role = options.role
  actor = options.actor
  save = options.save
  state = normalise(options.initial as StoredState | null)
  emit()
}

/** Someone else's change, arriving from the server. */
export function receive(raw: unknown) {
  state = normalise(raw as StoredState | null)
  emit()
}

export const getNavState = () => state
export { normalise as normaliseNavState }

function commit(next: NavState, edit: Edit) {
  if (role !== 'editor') return
  state = next
  emit()
  save?.(next, edit)
}

export function saveLocal(next: NavState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private mode or storage full: the edit still applies for this session.
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useNavState = () => useSyncExternalStore(subscribe, () => state)
/** Guests see everything but can change nothing; the controls for changing hide for them. */
export const useCanEdit = () => useSyncExternalStore(subscribe, () => role === 'editor')

export const nameOf = (s: NavState, id: string) =>
  s.names[id] ?? MODULES[id]?.label ?? s.custom[id]?.label ?? id

/** A module from the registry, or one someone added. */
export const moduleOf = (s: NavState, id: string): NavModule | undefined =>
  MODULES[id] ?? (s.custom[id] ? customModule(id, s.custom[id].label) : undefined)

const defaultLabel = (s: NavState, id: string) => MODULES[id]?.label ?? s.custom[id]?.label

export const moduleKey = (id: string) => `module:${id}`
export const tabKey = (moduleId: string, label: string) => `tab:${moduleId}:${label}`

/** Renames of one item, newest first. */
export const historyOf = (s: NavState, key: string): Change[] =>
  [...(s.history[key] ?? [])].reverse()

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
function moduleNameProblem(name: string, except?: string): string | null {
  if (!name) return 'Name can’t be empty'
  if (name.length > 40) return 'Too long — 40 characters max'
  const clash = liveIds(state).some(
    (other) => other !== except && nameOf(state, other).toLowerCase() === name.toLowerCase(),
  )
  return clash ? 'That name is taken' : null
}

/**
 * A new module at the end of a section: a blank page of its own, at `/m/<id>`. Returns the
 * new module's id, or a problem with the name.
 */
export function addModule(sectionId: string, raw: string): { id: string } | { error: string } {
  const label = raw.trim().replace(/\s+/g, ' ')
  const problem = moduleNameProblem(label)
  if (problem) return { error: problem }
  const id = `custom-${Date.now().toString(36)}`
  commit(
    {
      ...state,
      custom: { ...state.custom, [id]: { label } },
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, itemIds: [...s.itemIds, id] } : s,
      ),
    },
    { kind: 'add', summary: `Added “${label}” to ${sectionName(sectionId)}` },
  )
  return { id }
}

export function renameModule(id: string, raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  const problem = moduleNameProblem(name, id)
  if (problem) return problem

  const was = nameOf(state, id)
  if (name === was) return null
  const names = { ...state.names }
  if (name === defaultLabel(state, id)) delete names[id]
  else names[id] = name
  const history = logged(state, moduleKey(id), { from: was, to: name, at: Date.now(), by: actor })
  commit({ ...state, names, history }, { kind: 'rename', summary: `Renamed “${was}” to “${name}”` })
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
  const at = Math.max(0, Math.min(index, target.itemIds.length))
  target.itemIds.splice(at, 0, id)
  const where =
    from.id === toSectionId
      ? `position ${at + 1}`
      : `${sectionName(toSectionId)}, position ${at + 1}`
  commit(
    { ...state, sections },
    { kind: 'move', summary: `Moved “${nameOf(state, id)}” to ${where}` },
  )
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
    by: actor,
  }
  commit(
    {
      ...state,
      sections: state.sections.map((s) =>
        s.id === from.id ? { ...s, itemIds: s.itemIds.filter((other) => other !== id) } : s,
      ),
      deleted: [entry, ...state.deleted],
    },
    { kind: 'delete', summary: `Deleted “${entry.name}” from ${sectionName(from.id)}` },
  )
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
    commit(
      { ...state, deleted, history, tabs: { ...state.tabs, [entry.moduleId]: next } },
      { kind: 'restore', summary: `Restored tab “${label}” on ${nameOf(state, entry.moduleId)}` },
    )
    return
  }

  commit(
    {
      ...state,
      deleted,
      sections: state.sections.map((s) => {
        if (s.id !== entry.sectionId) return s
        const itemIds = [...s.itemIds]
        itemIds.splice(Math.min(entry.index, itemIds.length), 0, entry.id)
        return { ...s, itemIds }
      }),
    },
    { kind: 'restore', summary: `Restored “${entry.name}” to ${sectionName(entry.sectionId)}` },
  )
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
  commit(
    { ...state, tabs: { ...state.tabs, [moduleId]: [...tabsOf(state, moduleId), label] } },
    { kind: 'add-tab', summary: `Added tab “${label}” on ${nameOf(state, moduleId)}` },
  )
  return null
}

/** Returns an error to show, or null when the tab was renamed. */
export function renameTab(moduleId: string, from: string, raw: string): string | null {
  const label = cleanLabel(raw)
  if (label === from) return null
  const problem = tabProblem(moduleId, label, from)
  if (problem) return problem
  commit(
    {
      ...state,
      tabs: {
        ...state.tabs,
        [moduleId]: tabsOf(state, moduleId).map((tab) => (tab === from ? label : tab)),
      },
      history: rekey(state, tabKey(moduleId, from), tabKey(moduleId, label), {
        from,
        to: label,
        at: Date.now(),
        by: actor,
      }),
    },
    {
      kind: 'rename-tab',
      summary: `Renamed tab “${from}” to “${label}” on ${nameOf(state, moduleId)}`,
    },
  )
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
  const at = Math.max(0, Math.min(index, next.length))
  next.splice(at, 0, label)
  commit(
    { ...state, tabs: { ...state.tabs, [moduleId]: next } },
    {
      kind: 'move-tab',
      summary: `Moved tab “${label}” to position ${at + 1} on ${nameOf(state, moduleId)}`,
    },
  )
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
    by: actor,
    history: state.history[tabKey(moduleId, label)],
  }
  const { [tabKey(moduleId, label)]: _carried, ...history } = state.history
  commit(
    {
      ...state,
      history,
      deleted: [entry, ...state.deleted],
      tabs: { ...state.tabs, [moduleId]: row.filter((tab) => tab !== label) },
    },
    { kind: 'delete-tab', summary: `Deleted tab “${label}” from ${nameOf(state, moduleId)}` },
  )
}

/** Put the whole sidebar back as it was after an earlier change, as a change of its own. */
export function restoreVersion(snapshot: unknown, summary: string) {
  commit(normalise(snapshot as StoredState | null), { kind: 'restore-version', summary })
}
