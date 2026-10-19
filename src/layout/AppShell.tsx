import {
  AvatarV2,
  AvatarV2Shape,
  AvatarV2Size,
  FOUNDATION_THEME,
  SidebarV2,
} from '@juspay/blend-design-system'
import { ChevronDown } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import avatarImage from '../assets/avatar.png'
import searchIcon from '../assets/icons/search-md.svg'
import starsIcon from '../assets/icons/stars-02.svg'
import tenantIcon1 from '../assets/icons/tenant-icon-1.svg'
import tenantIcon2 from '../assets/icons/tenant-icon-2.svg'
import tenantLogo from '../assets/icons/tenant-logo.svg'
import merchantOrb from '../assets/merchant-hyper-recon.png'
import MaskIcon from '../components/MaskIcon'
import { font } from '../primitives'
import { CHROME_HOVER } from './chrome'
import DeletedModulesBar from './DeletedModulesBar'
import EditableNav from './EditableNav'
import { nameOf, useNavState } from './nav-store'
import { ROUTED_MODULES, buildNavigationData } from './navigation'
import { TopbarStatusIcons } from './topbar'

const { colors } = FOUNDATION_THEME

const NAV_PATHS = new Set(ROUTED_MODULES.map((m) => m.href))

/**
 * The sidebar is always open on this branch and cannot be closed: SidebarV2 is held
 * expanded (a controlled `isExpanded` whose change handler does nothing), its collapse button
 * is hidden in index.css, and the collapse shortcut is a key nobody can type.
 */
const keepOpen = () => {}
const NO_COLLAPSE_KEY = 'F24'

/**
 * The sidebar rows this file draws — the footer's menu items and the profile.
 *
 * 500, matching the nav rows Blend draws above them (src/theme.ts). They are the same kind
 * of row in the same column, so they move together; `font()` already emits 500, which is
 * why no weight is restated here.
 */
const MENU_ROW = font(FOUNDATION_THEME.font.size.body.md)

/**
 * The topbar's search placeholder, which is deliberately a step lighter than the menu rows.
 * It is placeholder text rather than a row you can click through to something, and reading
 * as secondary is the whole job.
 */
const LABEL = {
  ...font(FOUNDATION_THEME.font.size.body.md),
  fontWeight: FOUNDATION_THEME.font.weight[400],
}

const tenants = [
  { label: 'Juspay', value: 'juspay', icon: tenantLogo },
  { label: 'Breeze', value: 'breeze', icon: tenantIcon1 },
  { label: 'Hyperswitch', value: 'hyperswitch', icon: tenantIcon2 },
]

/** The signed-in user, as the design names them — the row shows a name, not an address. */
const PROFILE_NAME = 'Waqar Khan'

/**
 * The merchant the rail is scoped to — node 4405:10766. The orb is the design's own export,
 * downscaled to 64px: it renders at 14, and the 1024px original was 1.25MB for an icon.
 */
const merchants = [
  {
    label: 'Hyper Recon',
    value: 'hyper-recon',
    icon: <img src={merchantOrb} alt="" className="block size-full rounded object-cover" />,
  },
]

function TopbarSearch() {
  return (
    <button
      type="button"
      className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent py-1.5"
    >
      <MaskIcon src={searchIcon} size={16} color={colors.gray[400]} />
      <span className="whitespace-pre" style={{ ...LABEL, color: colors.gray[400] }}>
        {'Search  (⌘K)'}
      </span>
    </button>
  )
}

function TopbarContent() {
  return (
    <div className="flex w-full items-center justify-between">
      <TopbarSearch />
      <TopbarActions />
    </div>
  )
}

function TopbarActions() {
  return (
    <div className="flex items-center gap-1.5">
      <TopbarStatusIcons />
      <div className="h-6 w-px self-stretch" style={{ backgroundColor: colors.gray[200] }} />
      <button
        type="button"
        className="flex cursor-pointer items-center gap-[5px] border-none bg-transparent px-1"
      >
        <img src={starsIcon} alt="" className="block size-3" />
        <span className="bg-gradient-to-r from-[#6461ff] to-[#3877ff] bg-clip-text text-[14px] leading-[20px] font-medium text-transparent">
          Ask Genius
        </span>
      </button>
    </div>
  )
}

/**
 * The signed-in user, and the whole of the sidebar footer: a round avatar, the name, and a
 * chevron at the far end.
 *
 * Blend's footer draws the rule above it (`footer.borderTop`), so the row needs no divider
 * of its own.
 */
function SidebarFooter() {
  return (
    <button
      type="button"
      style={{
        ...CHROME_HOVER,
        borderRadius: FOUNDATION_THEME.border.radius[8],
      }}
      // py-3.5 (14px) around the 24px avatar makes the row 52px.
      className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-2 py-3.5 hover:bg-[var(--chrome-hover)]"
    >
      <AvatarV2
        src={avatarImage}
        alt={PROFILE_NAME}
        size={AvatarV2Size.SM}
        shape={AvatarV2Shape.CIRCULAR}
      />
      <span
        className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap"
        style={{ ...MENU_ROW, color: colors.gray[700] }}
      >
        {PROFILE_NAME}
      </span>
      <ChevronDown size={16} color={colors.gray[400]} aria-hidden />
    </button>
  )
}

function AppShell({ children }: { children?: ReactNode }) {
  const [tenant, setTenant] = useState(tenants[0].value)
  const [merchant, setMerchant] = useState(merchants[0].value)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const activePath = NAV_PATHS.has(pathname) ? pathname : null
  const nav = useNavState()
  // Blend's own nav list is hidden on desktop in favour of EditableNav, but SidebarV2 still
  // needs the tree: it draws its panel only when `data` is non-empty, and its mobile nav
  // reads it directly.
  const navigationData = useMemo(
    () =>
      buildNavigationData({
        sections: nav.sections,
        nameOf: (id) => nameOf(nav, id),
        activePath,
        navigate,
      }),
    [nav, activePath, navigate],
  )

  return (
    <>
      <SidebarV2
        data={navigationData}
        showHierarchyLines
        secondarySidebar={{
          items: tenants.map(({ label, value, icon }) => ({
            label,
            value,
            icon: <img src={icon} alt="" className="block size-4 object-contain" />,
          })),
          selected: tenant,
          onSelect: setTenant,
        }}
        merchantInfo={{
          items: merchants,
          selected: merchant,
          onSelect: setMerchant,
        }}
        topbar={<TopbarContent />}
        rightActions={<TopbarActions />}
        isExpanded
        onExpandedChange={keepOpen}
        sidebarCollapseKey={NO_COLLAPSE_KEY}
        footer={<SidebarFooter />}
      >
        {children}
      </SidebarV2>
      <EditableNav activePath={activePath} navigate={navigate} />
      <DeletedModulesBar />
    </>
  )
}

export default AppShell
