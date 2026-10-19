import { FOUNDATION_THEME, TooltipV2Side } from '@juspay/blend-design-system'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useParams } from 'react-router'
import { useState, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import ChangeInfo from '../layout/ChangeInfo'
import {
  addTab,
  deleteTab,
  historyOf,
  moveTab,
  nameOf,
  renameTab,
  tabKey,
  tabsOf,
  useCanEdit,
  useNavState,
  type Change,
} from '../layout/nav-store'

const { colors } = FOUNDATION_THEME

const TAB_TEXT: CSSProperties = { fontSize: 14, lineHeight: '21px', fontWeight: 500 }

/**
 * Every page on this branch: blank, apart from the page’s tab row — which anyone can add to,
 * reorder by dragging, rename and delete from.
 *
 * The row is drawn here rather than with Blend's TabsV2, whose triggers are buttons and so
 * cannot hold a Rename or Delete control. It copies TabsV2 UNDERLINE as configured for the
 * Configurator: 14/21 medium labels, gray[500] at rest and gray[700] when hovered or
 * selected, a 2px gray[700] underline, 24px between tabs, over a gray[200] hairline.
 *
 * Tabs wrap onto a second line rather than scroll or truncate.
 */
function ModulePage({ moduleId }: { moduleId: string }) {
  const nav = useNavState()
  const canEdit = useCanEdit()
  const tabs = tabsOf(nav, moduleId)
  const [picked, setPicked] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const current = picked && tabs.includes(picked) ? picked : tabs[0]
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  const endDrag = () => {
    setDragging(null)
    setDropAt(null)
  }
  // A drop that would leave the tab where it is draws no indicator.
  const from = dragging ? tabs.indexOf(dragging) : -1
  const activeDrop = dropAt !== null && dropAt !== from && dropAt !== from + 1 ? dropAt : null

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col px-6 pt-6">
      <h1 className="sr-only">{nameOf(nav, moduleId)}</h1>
      <div
        className="flex flex-wrap items-end gap-x-6 gap-y-3"
        style={{ borderBottom: `1px solid ${colors.gray[200]}` }}
      >
        {tabs.length > 0 && (
          <div role="tablist" aria-label="Page tabs" className="contents">
            {tabs.map((label, index) => (
              <Tab
                key={label}
                moduleId={moduleId}
                label={label}
                isSelected={label === current}
                isEditing={editing === label}
                changes={historyOf(nav, tabKey(moduleId, label))}
                isDragging={dragging === label}
                isDragActive={dragging !== null}
                dropEdge={
                  activeDrop === index
                    ? 'before'
                    : activeDrop === index + 1 && index === tabs.length - 1
                      ? 'after'
                      : null
                }
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', label)
                  setDragging(label)
                }}
                onDragOver={(event) => {
                  if (!dragging) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  const box = event.currentTarget.getBoundingClientRect()
                  const next = event.clientX < box.left + box.width / 2 ? index : index + 1
                  if (next !== dropAt) setDropAt(next)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragging && dropAt !== null) moveTab(moduleId, dragging, dropAt)
                  endDrag()
                }}
                onDragEnd={endDrag}
                onSelect={() => setPicked(label)}
                onEdit={(on) => setEditing(on ? label : null)}
                onRenamed={(to) => {
                  if (label === current) setPicked(to)
                }}
              />
            ))}
          </div>
        )}
        <div className="flex h-[35px] items-start">
          {canEdit && <AddTab moduleId={moduleId} onAdded={setPicked} />}
        </div>
      </div>
    </div>
  )
}

