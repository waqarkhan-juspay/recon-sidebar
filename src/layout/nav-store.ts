import { useSyncExternalStore } from 'react'
import { DEFAULT_SECTIONS, MODULES, customModule, sectionName, type NavModule } from './navigation'
import {
  defaultV2State,
  v2SectionName,
  type V2Group,
  type V2PageRec,
  type V2State,
} from './navigation-v2'

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

/** A version 2 top-level item, with its sub-items, kept whole so it can come back. */
export type DeletedV2Group = {
  kind: 'v2-group'
  key: string
  id: string
  name: string
  sectionId: string
  index: number
  sectionSize: number
  deletedAt: number
  by?: string
  group: V2Group
  pages: Record<string, V2PageRec>
}

/** A version 2 sub-item. */
export type DeletedV2Page = {
  kind: 'v2-page'
  key: string
  id: string
  name: string
  groupId: string
  /** Its item's name when it was deleted, for "In Configurator". */
  groupName: string
  index: number
  rowSize: number
  deletedAt: number
  by?: string
  page: V2PageRec
}

export type DeletedEntry = DeletedModule | DeletedTab | DeletedV2Group | DeletedV2Page

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
  /** Version 2 of the sidebar: its own items and sub-items (src/layout/navigation-v2.tsx). */
  v2: V2State
}

const STORAGE_KEY = 'recon-demos:sidebar:v1'

const defaultState = (): NavState => ({
  sections: DEFAULT_SECTIONS.map(({ id, itemIds }) => ({ id, itemIds: [...itemIds] })),
  names: {},
  deleted: [],
  tabs: {},
  history: {},
  custom: {},
  v2: defaultV2State(),
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
    d.kind === 'v2-group' || d.kind === 'v2-page'
      ? true
      : d.kind === 'tab'
        ? known(d.moduleId)
        : keep(d.id),
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
    v2: normaliseV2(raw.v2),
  }
}

/**
 * Version 2 as stored, made safe to draw: sections in their usual order, and no reference to
 * an item or sub-item that is not there. Saved before version 2 was editable: its start.
 */
