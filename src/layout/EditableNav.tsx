import {
  FOUNDATION_THEME,
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
} from '@juspay/blend-design-system'
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import ChangeInfo from './ChangeInfo'
import {
  addModule,
  deleteModule,
  historyOf,
  moduleKey,
  moduleOf,
  moveModule,
  nameOf,
  renameModule,
  useCanEdit,
  useNavState,
  type Change,
  type NavState,
} from './nav-store'
import { CUSTOM_PATH, DEFAULT_SECTIONS, SECTION_BY_ID } from './navigation'

const { colors } = FOUNDATION_THEME

/**
 * The sidebar's nav list on this branch — our own, not Blend's Directory, so that every
 * module can be dragged, renamed and deleted in place.
 *
 * SidebarV2 has no slot for its nav list, so this portals into the panel Blend draws
 * (`[data-directory-container]`) and index.css hides the Directory beside it. Spacing,
 * colours and type are measured off Blend's own rows so the swap does not show.
 */

type DropTarget = { sectionId: string; index: number }

const ROW_TEXT: CSSProperties = { fontSize: 14, lineHeight: '21px', fontWeight: 500 }

/** Blend's panel can remount (e.g. crossing the mobile breakpoint), so keep looking. */
function useDirectoryContainer() {
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

function EditableNav({
  activePath,
  navigate,
  collapsed,
}: {
  activePath: string | null
  navigate: (to: string) => void
  /** The rail is down to 52px: icons only, no editing. Hovering it peeks the full list back. */
  collapsed: boolean
}) {
  const nav = useNavState()
  const canEdit = useCanEdit()
  const container = useDirectoryContainer()
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, s.defaultOpen])),
  )

  if (!container) return null
  if (collapsed) {
    return createPortal(
      <CollapsedNav nav={nav} activePath={activePath} navigate={navigate} />,
      container,
    )
  }

  const endDrag = () => {
    setDragId(null)
    setDrop(null)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    if (dragId && drop) {
      moveModule(dragId, drop.sectionId, drop.index)
      setOpen((o) => ({ ...o, [drop.sectionId]: true }))
    }
    endDrag()
  }

  /** A drop that would leave the module where it is draws no indicator. */
  const isNoop = (target: DropTarget) => {
    if (!dragId) return true
    const section = nav.sections.find((s) => s.id === target.sectionId)
    const at = section?.itemIds.indexOf(dragId) ?? -1
    return at !== -1 && (target.index === at || target.index === at + 1)
  }
  const activeDrop = drop && !isNoop(drop) ? drop : null

  return createPortal(
    <nav
      data-editable-nav
      aria-label="Modules"
      className="flex flex-col gap-6 p-3"
      onDragOver={(event) => {
        if (dragId) event.preventDefault()
      }}
      onDrop={onDrop}
    >
      {nav.sections.map((section) => {
        const defaults = SECTION_BY_ID[section.id]
        const isOpen = !defaults.label || open[section.id]
        const appendTarget = { sectionId: section.id, index: section.itemIds.length }
        const headerIsTarget =
          activeDrop?.sectionId === section.id &&
          activeDrop.index === section.itemIds.length &&
          (!isOpen || section.itemIds.length === 0)

        return (
          <div key={section.id} className="flex flex-col gap-1">
            {defaults.label && (
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [section.id]: !isOpen }))}
                onDragOver={() => dragId && setDrop(appendTarget)}
                className="flex cursor-pointer items-center justify-between rounded border-none px-3 py-0.5 text-left"
                style={{
                  backgroundColor: headerIsTarget ? colors.primary[50] : 'transparent',
                  outline: headerIsTarget ? `1px dashed ${colors.primary[400]}` : 'none',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: '18px',
                    fontWeight: 600,
                    color: colors.gray[400],
                  }}
                >
                  {defaults.label.toUpperCase()}
                </span>
                <ChevronDown
                  size={16}
                  color={colors.gray[400]}
                  aria-hidden
                  style={{
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 150ms',
                  }}
                />
              </button>
            )}

            {isOpen && (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {section.itemIds.map((id, index) => (
                  <NavRow
                    key={id}
                    id={id}
                    index={index}
                    sectionId={section.id}
                    name={nameOf(nav, id)}
                    changes={historyOf(nav, moduleKey(id))}
                    numbered={!!defaults.numbered}
                    isSelected={!!activePath && moduleOf(nav, id)?.href === activePath}
                    isDragging={dragId === id}
                    isEditing={editingId === id}
                    dropEdge={
                      activeDrop?.sectionId !== section.id
                        ? null
                        : activeDrop.index === index
                          ? 'before'
                          : activeDrop.index === index + 1 && index === section.itemIds.length - 1
                            ? 'after'
                            : null
                    }
                    navigate={navigate}
                    onEdit={setEditingId}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', id)
                      setDragId(id)
                    }}
                    onDragEnd={endDrag}
                    onDragOver={(event) => {
                      if (!dragId) return
                      const rect = event.currentTarget.getBoundingClientRect()
                      const after = event.clientY > rect.top + rect.height / 2
                      const next = { sectionId: section.id, index: index + (after ? 1 : 0) }
                      if (next.index !== drop?.index || next.sectionId !== drop?.sectionId)
                        setDrop(next)
                    }}
                  />
                ))}
                {section.itemIds.length === 0 && dragId && (
                  <li
                    onDragOver={() => setDrop(appendTarget)}
                    className="flex h-[33px] items-center justify-center rounded"
                    style={{
                      ...ROW_TEXT,
                      fontSize: 12,
                      color: colors.gray[400],
                      border: `1px dashed ${headerIsTarget ? colors.primary[400] : colors.gray[300]}`,
                    }}
                  >
                    Drop here
                  </li>
                )}
              </ul>
            )}
            {isOpen && canEdit && !dragId && <AddItem sectionId={section.id} navigate={navigate} />}
          </div>
        )
      })}
    </nav>,
    container,
  )
}

