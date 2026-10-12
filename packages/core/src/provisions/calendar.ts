/** Bounded memo of the pure calendar calculation; never retained in a World. */
import { type CalendarInfo, calendarAt, type GameMinute } from '../time.ts';

const calendars = new Map<number, CalendarInfo>();
export function provisionCalendar(at: GameMinute): CalendarInfo {
  let cal = calendars.get(at);
  if (!cal) {
    cal = calendarAt(at);
    if (calendars.size >= 4096) calendars.clear();
    calendars.set(at, cal);
  }
  return cal;
}
