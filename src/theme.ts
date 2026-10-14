import {
  AccordionV2Type,
  FOUNDATION_THEME,
  getDirectoryTokens,
  getKeyValuePairV2Tokens,
  getTableToken,
  type ComponentTokenType,
  type DirectoryTokenType,
  type ResponsiveDirectoryTokens,
  type ResponsiveTableTokens,
  type ResponsiveTabsV2Tokens,
  type ResponsiveSidebarV2Tokens,
} from '@juspay/blend-design-system'
import { ICON_SIZE } from './layout/chrome'
import { ACCORDIONV2_TOKENS } from './tokens/AccordionV2'
import { BUTTONV2_TOKENS } from './tokens/ButtonV2'
import { DRAWER_TOKENS } from './tokens/Drawer'
import { MENU_V2_TOKENS } from './tokens/MenuV2'
import { POPOVERV2_TOKENS } from './tokens/PopoverV2'
import { TABSV2_TOKENS } from './tokens/TabsV2'
import { SIDEBARV2_TOKENS } from './tokens/SidebarV2'
import { SINGLE_SELECT_V2_TOKENS } from './tokens/SingleSelectV2'
import { TAGS_TOKENS } from './tokens/Tags'
import { TAGV2_TOKENS } from './tokens/TagV2'

/**
 * Component token overrides — the only mechanism this app uses to restyle a Blend
 * component. No global CSS, no `!important`, nothing anchored on Blend's internal DOM.
 *
 * ⚠️ Overrides REPLACE, they do not merge. The docs site says partial `BUTTONV2` overrides
 * are "merged on top of the active light or dark defaults"; the installed 0.0.37 does not
 * do that. All 81 slots in `initComponentTokens.ts` resolve as
 * `componentTokens.X ?? getXTokens(...)`, and there is no deep-merge helper in the package
 * (rule 2 — source is truth, not the docs). So every override here starts from the
 * component's own getter and edits one path. Handing in a partial object would discard the
 * component's whole token tree, dark variant included.
 *
 * ⚠️ Overrides are also GLOBAL. A slot set here applies to every instance in the app. Where
 * only one instance should move, use `scopedTokens` below instead.
 */

/**
 * A breakpoint-keyed token tree, edited one breakpoint at a time.
 *
 * Mapped over the keys rather than naming `sm` and `lg`, so a third breakpoint could not
 * silently keep the default.
 */
const perBreakpoint = <T,>(tokens: Record<string, T>, edit: (token: T) => T) =>
  Object.fromEntries(Object.entries(tokens).map(([bp, token]) => [bp, edit(token)]))

/**
 * Nav rows at 500 — Blend's own value (directory.tokens.ts:146,257) and AGENTS.md rule 10's
 * weight for body copy.
 *
 * They spent a while at 400: the rail looked heavy and weight was the obvious lever. The
 * cause turned out to be macOS subpixel antialiasing thickening every stem, fixed with
 * grayscale smoothing, and with that gone 500 reads correctly. The override stays rather
 * than reverting to Blend's default so the value is explicit and the reasoning is a comment
 * rather than a bisect.
 *
 * Section labels keep Blend's 600 — they are headings, and the contrast is the point.
 *
 * And the collapsed rail's nav buttons are centred. In icon-only mode Directory hard-codes
 * 12px of side padding on a 52px rail (Directory.tsx:79), which leaves a 28px column, then pads
 * each item by `iconOnlyPadding` — 10px a side, so a 14px icon makes a 34px button. It
 * overflows the column to the right and every nav icon sat 3px right of the rail's centre,
 * out of line with the toggle above and the footer rows below. Side padding of half the
 * column's leftover makes the button exactly 28px, the width the footer rows already are.
 */
const RAIL_COLUMN = '28px'
const ICON_ONLY_SIDE_PADDING = `calc((${RAIL_COLUMN} - ${ICON_SIZE}) / 2)`

const DIRECTORY = perBreakpoint(
  getDirectoryTokens(FOUNDATION_THEME) as unknown as Record<string, DirectoryTokenType>,
  (token) => ({
    ...token,
    section: {
      ...token.section,
      itemList: {
        ...token.section.itemList,
        item: {
          ...token.section.itemList.item,
          fontWeight: FOUNDATION_THEME.font.weight[500],
          iconOnlyPadding: {
            ...token.section.itemList.item.iconOnlyPadding,
            paddingLeft: ICON_ONLY_SIDE_PADDING,
            paddingRight: ICON_ONLY_SIDE_PADDING,
          },
        },
      },
    },
  }),
) as unknown as ResponsiveDirectoryTokens

