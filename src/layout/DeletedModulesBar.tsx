import {
  FOUNDATION_THEME,
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
} from '@juspay/blend-design-system'
import { ChevronDown, PanelTop, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { nameOf, restore, useNavState, type DeletedEntry, type NavState } from './nav-store'
import { MODULES, sectionName } from './navigation'
import { when } from './when'

const { colors } = FOUNDATION_THEME

/**
 * A floating bar over the page that holds everything deleted — modules from the sidebar and
 * tabs from a page — saying what it was called, where it was deleted from and when, with a
 * way to put each one back.
 *
 * Opens itself whenever something new is deleted, and folds down to a single line on demand.
 */
function DeletedModulesBar() {
  const nav = useNavState()
  const { deleted } = nav
  const [expanded, setExpanded] = useState(true)
  const [seen, setSeen] = useState(deleted.length)

  // A new deletion opens the bar, even if it had been folded away.
  if (deleted.length !== seen) {
    setSeen(deleted.length)
    if (deleted.length > seen) setExpanded(true)
  }

  if (deleted.length === 0) return null

  return (
    // Above SidebarV2, whose shell covers the viewport at z-index 99. Centred on the page area — the sidebar takes 52 + 320px on the left from `lg` up.
    <div className="fixed bottom-6 left-1/2 z-[1000] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 lg:left-[calc(50%+186px)]">
      <div
        className="deleted-bar overflow-hidden rounded-xl border bg-white"
        style={{
          borderColor: colors.gray[200],
          boxShadow: '0 8px 24px rgba(16, 24, 40, 0.07), 0 2px 6px rgba(16, 24, 40, 0.05)',
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-4 py-3 text-left"
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: colors.red[50], color: colors.red[600] }}
          >
            <Trash2 size={14} />
          </span>
          <span className="flex-1" style={{ fontSize: 14, lineHeight: '20px', fontWeight: 600, color: colors.gray[900] }}>
            Recently deleted
          </span>
          <span
            className="rounded-full px-2 py-0.5"
            style={{ fontSize: 12, lineHeight: '16px', fontWeight: 600, color: colors.gray[600], backgroundColor: colors.gray[100] }}
          >
            {deleted.length}
          </span>
          <ChevronDown
            size={16}
            color={colors.gray[500]}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={{ transform: expanded ? 'none' : 'rotate(180deg)', transition: 'transform 150ms' }}
          />
        </button>

        {expanded && (
          <ul
            className="m-0 max-h-[288px] list-none overflow-y-auto border-t p-1.5"
            style={{ borderColor: colors.gray[150] }}
          >
            {deleted.map((entry) => (
              <DeletedRow key={entry.key} entry={entry} nav={nav} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DeletedRow({ entry, nav }: { entry: DeletedEntry; nav: NavState }) {
  const isTab = entry.kind === 'tab'
  const mod = MODULES[isTab ? entry.moduleId : entry.id]
  const name = isTab ? entry.label : entry.name
  const renamed = !isTab && entry.name !== mod.label
  // The tag beside the name says what kind of thing it was; this line says where it was.
  const where = isTab
    ? `On ${nameOf(nav, entry.moduleId)} · position ${entry.index + 1} of ${entry.rowSize}`
    : `From ${sectionName(entry.sectionId)} · position ${entry.index + 1} of ${entry.sectionSize}`

  return (
    <li className="flex items-center gap-3 rounded-lg px-2.5 py-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: colors.gray[50], color: colors.gray[500], border: `1px solid ${colors.gray[150]}` }}
      >
        {isTab ? <PanelTop size={14} /> : mod.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500, color: colors.gray[900] }}>
            {name}
            {renamed && (
              <span style={{ fontWeight: 500, color: colors.gray[400] }}> · was {mod.label}</span>
            )}
          </span>
          <TagV2
            text={isTab ? 'Tab' : 'Sidebar Item'}
            type={TagV2Type.SUBTLE}
            size={TagV2Size.XS}
            subType={TagV2SubType.SQUARICAL}
            color={isTab ? TagV2Color.PURPLE : TagV2Color.PRIMARY}
          />
        </span>
        <span style={{ fontSize: 12, lineHeight: '18px', fontWeight: 500, color: colors.gray[500] }}>
          {where} · {when(entry.deletedAt)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => restore(entry.key)}
        className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2 hover:bg-[var(--hover)]"
        style={
          {
            '--hover': colors.gray[100],
            fontSize: 13,
            lineHeight: '18px',
            fontWeight: 600,
            color: colors.gray[700],
          } as CSSProperties
        }
      >
        <RotateCcw size={13} />
        Restore
      </button>
    </li>
  )
}

export default DeletedModulesBar
