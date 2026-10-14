/**
 * What an alert watches. A Recon alert reads the outcome of matching; a File alert reads
 * whether a file turned up at all. The two tabs above the table filter on this.
 */
export type AlertType = 'Recon' | 'File'

/** Where a fired alert goes. Order in `channels` is the order the tags are drawn in. */
export type AlertChannel = 'Email' | 'Slack' | 'Call'

export type AlertSetup = {
  id: string
  name: string
  /**
   * The condition, then the scope it applies to after an em dash — "… while loading a file —
   * All Sources". One sentence, so it can be read straight off the row.
   */
  checks: string
  type: AlertType
  channels: AlertChannel[]
  /** Whether the setup starts switched on. The page holds the live value from here on. */
  active: boolean
}

/**
 * Twenty setups, written to read like a real merchant's list rather than a test account's.
 *
 * Names are sentence case and say what went wrong, not how the rule is built — "Large
 * amount mismatch", not "percent check 41".
 *
 * Each check is varied on purpose — thresholds, cut-off times and scopes all differ — but
 * stays true to its type. A Recon alert reads the outcome of matching (match rate, amounts,
 * records left over); a File alert reads whether a file turned up, on time and intact.
 *
 * Types, channels and on/off state are unchanged from the design's rows, which is what keeps
 * the cards at 20 setups with 9 active.
 */
export const ALERT_SETUPS: AlertSetup[] = [
  {
    id: 'alert-1',
    name: 'High duplicate rate on file load',
    checks: 'Flags more than 5% duplicate records dropped while loading a file — All sources',
    type: 'Recon',
    channels: ['Email', 'Slack'],
    active: true,
  },
  {
    id: 'alert-2',
    name: 'Razorpay match rate drop',
    checks: 'Flags a recon run that matches fewer than 97% of transactions — Razorpay',
    type: 'Recon',
    channels: ['Slack'],
    active: true,
  },
  {
    id: 'alert-3',
    name: 'Large amount mismatch',
    checks:
      'Flags any transaction whose settled amount differs from the order by more than ₹5,000 — All sources',
    type: 'Recon',
    channels: ['Email', 'Slack', 'Call'],
    active: true,
  },
  {
    id: 'alert-4',
    name: 'Missing from bank statement',
    checks:
      'Flags more than 25 transactions settled by the PSP but absent from the bank statement — HDFC Bank',
    type: 'Recon',
    channels: ['Email', 'Call'],
    active: true,
  },
  {
    id: 'alert-5',
    name: 'Stale unreconciled records',
    checks: 'Flags records still unreconciled 3 days after the transaction date — PayU',
    type: 'Recon',
    channels: ['Email', 'Call'],
    active: true,
  },
  {
    id: 'alert-6',
    name: 'Recon run not started',
    checks: 'Checks reconciliation has started for the day’s PSP file by 13:30 — PayU',
    type: 'Recon',
    channels: ['Email', 'Call'],
    active: false,
  },
  {
    id: 'alert-7',
    name: 'Refunds not settled',
    checks: 'Flags refunds still unsettled 7 days after they were initiated — Cashfree',
    type: 'Recon',
    channels: ['Slack'],
    active: true,
  },
  {
    id: 'alert-8',
    name: 'Chargeback spike',
    checks: 'Flags more than 15 chargebacks raised in a single day — All sources',
    type: 'Recon',
    channels: ['Slack'],
    active: true,
  },
  {
    id: 'alert-9',
    name: 'Daily settlement file late',
    checks: 'Checks the settlement file has arrived by 11:00 — All sources',
    type: 'File',
    channels: ['Email', 'Slack', 'Call'],
    active: false,
  },
  {
    id: 'alert-10',
    name: 'Payouts stuck in pending',
    checks: 'Flags payouts still pending more than 2 days after the transaction — Paytm',
    type: 'Recon',
    channels: ['Email', 'Slack', 'Call'],
    active: false,
  },
  {
    id: 'alert-11',
    name: 'Razorpay settlement file missing',
    checks: 'Checks the settlement file has arrived by 10:00 — Razorpay',
    type: 'File',
    channels: ['Email', 'Slack'],
    active: true,
  },
  {
    id: 'alert-12',
    name: 'Fees above contract rate',
    checks: 'Flags more than 10 transactions in a day charged an MDR above 2.1% — PhonePe',
    type: 'Recon',
    channels: ['Email', 'Call'],
    active: true,
  },
  {
    id: 'alert-13',
    name: 'PayU file arrived late',
    checks: 'Checks the transaction file has arrived by 08:30 — PayU',
    type: 'File',
    channels: ['Email'],
    active: false,
  },
  {
    id: 'alert-14',
    name: 'Unmatched UPI transactions',
    checks: 'Flags more than 50 UPI transactions left unmatched after the evening run — PhonePe',
    type: 'Recon',
    channels: ['Slack'],
    active: false,
  },
  {
    id: 'alert-15',
    name: 'Empty file received',
    checks: 'Flags a file that arrives with no records in it — All sources',
    type: 'File',
    channels: ['Email', 'Slack'],
    active: false,
  },
  {
    id: 'alert-16',
    name: 'Bank statement not received',
    checks: 'Checks the bank statement has arrived by 08:00 — ICICI Bank',
    type: 'File',
    channels: ['Email', 'Call'],
    active: false,
  },
  {
    id: 'alert-17',
    name: 'Overall match rate below target',
    checks: 'Flags a recon run that matches fewer than 95% of records — All sources',
    type: 'Recon',
    channels: ['Email', 'Slack', 'Call'],
    active: false,
  },
  {
    id: 'alert-18',
    name: 'Duplicate settlements',
    checks: 'Flags any settlement UTR that appears more than once in a day — Axis Bank',
    type: 'Recon',
    channels: ['Slack', 'Call'],
    active: false,
  },
  {
    id: 'alert-19',
    name: 'File columns changed',
    checks: 'Flags a file whose columns differ from the last accepted file — Cashfree',
    type: 'File',
    channels: ['Email'],
    active: false,
  },
  {
    id: 'alert-20',
    name: 'Recon run failed',
    checks: 'Checks the daily recon run has completed by 14:00 — All sources',
    type: 'Recon',
    channels: ['Email', 'Slack'],
    active: false,
  },
]

/**
 * How often alerts fired, from the design's cards. Unlike the other two cards these cannot be
 * derived from the setups — they are counts from the alert log, which this demo has none of.
 */
export const TRIGGERED_LAST_DAY = 8
export const TRIGGERED_LAST_MONTH = 92

/** The period before each of those, which the cards' change is measured against. */
export const TRIGGERED_PREVIOUS_DAY = 10
export const TRIGGERED_PREVIOUS_MONTH = 80
