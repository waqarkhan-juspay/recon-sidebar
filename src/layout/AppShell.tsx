import {
  AvatarV2,
  AvatarV2Shape,
  AvatarV2Size,
  FOUNDATION_THEME,
  SidebarV2,
  SidebarV2StateChange,
  type SidebarV2StateChangeType,
} from '@juspay/blend-design-system'
import { LogIn, LogOut } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
import { displayName, signOut, useSession } from '../auth/session'
import ActivityBar from './ActivityBar'
import EditableNav from './EditableNav'
import { nameOf, useNavState } from './nav-store'
import { ROUTED_MODULES, buildNavigationData } from './navigation'
import { TopbarStatusIcons } from './topbar'

const { colors } = FOUNDATION_THEME

const NAV_PATHS = new Set(ROUTED_MODULES.map((m) => m.href))

/**
 * The sidebar opens expanded on every load — SidebarV2 keeps its state in memory only, so a
 * refresh always starts here. Anyone can still collapse it with its own button or the key.
 */
const RAIL_STARTS_EXPANDED = true

/**
 * `/`, Blend's own default, as the product has it. SidebarV2 listens for it anywhere outside
 * a form field, so typing into an input (renaming a module or tab) is safe.
 */
const SIDEBAR_COLLAPSE_KEY = '/'

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

/** The one editor with a photo in the design; everyone else gets initials. */
const OWNER_EMAIL = 'waqar.khan@juspay.in'

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
 * Who is here, and the way out: the signed-in editor with Sign out, or "Guest" with Sign in.
 *
 * Blend's footer draws the rule above it (`footer.borderTop`), so the row needs no divider
 * of its own. SidebarV2 passes `footer` straight through without saying the rail has
 * collapsed, so this drops everything but the avatar itself at 52px.
 */
function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const session = useSession()
  const isEditor = session.status === 'editor'
  const email = isEditor ? session.email : ''
  const name = isEditor ? displayName(email) : 'Guest'
  const detail = isEditor ? email : 'View only'

  return (
    // py-3.5 (14px) around the 24px avatar makes the row 52px — the collapsed rail's width.
    <div
      title={collapsed ? `${name} · ${detail}` : undefined}
      className={`flex w-full items-center py-3.5 ${collapsed ? 'justify-center px-0' : 'gap-2 px-2'}`}
    >
      <AvatarV2
        src={email === OWNER_EMAIL ? avatarImage : undefined}
        alt={name}
        fallbackText={isEditor ? undefined : 'G'}
        size={AvatarV2Size.SM}
        shape={AvatarV2Shape.CIRCULAR}
      />
      {!collapsed && (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ ...MENU_ROW, color: colors.gray[700] }}
            >
              {name}
            </span>
            <span
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.gray[500] }}
            >
              {detail}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2 hover:bg-[var(--chrome-hover)]"
            style={{
              ...CHROME_HOVER,
              fontSize: 13,
              lineHeight: '18px',
              fontWeight: 600,
              color: colors.gray[600],
            }}
          >
            {isEditor ? <LogOut size={14} /> : <LogIn size={14} />}
            {isEditor ? 'Sign out' : 'Sign in'}
          </button>
        </>
      )}
    </div>
  )
}

function AppShell({ children }: { children?: ReactNode }) {
  const [tenant, setTenant] = useState(tenants[0].value)
  const [merchant, setMerchant] = useState(merchants[0].value)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  /**
   * Compared against COLLAPSED, not `!isExpanded`: INTERMEDIATE is the hover-peek, where the
   * rail is wide again. Stable because SidebarV2 keys an effect on this callback.
   */
  const [isRailCollapsed, setIsRailCollapsed] = useState(!RAIL_STARTS_EXPANDED)
  const handleSidebarState = useCallback(
    (state: SidebarV2StateChangeType) =>
      setIsRailCollapsed(state === SidebarV2StateChange.COLLAPSED),
    [],
  )

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
        defaultIsExpanded={RAIL_STARTS_EXPANDED}
        sidebarCollapseKey={SIDEBAR_COLLAPSE_KEY}
        onSidebarStateChange={handleSidebarState}
        footer={<SidebarFooter collapsed={isRailCollapsed} />}
      >
        {children}
      </SidebarV2>
      <EditableNav activePath={activePath} navigate={navigate} collapsed={isRailCollapsed} />
      <ActivityBar railCollapsed={isRailCollapsed} />
    </>
  )
}

export default AppShell