/**
 * The table's outer radius: 12, not Blend's 8.
 *
 * 12 is what the design specifies and what DESIGN.md §7 asks of a card-like surface. This
 * one is reachable because DataTable reads the token to build its inline style
 * (`borderRadius: tableToken.dataTable.borderRadius`, DataTable.tsx:1581) — so setting the
 * token sets the inline style, and no CSS has to out-shout it.
 */
const TABLE = perBreakpoint(
  getTableToken(FOUNDATION_THEME) as unknown as Record<
    string,
    { dataTable: { borderRadius: unknown } }
  >,
  (token) => ({
    ...token,
    dataTable: { ...token.dataTable, borderRadius: FOUNDATION_THEME.border.radius[12] },
  }),
) as unknown as ResponsiveTableTokens

/**
 * The sidebar white, not Blend's gray[25] (#FCFCFD).
 *
 * SidebarV2 paints its whole shell from these: `container` is the rail *and* the area behind
 * the page, and the header, footer and the two narrow columns each repeat the same colour.
 * Every one moves together, so the rail, open or collapsed, and the page are one white
 * surface split by the rail's border. TopbarV2's 80% white then sits on white and reads white.
 */
const SIDEBARV2 = perBreakpoint(
  SIDEBARV2_TOKENS as unknown as Record<string, Record<string, object>>,
  (token) => {
    const white = FOUNDATION_THEME.colors.gray[0]
    return {
      ...token,
      container: { ...token.container, backgroundColor: white },
      leftPanel: { ...token.leftPanel, backgroundColor: white },
      header: { ...token.header, backgroundColor: white },
      // No padding of its own: the profile row (AppShell's SidebarFooter) carries its own, and
      // the footer's added a second inset around it.
      footer: {
        ...token.footer,
        backgroundColor: white,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
      },
      secondarySidebar: { ...token.secondarySidebar, backgroundColor: white },
    }
  },
) as unknown as ResponsiveSidebarV2Tokens

/**
 * Only slots that actually override something are wired.
 *
 * src/tokens/ carries a full tree for all 14 V2 components this app renders, but a tree
 * sitting at Blend's own values earns nothing by being handed back to ThemeProvider — and
 * costs something, because these are light values and passing them replaces the dark
 * defaults too. Edit a value in that file, then add its slot here.
 */
export const componentTokens: ComponentTokenType = {
  DIRECTORY,
  TABLE,
  SIDEBARV2,
  // Top padding halved to undo Blend applying it twice — see src/tokens/MenuV2.ts.
  MENU_V2: MENU_V2_TOKENS,
}

/**
 * Tabs with the design's 24px between triggers, for the ONE tab set that wants it.
 *
 * `tabList.gap` is a single value in the token tree — unlike `backgroundColor`,
 * `borderRadius` and `padding`, it is not keyed by variant or size. Setting it globally
 * would also space out the boxed All / Reconciliation / File Summary tabs, which the design
 * keeps tight inside their track.
 *
 * So it is scoped by React instead of by CSS selector: `useResponsiveTokens` reads
 * `useContext(ThemeContext)` (useResponsiveTokens.ts:69), which means a ThemeProvider
 * nested around one subtree gives that subtree its own tokens. Wrap only the section tabs
 * and nothing else moves.
 */
export const sectionTabsTokens: ComponentTokenType = {
  ...componentTokens,
  TABSV2: perBreakpoint(
    TABSV2_TOKENS as unknown as Record<string, { tabList: { gap: unknown } }>,
    (token) => ({ ...token, tabList: { ...token.tabList, gap: FOUNDATION_THEME.unit[24] } }),
  ) as unknown as ResponsiveTabsV2Tokens,
}

type UnderlineTabsPadding = Record<
  'sm' | 'md' | 'lg',
  Record<string, Record<'top' | 'right' | 'bottom' | 'left', unknown>>
>
/** `trigger` sits inside `tabList` in Blend's tree (tabsV2.tokens.ts), not beside it. */
type UnderlineTabsToken = {
  tabList: { gap: unknown; trigger: { padding: UnderlineTabsPadding } }
}

/**
 * The Configurator's section tabs — TabsV2 UNDERLINE with no side padding on the tabs (Blend:
 * 8px a side), so the first label starts on the page's keyline, with the toolbar and the
 * table under it. The 16px that padding put between neighbours goes into the gap instead
 * (8 → 24), so the labels sit as far apart as before. The indicator now spans the label
 * alone.
 */
export const configSectionTabsTokens: ComponentTokenType = {
  ...componentTokens,
  TABSV2: perBreakpoint(TABSV2_TOKENS as unknown as Record<string, UnderlineTabsToken>, (token) => {
    const { trigger } = token.tabList
    const padding = Object.fromEntries(
      Object.entries(trigger.padding).map(([size, variants]) => [
        size,
        { ...variants, underline: { ...variants.underline, left: 0, right: 0 } },
      ]),
    ) as unknown as UnderlineTabsPadding
    return {
      ...token,
      tabList: {
        ...token.tabList,
        gap: FOUNDATION_THEME.unit[24],
        trigger: { ...trigger, padding },
      },
    }
  }) as unknown as ResponsiveTabsV2Tokens,
}

