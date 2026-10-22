import { CONFIGURATOR_PATH } from './navigation'
import { V2_HOME, V2_ROOT } from './navigation-v2'

/**
 * Which sidebar is showing. The address decides it — version 2's pages live under `/v2` — so
 * a link or a reload lands in the right one without anything else to remember.
 *
 * Switching (the toggle in the Activity bar) goes back to the last page seen in the other
 * version, or its home the first time.
 */
export type SidebarVersion = 1 | 2

export const versionOf = (pathname: string): SidebarVersion =>
  pathname === V2_ROOT || pathname.startsWith(`${V2_ROOT}/`) ? 2 : 1

const lastPath: Record<SidebarVersion, string> = { 1: CONFIGURATOR_PATH, 2: V2_HOME }

export const rememberPath = (pathname: string) => {
  lastPath[versionOf(pathname)] = pathname
}

export const pathFor = (version: SidebarVersion) => lastPath[version]
