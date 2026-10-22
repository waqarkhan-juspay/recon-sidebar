import type { DirectoryData, NavbarItem } from '@juspay/blend-design-system'
import {
  ChartLine,
  ClipboardList,
  FileText,
  Folder,
  Gavel,
  History,
  House,
  ListChecks,
  Play,
  Scale,
  Ticket,
  TriangleAlert,
  Upload,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { DEFAULT_SECTIONS, MODULES } from './navigation'

/**
 * Version 2 of the sidebar: the Juspay dashboard's layout — items that open into sub-items —
 * holding version 1's items. Each version 1 module is a top-level item, and its page tabs are
 * its sub-items; a module without tabs is a plain link. Editable and shared like version 1:
 * its state lives in the same shared copy (src/layout/nav-store.ts, `v2`), separate from
 * version 1's, so the two can be arranged differently.
 *
 * Every page has an id that never changes, and its address is built from the id, so renaming
 * never breaks a link: `/v2/<id>`. The starting pages' ids read like paths
 * (`configurator/report-config`); pages added later get short generated ones.
 */

export const V2_ROOT = '/v2'

/** A top-level item: either a page itself, or an item that opens into sub-items. */
export type V2Group = {
  label: string
  /** A key of V2_ICONS. */
  icon: string
  /** Its sub-items, in order. Absent on an item that is a page itself. */
  pageIds?: string[]
  /** For an item that is a page itself. */
  description?: string
  defaultOpen?: boolean
}

export type V2PageRec = { label: string; description: string }

export type V2State = {
  sections: { id: string; groupIds: string[] }[]
  groups: Record<string, V2Group>
  pages: Record<string, V2PageRec>
}

/** Icons by name, so the shared copy can store one. Version 1's, plus a folder for new items. */
export const V2_ICONS: Record<string, LucideIcon> = {
  home: House,
  analytics: ChartLine,
  reports: FileText,
  exception: TriangleAlert,
  'upload-files': Upload,
  'run-recon': Play,
  'reconciliation-tickets': Ticket,
  configurator: Wrench,
  'dispute-management': Scale,
  'dispute-management-ops': Gavel,
  'settlement-summary': ClipboardList,
  'settlement-instructions': ListChecks,
  'recon-settlement-history': History,
  folder: Folder,
}

export const v2Icon = (name: string): LucideIcon => V2_ICONS[name] ?? Folder

export const v2SectionLabel = (id: string) => DEFAULT_SECTIONS.find((s) => s.id === id)?.label

/** How a section is named where it is not drawn as a heading — the Activity bar. */
export const v2SectionName = (id: string) => v2SectionLabel(id) ?? 'Main menu'

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Version 2 as it starts: version 1's default sidebar, with each module's tabs as its
 * sub-items. Items with sub-items start open.
 */
export function defaultV2State(): V2State {
  const state: V2State = { sections: [], groups: {}, pages: {} }
  for (const section of DEFAULT_SECTIONS) {
    for (const id of section.itemIds) {
      const mod = MODULES[id]
      const tabs = mod.tabs ?? []
      if (tabs.length === 0) {
        state.groups[id] = { label: mod.label, icon: id, description: '' }
        continue
      }
      const pageIds = tabs.map((tab) => {
        const pageId = `${id}/${slug(tab)}`
        state.pages[pageId] = { label: tab, description: '' }
        return pageId
      })
      state.groups[id] = { label: mod.label, icon: id, pageIds, defaultOpen: true }
    }
    state.sections.push({ id: section.id, groupIds: [...section.itemIds] })
  }
  return state
}

export const v2Href = (id: string) => `${V2_ROOT}/${id}`

/** Where version 2 opens: the Configurator's first tab, as version 1 does. */
export const V2_HOME = v2Href('configurator/report-config')

/** The page at an address — a sub-item, or an item that is a page itself. */
export function v2PageAt(v2: V2State, pathname: string): V2PageRec | null {
  if (!pathname.startsWith(`${V2_ROOT}/`)) return null
  const id = pathname.slice(V2_ROOT.length + 1)
  if (v2.pages[id]) return v2.pages[id]
  const group = v2.groups[id]
  if (group && !group.pageIds) return { label: group.label, description: group.description ?? '' }
  return null
}

/** The same tree in Blend's shape, for SidebarV2's own (mobile) navigation. */
export function buildNavigationDataV2(
  v2: V2State,
  activePath: string | null,
  navigate: (to: string) => void,
): DirectoryData[] {
  const leaf = (id: string, label: string, icon?: LucideIcon): NavbarItem => {
    const Icon = icon
    return {
      label,
      ...(Icon && { leftSlot: <Icon size={14} /> }),
      href: v2Href(id),
      onClick: () => navigate(v2Href(id)),
      isSelected: activePath === v2Href(id),
      showOnMobile: true,
    }
  }
  return v2.sections.map((section) => ({
    label: v2SectionLabel(section.id),
    isCollapsible: false,
    defaultOpen: true,
    items: section.groupIds.flatMap((id): NavbarItem[] => {
      const group = v2.groups[id]
      if (!group) return []
      const Icon = v2Icon(group.icon)
      if (!group.pageIds) return [leaf(id, group.label, Icon)]
      return [
        {
          label: group.label,
          leftSlot: <Icon size={14} />,
          items: group.pageIds.flatMap((p) => (v2.pages[p] ? [leaf(p, v2.pages[p].label)] : [])),
          showOnMobile: true,
        },
      ]
    }),
  }))
}