type BoxedTabsToken = {
  tabList: { borderRadius: Record<'sm' | 'md' | 'lg', Record<string, unknown>> }
}

/**
 * The Configurator's Reports / Drafts switch — TabsV2 BOXED, a segmented control. Its
 * grey track at the 12px radius (Blend: 8) so it rounds a step more than the 8px white tab
 * sitting 4px inside it, the way nested corners should: an inner radius as large as the
 * outer one makes the gap between them look pinched at the corners.
 *
 * Scoped by a nested ThemeProvider for the reason sectionTabsTokens gives — any other BOXED
 * tabs keep Blend's radius.
 */
export const viewTabsTokens: ComponentTokenType = {
  ...componentTokens,
  TABSV2: perBreakpoint(TABSV2_TOKENS as unknown as Record<string, BoxedTabsToken>, (token) => ({
    ...token,
    tabList: {
      ...token.tabList,
      borderRadius: {
        ...token.tabList.borderRadius,
        lg: { ...token.tabList.borderRadius.lg, boxed: FOUNDATION_THEME.border.radius[12] },
      },
    },
  })) as unknown as ResponsiveTabsV2Tokens,
}

type Sides = 'top' | 'right' | 'bottom' | 'left'
/** Blend's own size keys — `ButtonV2Size` is `sm | md | lg` (buttonV2.types.ts:11). */
type GhostSize = 'sm' | 'md' | 'lg'
type GhostButtonToken = {
  backgroundColor: { secondary: { inline: Record<'default' | 'hover' | 'active' | 'disabled', unknown> } }
  borderRadius: Record<GhostSize, { secondary: { inline: unknown } }>
  padding: Record<Sides, Record<GhostSize, { secondary: { inline: unknown } }>>
}

type ButtonState = Record<'default' | 'hover' | 'active' | 'disabled', unknown>
type DangerButtonToken = {
  backgroundColor: { danger: { default: ButtonState } }
  border: { danger: { default: ButtonState } }
  // The label's colour is under `text`, not at the top level: a breakpoint's own keys are
  // backgroundColor / borderRadius / padding / border / shadow / text.
  text: { color: { danger: { default: ButtonState } } }
}

/**
 * A danger *secondary* — the outlined shape of a secondary button, in red.
 *
 * blend-gap: ButtonV2 crosses variant with subType, and `danger` has only the three every
 * variant has: `default` (a red gradient fill), `iconOnly` (the same), and `inline` (no
 * fill and no border at all). The outlined middle weight that `secondary` gets does not
 * exist for danger, and no combination of props reaches it — so the three paths that
 * describe it are remapped on `danger.default` instead.
 *
 * The values mirror `secondary.default`'s own structure rather than inventing one: a white
 * rest state, a tinted hover, a border a step darker than the fill, and a label at 600.
 * Where secondary reads gray, this reads red.
 *
 * Scoped by a nested ThemeProvider around the one button that wants it (ExitFlowModal).
 * `danger.default` is the ordinary red button everywhere else, and a global remap would
 * quietly take the fill off all of them.
 */
export const dangerSecondaryButtonTokens: ComponentTokenType = {
  ...componentTokens,
  BUTTONV2: perBreakpoint(
    BUTTONV2_TOKENS as unknown as Record<string, DangerButtonToken>,
    (token) => ({
      ...token,
      backgroundColor: {
        ...token.backgroundColor,
        danger: {
          ...token.backgroundColor.danger,
          default: {
            default: FOUNDATION_THEME.colors.gray[0],
            hover: FOUNDATION_THEME.colors.red[50],
            active: FOUNDATION_THEME.colors.red[100],
            disabled: FOUNDATION_THEME.colors.gray[0],
          },
        },
      },
      border: {
        ...token.border,
        danger: {
          ...token.border.danger,
          default: {
            default: `1px solid ${FOUNDATION_THEME.colors.red[200]}`,
            hover: `1px solid ${FOUNDATION_THEME.colors.red[300]}`,
            active: `1px solid ${FOUNDATION_THEME.colors.red[300]}`,
            disabled: `1px solid ${FOUNDATION_THEME.colors.red[100]}`,
          },
        },
      },
      text: {
        ...token.text,
        color: {
          ...token.text.color,
          danger: {
            ...token.text.color.danger,
            default: {
              default: FOUNDATION_THEME.colors.red[600],
              hover: FOUNDATION_THEME.colors.red[700],
              active: FOUNDATION_THEME.colors.red[700],
              disabled: FOUNDATION_THEME.colors.red[300],
            },
          },
        },
      },
    }),
  ) as unknown as ComponentTokenType['BUTTONV2'],
}