/**
 * The nav in the collapsed 52px rail: one icon per module, a hairline between sections, and
 * the module's name (with its number) as the tooltip.
 */
function CollapsedNav({
  nav,
  activePath,
  navigate,
}: {
  nav: NavState
  activePath: string | null
  navigate: (to: string) => void
}) {
  return (
    <nav data-editable-nav aria-label="Modules" className="flex flex-col items-center gap-3 py-3">
      {nav.sections
        .filter((section) => section.itemIds.length > 0)
        .map((section, sectionIndex) => {
          const numbered = !!SECTION_BY_ID[section.id]?.numbered
          return (
            <ul
              key={section.id}
              className="m-0 flex list-none flex-col items-center gap-1 p-0"
              style={
                sectionIndex > 0
                  ? { borderTop: `1px solid ${colors.gray[150]}`, paddingTop: 12 }
                  : undefined
              }
            >
              {section.itemIds.map((id, index) => {
                const mod = moduleOf(nav, id)
                if (!mod) return null
                const name = `${numbered ? `${index + 1}. ` : ''}${nameOf(nav, id)}`
                const isSelected = !!mod.href && mod.href === activePath
                return (
                  <li key={id} data-nav-module={id} data-section={section.id}>
                    <a
                      href={mod.href}
                      title={name}
                      aria-label={name}
                      aria-current={isSelected ? 'page' : undefined}
                      onClick={(event: MouseEvent) => {
                        if (!mod.href) return event.preventDefault()
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                        event.preventDefault()
                        navigate(mod.href)
                      }}
                      className="flex size-8 items-center justify-center rounded hover:bg-[var(--row-hover)]"
                      style={
                        {
                          '--row-hover': colors.gray[50],
                          backgroundColor: isSelected ? colors.gray[150] : undefined,
                          color: isSelected ? colors.gray[1000] : colors.gray[600],
                        } as CSSProperties
                      }
                    >
                      {mod.icon}
                    </a>
                  </li>
                )
              })}
            </ul>
          )
        })}
    </nav>
  )
}

/**
 * The ghost "Add item" row at the foot of a section. Turns into a name field in place; the new
 * item lands at the end of the section and opens.
 */
