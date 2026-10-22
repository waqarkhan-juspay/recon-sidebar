import {
  FOUNDATION_THEME,
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2SubType,
  TagV2Type,
} from '@juspay/blend-design-system'
import {
  Activity,
  ChevronDown,
  CornerDownRight,
  History,
  Lock,
  PanelTop,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { displayName, useHistory, useSession, type HistoryEvent } from '../auth/session'
import {
  canRestore,
  moduleOf,
  nameOf,
  restore,
  restoreVersion,
  useCanEdit,
  useNavState,
  type DeletedEntry,
  type NavState,
} from './nav-store'
import { sectionName } from './navigation'
import { v2Icon, v2SectionName } from './navigation-v2'
import { pathFor, versionOf } from './sidebar-version'
import { when } from './when'

const { colors } = FOUNDATION_THEME

const TEXT: CSSProperties = { fontSize: 14, lineHeight: '20px', fontWeight: 500 }
const SMALL: CSSProperties = { fontSize: 12, lineHeight: '18px', fontWeight: 500 }

type TabId = 'deleted' | 'history'

/**
 * A floating bar over the page with two tabs:
 *
 *   Recently deleted  everything deleted — sidebar items and page tabs — with where it was
 *                     and when, and a way to put each back
 *   Version history   every change anyone has made, who made it and when, with a way to put
 *                     the whole sidebar back as it was after any one of them (editors only)
 *
 * Folds down to a single line, and opens on Recently deleted whenever something new is.
 */
function ActivityBar({ railCollapsed }: { railCollapsed: boolean }) {
  const nav = useNavState()
  const history = useHistory()
  const session = useSession()
  const isEditor = session.status === 'editor'
  const { deleted } = nav
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<TabId>('deleted')
  const [seen, setSeen] = useState(deleted.length)

  // A new deletion opens the bar on its tab, even if it had been folded away.
  if (deleted.length !== seen) {
    setSeen(deleted.length)
    if (deleted.length > seen) {
      setExpanded(true)
      setTab('deleted')
    }
  }

  const latest = history[0]
  const summary = [
    `${deleted.length} deleted`,
    isEditor && latest
      ? `last change ${when(latest.at)} by ${displayName(latest.actor).split(' ')[0]}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    // Above SidebarV2, whose shell covers the viewport at z-index 99. Centred on the page area:
    // from `lg` up the sidebar takes 52 + 320px on the left, or just the 52px rail collapsed.
    <div
      className={`fixed bottom-6 left-1/2 z-[1000] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 ${
        railCollapsed ? 'lg:left-[calc(50%+26px)]' : 'lg:left-[calc(50%+186px)]'
      }`}
    >
      <section
        aria-label="Activity"
        className="activity-bar overflow-hidden rounded-xl border bg-white"
        style={{
          borderColor: colors.gray[200],
          boxShadow: '0 8px 24px rgba(16, 24, 40, 0.07), 0 2px 6px rgba(16, 24, 40, 0.05)',
        }}
      >
        {/* The header folds the bar; the version switch sits in it but is its own control. */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-none bg-transparent p-0 text-left"
          >
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: colors.primary[50], color: colors.primary[600] }}
            >
              <Activity size={14} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span style={{ ...TEXT, fontWeight: 600, color: colors.gray[900] }}>Activity</span>
              {!expanded && <span style={{ ...SMALL, color: colors.gray[500] }}>{summary}</span>}
            </span>
          </button>
          <VersionSwitch />
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded((e) => !e)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent hover:bg-[var(--hover)]"
            style={{ '--hover': colors.gray[100] } as CSSProperties}
          >
            <ChevronDown
              size={16}
              color={colors.gray[500]}
              style={{
                transform: expanded ? 'none' : 'rotate(180deg)',
                transition: 'transform 150ms',
              }}
            />
          </button>
        </div>

        {expanded && (
          <>
            <div
              role="tablist"
              aria-label="Activity"
              className="flex gap-5 border-b px-4"
              style={{ borderColor: colors.gray[150] }}
            >
              <BarTab
                selected={tab === 'deleted'}
                onSelect={() => setTab('deleted')}
                icon={<Trash2 size={13} />}
                count={deleted.length}
              >
                Recently deleted
              </BarTab>
              <BarTab
                selected={tab === 'history'}
                onSelect={() => setTab('history')}
                icon={<History size={13} />}
                count={isEditor ? history.length : undefined}
              >
                Version history
              </BarTab>
            </div>

            <div role="tabpanel" className="max-h-[320px] overflow-y-auto p-1.5">
              {tab === 'deleted' ? (
                deleted.length === 0 ? (
                  <Empty>Nothing has been deleted.</Empty>
                ) : (
                  <ul className="m-0 list-none p-0">
                    {deleted.map((entry) => (
                      <DeletedRow key={entry.key} entry={entry} nav={nav} />
                    ))}
                  </ul>
                )
              ) : !isEditor ? (
                <Empty icon={<Lock size={16} />}>
                  Version history is for editors. Sign in with an editor’s email to see who changed
                  what.
                </Empty>
              ) : history.length === 0 ? (
                <Empty>No changes yet.</Empty>
              ) : (
                <ol className="m-0 list-none p-0">
                  {history.map((event, index) => (
                    <VersionRow key={event.id} event={event} isLatest={index === 0} />
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/**
 * Which sidebar to look at: version 1, the editable one, or version 2, the Juspay dashboard's
 * layout. Each viewer switches for themselves; it changes nothing for anyone else.
 */
function VersionSwitch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const current = versionOf(pathname)

  return (
    <div
      role="radiogroup"
      aria-label="Sidebar version"
      className="flex shrink-0 items-center rounded-lg p-0.5"
      style={{ backgroundColor: colors.gray[100] }}
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
            className="h-6 cursor-pointer rounded-md border-none px-2.5"
            style={{
              ...SMALL,
              fontWeight: 600,
              color: on ? colors.gray[900] : colors.gray[500],
              backgroundColor: on ? colors.gray[0] : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(16, 24, 40, 0.06)' : 'none',
            }}
          >
            Version {version}
          </button>
        )
      })}
    </div>
  )
}

function BarTab({
  selected,
  onSelect,
  icon,
  count,
  children,
}: {
  selected: boolean
  onSelect: () => void
  icon: ReactNode
  count?: number
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className="relative flex h-10 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[color:var(--tab)] hover:text-[color:var(--tab-hover)]"
      style={
        {
          ...TEXT,
          fontSize: 13,
          '--tab': selected ? colors.gray[900] : colors.gray[500],
          '--tab-hover': colors.gray[800],
        } as CSSProperties
      }
    >
      {icon}
      {children}
      {count !== undefined && (
        <span
          className="rounded-full px-1.5"
          style={{
            ...SMALL,
            fontSize: 11,
            lineHeight: '16px',
            fontWeight: 600,
            color: colors.gray[600],
            backgroundColor: colors.gray[100],
          }}
        >
          {count}
        </span>
      )}
      {selected && (
        <span
          aria-hidden
          className="absolute right-0 -bottom-px left-0 h-0.5"
          style={{ backgroundColor: colors.gray[900] }}
        />
      )}
    </button>
  )
}

function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p
      className="m-0 flex items-center justify-center gap-2 px-6 py-6 text-center"
      style={{ ...SMALL, fontSize: 13, color: colors.gray[500] }}
    >
      {icon}
      <span>{children}</span>
    </p>
  )
}

/** What a deleted entry was, in words and pictures, whichever kind it is. */
function describe(nav: NavState, entry: DeletedEntry) {
  const position = (index: number, of: number) => `position ${index + 1} of ${of}`
  switch (entry.kind) {
    case 'tab':
      return {
        name: entry.label,
        icon: <PanelTop size={14} />,
        tag: 'Tab',
        color: TagV2Color.PURPLE,
        where: `On ${nameOf(nav, entry.moduleId)} · ${position(entry.index, entry.rowSize)}`,
      }
    case 'module': {
      const mod = moduleOf(nav, entry.id)
      if (!mod) return null
      return {
        name: entry.name,
        renamedFrom: entry.name !== mod.label ? mod.label : undefined,
        icon: mod.icon,
        tag: 'Sidebar Item',
        color: TagV2Color.PRIMARY,
        where: `From ${sectionName(entry.sectionId)} · ${position(entry.index, entry.sectionSize)}`,
      }
    }
    case 'v2-group': {
      const Icon = v2Icon(entry.group.icon)
      return {
        name: entry.name,
        icon: <Icon size={14} />,
        tag: 'V2 Item',
        color: TagV2Color.WARNING,
        where: `From ${v2SectionName(entry.sectionId)} · ${position(entry.index, entry.sectionSize)}`,
      }
    }
    case 'v2-page':
      return {
        name: entry.name,
        icon: <CornerDownRight size={14} />,
        tag: 'V2 Sub-item',
        color: TagV2Color.SUCCESS,
        where: `In ${entry.groupName} · ${position(entry.index, entry.rowSize)}`,
      }
  }
}

function DeletedRow({ entry, nav }: { entry: DeletedEntry; nav: NavState }) {
  const canEdit = useCanEdit()
  const about = describe(nav, entry)
  if (!about) return null
  const restorable = canRestore(nav, entry)

  return (
    <li className="flex items-center gap-3 rounded-lg px-2.5 py-2">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: colors.gray[50],
          color: colors.gray[500],
          border: `1px solid ${colors.gray[150]}`,
        }}
      >
        {about.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span style={{ ...TEXT, color: colors.gray[900] }}>
            {about.name}
            {about.renamedFrom && (
              <span style={{ color: colors.gray[400] }}> · was {about.renamedFrom}</span>
            )}
          </span>
          <TagV2
            text={about.tag}
            type={TagV2Type.SUBTLE}
            size={TagV2Size.XS}
            subType={TagV2SubType.SQUARICAL}
            color={about.color}
          />
        </span>
        <span style={{ ...SMALL, color: colors.gray[500] }}>
          {about.where} · {when(entry.deletedAt)}
          {entry.by && ` · by ${displayName(entry.by).split(' ')[0]}`}
        </span>
      </span>
      {canEdit &&
        (restorable ? (
          <GhostAction onClick={() => restore(entry.key)}>Restore</GhostAction>
        ) : (
          <span
            title="Its item is deleted too. Restore that first."
            className="shrink-0 px-2"
            style={{ ...SMALL, color: colors.gray[400] }}
          >
            Restore its item first
          </span>
        ))}
    </li>
  )
}

/** One change: who (the avatar), what, when — and, for editors, a way back to the sidebar as it was then. */
function VersionRow({ event, isLatest }: { event: HistoryEvent; isLatest: boolean }) {
  const [confirming, setConfirming] = useState(false)

  // The confirmation lapses on its own, so a stray second click later does nothing.
  useEffect(() => {
    if (!confirming) return
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])

  return (
    <li className="flex items-start gap-3 rounded-lg px-2.5 py-2">
      <Initials email={event.actor} />
      <span className="flex min-w-0 flex-1 flex-col">
        {/* Who made it is the avatar's to say; the line is the change itself. */}
        <span style={{ ...TEXT, color: colors.gray[900] }}>{event.summary}</span>
        <span style={{ ...SMALL, color: colors.gray[500] }}>
          {when(event.at)}
          {isLatest && ' · current version'}
        </span>
      </span>
      {!isLatest && (
        <GhostAction
          title="Put the whole sidebar back as it was after this change"
          tone={confirming ? 'danger' : undefined}
          onClick={() => {
            if (!confirming) return setConfirming(true)
            setConfirming(false)
            restoreVersion(event.snapshot, `Restored the version from ${when(event.at)}`)
          }}
        >
          {confirming ? 'Confirm restore' : 'Restore'}
        </GhostAction>
      )}
    </li>
  )
}

const AVATAR_TONES = ['primary', 'purple', 'orange', 'green'] as const

function Initials({ email }: { email: string }) {
  const name = displayName(email)
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
  const hash = [...email].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length]
  return (
    <span
      role="img"
      aria-label={name}
      title={`${name} · ${email}`}
      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
      style={{
        ...SMALL,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: colors[tone][100],
        color: colors[tone][700],
      }}
    >
      {initials}
    </span>
  )
}

function GhostAction({
  onClick,
  title,
  tone,
  children,
}: {
  onClick: () => void
  title?: string
  tone?: 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2 whitespace-nowrap hover:bg-[var(--hover)]"
      style={
        {
          '--hover': tone ? colors.red[50] : colors.gray[100],
          fontSize: 13,
          lineHeight: '18px',
          fontWeight: 600,
          color: tone ? colors.red[600] : colors.gray[700],
        } as CSSProperties
      }
    >
      <RotateCcw size={13} />
      {children}
    </button>
  )
}

export default ActivityBar