/**
 * A ghost button: secondary + INLINE (no border, no fill at rest), given a real padding box,
 * a radius, and a gray[50] fill on hover — so it has a hit area and a surface that answers
 * the pointer, while still reading as the quiet action.
 *
 * blend-gap: ButtonV2Type has no ghost (primary/secondary/danger/success only), and INLINE
 * zeroes every padding (buttonV2.light.tokens.ts), which leaves an inline button as tall as
 * its own text and with nothing for a hover fill to sit in.
 *
 * `size` is the only size touched, and every caller scopes these by a nested ThemeProvider,
 * so the inline buttons elsewhere (Cc, Bcc, Save as draft, LinkAction) keep their shape. The
 * background is not size-keyed in Blend's tree — `backgroundColor.secondary.inline` is one
 * slot for all three — which is the other half of why the scope has to be narrow.
 */
const ghostButton = (
  size: GhostSize,
  {
    x,
    y,
    radius,
    hover = FOUNDATION_THEME.colors.gray[50],
    active = FOUNDATION_THEME.colors.gray[100],
  }: { x: string; y: string; radius: unknown; hover?: unknown; active?: unknown },
): ComponentTokenType => ({
  ...componentTokens,
  BUTTONV2: perBreakpoint(
    BUTTONV2_TOKENS as unknown as Record<string, GhostButtonToken>,
    (token) => {
      const pad = (side: Sides, value: string) => ({
        ...token.padding[side],
        [size]: {
          ...token.padding[side][size],
          secondary: { ...token.padding[side][size].secondary, inline: value },
        },
      })
      return {
        ...token,
        backgroundColor: {
          ...token.backgroundColor,
          secondary: {
            ...token.backgroundColor.secondary,
            inline: {
              default: 'transparent',
              hover,
              active,
              disabled: 'transparent',
            },
          },
        },
        borderRadius: {
          ...token.borderRadius,
          [size]: {
            ...token.borderRadius[size],
            secondary: { ...token.borderRadius[size].secondary, inline: radius },
          },
        },
        padding: {
          ...token.padding,
          top: pad('top', y),
          bottom: pad('bottom', y),
          left: pad('left', x),
          right: pad('right', x),
        },
      }
    },
  ) as unknown as ComponentTokenType['BUTTONV2'],
})

/**
 * The flow footer's Exit — the secondary LARGE button's padding (9px / 16px on lg) plus its
 * 1px border, so Exit is exactly as tall as the Back button beside the primary action.
 */
export const ghostButtonTokens = ghostButton('lg', {
  x: '16px',
  y: '10px',
  radius: FOUNDATION_THEME.border.radius[10],
})

/**
 * Alerts' row actions — Edit and History — as ghosts at SMALL: the secondary SMALL button's
 * padding (5px / 16px on sm) plus its 1px border, so dropping the outline leaves each one
 * exactly the 32px it was and the row does not shift. Same 10px radius as the outlined
 * button, so the hover fill has the shape the border used to draw.
 *
 * The fill is a step darker than the default ghost's. These sit in table rows, and hovering
 * a button hovers its row too — DataTable paints a hovered row gray[100]. The default
 * gray[50] is lighter than that, so the hovered button read as a pale hole in a grey row.
 * gray[150] / gray[200] sit one step above the row instead.
 */
export const smallGhostButtonTokens = ghostButton('sm', {
  x: '16px',
  y: '6px',
  radius: FOUNDATION_THEME.border.radius[10],
  hover: FOUNDATION_THEME.colors.gray[150],
  active: FOUNDATION_THEME.colors.gray[200],
})

/**
 * The FAQ panel's horizontal rhythm, in three numbers that have to agree:
 *
 * - FAQ_LIST_GUTTER — the list's own side padding, so a filled (open or hovered) question
 *   sits inside the panel as a rounded card rather than bleeding to its edges.
 * - FAQ_INSET — the question's side padding inside that card, and the answer's.
 * - FAQ_PANEL_PADDING — the two added up, and the panel's side padding. So the heading, the
 *   questions and the answers all start on one keyline, 24 in from the panel's edge.
 */
export const FAQ_LIST_GUTTER = 12
export const FAQ_INSET = 12
export const FAQ_PANEL_PADDING = FAQ_LIST_GUTTER + FAQ_INSET

type FaqAccordionToken = {
  trigger: {
    padding: Record<AccordionV2Type, unknown>
    text: {
      title: {
        fontSize: unknown
        fontWeight: unknown
        lineHeight: unknown
        color: Record<'default' | 'hover' | 'active' | 'disabled' | 'open', unknown>
      }
    }
  }
}

