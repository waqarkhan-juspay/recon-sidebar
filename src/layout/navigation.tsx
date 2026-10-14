import {
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
  type DirectoryData,
} from '@juspay/blend-design-system'
import { BellRing, BookOpen, House, MessageSquareCheck, User, Wrench } from 'lucide-react'
import announcementIcon from '../assets/icons/announcement-01.svg'
import globeIcon from '../assets/icons/globe-01.svg'
import MaskIcon from '../components/MaskIcon'
import { ICON_SIZE } from './chrome'

/**
 * Home has its own path rather than sitting at the root, because the root is a redirect to
 * the Configurator — the app's landing page (src/router.tsx). Leaving Home at `/` would
 * make the nav row a dead end: clicking it would bounce straight back here.
 */
export const HOME_PATH = '/home'
export const CONFIGURATOR_PATH = '/configurator'
export const ALERTS_PATH = '/alerts'

/**
 * The collapsed sections below Reconciliation — node 4405:10766 draws each as a label and a
 * chevron with nothing under it, which is a section whose items have not been designed yet
 * rather than an empty one. `items: []` is what Directory renders for that: the label, the
 * chevron, and no rows.
 *
 * Labels are given in sentence case because Directory uppercases them itself; writing them
 * shouty here would only make them harder to read in this file.
 */
const PLACEHOLDER_SECTIONS = ['Offers', 'Mandates', 'Smart Convert', 'Monitoring']

export type NavigationOptions = {
  /**
   * Which nav item is the active route, as booleans rather than the pathname, so that
   * navigating between two routes that are both "not this item" does not rebuild a
   * byte-identical tree — SidebarV2 re-binds scroll and resize listeners on a new `data`
   * identity (SidebarV2.tsx:230-274).
   */
  isHomeActive: boolean
  isConfiguratorActive: boolean
  isAlertsActive: boolean
  /** Router push. Blend's NavItem does no routing of its own — see below. */
  navigate: (to: string) => void
}

/**
 * Built per render rather than exported as a constant, because nav items need the router:
 * `NavItem.tsx:352` calls `preventDefault()` on every plain left click and does not route,
 * so `href` alone goes nowhere and an `onClick` is required. `href` still earns its place —
 * cmd/ctrl-click bails out before that handler and opens the real URL in a new tab.
 *
 * Only Home, Configurator and Alerts have routes. The rest are the design's labels, drawn
 * so the rail reads as the product's nav rather than the three pages that exist — they are
 * deliberately inert rather than pointing at a 404.
 */
export function buildNavigationData({
  isHomeActive,
  isConfiguratorActive,
  isAlertsActive,
  navigate,
}: NavigationOptions): DirectoryData[] {
  return [
    {
      items: [
        {
          label: 'Home',
          leftSlot: <House size={ICON_SIZE} />,
          href: HOME_PATH,
          onClick: () => navigate(HOME_PATH),
          isSelected: isHomeActive,
          showOnMobile: true,
        },
        {
          label: 'Marketplace',
          leftSlot: <MaskIcon src={globeIcon} size={ICON_SIZE} />,
          showOnMobile: true,
        },
        {
          label: 'What’s New',
          leftSlot: <MaskIcon src={announcementIcon} size={ICON_SIZE} />,
          showOnMobile: true,
        },
        {
          label: 'Users',
          leftSlot: <User size={ICON_SIZE} />,
          showOnMobile: true,
        },
        {
          label: 'Orders',
          leftSlot: <BookOpen size={ICON_SIZE} />,
          showOnMobile: true,
        },
        {
          label: 'Action Center',
          leftSlot: <MessageSquareCheck size={ICON_SIZE} />,
          // `rightSlot` lands the badge beside the label rather than against the far edge
          // of the row, which is what the design draws: NavItem does give the label
          // `flexGrow: 1` (NavItem.tsx:434), but the block holding it is content-sized, so
          // there is no free space for the label to claim and the tag follows it directly.
          //
          // The one thing lost is the announcement — NavItem wraps the slot in
          // `aria-hidden` (NavItem.tsx:449), so "Beta" is decoration to a screen reader.
          rightSlot: (
            <TagV2
              text="Beta"
              type={TagV2Type.SUBTLE}
              size={TagV2Size.XS}
              subType={TagV2SubType.SQUARICAL}
              color={TagV2Color.NEUTRAL}
            />
          ),
          showOnMobile: true,
        },
      ],
    },
    {
      label: 'Reconciliation',
      isCollapsible: true,
      defaultOpen: true,
      items: [
        {
          label: 'Configurator',
          // The design names this one outright — "lucide/wrench" — where its siblings are
          // Untitled UI glyphs.
          leftSlot: <Wrench size={ICON_SIZE} />,
          href: CONFIGURATOR_PATH,
          onClick: () => navigate(CONFIGURATOR_PATH),
          // `isSelected` is what actually drives the highlight — it wins unconditionally
          // over Directory's `activeItem` prop, and the mobile nav reads only this.
          isSelected: isConfiguratorActive,
          // Without this the item is absent from the mobile drawer, where the desktop
          // nav is display:none — i.e. unreachable between 320px and 1024px.
          showOnMobile: true,
        },
        {
          label: 'Alerts',
          leftSlot: <BellRing size={ICON_SIZE} />,
          href: ALERTS_PATH,
          onClick: () => navigate(ALERTS_PATH),
          isSelected: isAlertsActive,
          showOnMobile: true,
        },
      ],
    },
    ...PLACEHOLDER_SECTIONS.map((label) => ({
      label,
      isCollapsible: true,
      defaultOpen: false,
      items: [],
    })),
  ]
}
