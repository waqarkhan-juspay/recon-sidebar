import {
  ButtonV2,
  ButtonV2Size,
  ButtonV2SubType,
  ButtonV2Type,
  ColumnType,
  DataTable,
  FOUNDATION_THEME,
  InputSizeV2,
  SelectorV2Size,
  StatCardV2,
  StatCardV2ArrowDirection,
  StatCardV2ChangeType,
  StatCardV2Variant,
  SwitchV2,
  TabsV2,
  TabsV2List,
  TabsV2Size,
  TabsV2Trigger,
  TabsV2Variant,
  TagGroupV2,
  TagV2,
  TagV2Color,
  TagV2Size,
  TagV2Type,
  TextInputV2,
  ThemeProvider,
  type ColumnDefinition,
} from '@juspay/blend-design-system'
import { useDialKit } from 'dialkit'
import { Bell, BellRing, CalendarDays, Clock, Mail, Phone, Plus, Search } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactElement } from 'react'
import slackLogo from '../../assets/icons/slack.svg'
import { SLOT_ICON } from '../../icons'
import { PrimitiveText, font } from '../../primitives'
import { smallGhostButtonTokens, viewTabsTokens } from '../../theme'
import { TAGV2_TOKENS } from '../../tokens/TagV2'
import {
  ALERT_SETUPS,
  TRIGGERED_LAST_DAY,
  TRIGGERED_LAST_MONTH,
  TRIGGERED_PREVIOUS_DAY,
  TRIGGERED_PREVIOUS_MONTH,
  type AlertChannel,
  type AlertSetup,
  type AlertType,
} from './data'

const { colors } = FOUNDATION_THEME

/** The type filter above the table. Labels are the identity — keep them unique. */
const ALL = 'All'
const TYPE_TABS: readonly string[] = [ALL, 'File', 'Recon'] satisfies (AlertType | 'All')[]

/** Icons in an input slot — the search glyph. */
const SLOT_ICON_SIZE = 16

/**
 * The stat cards' icons. StatCardV2 draws `titleIcon` above the title, centred, so it is a
 * mark at the head of the card rather than a glyph in a line of text — 20, a step up from
 * the 14px title under it.
 */
const STAT_ICON_SIZE = 20

/**
 * One colour per card, each saying what kind of number it is — all at 600, so the four sit
 * at one weight on the row:
 *
 * - Total — primary blue: a plain count, nothing to read into it.
 * - Active — green: switched on and live, the colour the switches use for on.
 * - Last 24 hours — orange: alerts that fired recently are the ones that may still need a
 *   look, and orange is the palette's "attention" without red's "something is broken".
 * - Last 30 days — purple: the longer view, a trend rather than a to-do.
 */
const STAT_ICON_COLOR = {
  total: colors.primary[600],
  active: colors.green[600],
  lastDay: colors.orange[600],
  lastMonth: colors.purple[600],
} as const

/** Slack's logo in a tag — the same 12px box as SLOT_ICON's glyphs beside it. */
const TAG_LOGO_SIZE = SLOT_ICON.size

/**
 * Each channel is one colour: blue Email, purple Slack, green Call. With Alert Type now
 * plain text, nothing else on the row is tinted, so the three can be told apart at a glance.
 *
 * Email and Call are lucide outlines at SLOT_ICON's size and weight — the app's tag icon
 * everywhere else — tinted to their tag. Slack keeps its own four-colour logo instead: a
 * brand mark is recognised by its colours, so it is not tinted to the tag around it.
 */
const CHANNEL_TAG: Record<
  AlertChannel,
  { color: TagV2Color; icon: (tint?: string) => ReactElement }
> = {
  Email: { color: TagV2Color.PRIMARY, icon: (tint) => <Mail {...SLOT_ICON} color={tint} /> },
  Slack: {
    color: TagV2Color.PURPLE,
    icon: () => <img src={slackLogo} alt="" width={TAG_LOGO_SIZE} height={TAG_LOGO_SIZE} />,
  },
  Call: { color: TagV2Color.SUCCESS, icon: (tint) => <Phone {...SLOT_ICON} color={tint} /> },
}