type FaqPopoverToken = {
  padding: Record<'left' | 'right' | 'bottom', Record<'sm' | 'md' | 'lg', unknown>>
  TopContainer: { heading: { fontWeight: Record<'sm' | 'md' | 'lg', unknown> } }
}

type FabButtonToken = {
  borderRadius: Record<GhostSize, { secondary: { iconOnly: unknown } }>
  backgroundColor: { secondary: { iconOnly: Record<string, unknown> } }
}

/**
 * The flow's help button (FaqLauncher) — a secondary LARGE icon-only ButtonV2 drawn as a
 * floating action button: fully round.
 *
 * Secondary — bordered, gray glyph — rather than primary: help is on every step and wanted on
 * few of them, and a blue disc in the corner would out-shout Continue, the one button on the
 * page that should be the loudest. Round is the one shape that reads as "floating" rather than
 * as a toolbar button someone forgot to put in a toolbar.
 *
 * Filled gray[100] rather than Blend's white, so the disc reads as a surface of its own over
 * the white page; hover steps it to gray[150], and active returns to rest as Blend's does. The
 * fill is not size-keyed in Blend's tree, but the only secondary icon-only ButtonV2 under this
 * scope is the launcher — PopoverV2's own ✕ is a V1 Button, which these tokens do not reach.
 *
 * No drop shadow here: ButtonV2 reads its `shadow` token only for `:active`
 * (ButtonV2/utils.ts:239) — the resting and hover slots exist in the tree and are never
 * applied — so FaqLauncher casts `shadows.lg` from a round wrapper around the button instead.
 *
 * And the FAQ list inside it — AccordionV2, borderless:
 *
 * - The question's side padding FAQ_INSET (12, the `lg` value; `sm` is 16), which with the
 *   list's FAQ_LIST_GUTTER puts it on the panel heading's keyline — and the answers, which
 *   FaqLauncher pads by the same FAQ_INSET.
 * - The question as `body.md` at 500 in gray[700] — the same size and leading as its answer
 *   (FaqLauncher), so weight alone sets the two apart: 500 over 400. 600 read as shouting down
 *   a list where every row is a question. Blend draws `lg` titles
 *   at 16px in gray[800]. Disabled keeps Blend's gray[500].
 * - Its line height `body.md`'s own 20, not Blend's 16: a 16px line under 14px type is fine for
 *   a one-line label and cramped for a question that wraps — and most of these do, at the
 *   panel's width.
 *
 * And the panel's heading, "Frequently asked questions", at 500 rather than PopoverV2's 600 —
 * still 16px, Blend's `md` heading size, which is the size FaqLauncher opens at. A deliberate
 * exception to AGENTS.md rule 10's 600 headings, by request: beside questions set at 500 the
 * semibold title was the one loud thing in a panel that is meant to be quiet. And its side
 * padding 16 → FAQ_PANEL_PADDING (24), so the heading lands on the questions' keyline now that
 * they sit inside the list's gutter. Its bottom padding 16 → 0: the list runs to the panel's
 * bottom edge, and its own 8px padding is the only space under the last question.
 *
 * All scoped by one nested ThemeProvider around the launcher, for the reason
 * sectionTabsTokens gives: every other secondary icon-only button keeps Blend's square
 * corners, and any other accordion keeps Blend's spacing.
 */
export const faqLauncherTokens: ComponentTokenType = {
  ...componentTokens,
  BUTTONV2: perBreakpoint(BUTTONV2_TOKENS as unknown as Record<string, FabButtonToken>, (token) => ({
    ...token,
    backgroundColor: {
      ...token.backgroundColor,
      secondary: {
        ...token.backgroundColor.secondary,
        iconOnly: {
          ...token.backgroundColor.secondary.iconOnly,
          default: FOUNDATION_THEME.colors.gray[100],
          hover: FOUNDATION_THEME.colors.gray[150],
          active: FOUNDATION_THEME.colors.gray[100],
        },
      },
    },
    borderRadius: {
      ...token.borderRadius,
      lg: {
        ...token.borderRadius.lg,
        secondary: {
          ...token.borderRadius.lg.secondary,
          iconOnly: FOUNDATION_THEME.border.radius.full,
        },
      },
    },
  })) as unknown as ComponentTokenType['BUTTONV2'],
  ACCORDIONV2: perBreakpoint(
    ACCORDIONV2_TOKENS as unknown as Record<string, FaqAccordionToken>,
    (token) => ({
      ...token,
      trigger: {
        ...token.trigger,
        padding: {
          ...token.trigger.padding,
          [AccordionV2Type.NO_BORDER]: `${FOUNDATION_THEME.unit[16]} ${FAQ_INSET}px`,
        },
        text: {
          ...token.trigger.text,
          title: {
            ...token.trigger.text.title,
            fontSize: FOUNDATION_THEME.font.size.body.md.fontSize,
            fontWeight: FOUNDATION_THEME.font.weight[500],
            lineHeight: FOUNDATION_THEME.font.size.body.md.lineHeight,
            color: {
              ...token.trigger.text.title.color,
              default: FOUNDATION_THEME.colors.gray[700],
              hover: FOUNDATION_THEME.colors.gray[700],
              active: FOUNDATION_THEME.colors.gray[700],
              open: FOUNDATION_THEME.colors.gray[700],
            },
          },
        },
      },
    }),
  ) as unknown as ComponentTokenType['ACCORDIONV2'],
  POPOVERV2: perBreakpoint(
    POPOVERV2_TOKENS as unknown as Record<string, FaqPopoverToken>,
    (token) => ({
      ...token,
      padding: {
        ...token.padding,
        left: { ...token.padding.left, md: `${FAQ_PANEL_PADDING}px` },
        right: { ...token.padding.right, md: `${FAQ_PANEL_PADDING}px` },
        bottom: { ...token.padding.bottom, md: '0px' },
      },
      TopContainer: {
        ...token.TopContainer,
        heading: {
          ...token.TopContainer.heading,
          fontWeight: {
            ...token.TopContainer.heading.fontWeight,
            md: FOUNDATION_THEME.font.weight[500],
          },
        },
      },
    }),
  ) as unknown as ComponentTokenType['POPOVERV2'],
}

