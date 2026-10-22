import { FOUNDATION_THEME } from '@juspay/blend-design-system'
import { Activity, Bell, CircleHelp, Search, Settings, Sparkles } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

const { colors } = FOUNDATION_THEME

/**
 * The chrome around version 2's sidebar: the tenant rail's lettered tiles and its help button,
 * the workspace switcher, the quick search above the nav, and the topbar.
 */

const tile = (letter: string, color: string | undefined) => (
  <span
    className="flex size-5 items-center justify-center rounded-[5px]"
    style={{ backgroundColor: color, color: colors.gray[0], fontSize: 11, fontWeight: 700 }}
  >
    {letter}
  </span>
)

export const TENANTS_V2 = [
  { label: 'Juspay', value: 'juspay', icon: tile('J', colors.primary[500]) },
  { label: 'Namma Yatri', value: 'namma-yatri', icon: tile('N', colors.red[500]) },
  { label: 'Gameberry', value: 'gameberry', icon: tile('G', colors.orange[500]) },
]

export const MERCHANTS_V2 = [{ label: 'Jam w/ Juspay', value: 'jam-w-juspay' }]

export function RailHelpV2() {
  return (
    <button
      type="button"
      aria-label="Help"
      className="flex size-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent hover:bg-[var(--hover)]"
      style={{ '--hover': colors.gray[100], color: colors.gray[700] } as CSSProperties}
    >
      <CircleHelp size={18} />
    </button>
  )
}

/** Above the nav list, below the workspace switcher. */
export function QuickSearchV2() {
  return (
    <div className="px-3 pt-1 pb-2">
      <button
        type="button"
        className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-solid bg-white px-3 text-left"
        style={{ borderColor: colors.gray[200] }}
      >
        <Search size={16} color={colors.gray[400]} />
        <span
          className="flex-1"
          style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.gray[400] }}
        >
          Quick search...
        </span>
        <span
          style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.gray[400] }}
        >
          ⌘K
        </span>
      </button>
    </div>
  )
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent hover:bg-[var(--hover)]"
      style={{ '--hover': colors.gray[100], color: colors.gray[600] } as CSSProperties}
    >
      {children}
    </button>
  )
}

export function TopbarActionsV2() {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Help">
        <CircleHelp size={18} />
      </IconButton>
      <IconButton label="Settings">
        <Settings size={18} />
      </IconButton>
      <IconButton label="Notifications">
        <Bell size={18} />
      </IconButton>
      <IconButton label="System status">
        <Activity size={18} color={colors.green[500]} />
      </IconButton>
      <span className="mx-2 h-6 w-px" style={{ backgroundColor: colors.gray[200] }} />
      <button
        type="button"
        className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-solid bg-white px-3.5"
        style={{
          borderColor: colors.gray[200],
          color: colors.gray[800],
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 500,
        }}
      >
        <Sparkles size={16} />
        Ask Genius
      </button>
    </div>
  )
}

export function TopbarContentV2() {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <button
        type="button"
        className="flex h-9 w-[400px] max-w-[45%] cursor-pointer items-center gap-2 rounded-lg border border-solid bg-white px-3 text-left"
        style={{ borderColor: colors.gray[200] }}
      >
        <Search size={16} color={colors.gray[400]} />
        <span
          style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.gray[400] }}
        >
          Search
        </span>
      </button>
      <TopbarActionsV2 />
    </div>
  )
}