/**
 * A slot icon has to be told its colour. TagV2 colours its label from the token but leaves
 * the slot to inherit from the table cell, which is gray[700], so an untinted icon reads as
 * black beside a blue label. The colour is the label's own token, read from the same tree
 * TagV2 reads, so the icon cannot drift from the text next to it.
 */
const tagTextColor = (color: TagV2Color) => TAGV2_TOKENS.lg.text.color.subtle[color]

/**
 * The move in alerts fired since the period before, for the two Triggered cards.
 *
 * The arrow and the colour are set separately because, for alerts, they disagree. The arrow
 * says which way the count went. The colour says whether that is good, and more alerts
 * firing is bad. StatCardV2 names its colours INCREASE (green) and DECREASE (red), so a
 * rising count is drawn as an up arrow in DECREASE red.
 */
const firedChange = (current: number, previous: number, period: string) => {
  const rose = current > previous
  const percent = Math.round((Math.abs(current - previous) / previous) * 100)
  return {
    value: `${percent}%`,
    arrowDirection: rose ? StatCardV2ArrowDirection.UP : StatCardV2ArrowDirection.DOWN,
    changeType: rose ? StatCardV2ChangeType.DECREASE : StatCardV2ChangeType.INCREASE,
    tooltip: `${rose ? 'Up' : 'Down'} from ${previous} ${period}`,
  }
}

type StatCard = {
  title: string
  icon: ReactElement
  value: string
  subtitle: string
  change?: ReturnType<typeof firedChange>
}

/**
 * A stat card's accessible name, with the change worded from the arrow.
 *
 * StatCardV2 builds its own aria-label and words the change from `changeType` — "increased"
 * for INCREASE (buildStatCardV2AriaLabel, StatCardV2/utils.ts). That is the colour, not the
 * direction, and firedChange colours a fall green, so the 24-hour card would be read out as
 * "increased by 20%". StatCardV2 spreads its remaining props after its own aria-label, so
 * passing one replaces it — a plain prop, nothing reached around.
 */
const statCardLabel = ({ title, value, subtitle, change }: StatCard) =>
  [
    title,
    value,
    subtitle,
    change &&
      `${change.arrowDirection === StatCardV2ArrowDirection.UP ? 'up' : 'down'} ${change.value}`,
  ]
    .filter(Boolean)
    .join(', ')

/** Every column is fixed: the design draws no sort or filter affordance on any header. */
const COLUMNS = [
  { field: 'name', header: 'Name' },
  { field: 'type', header: 'Alert Type' },
  { field: 'checks', header: 'What It Checks' },
  { field: 'channels', header: 'Notify Via' },
  { field: 'status', header: 'Status' },
  { field: 'actions', header: 'Actions' },
] as const

/** Let content decide each column's width, as on the Configurator table. */
const HUG = { minWidth: '0px', maxWidth: 'none' } as const

/** A setup as the table sees it: the source row plus its live switch position. */
type TableRow = AlertSetup & {
  isActive: boolean
  [key: string]: unknown
}

/**
 * The page's vertical rhythm, tunable live from the DialKit panel — one dial per gap between
 * its main blocks: heading, intro line, stat cards, toolbar, table.
 *
 * Same shape as the Configurator's: `[value, min, max, step]`, stepping by 4 so every value
 * the dial can reach stays on the 4px grid (DESIGN.md §7). The table is one block and nothing
 * here reaches inside it — row heights and cell padding stay Blend's.
 *
 * Defaults are what the page drew before the dials existed, so adding them moved nothing.
 */
// A factory rather than six literals: it keeps the range and the step in one place, and
// returns the mutable tuple DialKit's config wants (`as const` would make it readonly).
const dial = (value: number): [number, number, number, number] => [value, 0, 96, 4]

const SPACING_DIALS = {
  aboveTitle: dial(24),
  titleToIntro: dial(4),
  introToCards: dial(24),
  cardsToToolbar: dial(24),
  // 8, not 24: the toolbar chooses what the table shows, so the two read as one block.
  toolbarToTable: dial(8),
  belowTable: dial(24),
}