type ButtonTextColors = {
  text: {
    color: { secondary: { inline: Record<'default' | 'hover' | 'active' | 'disabled', unknown> } }
  }
}

/**
 * Secondary inline buttons in gray[500] rather than Blend's gray[600], for quiet link-style
 * actions such as the email card's "Cc" / "Bcc" links.
 *
 * blend-gap: ButtonV2 takes no colour prop and omits `style`, so the only reach is the
 * token. Scoped with a nested ThemeProvider for the same reason as sectionTabsTokens — set
 * globally it would also grey out Exit and "Save as draft", which keep gray[600]. Hover
 * steps up to 600 so the link still acknowledges the pointer.
 */
export const neutralLinkTokens: ComponentTokenType = {
  ...componentTokens,
  BUTTONV2: perBreakpoint(
    BUTTONV2_TOKENS as unknown as Record<string, ButtonTextColors>,
    (token) => ({
      ...token,
      text: {
        ...token.text,
        color: {
          ...token.text.color,
          secondary: {
            ...token.text.color.secondary,
            inline: {
              default: FOUNDATION_THEME.colors.gray[500],
              hover: FOUNDATION_THEME.colors.gray[600],
              active: FOUNDATION_THEME.colors.gray[600],
              disabled: FOUNDATION_THEME.colors.gray[400],
            },
          },
        },
      },
    }),
  ) as unknown as ComponentTokenType['BUTTONV2'],
}

type TagChromeToken = {
  backgroundColor: { subtle: { neutral: unknown; warning: unknown; purple: unknown } }
  border: {
    noFill: { neutral: unknown; warning: unknown; purple: unknown }
    subtle: { neutral: unknown; warning: unknown; purple: unknown }
  }
}

/** The design's chip hairline — `tag/borderColor/subtle/neutral`, #ECEFF3. */
const TAG_HAIRLINE = `1px solid ${FOUNDATION_THEME.colors.gray[150]}`

type TagPaletteToken = (typeof TAGS_TOKENS)['sm']

/**
 * The recipient chips in the Delivery step's email field (RecipientsInput.tsx).
 *
 * `TAGS`, not `TAGV2`: MultiValueInputV2 renders the V1 Tag for its values
 * (MultiValueInputV2.tsx:246). Nothing else in this app draws a V1 Tag, but this is scoped
 * to the field anyway — a global remap of a colour slot is the kind of thing that surprises
 * the next component to use it.
 *
 * Two edits.
 *
 * **Colour.** `tags` carries `{ value, size, shape, variant }` and no colour key, so Tag
 * falls through to its own default of PRIMARY and the chips come out blue. Neutral is what
 * an address that has merely been entered should read as — it is a value, not a status. With
 * no prop to pass, the way there is to point the `primary` slot at `neutral`'s own values
 * rather than restate them, so the two cannot drift if Blend moves its greys.
 *
 * **Height.** `xs` padding goes from `2px 6px` to `0 6px`. The field's content box is 21px
 * (a 35px MD input, less 6px of padding either side and its two borders) and the chip was
 * 30px, so the input grew by 9px the moment an address went in. The chip's floor is its own
 * 18px line plus 2px of border, so zero vertical padding is what it takes to fit — 20px, and
 * the field holds its height. The horizontal 6px is untouched.
 *
 * That alone is not enough: Tag's remove button carries an inline `min-height: 24px`
 * (MultiValueInputV2.tsx:281) that no token reaches. See `.recipients-field` in index.css.
 */
