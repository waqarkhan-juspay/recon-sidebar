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
import { DEFAULT_SECTIONS } from './navigation'

/**
 * Version 2 of the sidebar: the Juspay dashboard's layout — items that open into sub-items —
 * built from version 1's modules, regrouped (SEED below). Editable and shared like version 1:
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

/** An item: its name, its icon, and its sub-items — or `null` for a plain link. */
type Seed = [label: string, icon: string, subItems: string[] | null]

/**
 * Version 2 as it starts — the sidebar as Waqar laid it out (2026-10-22): version 1's
 * modules, regrouped. Analytics and Reports open into their reports, Upload Files gains two,
 * Dispute Management takes OPS in, and Settlement gathers its summary, instructions, vendor
 * and beneficiary pages. Ids come from the names, so addresses read well:
 * `/v2/reports/gateway-vs-bank`. Every item with sub-items starts open.
 */
const SEED: Record<string, Seed[]> = {
  main: [['Home', 'home', null]],
  reconciliation: [
    [
      'Analytics',
      'analytics',
      [
        'Recon Analytics',
        'Fee Analytics (to be developed)',
        'Settlement Analytics (to be developed)',
      ],
    ],
    ['Reports', 'reports', ['Merchant vs Gateway', 'Gateway vs Bank']],
    ['Exception', 'exception', null],
    ['Upload Files', 'upload-files', ['File Upload', 'File Summary', 'File Report']],
    ['Run Recon', 'run-recon', null],
    [
      'Reconciliation Tickets',
      'reconciliation-tickets',
      ['Exception', 'SFTP Config', 'Scheduled Jobs', 'Configuration', 'Settlement Report'],
    ],
    [
      'Configurator',
      'configurator',
      [
        'Report Config',
        'SFTP Config',
        'Schedule Jobs',
        'Configuration Setup',
        'Recon Configs',
        'Query Jobs',
        'SFTP Setup',
        'Settlement Report',
        'Bene Details',
        'Alert Config',
      ],
    ],
    ['Dispute Management', 'dispute-management', ['Merchants', 'OPS']],
    ['Settlement', 'settlement-summary', ['Summary', 'Instruction', 'Vendor', 'Bene']],
  ],
}

export function defaultV2State(): V2State {
  const state: V2State = { sections: [], groups: {}, pages: {} }
  for (const section of DEFAULT_SECTIONS) {
    const groupIds: string[] = []
    for (const [label, icon, subItems] of SEED[section.id] ?? []) {
      const id = slug(label)
      groupIds.push(id)
      if (!subItems) {
        state.groups[id] = { label, icon, description: '' }
        continue
      }
      const pageIds = subItems.map((page) => {
        const pageId = `${id}/${slug(page)}`
        state.pages[pageId] = { label: page, description: '' }
        return pageId
      })
      state.groups[id] = { label, icon, pageIds, defaultOpen: true }
    }
    state.sections.push({ id: section.id, groupIds })
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
