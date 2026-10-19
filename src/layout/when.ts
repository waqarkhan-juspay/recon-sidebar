const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/** "4:32 PM" today, "Oct 18, 4:32 PM" before that. */
export const when = (at: number) => {
  const date = new Date(at)
  const today = new Date().toDateString() === date.toDateString()
  return today ? TIME.format(date) : `${DAY.format(date)}, ${TIME.format(date)}`
}
