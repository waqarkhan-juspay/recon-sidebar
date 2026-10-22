import { FOUNDATION_THEME } from '@juspay/blend-design-system'
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import ChangeInfo from './ChangeInfo'
import { QuickSearchV2 } from './chrome-v2'
import { useDirectoryContainer } from './directory-container'
import {
  addV2Group,
  addV2Page,
  deleteV2Group,
  deleteV2Page,
  moveV2Group,
  moveV2Page,
  renameV2Group,
  renameV2Page,
  useCanEdit,
  useNavState,
  v2HistoryOf,
  type NavState,
} from './nav-store'
import { v2Href, v2Icon, v2SectionLabel, type V2Group } from './navigation-v2'
import { startPointerDrag } from './pointer-drag'

const { colors } = FOUNDATION_THEME

const ROW: CSSProperties = { fontSize: 14, lineHeight: '20px', fontWeight: 500 }

/** What is being dragged, and — once over somewhere it could go — where it would land. */
type Drag =
  | { kind: 'group'; id: string; sectionId?: string; index?: number }
  | { kind: 'page'; id: string; groupId?: string; index?: number }

type Edge = 'before' | 'after' | null

/**
 * Version 2's nav list, portalled into SidebarV2's panel like version 1's (index.css hides
 * Blend's own list). Drawn here rather than by Blend's Directory because, in 0.0.37, the
 * Directory opens every item closed and cannot colour a closed item whose page is open.
 *
 * Editors can rename (✎ or double-click), delete, add (+ Add item at the end of a section,
 * + Add sub-item under an item) and drag both levels: items within and across sections,
 * sub-items within and across items. Guests see it read-only.
 */
