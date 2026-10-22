import {
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
  type DirectoryData,
} from '@juspay/blend-design-system'
import {
  ChartLine,
  ClipboardList,
  FileText,
  File,
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
import type { ReactNode } from 'react'
import { ICON_SIZE } from './chrome'

/**
 * Home has its own path rather than sitting at the root, because the root is a redirect to
 * the Configurator — the app's landing page (src/router.tsx).
 */
export const HOME_PATH = '/home'
export const CONFIGURATOR_PATH = '/configurator'

/**
 * One module in the sidebar. `id` is identity and never changes; `label` is only the
 * default name — people can rename a module on this branch (src/layout/nav-store.ts), and
 * its route stays where it was.
 */
export type NavModule = {
  id: string
  label: string
  /** Modules without one are the design's labels with no page behind them. */
  href?: string
  icon: ReactNode
  /** The page's tab row, transcribed from the product. People can add more. */
  tabs?: string[]
  badge?: string
}

export type NavSectionDefault = {
  id: string
  /** The heading over the section. The top section has none. */
  label?: string
  /** Prefix each item with its position — "1. Analytics". */
  numbered?: boolean
  defaultOpen: boolean
  itemIds: string[]
}

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const lucide = (Icon: LucideIcon) => <Icon size={ICON_SIZE} />

const navModule = (
  label: string,
  icon: ReactNode,
  extra: Partial<Omit<NavModule, 'label' | 'icon'>> = {},
): NavModule => ({ id: slug(label), label, icon, ...extra })

/** A Reconciliation module: routed, and at the label's slug unless it says otherwise. */
const recon = (
  label: string,
  Icon: LucideIcon,
  extra: Partial<Omit<NavModule, 'label' | 'icon'>> = {},
) => navModule(label, lucide(Icon), { href: `/${slug(label)}`, ...extra })

const TOP_MODULES: NavModule[] = [navModule('Home', lucide(House), { href: HOME_PATH })]

/**
 * The Reconciliation section as the team settled it (Ritik, 2026-10-22): twelve modules,
 * "Recon Settlement History" shortened to "Settlement History", and two new Configurator
 * tabs. Settlement History keeps its old id so the shared copy's edits still attach to it.
 */
const RECON_MODULES: NavModule[] = [
  recon('Analytics', ChartLine),
  recon('Reports', FileText),
  recon('Exception', TriangleAlert),
  recon('Upload Files', Upload, { tabs: ['File Upload'] }),
  recon('Run Recon', Play),
  recon('Reconciliation Tickets', Ticket, {
    tabs: ['Exception', 'SFTP Config', 'Scheduled Jobs', 'Configuration', 'Settlement Report'],
  }),
  recon('Configurator', Wrench, {
    href: CONFIGURATOR_PATH,
    tabs: [
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
  }),
  recon('Dispute Management', Scale, { tabs: ['Merchants'] }),
  recon('Dispute Management-OPS', Gavel, { tabs: ['Merchants'] }),
  recon('Settlement Summary', ClipboardList, { tabs: ['Settlement Summary'] }),
  recon('Settlement Instructions', ListChecks, {
    tabs: ['Settlement Instructions', 'Vendor Settlement'],
  }),
  recon('Settlement History', History, { id: 'recon-settlement-history' }),
]

/** Pages people add from the sidebar live under here — `/m/<id>`. */
export const CUSTOM_PATH = '/m'

/** A module someone added in the sidebar: a blank page with a tab row, like the rest. */
export const customModule = (id: string, label: string): NavModule => ({
  id,
  label,
  href: `${CUSTOM_PATH}/${id}`,
  icon: lucide(File),
})

/**
 * Every module, by id. This is the one registry: the router reads the routed ones, and the
 * sidebar's default layout below reads all of them.
 */
export const MODULES: Record<string, NavModule> = Object.fromEntries(
  [...TOP_MODULES, ...RECON_MODULES].map((m) => [m.id, m]),
)

export const ROUTED_MODULES = Object.values(MODULES).filter(
  (m): m is NavModule & { href: string } => !!m.href,
)

/** The sidebar as the product draws it, before anyone edits it. */
export const DEFAULT_SECTIONS: NavSectionDefault[] = [
  { id: 'main', defaultOpen: true, itemIds: TOP_MODULES.map((m) => m.id) },
  {
    id: 'reconciliation',
    label: 'Reconciliation',
    numbered: true,
    defaultOpen: true,
    itemIds: RECON_MODULES.map((m) => m.id),
  },
]

export const SECTION_BY_ID = Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, s]))

/** How a section is named where it is not drawn as a heading — the deleted-modules bar. */
export const sectionName = (sectionId: string) => SECTION_BY_ID[sectionId]?.label ?? 'Main menu'

/** "3. Analytics" in a numbered section, the plain name everywhere else. */
export const displayLabel = (name: string, sectionId: string, index: number) =>
  SECTION_BY_ID[sectionId]?.numbered ? `${index + 1}. ${name}` : name

/**
 * The same layout in Blend's shape, for SidebarV2's mobile nav. On desktop the sidebar draws
 * our own editable list instead (src/layout/EditableNav.tsx).
 */
export function buildNavigationData({
  sections,
  nameOf,
  moduleOf,
  activePath,
  navigate,
}: {
  sections: { id: string; itemIds: string[] }[]
  nameOf: (id: string) => string
  moduleOf: (id: string) => NavModule | undefined
  activePath: string | null
  navigate: (to: string) => void
}): DirectoryData[] {
  return sections.map((section) => {
    const defaults = SECTION_BY_ID[section.id]
    return {
      label: defaults?.label,
      isCollapsible: !!defaults?.label,
      defaultOpen: defaults?.defaultOpen ?? true,
      items: section.itemIds.flatMap((id, index) => {
        const m = moduleOf(id)
        if (!m) return []
        return {
          label: displayLabel(nameOf(id), section.id, index),
          leftSlot: m.icon,
          ...(m.badge && {
            rightSlot: (
              <TagV2
                text={m.badge}
                type={TagV2Type.SUBTLE}
                size={TagV2Size.XS}
                subType={TagV2SubType.SQUARICAL}
                color={TagV2Color.NEUTRAL}
              />
            ),
          }),
          ...(m.href && {
            href: m.href,
            onClick: () => navigate(m.href!),
            isSelected: activePath === m.href,
          }),
          showOnMobile: true,
        }
      }),
    }
  })
}
