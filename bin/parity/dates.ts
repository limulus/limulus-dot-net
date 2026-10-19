// The date grammars parity's XML leg reads, each to a key that every spelling of one
// instant shares. A date is read only when it matches its grammar exactly and its fields
// name a real wall-clock time, so that a spelling a lenient parser would still take —
// V8's `Date.parse` takes most — is not counted as the same instant.

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
const DAYS = 'Sun Mon Tue Wed Thu Fri Sat'.split(' ')

/** RFC 822's zone names, but its military letters, by their offset in minutes. */
const ZONES: Partial<Record<string, number>> = {
  UT: 0,
  GMT: 0,
  EST: -300,
  EDT: -240,
  CST: -360,
  CDT: -300,
  MST: -420,
  MDT: -360,
  PST: -480,
  PDT: -420,
}

const RFC_822 = new RegExp(
  `^(?:(${DAYS.join('|')}), )?(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4}) ` +
    `(\\d\\d):(\\d\\d)(?::(\\d\\d))? ([+-]\\d{4}|${Object.keys(ZONES).join('|')})$`
)

const RFC_3339 = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/

/** A wall-clock time, its month counted from 0. */
interface Wall {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * The instant `wall` names at `offset` minutes east of UTC, in whole seconds since the
 * epoch, or undefined where a field is out of its range — the 31st of June, an hour 24
 * — which `Date.UTC` rolls over into the next, so that the time it names is not the one
 * written; or where the weekday given is not the date's.
 */
function secondsOf(wall: Wall, offset: number, weekday?: number): number | undefined {
  const { year, month, day, hour, minute, second } = wall
  const at = new Date(Date.UTC(year, month, day, hour, minute, second))
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const written =
    `${pad(year, 4)}-${pad(month + 1)}-${pad(day)}` +
    `T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`
  const real =
    at.toISOString() === written && (weekday === undefined || at.getUTCDay() === weekday)
  return real ? at.getTime() / 1000 - offset * 60 : undefined
}

/** The minutes east of UTC an offset `±hhmm` or `±hh:mm` names, if it names any. */
function minutesOf(offset: string): number | undefined {
  const [hours, minutes] = [offset.slice(1, 3), offset.slice(-2)].map(Number)
  if (hours > 23 || minutes > 59) return undefined
  return (offset.startsWith('-') ? -1 : 1) * (hours * 60 + minutes)
}

/**
 * The instant an RFC 822 date-time names, as RSS writes `pubDate` — its weekday
 * optional, a four-digit year, seconds optional, a numeric offset or one of RFC 822's
 * zone names — or undefined where `text` is no such date.
 */
export function rfc822(text: string): string | undefined {
  const m = RFC_822.exec(text)
  if (m === null) return undefined
  const [, weekday, day, month, year, hour, minute, second = '0', zone] = m
  const offset = ZONES[zone] ?? minutesOf(zone)
  if (offset === undefined) return undefined
  const wall = {
    year: Number(year),
    month: MONTHS.indexOf(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }
  const dayOfWeek = weekday === undefined ? undefined : DAYS.indexOf(weekday)
  return secondsOf(wall, offset, dayOfWeek)?.toString()
}

/**
 * The instant an RFC 3339 date-time names — Atom's dates, and the sitemap's, whose W3C
 * profile of ISO 8601 this is the full form of — its fraction kept exactly, or undefined
 * where `text` is no such date-time.
 */
export function rfc3339(text: string): string | undefined {
  const m = RFC_3339.exec(text)
  if (m === null) return undefined
  const [, year, month, day, hour, minute, second, fraction = '', zone] = m
  const offset = zone === 'Z' ? 0 : minutesOf(zone)
  if (offset === undefined) return undefined
  const wall = {
    year: Number(year),
    month: Number(month) - 1,
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }
  const seconds = secondsOf(wall, offset)
  const digits = fraction.replace(/0+$/, '')
  if (seconds === undefined) return undefined
  return digits === '' ? `${seconds}` : `${seconds}.${digits}`
}

/** A date grammar: its name, for a report, and how it reads a date to its instant. */
export interface Grammar {
  name: string
  read: (text: string) => string | undefined
}

export const GRAMMARS = {
  rfc822: { name: 'RFC 822', read: rfc822 },
  rfc3339: { name: 'RFC 3339', read: rfc3339 },
} as const satisfies Record<string, Grammar>
