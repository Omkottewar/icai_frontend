// Build Google Calendar deep-links that open in the browser instead of
// downloading a .ics file or hitting Windows' webcal:// handler (which
// nags users to install a calendar app from the Microsoft Store).
//
// Two URL shapes Google supports:
//
//  1. Single-event prefill  (action=TEMPLATE)
//     User lands on calendar.google.com with the event already filled in;
//     one click to save into their own calendar. No download, no app.
//
//  2. Calendar subscription by URL  (action=ADD_FROM_URL... aka /r?cid=)
//     User adds our `webcal://...` feed as an "Other calendar" inside their
//     Google Calendar. All registered events keep syncing automatically.

const GCAL_BASE = 'https://calendar.google.com/calendar/render';

// Google's expected datetime shape: YYYYMMDDTHHmmssZ (UTC, basic ISO 8601
// with separators stripped). We always emit UTC and let Google convert to
// the user's timezone on render.
function toGCalDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString()
    + pad(d.getUTCMonth() + 1)
    + pad(d.getUTCDate())
    + 'T'
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds())
    + 'Z'
  );
}

// Build a Google Calendar prefill URL for a single event. Falls back to a
// 2-hour duration if the event has no ends_at (shouldn't happen — events
// table has NOT NULL — but defensive).
export function googleCalendarEventUrl(event) {
  if (!event || !event.starts_at) return null;
  const start = toGCalDate(event.starts_at);
  let end = toGCalDate(event.ends_at);
  if (!end) {
    const fallback = new Date(new Date(event.starts_at).getTime() + 2 * 60 * 60 * 1000);
    end = toGCalDate(fallback.toISOString());
  }
  if (!start || !end) return null;

  // Compose the human-readable description. Strip markdown asterisks/hashes
  // since GCal renders plain text only; keep newlines.
  const descLines = [];
  if (event.committee) descLines.push(`Committee: ${event.committee}`);
  if (event.cpe > 0) descLines.push(`CPE hours: ${event.cpe}`);
  if (event.description) {
    descLines.push('');
    descLines.push(String(event.description).replace(/[*#_`]+/g, ''));
  }
  descLines.push('');
  descLines.push('More info & registration: ICAI Nagpur Branch portal');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'ICAI Nagpur Event',
    dates: `${start}/${end}`,
    details: descLines.join('\n'),
  });

  // Location: prefer venue; for online events use the meeting URL.
  const loc = event.venue === 'Online' && event.online_url
    ? event.online_url
    : (event.venue || '');
  if (loc) params.set('location', loc);

  return `${GCAL_BASE}?${params.toString()}`;
}

// Build a Google Calendar URL that prompts the user to subscribe to a
// `webcal://` feed. Google's /r URL with `cid=` is the documented path:
// it pops a "Add this calendar?" dialog inside the user's GCal so they
// never see a download or an OS protocol handler. The `cid` parameter
// expects a fully-qualified webcal:// (or https://) URL.
//
// If the input is `https://.../my-calendar.ics?token=...`, swap to webcal://
// so calendar apps recognise it as a subscription rather than a one-off
// download. Google handles both, but webcal:// is more universally
// interpreted by other clients if a user copies this URL out.
export function googleCalendarSubscribeUrl(feedUrl) {
  if (!feedUrl) return null;
  const webcal = feedUrl.replace(/^https?:\/\//i, 'webcal://');
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
}
