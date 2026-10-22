import { FOUNDATION_THEME } from '@juspay/blend-design-system'
import type { CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { pathFor, versionOf } from './sidebar-version'

const { colors } = FOUNDATION_THEME

/**
 * A floating switch over the page between the two sidebars: version 1, the original list, and
 * version 2, the Juspay dashboard's layout. Each viewer switches for themselves; it changes
 * nothing for anyone else. Switching goes back to the last page seen in that version.
 */
function VersionBar({ railCollapsed }: { railCollapsed: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = versionOf(pathname)

  return (
    // Above SidebarV2, whose shell covers the viewport at z-index 99. Centred on the page area:
    // from `lg` up the sidebar takes 52 + 320px on the left, or just the 52px rail collapsed.
    <div
      className={`fixed bottom-6 left-1/2 z-[1000] w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 ${
        railCollapsed ? 'lg:left-[calc(50%+26px)]' : 'lg:left-[calc(50%+186px)]'
      }`}
    >
      <div
        role="radiogroup"
        aria-label="Sidebar version"
        className="version-bar grid grid-cols-2 gap-1 rounded-2xl border border-solid p-1.5"
        style={{
          backgroundColor: colors.gray[100],
          borderColor: colors.gray[200],
          boxShadow: '0 8px 24px rgba(16, 24, 40, 0.07), 0 2px 6px rgba(16, 24, 40, 0.05)',
        }}
      >
        {([1, 2] as const).map((version) => {
          const on = current === version
          return (
            <button
              key={version}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => !on && navigate(pathFor(version))}
              className={`h-10 rounded-xl border-none px-4 ${on ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--hover)] hover:text-[color:var(--hover-text)]'}`}
              style={
                {
                  fontSize: 14,
                  lineHeight: '20px',
                  fontWeight: 600,
                  '--hover': colors.gray[200],
                  '--hover-text': colors.gray[800],
                  color: on ? colors.gray[0] : colors.gray[600],
                  backgroundColor: on ? colors.primary[600] : 'transparent',
                  boxShadow: on ? '0 1px 2px rgba(16, 24, 40, 0.06)' : 'none',
                  transition: 'background-color 150ms, color 150ms',
                } as CSSProperties
              }
            >
              Version {version}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default VersionBar