function AddItem({ sectionId, navigate }: { sectionId: string; navigate: (to: string) => void }) {
  const [adding, setAdding] = useState(false)

  if (adding) {
    return (
      <div className="flex min-h-[33px] items-center gap-[10px] py-[4px] pr-2 pl-3">
        <span className="flex size-[14px] shrink-0 items-center justify-center">
          <Plus size={14} color={colors.gray[400]} />
        </span>
        <RenameField
          name=""
          prefix=""
          ariaLabel="New item name"
          placeholder="Item name"
          onDone={() => setAdding(false)}
          onSubmit={(value) => {
            const result = addModule(sectionId, value)
            if ('error' in result) return result.error
            navigate(`${CUSTOM_PATH}/${result.id}`)
            return null
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex min-h-[33px] w-full cursor-pointer items-center gap-[10px] rounded border-none bg-transparent py-[6px] pl-3 text-left hover:bg-[var(--row-hover)] hover:text-[color:var(--hover-text)]"
      style={
        {
          ...ROW_TEXT,
          '--row-hover': colors.gray[50],
          '--hover-text': colors.gray[700],
          color: colors.gray[500],
        } as CSSProperties
      }
    >
      <span className="flex size-[14px] shrink-0 items-center justify-center">
        <Plus size={14} />
      </span>
      Add item
    </button>
  )
}

function NavRow({
  id,
  index,
  sectionId,
  name,
  changes,
  numbered,
  isSelected,
  isDragging,
  isEditing,
  dropEdge,
  navigate,
  onEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  id: string
  index: number
  sectionId: string
  name: string
  /** Renames, newest first — an info icon beside the name shows them. */
  changes: Change[]
  numbered: boolean
  isSelected: boolean
  isDragging: boolean
  isEditing: boolean
  dropEdge: 'before' | 'after' | null
  navigate: (to: string) => void
  onEdit: (id: string | null) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent<HTMLLIElement>) => void
}) {
  const mod = moduleOf(useNavState(), id)!
  // Guests see the sidebar exactly as editors do, minus every way of changing it.
  const canEdit = useCanEdit()
  const color = isSelected ? colors.gray[1000] : colors.gray[600]
  const prefix = numbered ? `${index + 1}. ` : ''

  const content = (
    <>
      <span className="flex size-[14px] shrink-0 items-center justify-center" style={{ color }}>
        {mod.icon}
      </span>
      {isEditing ? (
        <RenameField id={id} name={name} prefix={prefix} onDone={() => onEdit(null)} />
      ) : (
        <span className="min-w-0 break-words" style={{ ...ROW_TEXT, color }}>
          {prefix && <Num>{prefix}</Num>}
          {name}
          {changes.length > 0 && (
            <>
              {' '}
              <ChangeInfo changes={changes} />
            </>
          )}
        </span>
      )}
      {mod.badge && !isEditing && (
        <span className="shrink-0">
          <TagV2
            text={mod.badge}
            type={TagV2Type.SUBTLE}
            size={TagV2Size.XS}
            subType={TagV2SubType.SQUARICAL}
            color={TagV2Color.NEUTRAL}
          />
        </span>
      )}
    </>
  )

  // The right padding is always kept for the Rename / Delete buttons, so a label never runs
  // under them and nothing shifts when they appear. Labels wrap rather than truncate.
  const linkClass =
    'flex min-w-0 flex-1 items-center gap-[10px] self-stretch py-[6px] pr-[60px] pl-3 no-underline'

  return (
    <li className="relative" data-nav-module={id} data-section={sectionId} onDragOver={onDragOver}>
      {dropEdge && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 left-0 z-10 h-0.5 rounded-full"
          style={{
            backgroundColor: colors.primary[500],
            [dropEdge === 'before' ? 'top' : 'bottom']: -5,
          }}
        />
      )}
      <div
        draggable={canEdit && !isEditing}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDoubleClick={canEdit ? () => onEdit(id) : undefined}
        className="group relative flex min-h-[33px] items-center rounded hover:bg-[var(--row-hover)]"
        style={
          {
            '--row-hover': colors.gray[50],
            backgroundColor: isSelected ? colors.gray[150] : undefined,
            opacity: isDragging ? 0.4 : 1,
            transition: 'background-color 0.2s',
          } as CSSProperties
        }
      >
        {canEdit && !isEditing && (
          <GripVertical
            aria-hidden
            size={12}
            color={colors.gray[400]}
            className="absolute top-1/2 left-0 hidden -translate-y-1/2 cursor-grab group-hover:block"
          />
        )}

        {mod.href && !isEditing ? (
          <a
            href={mod.href}
            draggable={false}
            aria-current={isSelected ? 'page' : undefined}
            onClick={(event: MouseEvent) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              navigate(mod.href!)
            }}
            className={linkClass}
          >
            {content}
          </a>
        ) : (
          <div className={linkClass}>{content}</div>
        )}

        {canEdit && !isEditing && (
          <div className="absolute top-[4px] right-1 hidden items-center gap-0.5 group-hover:flex group-has-[:focus-visible]:flex">
            <RowAction label={`Rename ${name}`} onClick={() => onEdit(id)}>
              <Pencil size={14} />
            </RowAction>
            <RowAction label={`Delete ${name}`} danger onClick={() => deleteModule(id)}>
              <Trash2 size={14} />
            </RowAction>
          </div>
        )}
      </div>
    </li>
  )
}