export const recipientTagTokens: ComponentTokenType = {
  ...componentTokens,
  TAGS: perBreakpoint(TAGS_TOKENS as unknown as Record<string, TagPaletteToken>, (token) => ({
    ...token,
    padding: { ...token.padding, xs: `0 ${FOUNDATION_THEME.unit[6]}` },
    backgroundColor: {
      ...token.backgroundColor,
      subtle: { ...token.backgroundColor.subtle, primary: token.backgroundColor.subtle.neutral },
    },
    border: {
      ...token.border,
      subtle: { ...token.border.subtle, primary: token.border.subtle.neutral },
    },
    text: {
      ...token.text,
      color: {
        ...token.text.color,
        subtle: { ...token.text.color.subtle, primary: token.text.color.subtle.neutral },
      },
    },
  })) as unknown as ComponentTokenType['TAGS'],
}

/**
 * The field vocabulary's chips — version 6's, and the column organiser's palette — with the
 * design's own hairline in place of Blend's.
 *
 * Node 4861:105311 sets `tag/borderColor/subtle/neutral` to #ECEFF3 — gray[150]. Blend's own
 * token is gray[200] (#E1E4EA), one step darker on the ramp. On a single chip the difference
 * is invisible; across twenty-two of them it is the difference between a field of soft
 * shapes and a grid of hard-edged boxes, which is the whole point of the subtle style.
 *
 * `noFill` takes the same value, and that one is not a nicety. The organiser's palette draws
 * an *unchosen* chip as NO_FILL (ColumnOrganiser.tsx), and Blend borders that one in
 * gray[950] — near-black, which down a column of twenty-nine reads as a stack of outlined
 * boxes rather than as a list. Node 4911:111688, the design's own default chip, is this same
 * #ECEFF3 hairline with its fill switched off, so in the design the two states differ by
 * their fill and their glyph and by nothing else.
 *
 * Two more colours draw under these tokens, and they are treated differently.
 *
 * A field the user wrote is WARNING (ColumnOrganiser.tsx), and Blend paints it across the
 * whole chip: orange[500] all the way round an unfilled one, orange[50] under a filled one.
 * Custom is where a field came from, not anything the report does with it, so it falls back to
 * the neutral fill and hairline and the word alone carries the orange — orange[500] unfilled,
 * orange[600] filled.
 *
 * A field the report groups by is PURPLE, and a *chosen* grouped chip keeps Blend's wash:
 * purple[50] under it and a purple[100] hairline, exactly as the Grouping step draws a picked
 * chip. That is the one mark meant to carry from that step into this one, so it is drawn the
 * same in both. Only an unfilled grouped chip — a grouped field whose column has since been
 * removed — takes the neutral hairline, since Blend would otherwise ring it in purple[500].
 *
 * The Fields step's older round chips — the flow's only other NO_FILL — render unwrapped
 * (FieldsStep.tsx:862) and keep Blend's border.
 *
 * Scoped by a nested ThemeProvider rather than set globally, for the same reason as
 * sectionTabsTokens: SUBTLE/NEUTRAL is also the Filters step's "Optional" chip, and that one
 * keeps Blend's default. Every other value the design asks for — gray[50] fill, radius 6,
 * 24px height, 10/4 padding, 6px gap, 14px/500 type — is already Blend's MD SQUARICAL token,
 * so this override is two paths deep and nothing else moves.
 */
export const fieldTagTokens: ComponentTokenType = {
  ...componentTokens,
  TAGV2: perBreakpoint(
    TAGV2_TOKENS as unknown as Record<string, TagChromeToken>,
    (token) => ({
      ...token,
      backgroundColor: {
        ...token.backgroundColor,
        subtle: {
          ...token.backgroundColor.subtle,
          warning: token.backgroundColor.subtle.neutral,
        },
      },
      border: {
        ...token.border,
        noFill: {
          ...token.border.noFill,
          neutral: TAG_HAIRLINE,
          warning: TAG_HAIRLINE,
          purple: TAG_HAIRLINE,
        },
        subtle: {
          ...token.border.subtle,
          neutral: TAG_HAIRLINE,
          warning: TAG_HAIRLINE,
        },
      },
    }),
  ) as unknown as ComponentTokenType['TAGV2'],
}

type SelectTriggerToken = { trigger: { selectedValue: { color: unknown } } }

