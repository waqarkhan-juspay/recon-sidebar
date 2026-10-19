import {
  FOUNDATION_THEME,
  TooltipV2,
  TooltipV2Side,
  TooltipV2Size,
} from '@juspay/blend-design-system'
import { Info } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Change } from './nav-store'
import { when } from './when'

const { colors } = FOUNDATION_THEME

/**
 * An info icon beside anything that has been renamed. Hovering or focusing it shows the
 * item's rename history, newest first. Renders nothing for an item never renamed.
 */
function ChangeInfo({
  changes,
  side = TooltipV2Side.RIGHT,
}: {
  changes: Change[]
  side?: TooltipV2Side
}) {
  if (changes.length === 0) return null

  const content = (
    <span className="flex flex-col gap-2 py-0.5">
      <span className="block" style={{ fontWeight: 600, color: colors.gray[0] }}>
        Rename history
      </span>
      {changes.map((change) => (
        <span key={change.at} className="block">
          <span className="block" style={{ color: colors.gray[0] }}>
            “{change.from}” → “{change.to}”
          </span>
          <span className="block" style={{ color: colors.gray[400] }}>
            {when(change.at)}
          </span>
        </span>
      ))}
    </span>
  )

  return (
    <TooltipV2
      content={content}
      side={side}
      size={TooltipV2Size.LG}
      maxWidth="280px"
      showArrow
      delayDuration={100}
    >
      <span
        tabIndex={0}
        role="img"
        aria-label={`Renamed ${changes.length} time${changes.length > 1 ? 's' : ''}. Latest: from ${changes[0].from} to ${changes[0].to}`}
        draggable={false}
        onClick={(event) => {
          // Inside a nav link or tab: looking at the history should not navigate or select.
          event.preventDefault()
          event.stopPropagation()
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className="inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ color: colors.gray[400], '--ring': colors.primary[200] } as CSSProperties}
      >
        <Info size={13} />
      </span>
    </TooltipV2>
  )
}

export default ChangeInfo
