// Centralised status → human-label mapping for events, registrations and
// checklists. Replaces the half-dozen inline objects scattered through the
// codebase. Two label sets per status:
//
//   short  — compact label for pills and table cells ("Awaiting chair")
//   long   — context-aware sentence ("Waiting for chairman ma'am's review")
//
// Why context-aware? "awaiting_review" means different things to different
// people. The committee chair who submitted it thinks "I'm done"; the branch
// chair who has to act thinks "this is on me". Where the viewer's role
// matters, pass it as the second arg.

// ─── Event lifecycle ─────────────────────────────────────────────────────────
export const EVENT_STATUS = {
  draft: {
    short: 'Draft',
    long:  'Draft — not yet submitted for approval',
    tone:  'muted',
  },
  pending_approval: {
    short: 'Awaiting approval',
    long:  'Waiting for chairman ma\'am to approve',
    tone:  'amber',
  },
  approved: {
    short: 'Approved',
    long:  'Approved — ready to publish',
    tone:  'blue',
  },
  published: {
    short: 'Published',
    long:  'Live — accepting registrations',
    tone:  'green',
  },
  cancelled: {
    short: 'Cancelled',
    long:  'Cancelled',
    tone:  'red',
  },
  completed: {
    short: 'Completed',
    long:  'Completed — past event',
    tone:  'grey',
  },
};

// ─── Checklist instance state ────────────────────────────────────────────────
//
// The viewer's role determines the long-form copy. `viewerRole` should be
// one of: 'admin', 'fill' (committee chair filling the checklist),
// 'review' (branch chair reviewing it), or undefined for generic copy.
export const CHECKLIST_STATUS = {
  draft: {
    short: 'Draft',
    long:  'Not yet released to the committee',
    tone:  'muted',
  },
  awaiting_fill: {
    short: 'With committee',
    long:  'Waiting for the committee chairman to fill it in',
    forFiller: 'Your input needed — please fill this in',
    tone:  'amber',
  },
  awaiting_review: {
    short: 'With chairman',
    long:  'Submitted — waiting for chairman ma\'am\'s review',
    forReviewer: 'Your review needed — chairman ma\'am, please action',
    tone:  'blue',
  },
  approved: {
    short: 'Approved',
    long:  'Approved by chairman ma\'am',
    tone:  'green',
  },
  rejected: {
    short: 'Sent back',
    long:  'Sent back to the committee with comments',
    tone:  'red',
  },
};

// ─── Event registration status ───────────────────────────────────────────────
export const REGISTRATION_STATUS = {
  registered: {
    short: 'Registered',
    long:  'You\'re in — see you there',
    tone:  'green',
  },
  waitlisted: {
    short: 'Waitlisted',
    long:  'On the waitlist — we\'ll email if a seat opens',
    tone:  'amber',
  },
  cancelled: {
    short: 'Cancelled',
    long:  'Registration cancelled',
    tone:  'red',
  },
  attended: {
    short: 'Attended',
    long:  'Attended',
    tone:  'green',
  },
  no_show: {
    short: 'Missed',
    long:  'Marked as a no-show',
    tone:  'muted',
  },
};

// ─── Tone → CSS colour pair ──────────────────────────────────────────────────
// Use this to render a pill consistently. Tones are colour-blind safe pairs.
export const TONE_STYLE = {
  muted: { bg: '#f1f5f9', fg: '#475569' },
  amber: { bg: '#fef3c7', fg: '#92400e' },
  blue:  { bg: '#dbeafe', fg: '#1e40af' },
  green: { bg: '#dcfce7', fg: '#166534' },
  red:   { bg: '#fee2e2', fg: '#991b1b' },
  grey:  { bg: '#e5e7eb', fg: '#374151' },
};

/** Compact accessor: eventLabel(row.status) → human short label. */
export function eventLabel(status, long = false) {
  const m = EVENT_STATUS[status];
  if (!m) return prettify(status);
  return long ? m.long : m.short;
}

/** Compact accessor for checklist status, with optional viewer role. */
export function checklistLabel(status, viewerRole) {
  const m = CHECKLIST_STATUS[status];
  if (!m) return prettify(status);
  if (viewerRole === 'fill'   && m.forFiller)   return m.forFiller;
  if (viewerRole === 'review' && m.forReviewer) return m.forReviewer;
  return m.long ?? m.short;
}

export function registrationLabel(status) {
  return REGISTRATION_STATUS[status]?.short ?? prettify(status);
}

/** Tone style helper. Pass any of the maps' values + this returns its CSS. */
export function toneStyle(toneName) {
  return TONE_STYLE[toneName] ?? TONE_STYLE.muted;
}

function prettify(s) {
  if (!s) return '';
  return String(s).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