/** The position number before a name — present, but a step quieter than the name. */
function Num({ children }: { children: ReactNode }) {
  return (
    <span className="tabular-nums" style={{ color: colors.gray[400], fontWeight: 500 }}>
      {children}
    </span>
  )
}

function RowAction({
  label,
  danger,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label.split(' ')[0]}
      draggable={false}
      onClick={(event) => {
        event.stopPropagation()
        // Only the first click of a double-click counts. Deleting slides the next row under
        // the pointer, so a second click would delete that one too.
        if (event.detail > 1) return
        onClick()
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[color:var(--icon)] hover:bg-[var(--hover)] hover:text-[color:var(--icon-hover)]"
      style={
        {
          '--icon': colors.gray[400],
          '--icon-hover': danger ? colors.red[600] : colors.gray[700],
          '--hover': danger ? colors.red[50] : colors.gray[200],
        } as CSSProperties
      }
    >
      {children}
    </button>
  )
}

function RenameField({
  id,
  name,
  prefix,
  onDone,
  onSubmit,
  ariaLabel = 'Module name',
  placeholder,
}: {
  id?: string
  name: string
  prefix: string
  onDone: () => void
  /** Instead of renaming `id`: what to do with the name. Returns a problem, or null. */
  onSubmit?: (value: string) => string | null
  ariaLabel?: string
  placeholder?: string
}) {
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)

  const commit = (closeOnError: boolean) => {
    if (onSubmit && !value.trim()) return onDone()
    const problem = onSubmit
      ? onSubmit(value)
      : value.trim() === name
        ? null
        : renameModule(id!, value)
    if (!problem || closeOnError) onDone()
    else setError(problem)
  }

  return (
    <span className="relative flex min-w-0 flex-1 items-center gap-1">
      {prefix && (
        <span className="shrink-0" style={ROW_TEXT}>
          <Num>{prefix.trim()}</Num>
        </span>
      )}
      <input
        autoFocus
        aria-label={ariaLabel}
        aria-invalid={!!error}
        placeholder={placeholder}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === 'Enter') commit(false)
          if (event.key === 'Escape') onDone()
        }}
        onBlur={() => commit(true)}
        className="h-[25px] min-w-0 flex-1 rounded border bg-white px-1.5 outline-none"
        style={{
          ...ROW_TEXT,
          color: colors.gray[900],
          borderColor: error ? colors.red[500] : colors.primary[500],
          boxShadow: `0 0 0 2px ${error ? colors.red[100] : colors.primary[100]}`,
        }}
      />
      {error && (
        <span
          role="alert"
          className="absolute top-full left-0 z-20 mt-2 max-w-[180px] rounded px-2 py-1"
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

export default EditableNav