function normaliseV2(raw: Partial<V2State> | undefined): V2State {
  if (!raw || !Array.isArray(raw.sections) || !raw.groups || !raw.pages) return defaultV2State()
  const groups: Record<string, V2Group> = {}
  const pages = raw.pages
  const seenPages = new Set<string>()
  for (const [id, group] of Object.entries(raw.groups)) {
    groups[id] = group.pageIds
      ? {
          ...group,
          pageIds: group.pageIds.filter((p) => pages[p] && !seenPages.has(p) && !!seenPages.add(p)),
        }
      : group
  }
  const seenGroups = new Set<string>()
  const stored = new Map(raw.sections.map((s) => [s.id, s.groupIds ?? []]))
  const sections = DEFAULT_SECTIONS.map(({ id }) => ({
    id,
    groupIds: (stored.get(id) ?? []).filter(
      (g) => groups[g] && !seenGroups.has(g) && !!seenGroups.add(g),
    ),
  }))
  return { sections, groups, pages }
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

  if (entry.kind === 'v2-group' || entry.kind === 'v2-page') {
    restoreV2(entry, deleted)
    return
  }

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

// --- Version 2 -----------------------------------------------------------------------------

const v2Key = (id: string) => `v2:${id}`

/** The item a sub-item belongs to. */
export const v2ParentOf = (v2: V2State, pageId: string) =>
  Object.keys(v2.groups).find((g) => v2.groups[g].pageIds?.includes(pageId))

function v2NameProblem(name: string, siblings: string[]): string | null {
  if (!name) return 'Name can’t be empty'
  if (name.length > 40) return 'Too long — 40 characters max'
  if (siblings.some((other) => other.toLowerCase() === name.toLowerCase()))
    return 'That name is taken'
  return null
}

const allV2GroupIds = (v2: V2State) => v2.sections.flatMap((s) => s.groupIds)
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`

/** Rename a top-level item. Returns a problem to show, or null. */
export function renameV2Group(id: string, raw: string): string | null {
  const v2 = state.v2
  const group = v2.groups[id]
  const name = cleanLabel(raw)
  if (!group || name === group.label) return null
  const problem = v2NameProblem(
    name,
    allV2GroupIds(v2)
      .filter((g) => g !== id)
      .map((g) => v2.groups[g].label),
  )
  if (problem) return problem
  commit(
    {
      ...state,
      v2: { ...v2, groups: { ...v2.groups, [id]: { ...group, label: name } } },
      history: logged(state, v2Key(id), { from: group.label, to: name, at: Date.now(), by: actor }),
    },
    { kind: 'v2-rename', summary: `Renamed “${group.label}” to “${name}” (version 2)` },
  )
  return null
}

/** Rename a sub-item. Returns a problem to show, or null. */
export function renameV2Page(id: string, raw: string): string | null {
  const v2 = state.v2
  const page = v2.pages[id]
  const parent = v2ParentOf(v2, id)
  const name = cleanLabel(raw)
  if (!page || !parent || name === page.label) return null
  const siblings = v2.groups[parent].pageIds!.filter((p) => p !== id).map((p) => v2.pages[p].label)
  const problem = v2NameProblem(name, siblings)
  if (problem) return problem
  commit(
    {
      ...state,
      v2: { ...v2, pages: { ...v2.pages, [id]: { ...page, label: name } } },
      history: logged(state, v2Key(id), { from: page.label, to: name, at: Date.now(), by: actor }),
    },
    {
      kind: 'v2-rename',
      summary: `Renamed “${page.label}” to “${name}” in ${v2.groups[parent].label} (version 2)`,
    },
  )
  return null
}

/** A new top-level item at the end of a section, ready for sub-items. */
export function addV2Group(sectionId: string, raw: string): { id: string } | { error: string } {
  const v2 = state.v2
  const label = cleanLabel(raw)
  const problem = v2NameProblem(
    label,
    allV2GroupIds(v2).map((g) => v2.groups[g].label),
  )
  if (problem) return { error: problem }
  const id = newId('g')
  commit(
    {
      ...state,
      v2: {
        ...v2,
        groups: { ...v2.groups, [id]: { label, icon: 'folder', pageIds: [] } },
        sections: v2.sections.map((s) =>
          s.id === sectionId ? { ...s, groupIds: [...s.groupIds, id] } : s,
        ),
      },
    },
    { kind: 'v2-add', summary: `Added “${label}” to ${v2SectionName(sectionId)} (version 2)` },
  )
  return { id }
}

/**
 * A new sub-item at the end of an item. An item that was a page by itself becomes one that
 * opens into sub-items.
 */
export function addV2Page(groupId: string, raw: string): { id: string } | { error: string } {
  const v2 = state.v2
  const group = v2.groups[groupId]
  if (!group) return { error: 'That item is gone' }
  const label = cleanLabel(raw)
  const siblings = (group.pageIds ?? []).map((p) => v2.pages[p].label)
  const problem = v2NameProblem(label, siblings)
  if (problem) return { error: problem }
  const id = newId('p')
  commit(
    {
      ...state,
      v2: {
        ...v2,
        pages: { ...v2.pages, [id]: { label, description: '' } },
        groups: {
          ...v2.groups,
          [groupId]: { ...group, pageIds: [...(group.pageIds ?? []), id] },
        },
      },
    },
    { kind: 'v2-add', summary: `Added “${label}” to ${group.label} (version 2)` },
  )
  return { id }
}

/** Move a top-level item to `toIndex` in a section, the index counted before it is taken out. */
export function moveV2Group(id: string, toSectionId: string, toIndex: number) {
  const v2 = state.v2
  const from = v2.sections.find((s) => s.groupIds.includes(id))
  if (!from) return
  const fromIndex = from.groupIds.indexOf(id)
  let index = toIndex
  if (from.id === toSectionId && fromIndex < toIndex) index -= 1
  if (from.id === toSectionId && index === fromIndex) return
  const sections = v2.sections.map((s) => ({ ...s, groupIds: s.groupIds.filter((g) => g !== id) }))
  const target = sections.find((s) => s.id === toSectionId)!
  const at = Math.max(0, Math.min(index, target.groupIds.length))
  target.groupIds.splice(at, 0, id)
  const where =
    from.id === toSectionId
      ? `position ${at + 1}`
      : `${v2SectionName(toSectionId)}, position ${at + 1}`
  commit(
    { ...state, v2: { ...v2, sections } },
    { kind: 'v2-move', summary: `Moved “${v2.groups[id].label}” to ${where} (version 2)` },
  )
}

/**
 * Move a sub-item to `toIndex` under an item — its own or another — the index counted before
 * it is taken out.
 */
export function moveV2Page(id: string, toGroupId: string, toIndex: number) {
  const v2 = state.v2
  const fromGroupId = v2ParentOf(v2, id)
  const target = v2.groups[toGroupId]
  if (!fromGroupId || !target) return
  const fromIds = v2.groups[fromGroupId].pageIds!
  const fromIndex = fromIds.indexOf(id)
  let index = toIndex
  if (fromGroupId === toGroupId && fromIndex < toIndex) index -= 1
  if (fromGroupId === toGroupId && index === fromIndex) return
  if (fromGroupId !== toGroupId) {
    const clash = (target.pageIds ?? []).some(
      (p) => v2.pages[p].label.toLowerCase() === v2.pages[id].label.toLowerCase(),
    )
    if (clash) return
  }
  const groups = { ...v2.groups }
  groups[fromGroupId] = { ...groups[fromGroupId], pageIds: fromIds.filter((p) => p !== id) }
  const into = [...(groups[toGroupId].pageIds ?? [])]
  const at = Math.max(0, Math.min(index, into.length))
  into.splice(at, 0, id)
  groups[toGroupId] = { ...groups[toGroupId], pageIds: into }
  const where =
    fromGroupId === toGroupId
      ? `position ${at + 1} in ${target.label}`
      : `${target.label}, position ${at + 1}`
  commit(
    { ...state, v2: { ...v2, groups } },
    { kind: 'v2-move', summary: `Moved “${v2.pages[id].label}” to ${where} (version 2)` },
  )
}

/** Delete a top-level item and its sub-items; all of it waits in Recently deleted. */
export function deleteV2Group(id: string) {
  const v2 = state.v2
  const from = v2.sections.find((s) => s.groupIds.includes(id))
  const group = v2.groups[id]
  if (!from || !group) return
  const deletedAt = Date.now()
  const pages = Object.fromEntries((group.pageIds ?? []).map((p) => [p, v2.pages[p]]))
  const entry: DeletedV2Group = {
    kind: 'v2-group',
    key: `v2-group:${id}:${deletedAt}`,
    id,
    name: group.label,
    sectionId: from.id,
    index: from.groupIds.indexOf(id),
    sectionSize: from.groupIds.length,
    deletedAt,
    by: actor,
    group,
    pages,
  }
  const { [id]: _group, ...groups } = v2.groups
  const remainingPages = Object.fromEntries(Object.entries(v2.pages).filter(([p]) => !(p in pages)))
  commit(
    {
      ...state,
      deleted: [entry, ...state.deleted],
      v2: {
        sections: v2.sections.map((s) =>
          s.id === from.id ? { ...s, groupIds: s.groupIds.filter((g) => g !== id) } : s,
        ),
        groups,
        pages: remainingPages,
      },
    },
    {
      kind: 'v2-delete',
      summary: `Deleted “${group.label}” from ${v2SectionName(from.id)} (version 2)`,
    },
  )
}

/** Delete a sub-item; it waits in Recently deleted. */
export function deleteV2Page(id: string) {
  const v2 = state.v2
  const groupId = v2ParentOf(v2, id)
  const page = v2.pages[id]
  if (!groupId || !page) return
  const group = v2.groups[groupId]
  const deletedAt = Date.now()
  const entry: DeletedV2Page = {
    kind: 'v2-page',
    key: `v2-page:${id}:${deletedAt}`,
    id,
    name: page.label,
    groupId,
    groupName: group.label,
    index: group.pageIds!.indexOf(id),
    rowSize: group.pageIds!.length,
    deletedAt,
    by: actor,
    page,
  }
  const { [id]: _page, ...pages } = v2.pages
  commit(
    {
      ...state,
      deleted: [entry, ...state.deleted],
      v2: {
        ...v2,
        pages,
        groups: {
          ...v2.groups,
          [groupId]: { ...group, pageIds: group.pageIds!.filter((p) => p !== id) },
        },
      },
    },
    { kind: 'v2-delete', summary: `Deleted “${page.label}” from ${group.label} (version 2)` },
  )
}

/** A sub-item can only go back under its item, so not while that item is deleted too. */
export const canRestore = (s: NavState, entry: DeletedEntry) =>
  entry.kind !== 'v2-page' || !!s.v2.groups[entry.groupId]

function restoreV2(entry: DeletedV2Group | DeletedV2Page, deleted: DeletedEntry[]) {
  const v2 = state.v2
  if (entry.kind === 'v2-page') {
    const group = v2.groups[entry.groupId]
    if (!group) return
    const pageIds = [...(group.pageIds ?? [])]
    pageIds.splice(Math.min(entry.index, pageIds.length), 0, entry.id)
    commit(
      {
        ...state,
        deleted,
        v2: {
          ...v2,
          pages: { ...v2.pages, [entry.id]: entry.page },
          groups: { ...v2.groups, [entry.groupId]: { ...group, pageIds } },
        },
      },
      { kind: 'v2-restore', summary: `Restored “${entry.name}” to ${group.label} (version 2)` },
    )
    return
  }
  // Someone may have used the name since.
  let label = entry.group.label
  const taken = allV2GroupIds(v2).map((g) => v2.groups[g].label.toLowerCase())
  while (taken.includes(label.toLowerCase())) label += ' (restored)'
  const sectionId = v2.sections.some((s) => s.id === entry.sectionId)
    ? entry.sectionId
    : v2.sections[0].id
  commit(
    {
      ...state,
      deleted,
      v2: {
        groups: { ...v2.groups, [entry.id]: { ...entry.group, label } },
        pages: { ...v2.pages, ...entry.pages },
        sections: v2.sections.map((s) => {
          if (s.id !== sectionId) return s
          const groupIds = [...s.groupIds]
          groupIds.splice(Math.min(entry.index, groupIds.length), 0, entry.id)
          return { ...s, groupIds }
        }),
      },
    },
    {
      kind: 'v2-restore',
      summary: `Restored “${label}” to ${v2SectionName(sectionId)} (version 2)`,
    },
  )
}

export const v2HistoryOf = (s: NavState, id: string) => historyOf(s, v2Key(id))