function Tab({
  moduleId,
  label,
  isSelected,
  isEditing,
  changes,
  isDragging,
  isDragActive,
  dropEdge,
  onSelect,
  onEdit,
  onRenamed,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  moduleId: string
  label: string
  isSelected: boolean
  isEditing: boolean
  /** Renames, newest first — an info icon beside the label shows them. */
  changes: Change[]
  isDragging: boolean
  /** Some tab is being dragged — hide the hover toolbars so they don't flicker past. */
  isDragActive: boolean
  dropEdge: 'before' | 'after' | null
  onSelect: () => void
  onEdit: (on: boolean) => void
  onRenamed: (to: string) => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const canEdit = useCanEdit()
  return (
    <div
      draggable={canEdit && !isEditing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className="group relative flex h-[35px] items-start pt-0.5"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Where the dragged tab will land: a bar in the middle of the 24px gap. */}
      {dropEdge && (
        <span
          aria-hidden
          className={`pointer-events-none absolute top-0 bottom-1 w-0.5 rounded-full ${
            dropEdge === 'before' ? '-left-[13px]' : '-right-[13px]'
          }`}
          style={{ backgroundColor: colors.primary[500] }}
        />
      )}
      {isEditing ? (
        <NameField
          initial={label}
          ariaLabel="Tab name"
          onSubmit={(value) => {
            const problem = renameTab(moduleId, label, value)
            if (!problem) onRenamed(value.trim().replace(/\s+/g, ' '))
            return problem
          }}
          onDone={() => onEdit(false)}
        />
      ) : (
        <button
          type="button"
          role="tab"
          aria-selected={isSelected}
          onClick={onSelect}
          onDoubleClick={canEdit ? () => onEdit(true) : undefined}
          className="cursor-pointer border-none bg-transparent p-0 whitespace-nowrap text-[color:var(--tab)] hover:text-[color:var(--tab-hover)]"
          style={
            {
              ...TAB_TEXT,
              '--tab': isSelected ? colors.gray[700] : colors.gray[500],
              '--tab-hover': colors.gray[700],
            } as CSSProperties
          }
        >
          {label}
        </button>
      )}
      {!isEditing && changes.length > 0 && (
        // Beside the tab rather than inside it: the tab is a button, and the icon is its own
        // focus stop. 2.5px drops the 16px icon onto the 21px label line.
        <span className="mt-[2.5px] ml-1 flex">
          <ChangeInfo changes={changes} side={TooltipV2Side.TOP} />
        </span>
      )}

      {isSelected && (
        <span
          aria-hidden
          className="absolute right-0 -bottom-px left-0 h-0.5"
          style={{ backgroundColor: colors.gray[700] }}
        />
      )}

      {/* Rename / Delete, under the hovered tab. Part of the tab's own box, so moving the
          pointer down onto it does not end the hover. */}
      {canEdit && !isEditing && !isDragActive && (
        <div className="absolute top-full left-1/2 z-20 hidden -translate-x-1/2 pt-1.5 group-hover:block group-has-[:focus-visible]:block">
          <div
            className="flex items-center gap-0.5 rounded-lg border bg-white p-0.5"
            style={{
              borderColor: colors.gray[200],
              boxShadow: '0 4px 12px rgba(16, 24, 40, 0.07)',
            }}
          >
            <TabAction label={`Rename ${label}`} onClick={() => onEdit(true)}>
              <Pencil size={13} />
            </TabAction>
            <TabAction label={`Delete ${label}`} danger onClick={() => deleteTab(moduleId, label)}>
              <Trash2 size={13} />
            </TabAction>
          </div>
        </div>
      )}
    </div>
  )
}

function TabAction({
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
      onClick={(event) => {
        event.stopPropagation()
        // Only the first click of a double-click counts. Deleting slides the next row under
        // the pointer, so a second click would delete that one too.
        if (event.detail > 1) return
        onClick()
      }}
      className="flex size-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-[color:var(--icon)] hover:bg-[var(--hover)] hover:text-[color:var(--icon-hover)]"
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

/**
 * An inline name field. Enter saves (and stays open on a problem, saying what it is), Escape
 * cancels, and leaving the field saves if it can and otherwise drops the edit.
 */
function NameField({
  initial,
  ariaLabel,
  placeholder,
  onSubmit,
  onDone,
}: {
  initial: string
  ariaLabel: string
  placeholder?: string
  onSubmit: (value: string) => string | null
  onDone: () => void
}) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  const submit = (closeOnError: boolean) => {
    if (!value.trim()) return onDone()
    const problem = onSubmit(value)
    if (!problem || closeOnError) onDone()
    else setError(problem)
  }

  return (
    <span className="relative flex items-center">
      <input
        autoFocus
        aria-label={ariaLabel}
        aria-invalid={!!error}
        placeholder={placeholder}
        value={value}
        size={Math.max(value.length, placeholder?.length ?? 0, 6)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit(false)
          if (event.key === 'Escape') onDone()
        }}
        onBlur={() => submit(true)}
        className="h-7 rounded-md border bg-white px-2 outline-none placeholder:text-[color:var(--placeholder)]"
        style={
          {
            ...TAB_TEXT,
            '--placeholder': colors.gray[400],
            color: colors.gray[900],
            borderColor: error ? colors.red[500] : colors.primary[500],
            boxShadow: `0 0 0 3px ${error ? colors.red[100] : colors.primary[100]}`,
          } as CSSProperties
        }
      />
      {error && (
        <span
          role="alert"
          className="absolute top-full left-0 z-20 mt-2 whitespace-nowrap"
          style={{ fontSize: 12, lineHeight: '16px', fontWeight: 500, color: colors.red[600] }}
        >
          {error}
        </span>
      )}
    </span>
  )
}

/** The ghost "Add tab" button, which turns into a name field in place. */
function AddTab({ moduleId, onAdded }: { moduleId: string; onAdded: (label: string) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <NameField
        initial=""
        ariaLabel="New tab name"
        placeholder="Tab name"
        onSubmit={(value) => {
          const problem = addTab(moduleId, value)
          if (!problem) onAdded(value.trim().replace(/\s+/g, ' '))
          return problem
        }}
        onDone={() => setEditing(false)}
      />
    )
  }

  return (
    // Ghost: no border and no fill until hovered.
    <button
      type="button"
      onClick={() => setEditing(true)}
      // -mt-1 centres its label on the tab labels beside it.
      className="-mt-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 whitespace-nowrap hover:bg-[var(--hover)] active:bg-[var(--active)]"
      style={
        {
          '--hover': colors.gray[100],
          '--active': colors.gray[150],
          ...TAB_TEXT,
          color: colors.gray[600],
        } as CSSProperties
      }
    >
      <Plus size={16} color={colors.gray[500]} />
      Add tab
    </button>
  )
}

/** The page for a module someone added in the sidebar, found by the id in its address. */
export function AddedModulePage() {
  const { moduleId = '' } = useParams()
  return <ModulePage key={moduleId} moduleId={moduleId} />
}

export default ModulePage