/**
 * The column organiser (ColumnOrganiser.tsx) — the field chips above, plus its aggregation
 * select.
 *
 * Spreads `fieldTagTokens` rather than restating it: the organiser's palette is the same
 * chip as the Fields step's vocabulary, drawn from the same node, and two copies of one
 * border colour is how the two would drift apart.
 *
 * The one thing added is the select's trigger colour. Node 4911:111609 draws "COUNT" at
 * gray[400] — the same tint as the grip, pencil and duplicate glyphs beside it, which is the
 * organiser saying these are the row's secondary controls and the column's name is the row.
 * Blend colours a *chosen* value gray[700] (singleSelectV2.light.tokens.ts:184) and only its
 * placeholder gray[400], which is the right default for a select that is answering a
 * question — but every one of these has an answer from the moment the column exists, so
 * gray[700] would make a rank of COUNTs the loudest thing in the panel.
 *
 * Deliberately not conditional on whether the aggregation is still COUNT. A select that
 * darkened once touched would be a third state to explain, and the design draws one.
 *
 * Scoped by a nested ThemeProvider, not global: the Filters step's selects
 * (FiltersStep.tsx:180-192) are the ordinary kind and keep Blend's gray[700].
 */
export const columnOrganiserTokens: ComponentTokenType = {
  ...fieldTagTokens,
  SINGLE_SELECT_V2: perBreakpoint(
    SINGLE_SELECT_V2_TOKENS as unknown as Record<string, SelectTriggerToken>,
    (token) => ({
      ...token,
      trigger: {
        ...token.trigger,
        selectedValue: {
          ...token.trigger.selectedValue,
          color: FOUNDATION_THEME.colors.gray[400],
        },
      },
    }),
  ) as unknown as ComponentTokenType['SINGLE_SELECT_V2'],
}

/**
 * The organiser's right-hand list — the palette's tokens with Blend's tag colours put back.
 *
 * `fieldTagTokens` sends WARNING to the neutral fill because a palette chip is one of
 * twenty-nine, and down a column that long a coloured wash stops being a mark and becomes the
 * weather. A row's pill is the opposite case. There is one of it, it sits alone in the
 * slot the aggregation select would have taken, and it is naming the treatment the row is
 * under rather than being an item in a list — so the wash is doing the work there, and
 * "Grouped by" keeps its purple, "Custom" its orange.
 *
 * Only TAGV2 goes back. The select's gray[400] trigger stays, because the rows are where that
 * select lives.
 */
export const organiserRowTokens: ComponentTokenType = {
  ...columnOrganiserTokens,
  TAGV2: TAGV2_TOKENS as unknown as ComponentTokenType['TAGV2'],
}

/**
 * The report config detail sheet's spacing, set on Blend's own tokens rather than on the
 * markup around them — see ConfigDetailSheet.tsx.
 *
 * Two values move, and both are the panel's own rhythm rather than anything about a single
 * row:
 *
 * `DRAWER.content.padding` 16/20 → 24. Blend's values are a bottom-sheet inset — right on a
 * phone, thin on a 600px reference panel, where 20px leaves the title, the key column and the
 * preview table all running to within 20px of the edge and nothing reading as a margin. 24 is
 * the step the pages already use, and because DrawerHeader, DrawerBody and DrawerFooter all
 * read this one token, the header/body boundary opens to 48px at the same time — which is
 * what lets the sheet separate its zones with space instead of a rule (better-layout: group
 * with space, not lines).
 *
 * `KEYVALUEPAIRV2.gap.vertical` 4 → 8. Only the stacked rows use it (Metrics, Filters, Column
 * Order, File Name Template), and their values wrap to two 20px lines. At 4px the key sits
 * closer to its value than the value's own lines sit to each other, so the pair reads as one
 * paragraph and the list loses its keys; 8px still leaves the 20px between those rows at
 * 2.5x the gap inside one, which is the ratio that makes a group read as a group.
 *
 * Scoped by a nested ThemeProvider for the same reason as sectionTabsTokens: DRAWER is also
 * every mobile select panel Blend opens (SingleSelectDrawer and friends), which want the
 * bottom-sheet inset they were designed with.
 */
export const detailSheetTokens: ComponentTokenType = {
  ...componentTokens,
  DRAWER: perBreakpoint(
    DRAWER_TOKENS as unknown as Record<
      string,
      { content: { padding: { x: unknown; y: unknown } } }
    >,
    (token) => ({
      ...token,
      content: {
        ...token.content,
        padding: { x: FOUNDATION_THEME.unit[24], y: FOUNDATION_THEME.unit[24] },
      },
    }),
  ) as unknown as ComponentTokenType['DRAWER'],
  KEYVALUEPAIRV2: perBreakpoint(
    getKeyValuePairV2Tokens(FOUNDATION_THEME) as unknown as Record<
      string,
      { gap: { vertical: unknown; horizontal: unknown } }
    >,
    (token) => ({ ...token, gap: { ...token.gap, vertical: FOUNDATION_THEME.unit[8] } }),
  ) as unknown as ComponentTokenType['KEYVALUEPAIRV2'],
}
