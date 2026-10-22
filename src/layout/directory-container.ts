import { useEffect, useState } from 'react'

/**
 * The panel SidebarV2 draws its nav list into, `[data-directory-container]`. Both sidebar
 * versions portal their own nav into it (index.css hides Blend's list beside them).
 *
 * Blend's panel can remount (e.g. crossing the mobile breakpoint), so keep looking.
 */
export function useDirectoryContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const find = () => {
      const next = document.querySelector<HTMLElement>('[data-directory-container]')
      setContainer((current) => (current === next ? current : next))
    }
    find()
    const observer = new MutationObserver(find)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  return container
}