function NavV2({
  activePath,
  navigate,
  collapsed,
}: {
  activePath: string | null
  navigate: (to: string) => void
  collapsed: boolean
}) {
  const nav = useNavState()
  const v2 = nav.v2
  const canEdit = useCanEdit()
  const container = useDirectoryContainer()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  if (!container) return null

  // Every item starts collapsed. Opening one is each viewer's own choice, not shared.
  const isOpen = (id: string) => open[id] ?? false
  const go = (href: string) => (event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }
  /** The open page is this item, or one of its sub-items. */
  const holds = (id: string) => {
    const g = v2.groups[id]
    if (!activePath || !g) return false
    return g.pageIds ? g.pageIds.some((p) => v2Href(p) === activePath) : v2Href(id) === activePath
  }

  if (collapsed) {
    return createPortal(
      <nav
        data-custom-nav
        aria-label="Navigation"
        className="flex flex-col items-center gap-3 py-3"
      >
        {v2.sections.map((section, i) => (
          <ul
            key={section.id}
            className="m-0 flex list-none flex-col items-center gap-1 p-0"
            style={
              i > 0 ? { borderTop: `1px solid ${colors.gray[150]}`, paddingTop: 12 } : undefined
            }
          >
            {section.groupIds.map((id) => {
              const g = v2.groups[id]
              const first = g.pageIds ? g.pageIds[0] : id
              const Icon = v2Icon(g.icon)
              const active = holds(id)
              return (
                <li key={id}>
                  <a
                    href={first ? v2Href(first) : undefined}
                    title={g.label}
                    aria-label={g.label}
                    onClick={first ? go(v2Href(first)) : (e) => e.preventDefault()}
                    className="flex size-8 items-center justify-center rounded-lg hover:bg-[var(--hover)]"
                    style={
                      {
                        '--hover': colors.gray[50],
                        color: active ? colors.primary[600] : colors.gray[600],
                        backgroundColor: active ? colors.primary[50] : undefined,
                      } as CSSProperties
                    }
                  >
                    <Icon size={16} />
                  </a>
                </li>
              )
            })}
          </ul>
        ))}
      </nav>,
      container,
    )
  }

  /** Where the dragged thing would land if let go here. */
  const targetAt = (dragging: Drag, x: number, y: number): Drag | null => {
    const el = document.elementFromPoint(x, y)
    if (dragging.kind === 'group') {
      const li = el?.closest<HTMLElement>('[data-v2-group]')
      if (li) {
        const sectionId = li.dataset.section!
        const ids = v2.sections.find((s) => s.id === sectionId)!.groupIds
        const box = li.getBoundingClientRect()
        const after = y > box.top + box.height / 2
        return {
          ...dragging,
          sectionId,
          index: ids.indexOf(li.dataset.v2Group!) + (after ? 1 : 0),
        }
      }
      const zone = el?.closest<HTMLElement>('[data-v2-section]')
      if (zone) {
        const sectionId = zone.dataset.v2Section!
        const ids = v2.sections.find((s) => s.id === sectionId)!.groupIds
        return { ...dragging, sectionId, index: ids.length }
      }
      return null
    }
    const row = el?.closest<HTMLElement>('[data-v2-page]')
    if (row) {
      const groupId = row.dataset.parent!
      const ids = v2.groups[groupId].pageIds!
      const box = row.getBoundingClientRect()
      const after = y > box.top + box.height / 2
      return { ...dragging, groupId, index: ids.indexOf(row.dataset.v2Page!) + (after ? 1 : 0) }
    }
    // Onto an item's own row: into it, at the end.
    const head = el?.closest<HTMLElement>('[data-v2-group-row]')
    if (head) {
      const groupId = head.dataset.v2GroupRow!
      const g = v2.groups[groupId]
      if (g?.pageIds) return { ...dragging, groupId, index: g.pageIds.length }
    }
    return null
  }

  const startDrag = (start: Drag, label: string) => (event: PointerEvent<HTMLElement>) => {
    // An item's own controls (add, rename, delete, the ⓘ, a name field) are not handles.
    if ((event.target as Element).closest('button, input, [role=img]')) return
    let target: Drag | null = null
    startPointerDrag(event, {
      label,
      onStart: () => setDrag(start),
      onMove: (x, y) => {
        const next = targetAt(start, x, y)
        if (!next) return
        target = next
        setDrag(next)
      },
      onDrop: () => {
        if (!target || target.index === undefined) return
        if (target.kind === 'group' && target.sectionId)
          moveV2Group(target.id, target.sectionId, target.index)
        if (target.kind === 'page' && target.groupId) {
          moveV2Page(target.id, target.groupId, target.index)
          const groupId = target.groupId
          setOpen((o) => ({ ...o, [groupId]: true }))
        }
      },
      onEnd: () => setDrag(null),
    })
  }

  /** The drop line beside a row, if the drag would land there and actually move something. */
  const edgeFor = (kind: Drag['kind'], parent: string, ids: string[], index: number): Edge => {
    if (!drag || drag.kind !== kind || drag.index === undefined) return null
    const where = drag.kind === 'group' ? drag.sectionId : drag.groupId
    if (where !== parent) return null
    const from = ids.indexOf(drag.id)
    if (from !== -1 && (drag.index === from || drag.index === from + 1)) return null
    if (drag.index === index) return 'before'
    if (drag.index === index + 1 && index === ids.length - 1) return 'after'
    return null
  }

  return createPortal(
    <nav data-custom-nav aria-label="Navigation" className="flex flex-col gap-3 px-3 pt-1 pb-3">
      {/* Below the workspace switcher, pinned while the list scrolls under it. Here rather
          than in SidebarV2's sidebarTopSlot, which takes the switcher's place. */}
      <div className="sticky top-0 z-10 -mx-3 bg-white">
        <QuickSearchV2 />
      </div>
      {v2.sections.map((section) => {
        const label = v2SectionLabel(section.id)
        return (
          <div key={section.id} className="flex flex-col gap-0.5">
            {label && (
              <div
                data-v2-section={section.id}
                className="px-2 pt-3 pb-1.5"
                style={{
                  fontSize: 12,
                  lineHeight: '18px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: colors.gray[400],
                }}
              >
                {label.toUpperCase()}
              </div>
            )}
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {section.groupIds.map((id, index) => (
                <GroupRow
                  key={id}
                  id={id}
                  sectionId={section.id}
                  nav={nav}
                  activePath={activePath}
                  active={holds(id)}
                  isOpen={isOpen(id)}
                  canEdit={canEdit}
                  editing={editing}
                  addingTo={addingTo}
                  dragging={drag}
                  edge={edgeFor('group', section.id, section.groupIds, index)}
                  pageEdge={(i) => edgeFor('page', id, v2.groups[id].pageIds ?? [], i)}
                  onToggle={() => setOpen((o) => ({ ...o, [id]: !isOpen(id) }))}
                  onEdit={setEditing}
                  onAddTo={(groupId) => {
                    setAddingTo(groupId)
                    if (groupId) setOpen((o) => ({ ...o, [groupId]: true }))
                  }}
                  go={go}
                  navigate={navigate}
                  startDrag={startDrag}
                />
              ))}
              {section.groupIds.length === 0 && drag?.kind === 'group' && (
                <li
                  data-v2-section={section.id}
                  className="flex h-9 items-center justify-center rounded-lg"
                  style={{
                    ...ROW,
                    fontSize: 12,
                    color: colors.gray[400],
                    border: `1px dashed ${colors.gray[300]}`,
                  }}
                >
                  Drop here
                </li>
              )}
            </ul>
            {/* Hidden, not removed, while dragging: taking it out would shift every row
                below it, and the drop would land a row off from where the pointer is. */}
            {canEdit && (
              <div style={{ visibility: drag ? 'hidden' : undefined }}>
                <AddRow
                  label="Add item"
                  placeholder="Item name"
                  onSubmit={(value) => {
                    const result = addV2Group(section.id, value)
                    if ('error' in result) return result.error
                    // Straight on to its first sub-item.
                    setOpen((o) => ({ ...o, [result.id]: true }))
                    setAddingTo(result.id)
                    return null
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </nav>,
    container,
  )
}

function GroupRow({
  id,
  sectionId,
  nav,
  activePath,
  active,
  isOpen,
  canEdit,
  editing,
  addingTo,
  dragging,
  edge,
  pageEdge,
  onToggle,
  onEdit,
  onAddTo,
  go,
  navigate,
  startDrag,
}: {
  id: string
  sectionId: string
  nav: NavState
  activePath: string | null
  active: boolean
  isOpen: boolean
  canEdit: boolean
  editing: string | null
  addingTo: string | null
  dragging: Drag | null
  edge: Edge
  pageEdge: (index: number) => Edge
  onToggle: () => void
  onEdit: (id: string | null) => void
  onAddTo: (groupId: string | null) => void
  go: (href: string) => (event: MouseEvent) => void
  navigate: (to: string) => void
  startDrag: (start: Drag, label: string) => (event: PointerEvent<HTMLElement>) => void
}) {
  const v2 = nav.v2
  const group: V2Group = v2.groups[id]
  const Icon = v2Icon(group.icon)
  const isLeaf = !group.pageIds
  const selected = isLeaf && activePath === v2Href(id)
  // Blue when one of its sub-items is open, even folded away.
  const tone = active && !isLeaf ? colors.primary[600] : undefined
  const changes = v2HistoryOf(nav, id)
  const isEditing = editing === id
  const isDragged = dragging?.kind === 'group' && dragging.id === id

  const rowStyle = {
    ...ROW,
    '--hover': colors.gray[50],
    color: tone ?? (selected ? colors.gray[900] : colors.gray[700]),
    backgroundColor: selected ? colors.gray[100] : 'transparent',
  } as CSSProperties

  const content = (
    <>
      <Icon
        size={16}
        color={tone ?? (selected ? colors.gray[800] : colors.gray[600])}
        className="shrink-0"
      />
      {isEditing ? (
        <NameField
          initial={group.label}
          onSubmit={(value) => renameV2Group(id, value)}
          onDone={() => onEdit(null)}
        />
      ) : (
        <span className="min-w-0 flex-1 break-words">
          {group.label}
          {changes.length > 0 && (
            <>
              {' '}
              <ChangeInfo changes={changes} />
            </>
          )}
        </span>
      )}
    </>
  )

  return (
    <li
      data-v2-group={id}
      data-section={sectionId}
      className="relative"
      style={{ opacity: isDragged ? 0.4 : 1 }}
    >
      {edge && <DropLine edge={edge} />}
      <div
        data-v2-group-row={id}
        onPointerDown={
          canEdit && !isEditing ? startDrag({ kind: 'group', id }, group.label) : undefined
        }
        onDoubleClick={canEdit && !isEditing ? () => onEdit(id) : undefined}
        className="group relative select-none"
      >
        {canEdit && !isEditing && <Grip />}
        {isLeaf && !isEditing ? (
          <a
            href={v2Href(id)}
            draggable={false}
            aria-current={selected ? 'page' : undefined}
            onClick={go(v2Href(id))}
            className="flex min-h-9 items-center gap-2.5 rounded-lg py-1.5 pr-[84px] pl-2 no-underline hover:bg-[var(--hover)]"
            style={rowStyle}
          >
            {content}
          </a>
        ) : (
          <div
            role={isEditing ? undefined : 'button'}
            tabIndex={isEditing ? undefined : 0}
            aria-expanded={isLeaf ? undefined : isOpen}
            onClick={isEditing || isLeaf ? undefined : onToggle}
            onKeyDown={(e: KeyboardEvent) => {
              if (isEditing || isLeaf) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggle()
              }
            }}
            className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg py-1.5 pl-2 hover:bg-[var(--hover)] ${isEditing ? 'pr-2' : 'pr-[108px]'}`}
            style={rowStyle}
          >
            {content}
            {!isEditing && !isLeaf && (
              <ChevronDown
                size={16}
                color={tone ?? colors.gray[500]}
                aria-hidden
                className="absolute top-2.5 right-2 shrink-0"
                style={{
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms',
                }}
              />
            )}
          </div>
        )}
        {canEdit && !isEditing && (
          <Actions right={isLeaf ? 4 : 30}>
            <Action
              label={`Add sub-item to ${group.label}`}
              title="Add sub-item"
              onClick={() => onAddTo(id)}
            >
              <Plus size={14} />
            </Action>
            <Action label={`Rename ${group.label}`} title="Rename" onClick={() => onEdit(id)}>
              <Pencil size={13} />
            </Action>
            <Action
              label={`Delete ${group.label}`}
              title="Delete"
              danger
              onClick={() => deleteV2Group(id)}
            >
              <Trash2 size={13} />
            </Action>
          </Actions>
        )}
      </div>

      {((!isLeaf && isOpen) || addingTo === id) && (
        // The line runs down from under the item's icon; the sub-items hang off it.
        <ul
          className="m-0 mt-0.5 mb-1 ml-4 flex list-none flex-col gap-0.5 border-0 border-l border-solid py-0 pr-0 pl-2"
          style={{ borderColor: colors.gray[200] }}
        >
          {(group.pageIds ?? []).map((pageId, index) => (
            <PageRow
              key={pageId}
              id={pageId}
              parentId={id}
              nav={nav}
              selected={activePath === v2Href(pageId)}
              canEdit={canEdit}
              isEditing={editing === pageId}
              isDragged={dragging?.kind === 'page' && dragging.id === pageId}
              edge={pageEdge(index)}
              onEdit={onEdit}
              go={go}
              startDrag={startDrag}
            />
          ))}
          {canEdit && (
            <li style={{ visibility: dragging ? 'hidden' : undefined }}>
              <AddRow
                label="Add sub-item"
                placeholder="Sub-item name"
                nested
                startOpen={addingTo === id}
                onClose={() => {
                  if (addingTo === id) onAddTo(null)
                }}
                onSubmit={(value) => {
                  const result = addV2Page(id, value)
                  if ('error' in result) return result.error
                  onAddTo(null)
                  navigate(v2Href(result.id))
                  return null
                }}
              />
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

function PageRow({
  id,
  parentId,
  nav,
  selected,
  canEdit,
  isEditing,
  isDragged,
  edge,
  onEdit,
  go,
  startDrag,
}: {
  id: string
  parentId: string
  nav: NavState
  selected: boolean
  canEdit: boolean
  isEditing: boolean
  isDragged: boolean
  edge: Edge
  onEdit: (id: string | null) => void
  go: (href: string) => (event: MouseEvent) => void
  startDrag: (start: Drag, label: string) => (event: PointerEvent<HTMLElement>) => void
}) {
  const page = nav.v2.pages[id]
  const changes = v2HistoryOf(nav, id)
  return (
    <li
      data-v2-page={id}
      data-parent={parentId}
      className="relative"
      style={{ opacity: isDragged ? 0.4 : 1 }}
    >
      {edge && <DropLine edge={edge} />}
      <div
        onPointerDown={
          canEdit && !isEditing ? startDrag({ kind: 'page', id }, page.label) : undefined
        }
        onDoubleClick={canEdit && !isEditing ? () => onEdit(id) : undefined}
        className="group relative select-none"
      >
        {isEditing ? (
          <div className="flex min-h-9 items-center px-3 py-1" style={ROW}>
            <NameField
              initial={page.label}
              onSubmit={(value) => renameV2Page(id, value)}
              onDone={() => onEdit(null)}
            />
          </div>
        ) : (
          <a
            href={v2Href(id)}
            draggable={false}
            aria-current={selected ? 'page' : undefined}
            onClick={go(v2Href(id))}
            className="flex min-h-9 items-center rounded-lg py-1.5 pr-[60px] pl-3 no-underline hover:bg-[var(--hover)]"
            style={
              {
                ...ROW,
                '--hover': colors.gray[50],
                color: selected ? colors.gray[900] : colors.gray[600],
                backgroundColor: selected ? colors.gray[100] : 'transparent',
              } as CSSProperties
            }
          >
            <span className="min-w-0 break-words">
              {page.label}
              {changes.length > 0 && (
                <>
                  {' '}
                  <ChangeInfo changes={changes} />
                </>
              )}
            </span>
          </a>
        )}
        {canEdit && !isEditing && (
          <Actions right={4}>
            <Action label={`Rename ${page.label}`} title="Rename" onClick={() => onEdit(id)}>
              <Pencil size={13} />
            </Action>
            <Action
              label={`Delete ${page.label}`}
              title="Delete"
              danger
              onClick={() => deleteV2Page(id)}
            >
              <Trash2 size={13} />
            </Action>
          </Actions>
        )}
      </div>
    </li>
  )
}

function Grip() {
  return (
    <GripVertical
      aria-hidden
      size={12}
      color={colors.gray[400]}
      className="pointer-events-none absolute top-3 -left-2.5 hidden group-hover:block"
    />
  )
}

function DropLine({ edge }: { edge: 'before' | 'after' }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 rounded-full"
      style={{ backgroundColor: colors.primary[500], [edge === 'before' ? 'top' : 'bottom']: -2 }}
    />
  )
}

/** Shown on hover (or keyboard focus), over the right end of the row. */
function Actions({ right, children }: { right: number; children: ReactNode }) {
  return (
    <div
      className="absolute top-1.5 hidden items-center gap-0.5 group-hover:flex group-has-[:focus-visible]:flex"
      style={{ right }}
    >
      {children}
    </div>
  )
}

function Action({
  label,
  title,
  danger,
  onClick,
  children,
}: {
  label: string
  title: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        // Only the first click of a double-click counts: a delete slides the next row under
        // the pointer, and a second click would take that one too.
        if (event.detail > 1) return
        onClick()
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="flex size-6 cursor-pointer items-center justify-center rounded-md border-none bg-white text-[color:var(--icon)] hover:bg-[var(--hover)] hover:text-[color:var(--icon-hover)]"
      style={
        {
          '--icon': colors.gray[500],
          '--icon-hover': danger ? colors.red[600] : colors.gray[800],
          '--hover': danger ? colors.red[50] : colors.gray[100],
        } as CSSProperties
      }
    >
      {children}
    </button>
  )
}

/** An inline name field: Enter saves (staying open on a problem), Escape cancels. */
function NameField({
  initial,
  placeholder,
  onSubmit,
  onDone,
}: {
  initial: string
  placeholder?: string
  onSubmit: (value: string) => string | null
  onDone: () => void
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const submit = (closeOnError: boolean) => {
    if (!value.trim() || value.trim() === initial) return onDone()
    const problem = onSubmit(value)
    if (!problem || closeOnError) onDone()
    else setError(problem)
  }
  return (
    <span className="relative flex min-w-0 flex-1">
      <input
        autoFocus
        aria-label={placeholder ?? 'Name'}
        aria-invalid={!!error}
        placeholder={placeholder}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(false)
          if (e.key === 'Escape') onDone()
        }}
        onBlur={() => submit(true)}
        onClick={(e) => e.stopPropagation()}
        className="h-7 min-w-0 flex-1 rounded-md border border-solid bg-white px-2 outline-none placeholder:text-[color:var(--placeholder)]"
        style={
          {
            ...ROW,
            '--placeholder': colors.gray[400],
            color: colors.gray[900],
            borderColor: error ? colors.red[500] : colors.primary[500],
            boxShadow: `0 0 0 2px ${error ? colors.red[100] : colors.primary[100]}`,
          } as CSSProperties
        }
      />
      {error && (
        <span
          role="alert"
          className="absolute top-full left-0 z-20 mt-1.5 max-w-[200px] rounded px-2 py-1"
          style={{
            fontSize: 12,
            lineHeight: '16px',
            color: colors.gray[0],
            backgroundColor: colors.gray[900],
          }}
        >
          {error}
        </span>
      )}
    </span>
  )
}

/** The ghost "+ Add item" / "+ Add sub-item" row, which becomes a name field in place. */
function AddRow({
  label,
  placeholder,
  nested,
  startOpen,
  onClose,
  onSubmit,
}: {
  label: string
  placeholder: string
  /** Under an item, lined up with its sub-items. */
  nested?: boolean
  /** Opened from elsewhere — the row's + button, or a just-added item. */
  startOpen?: boolean
  onClose?: () => void
  onSubmit: (value: string) => string | null
}) {
  const [adding, setAdding] = useState(false)
  if (adding || startOpen) {
    return (
      <div className={`flex min-h-9 items-center gap-2.5 py-1 pr-2 ${nested ? 'pl-3' : 'pl-2'}`}>
        {!nested && <Plus size={16} color={colors.gray[400]} className="shrink-0" />}
        <NameField
          initial=""
          placeholder={placeholder}
          onSubmit={onSubmit}
          onDone={() => {
            setAdding(false)
            onClose?.()
          }}
        />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className={`flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent py-1.5 text-left hover:bg-[var(--hover)] hover:text-[color:var(--hover-text)] ${nested ? 'pl-3' : 'pl-2'}`}
      style={
        {
          ...ROW,
          '--hover': colors.gray[50],
          '--hover-text': colors.gray[700],
          color: colors.gray[500],
        } as CSSProperties
      }
    >
      <Plus size={nested ? 14 : 16} className="shrink-0" />
      {label}
    </button>
  )
}

export default NavV2
