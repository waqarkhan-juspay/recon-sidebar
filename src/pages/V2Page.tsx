import { FOUNDATION_THEME } from '@juspay/blend-design-system'
import { Navigate, useLocation } from 'react-router'
import { useNavState } from '../layout/nav-store'
import { V2_HOME, v2PageAt } from '../layout/navigation-v2'

const { colors } = FOUNDATION_THEME

/**
 * A version 2 page: its title, and what it is for where that has been written. A page that has
 * been deleted (or never was) goes back to version 2's home.
 */
function V2Page() {
  const { pathname } = useLocation()
  const nav = useNavState()
  const found = v2PageAt(nav.v2, pathname)
  // Home itself may be the page that was deleted; then say so rather than bounce back here.
  if (!found && pathname !== V2_HOME) return <Navigate to={V2_HOME} replace />
  const page = found ?? {
    label: 'This page was deleted',
    description: 'Pick another page from the sidebar, or restore it from the Activity bar.',
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-1.5 px-7 pt-8">
      <h1
        className="m-0"
        style={{ fontSize: 22, lineHeight: '30px', fontWeight: 600, color: colors.gray[900] }}
      >
        {page.label}
      </h1>
      {page.description && (
        <p
          className="m-0"
          style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.gray[500] }}
        >
          {page.description}
        </p>
      )}
    </div>
  )
}

export default V2Page