/** One search box over the three things a person would type: the name, the type, the rule. */
const matchesQuery = (row: AlertSetup, needle: string) =>
  needle === '' ||
  [row.name, row.type, row.checks].some((text) =>
    text.toLowerCase().includes(needle),
  )

function Alerts() {
  const spacing = useDialKit('Alerts spacing', SPACING_DIALS)

  const [query, setQuery] = useState('')
  const [typeTab, setTypeTab] = useState(ALL)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  /** Row id → switched on. Seeded from the data; the page owns it from here. */
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALERT_SETUPS.map((row) => [row.id, row.active])),
  )

  /**
   * The two cards that describe the setups are counted from them, so flipping a switch in
   * the table moves the Active Alerts card with it. The other two are counts from the alert
   * log (data.ts).
   */
  const activeCount = ALERT_SETUPS.filter((row) => active[row.id]).length

  /** A narrower set sends you back to page one — page 2 of a set of three is an empty table. */
  const handleQueryChange = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handleTypeTabChange = (next: string) => {
    setTypeTab(next)
    setPage(1)
  }
  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next)
    setPage(1)
  }, [])

  const matchingRows = useMemo<TableRow[]>(() => {
    const needle = query.trim().toLowerCase()
    return ALERT_SETUPS.filter(
      (row) => (typeTab === ALL || row.type === typeTab) && matchesQuery(row, needle),
    ).map((row) => ({ ...row, isActive: active[row.id] ?? false }))
  }, [query, typeTab, active])

  /**
   * Paged here rather than by DataTable, for the Configurator's reason: with
   * `serverSidePagination` the footer describes the set this page has already filtered, so
   * "1-10 of 20" stays true when the search narrows it.
   */
  const totalRows = matchingRows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, pageCount)
  const data = useMemo(
    () => matchingRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [matchingRows, currentPage, pageSize],
  )

  /**
   * Built once. DataTable keeps the first `renderCell` it is given for a REACT_ELEMENT
   * column (see the note on `columns` in Configurator.tsx), so a cell reads the switch from
   * `row.isActive` — which arrives with `data` and is always current — and writes through
   * `setActive`, which React keeps stable.
   */
  /**
   * The four cards, in reading order. Active leads — what is watching right now is the
   * number this page is opened for — then the last day's firing, the total, and the month.
   */
  const statCards: StatCard[] = [
    {
      title: 'Active Alerts',
      // Ringing: an alert that is live. The same glyph the nav gives Alerts.
      icon: <BellRing size={STAT_ICON_SIZE} color={STAT_ICON_COLOR.active} />,
      value: String(activeCount),
      subtitle: 'Currently live setups',
    },
    {
      title: 'Triggered in 24 Hours',
      icon: <Clock size={STAT_ICON_SIZE} color={STAT_ICON_COLOR.lastDay} />,
      value: String(TRIGGERED_LAST_DAY),
      change: firedChange(TRIGGERED_LAST_DAY, TRIGGERED_PREVIOUS_DAY, 'the day before'),
      subtitle: 'Alerts fired in the last day',
    },
    {
      title: 'Total Alerts',
      icon: <Bell size={STAT_ICON_SIZE} color={STAT_ICON_COLOR.total} />,
      value: String(ALERT_SETUPS.length),
      subtitle: 'Alert setups configured',
    },
    {
      title: 'Triggered in 30 Days',
      icon: <CalendarDays size={STAT_ICON_SIZE} color={STAT_ICON_COLOR.lastMonth} />,
      value: String(TRIGGERED_LAST_MONTH),
      change: firedChange(TRIGGERED_LAST_MONTH, TRIGGERED_PREVIOUS_MONTH, 'the 30 days before'),
      subtitle: 'Alerts fired in the last month',
    },
  ]

  const columns = useMemo<ColumnDefinition<Record<string, unknown>>[]>(
    () =>
      COLUMNS.map(({ field, header }) => {
        const base = { field, header, ...HUG, isSortable: false as const }

        if (field === 'name') {
          return {
            ...base,
            type: ColumnType.TEXT,
            renderCell: (_value, row) => (
              // A ceiling on our own element rather than the column: a table cell ignores
              // max-width under auto layout, so the cap has to be on what is inside it.
              <div className="max-w-[280px] py-3">
                <PrimitiveText
                  {...font(FOUNDATION_THEME.font.size.body.md)}
                  color={colors.gray[900]}
                  // 600: the name is what each row is called — the row's heading.
                  fontWeight={FOUNDATION_THEME.font.weight[600]}
                >
                  {String(row.name)}
                </PrimitiveText>
              </div>
            ),
          }
        }

        if (field === 'checks') {
          return {
            ...base,
            type: ColumnType.TEXT,
            renderCell: (value) => (
              // Wraps rather than truncates: the scope after the dash is the half you need
              // to tell two similar rules apart, and an ellipsis would cut exactly that.
              <div className="max-w-[560px] py-3">
                <PrimitiveText {...font(FOUNDATION_THEME.font.size.body.md)} color={colors.gray[700]}>
                  {String(value)}
                </PrimitiveText>
              </div>
            ),
          }
        }

        if (field === 'type') {
          // Plain text, in the cell's own style. A tag here would put a second set of
          // coloured chips beside Notify Via's, and only the channels need telling apart.
          return { ...base, type: ColumnType.TEXT }
        }

        if (field === 'channels') {
          return {
            ...base,
            type: ColumnType.REACT_ELEMENT,
            renderCell: (value) => (
              <TagGroupV2 gap={FOUNDATION_THEME.unit[8]}>
                {(value as AlertChannel[]).map((channel) => {
                  const { color, icon } = CHANNEL_TAG[channel]
                  return (
                    <TagV2
                      key={channel}
                      text={channel}
                      color={color}
                      type={TagV2Type.SUBTLE}
                      size={TagV2Size.SM}
                      leftSlot={{ slot: icon(tagTextColor(color)) }}
                    />
                  )
                })}
              </TagGroupV2>
            ),
          }
        }

        if (field === 'status') {
          return {
            ...base,
            type: ColumnType.REACT_ELEMENT,
            renderCell: (_value, row) => {
              const id = String(row.id)
              return (
                // The switch alone, with no Active / Inactive word beside it: its position
                // already says that. The alert's name is its accessible name, so a screen
                // reader hears "Large amount mismatch, switch, on" rather than twenty
                // switches that sound the same.
                <SwitchV2
                  checked={row.isActive === true}
                  size={SelectorV2Size.MD}
                  aria-label={String(row.name)}
                  onCheckedChange={(next) =>
                    setActive((previous) => ({ ...previous, [id]: next }))
                  }
                />
              )
            },
          }
        }

        return {
          ...base,
          type: ColumnType.REACT_ELEMENT,
          renderCell: (_value, row) => (
            // Centred under the Actions title (its header is centred in index.css). Ghosts —
            // secondary with no outline — so twenty rows of them read as two quiet actions
            // per row rather than a column of boxes; the hover fill still marks each one as
            // a button. smallGhostButtonTokens keeps them at the outlined button's 32px.
            <div className="flex items-center justify-center gap-2">
              <ThemeProvider componentTokens={smallGhostButtonTokens}>
                {/* Edit is off while the alert is: the design greys it on every inactive
                    row, so a setup is switched back on before its rule is changed. */}
                <ButtonV2
                  buttonType={ButtonV2Type.SECONDARY}
                  subType={ButtonV2SubType.INLINE}
                  size={ButtonV2Size.SMALL}
                  text="Edit"
                  disabled={row.isActive !== true}
                />
                <ButtonV2
                  buttonType={ButtonV2Type.SECONDARY}
                  subType={ButtonV2SubType.INLINE}
                  size={ButtonV2Size.SMALL}
                  text="History"
                />
              </ThemeProvider>
            </div>
          ),
        }
      }),
    [],
  )

  return (
    // The Configurator's container — capped at the design's 1440 frame, 24px gutters — so
    // the two Reconciliation pages share one keyline.
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-col px-6"
      style={{ paddingTop: spacing.aboveTitle, paddingBottom: spacing.belowTable }}
    >
      <div className="flex flex-col" style={{ gap: spacing.titleToIntro }}>
        {/* heading.lg — 24/32 — and gray[900]: the page's one heading, a step up from the
            Configurator's because nothing else on this page names it. "Reconciliation
            Alerts" rather than the nav's "Alerts", since the page is reached from inside the
            Reconciliation section and the title should still make sense on its own. */}
        <PrimitiveText
          as="h1"
          {...font(FOUNDATION_THEME.font.size.heading.lg)}
          color={colors.gray[900]}
          fontWeight={FOUNDATION_THEME.font.weight[600]}
        >
          Reconciliation Alerts
        </PrimitiveText>
        <PrimitiveText {...font(FOUNDATION_THEME.font.size.body.md)} color={colors.gray[500]}>
          Get notified the moment a file, settlement or recon check needs your attention.
        </PrimitiveText>
      </div>

      {/* Plain StatCardV2, props only — nothing here a developer has to rebuild. At 1024 and
          up it is Blend's centred card, icon above the title; below 1024 Blend switches it
          to its compact, left-aligned layout itself (and drops the icon and subtitle).
          `maxWidth="none"` lifts the card's own 340px cap so four fill the row. */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        style={{ marginTop: spacing.introToCards }}
      >
        {statCards.map((card) => (
          <StatCardV2
            key={card.title}
            variant={StatCardV2Variant.NUMBER}
            title={card.title}
            titleIcon={card.icon}
            value={card.value}
            change={card.change}
            subtitle={card.subtitle}
            maxWidth="none"
            aria-label={statCardLabel(card)}
          />
        ))}
      </div>

      <div
        className="flex flex-col"
        style={{ marginTop: spacing.cardsToToolbar, gap: spacing.toolbarToTable }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* TabsV2 takes the full width of its parent, so it hugs its tabs on a wrapper we
              own — the same reason, and the same 12px track, as the Configurator's Reports /
              Drafts switch. */}
          <div className="w-fit shrink-0">
            <ThemeProvider componentTokens={viewTabsTokens}>
              <TabsV2
                variant={TabsV2Variant.BOXED}
                size={TabsV2Size.LG}
                value={typeTab}
                onValueChange={handleTypeTabChange}
              >
                <TabsV2List>
                  {TYPE_TABS.map((label) => (
                    <TabsV2Trigger key={label} value={label}>
                      {label}
                    </TabsV2Trigger>
                  ))}
                </TabsV2List>
              </TabsV2>
            </ThemeProvider>
          </div>

          {/* Search sits with the actions at the right end, just before Audit Log. Below sm
              the group takes the full row and the search its full width, with the two
              buttons wrapping under it as a pair. */}
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <div className="w-full sm:w-[360px]">
              <TextInputV2
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Search alerts by name or type..."
                aria-label="Search alerts"
                // SM, so the field stands the same 32px as the SMALL buttons beside it.
                size={InputSizeV2.SM}
                // gray[400], the placeholder's colour (rule 11).
                leftSlot={{ slot: <Search size={SLOT_ICON_SIZE} color={colors.gray[400]} /> }}
              />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <ButtonV2
                buttonType={ButtonV2Type.SECONDARY}
                size={ButtonV2Size.SMALL}
                text="Audit Log"
              />
              <ButtonV2
                buttonType={ButtonV2Type.PRIMARY}
                size={ButtonV2Size.SMALL}
                text="New Alert"
                leftSlot={{ slot: <Plus size={14} /> }}
              />
            </div>
          </div>
        </div>

        {/* `alerts-table` is the hook for the Actions header's centring (index.css). */}
        <div className="alerts-table">
          <DataTable
            data={data}
            columns={columns}
            idField="id"
            showHeader={false}
            enableColumnManager={false}
            pagination={{
              currentPage,
              pageSize,
              totalRows,
              pageSizeOptions: [10, 20, 50],
            }}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            serverSidePagination
          />
        </div>
      </div>
    </div>
  )
}

export default Alerts
