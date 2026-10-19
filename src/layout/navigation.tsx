import {
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
  type DirectoryData,
} from '@juspay/blend-design-system'
import {
  BellDot,
  BellRing,
  BookOpen,
  ChartLine,
  ClipboardList,
  FileClock,
  FileText,
  FileUp,
  Gavel,
  History,
  House,
  Landmark,
  ListChecks,
  MessageSquareCheck,
  Percent,
  Play,
  Scale,
  Store,
  Ticket,
  TriangleAlert,
  Upload,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import announcementIcon from '../assets/icons/announcement-01.svg'
import globeIcon from '../assets/icons/globe-01.svg'
import MaskIcon from '../components/MaskIcon'
import { ICON_SIZE } from './chrome'

/**
 * Home has its own path rather than sitting at the root, because the root is a redirect to
 * the Configurator — the app's landing page (src/router.tsx).
 */
export const HOME_PATH = '/home'
export const CONFIGURATOR_PATH = '/configurator'
export const ALERTS_PATH = '/alerts'

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
  label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

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

const TOP_MODULES: NavModule[] = [
  navModule('Home', lucide(House), { href: HOME_PATH }),
  navModule('Marketplace', <MaskIcon src={globeIcon} size={ICON_SIZE} />),
  navModule('What’s New', <MaskIcon src={announcementIcon} size={ICON_SIZE} />, { id: 'whats-new' }),
  navModule('Users', lucide(User)),
  navModule('Orders', lucide(BookOpen)),
  navModule('Action Center', lucide(MessageSquareCheck), { badge: 'Beta' }),
]

const RECON_MODULES: NavModule[] = [
  recon('Analytics', ChartLine),
  recon('Reports', FileText),
  recon('Exception', TriangleAlert),
  recon('Upload Files', Upload, { tabs: ['File Upload'] }),
  recon('Run Recon', Play),
  recon('Settlement Alerts', BellDot),
  recon('Reconciliation Alerts', BellRing, { href: ALERTS_PATH }),
  recon('Reconciliation Tickets', Ticket, {
    tabs: ['Exception', 'SFTP Config', 'Scheduled Jobs', 'Configuration', 'Settlement Report'],
  }),
  recon('Reports Tracker', FileClock),
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
    ],
  }),
  recon('Dispute Management', Scale, { tabs: ['Merchants'] }),
  recon('Dispute Management-OPS', Gavel, { tabs: ['Merchants'] }),
  recon('Recon OPS File Upload', FileUp),
  recon('Recon Fee Config', Percent),
  recon('Settlement Summary', ClipboardList, { tabs: ['Settlement Summary'] }),
  recon('Settlement Instructions', ListChecks, { tabs: ['Settlement Instructions'] }),
  recon('Recon Settlement History', History),
  recon('Vendor Settlement', Store),
  recon('Recon Bene Details', Landmark),
]

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
  // Sections the design draws with nothing under them yet.
  ...['Offers', 'Mandates', 'Smart Convert', 'Monitoring'].map((label) => ({
    id: slug(label),
    label,
    defaultOpen: false,
    itemIds: [],
  })),
]

export const SECTION_BY_ID = Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, s]))

/** How a section is named where it is not drawn as a heading — the deleted-modules bar. */
export const sectionName = (sectionId: string) =>
  SECTION_BY_ID[sectionId]?.label ?? 'Main menu'

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
  activePath,
  navigate,
}: {
  sections: { id: string; itemIds: string[] }[]
  nameOf: (id: string) => string
  activePath: string | null
  navigate: (to: string) => void
}): DirectoryData[] {
  return sections.map((section) => {
    const defaults = SECTION_BY_ID[section.id]
    return {
      label: defaults?.label,
      isCollapsible: !!defaults?.label,
      defaultOpen: defaults?.defaultOpen ?? true,
      items: section.itemIds.map((id, index) => {
        const m = MODULES[id]
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
