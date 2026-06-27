// Frontend mirror of backend/server/lib/checklistQuestions.ts.
// One source of truth for the question type catalogue + per-type defaults.
//
// Keep in sync with the backend — the order here drives the builder palette.

// Every backend-supported question type, in a tidy declared order. The
// builder UI splits these into "popular" (shown as tiles) and "more"
// (collapsed behind a button) — see POPULAR_TYPES below.
export const QUESTION_TYPES = [
  { type: 'short_text',      label: 'Short text',     hint: 'Single-line answer',                 group: 'Text' },
  { type: 'long_text',       label: 'Long text',      hint: 'Multi-line paragraph',               group: 'Text' },
  { type: 'number',          label: 'Number',         hint: 'Numeric input with optional min/max',group: 'Numbers' },
  { type: 'money',           label: 'Money (INR)',    hint: 'Amount in rupees (stored as paise)', group: 'Numbers' },
  { type: 'date',            label: 'Date',           hint: 'Calendar date picker',               group: 'Dates' },
  { type: 'time_range',      label: 'Time range',     hint: 'Start + end time (e.g. 5:00–8:00 PM)',group: 'Dates' },
  { type: 'datetime',        label: 'Date + time',    hint: 'Date and time picker',               group: 'Dates' },
  { type: 'radio',           label: 'Single choice',  hint: 'Pick one (visible options)',         group: 'Choice' },
  { type: 'dropdown',        label: 'Dropdown',       hint: 'Pick one (compact select)',          group: 'Choice' },
  { type: 'yes_no',          label: 'Yes / No',       hint: 'Quick toggle',                       group: 'Choice' },
  { type: 'checkbox',        label: 'Multi-select',   hint: 'Pick many',                          group: 'Choice' },
  { type: 'rating',          label: 'Rating',         hint: 'Star rating',                        group: 'Other' },
  { type: 'file',            label: 'File upload',    hint: 'Attach a document or image',         group: 'Other' },
  { type: 'task_list',       label: 'Task list',      hint: 'Assign tasks to people with due dates', group: 'Other' },
  { type: 'budget_table',    label: 'Budget table',   hint: 'Event budget with revenue + categorised expenses', group: 'Other' },
  { type: 'section_heading', label: 'Section heading',hint: 'Visual separator — not a question', group: 'Other' },
];

// The 9 types that cover ~95% of branch checklist questions. Shown as
// tiles in the add-question menu; the remaining four live behind a
// "More types" expand. Order is deliberate: text first (most common),
// then numbers, dates, choices, file/section last.
export const POPULAR_TYPES = [
  'short_text',
  'long_text',
  'number',
  'money',
  'date',
  'time_range',
  'yes_no',
  'radio',
  'file',
  'task_list',
];

export const QUESTION_TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((q) => [q.type, q]),
);

// Curated quick-add library. Each entry is a ready-to-use question that
// non-tech committee chairmen can add with one click — the most common
// fields the branch SOP expects on event checklists.
export const QUESTION_LIBRARY = [
  { key: 'event_date',     icon: '📅', label: 'Event date',           type: 'date',       overrides: { label: 'Event date' } },
  { key: 'event_time',     icon: '🕒', label: 'Event time',           type: 'short_text', overrides: { label: 'Event time', help_text: 'e.g. 6:00 PM – 8:30 PM' } },
  { key: 'budget',         icon: '💰', label: 'Budget amount',        type: 'money',      overrides: { label: 'Total budget (₹)' } },
  { key: 'speaker',        icon: '🎤', label: 'Speaker name',         type: 'short_text', overrides: { label: 'Speaker name & designation' } },
  { key: 'venue',          icon: '📍', label: 'Venue',                type: 'short_text', overrides: { label: 'Venue' } },
  { key: 'capacity',       icon: '👥', label: 'Capacity',             type: 'number',     overrides: { label: 'Maximum attendees', required: false } },
  { key: 'cpe_hours',      icon: '⏱️', label: 'CPE hours',            type: 'number',     overrides: { label: 'CPE hours', help_text: 'Half-hour increments' } },
  { key: 'agenda',         icon: '📝', label: 'Agenda / programme',   type: 'long_text',  overrides: { label: 'Agenda / programme', help_text: 'One item per line' } },
  { key: 'is_iut',         icon: '🔁', label: 'IUT involved?',        type: 'yes_no',     overrides: { label: 'Does this event involve IUT (Inter-Unit Transfer)?' } },
  { key: 'sponsor_letter', icon: '📎', label: 'Sponsor letter',       type: 'file',       overrides: { label: 'Sponsor letter (if any)', required: false } },
  { key: 'tasks',          icon: '✅', label: 'Tasks to assign',      type: 'task_list',  overrides: { label: 'Tasks for the team', help_text: 'Add one row per task, pick the person who will do it' } },
];

// ─── Section presets ────────────────────────────────────────────────────────
// One-click section starters for the most common branch checklist sections.
// Each entry adds a section_heading question + a curated list of questions
// underneath it. Vastly faster than asking a non-tech user to build the
// same section from scratch.
//
// Schema: each preset is { key, icon, title, questions[] }
// where questions[] follow the newQuestion() shape (type + overrides).
// Per F21, presets no longer carry an `owner_role` — filler / approver
// are decided at event-checklist creation, not on the template.
export const SECTION_PRESETS = [
  {
    key: 'event_basics',
    icon: '📌',
    title: 'Event basics',
    description: 'Title, type, description, date, time',
    questions: [
      { type: 'short_text', overrides: { label: 'Event title', required: true } },
      { type: 'dropdown',   overrides: {
          label: 'Programme type', required: true,
          config: { options: [
            { value: 'cpe_seminar', label: 'CPE Seminar' },
            { value: 'study_circle', label: 'Study Circle Meet' },
            { value: 'workshop', label: 'Workshop' },
            { value: 'conference', label: 'Conference' },
            { value: 'revisionary', label: 'One-Day Revisionary Batch' },
            { value: 'other', label: 'Other' },
          ] },
        } },
      { type: 'long_text',  overrides: { label: 'Brief description (80–200 words)', required: true } },
      { type: 'date',       overrides: { label: 'Event date', required: true } },
      { type: 'time_range', overrides: { label: 'Event time', required: true, help_text: 'Start and end time' } },
    ],
  },
  {
    key: 'venue',
    icon: '📍',
    title: 'Venue & logistics',
    description: 'Mode, venue / URL, capacity, banner',
    questions: [
      { type: 'dropdown', overrides: {
          label: 'Mode', required: true,
          config: { options: [
            { value: 'physical', label: 'Physical' },
            { value: 'online', label: 'Online' },
            { value: 'hybrid', label: 'Hybrid' },
          ] },
        } },
      { type: 'short_text', overrides: { label: 'Venue or online URL', required: true } },
      { type: 'number',     overrides: { label: 'Capacity (max attendees)', required: true } },
      { type: 'file',       overrides: { label: 'Banner image', required: false } },
    ],
  },
  {
    key: 'speakers',
    icon: '🎤',
    title: 'Speakers & agenda',
    description: 'Speaker info, agenda, CPE — Vice-Chairman reviews',
    questions: [
      { type: 'short_text', overrides: { label: 'Speaker name & designation', required: true } },
      { type: 'long_text',  overrides: { label: 'Speaker bio (1–2 sentences)', required: true } },
      { type: 'file',       overrides: { label: 'Speaker photo', required: false } },
      { type: 'long_text',  overrides: { label: 'Agenda', required: true, help_text: 'One session per line' } },
      { type: 'number',     overrides: { label: 'CPE hours', required: true, help_text: 'Half-hour increments' } },
      { type: 'dropdown',   overrides: {
          label: 'CPE eligibility', required: true,
          config: { options: [
            { value: 'structured', label: 'Structured' },
            { value: 'unstructured', label: 'Unstructured' },
            { value: 'na', label: 'N/A' },
          ] },
        } },
    ],
  },
  {
    key: 'registration',
    icon: '🎟️',
    title: 'Registration & pricing',
    description: 'Fees by audience, capacity, spot registration',
    questions: [
      { type: 'money',  overrides: { label: 'Fee — Members', required: true } },
      { type: 'money',  overrides: { label: 'Fee — Students', required: true } },
      { type: 'money',  overrides: { label: 'Fee — Non-members', required: false } },
      { type: 'date',   overrides: { label: 'Registration close date', required: true } },
      { type: 'yes_no', overrides: { label: 'Spot registration allowed?', required: true } },
      { type: 'yes_no', overrides: { label: 'Waitlist beyond capacity?', required: true } },
    ],
  },
  {
    key: 'budget',
    icon: '💰',
    title: 'Budget & IUT',
    description: 'Excel-style budget table + IUT details — Treasurer fills',
    questions: [
      // The headline question — the spreadsheet-style budget table. Auto-
      // computes subtotals + net + deficit/surplus.
      { type: 'budget_table', overrides: { label: 'Event budget', required: true, config: { faculty_count: 6 } } },
      // IUT side — kept as separate y/n + long_text so the treasurer can
      // record bank-account details outside the budget table.
      { type: 'yes_no',    overrides: { label: 'Does this event involve IUT?', required: true } },
      { type: 'long_text', overrides: { label: 'IUT details (from-account, to-account, purpose)', required: false } },
      { type: 'file',      overrides: { label: 'Sponsor letter (if any)', required: false } },
    ],
  },
  {
    key: 'compliance',
    icon: '⚖️',
    title: 'Compliance & disclaimers',
    description: 'GST, consent, refund policy',
    questions: [
      { type: 'yes_no', overrides: { label: 'GST applicable on fees?', required: true } },
      { type: 'yes_no', overrides: { label: 'Photography / video consent collected?', required: true } },
      { type: 'yes_no', overrides: { label: 'Refund policy stated on the registration page?', required: true } },
      { type: 'yes_no', overrides: { label: 'Paper-presentation disclaimer added?', required: false, help_text: '"Views expressed are personal"' } },
    ],
  },
  {
    key: 'promotion',
    icon: '📣',
    title: 'Promotion',
    description: 'Launch date, channels, budget',
    questions: [
      { type: 'date',     overrides: { label: 'Date public registration opens', required: true } },
      { type: 'checkbox', overrides: {
          label: 'Promotion channels', required: true,
          config: { options: [
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Email' },
            { value: 'social', label: 'Social media' },
            { value: 'newsletter', label: 'Branch newsletter' },
            { value: 'press', label: 'Press release' },
            { value: 'other', label: 'Other' },
          ] },
        } },
      { type: 'money', overrides: { label: 'Promotion budget (₹)', required: false } },
    ],
  },
  {
    key: 'tasks',
    icon: '✅',
    title: 'Tasks to assign',
    description: 'Task list with assignees + due dates',
    questions: [
      { type: 'task_list', overrides: { label: 'Pre-event task list', required: true, help_text: 'Add one row per task. Pick the assignee and the due date.' } },
    ],
  },
];

// Known role codes for the fill/review role pickers. Mirrors the seed in
// migration 0003. Free-text input is a footgun for non-tech users — the
// dropdown protects against typos like "branchchairman" / "Chairman".
export const ROLE_OPTIONS = [
  { code: '',                       label: 'Anyone (uses assignment only)' },
  { code: 'committee_chairman',     label: 'Committee Chairman' },
  { code: 'committee_convener',     label: 'Committee Convener' },
  { code: 'committee_co_convener',  label: 'Committee Co-Convener' },
  { code: 'committee_member',       label: 'Committee Member' },
  { code: 'mcm',                    label: 'Managing Committee Member' },
  { code: 'branch_chairman',        label: 'Branch Chairman' },
  { code: 'branch_vice_chairman',   label: 'Branch Vice-Chairman' },
  { code: 'branch_secretary',       label: 'Branch Secretary' },
  { code: 'branch_treasurer',       label: 'Branch Treasurer' },
  { code: 'accountant',             label: 'Accountant' },
  { code: 'branch_manager',         label: 'Branch Manager' },
];

// Role codes that constitute the Managing Committee + elected office-bearers
// — used by the checklist filler / reviewer pickers to keep the dropdown
// scoped to people who could plausibly be assigned to run an event's
// pre-event checklist. Excludes 'committee_member' (too broad — generic
// volunteer slot) and 'accountant' / 'branch_manager' (operational staff,
// not elected committee).
export const MCM_ROLE_CODES = [
  'committee_chairman',
  'committee_convener',
  'committee_co_convener',
  'mcm',
  'branch_chairman',
  'branch_vice_chairman',
  'branch_secretary',
  'branch_treasurer',
];

// ─── Per-picker role scopes ──────────────────────────────────────────────
// The "Who fills each section?" dialog has two distinct dropdowns. They
// shouldn't show the same set of people:
//
//   FILLER  — the person who actually does the pre-event paperwork.
//             Real-world: Committee Chairman runs their own committee's
//             events; for student-wing events (WICASA), members of the
//             WICASA committee fill it. We narrow to committee chairs +
//             other committee officers + MCM (which is how WICASA members
//             show up — they're MCM-tagged on the WICASA committee).
//
//   APPROVER — the person who signs off. Real-world: Branch Chairman or
//              Treasurer — nobody else has approval authority over a
//              committee's event paperwork.
//
// These lists are passed to the existing /api/admin/users endpoint as the
// `role_codes` filter, and then filtered client-side per picker so we
// only fetch the user directory once.
export const FILLER_ROLE_CODES = [
  'committee_chairman',
  'committee_convener',
  'committee_co_convener',
  'mcm',
];
export const APPROVER_ROLE_CODES = [
  'branch_chairman',
  'branch_treasurer',
];

// Lookup: role_code → human label, used by the user picker to show
// "Akshara Soni · Committee Chairman" next to each name.
export const ROLE_CODE_LABEL = Object.fromEntries(
  ROLE_OPTIONS.filter((r) => r.code).map((r) => [r.code, r.label]),
);

// Common category strings so the non-tech user doesn't have to invent and
// remember their own naming. Free-text "Other" still available via a
// fallback input in the UI.
export const CATEGORY_OPTIONS = [
  '',
  'Event approval',
  'Post-event bills',
  'Newsletter approval',
  'Circular approval',
  'Compliance',
  'Audit',
  'Other',
];

export function defaultConfig(type) {
  switch (type) {
    case 'radio':
    case 'dropdown':
    case 'checkbox':
      return { options: [{ value: 'opt_1', label: 'Option 1' }, { value: 'opt_2', label: 'Option 2' }] };
    case 'rating':
      return { scale: 5 };
    case 'money':
      return { currency: 'INR' };
    case 'file':
      return { max_size_kb: 5 * 1024 };
    case 'task_list':
      return {};
    case 'time_range':
      return {};
    case 'budget_table':
      return { faculty_count: 6 };
    default:
      return {};
  }
}

export function newQuestion(type = 'short_text', overrides = {}) {
  return {
    // Client-side draft id — replaced server-side. Used as React key.
    _draftId: `q_${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: '',
    help_text: '',
    required: type !== 'section_heading',
    config: defaultConfig(type),
    ...overrides,
  };
}

// Slugify a free-text label into a stable option `value`. Keeps the
// builder UI free of the confusing "Label vs value" double-input.
// Same option label twice → caller must dedupe by appending a counter.
export function slugifyOptionValue(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'option';
}

// Quick check whether a stored response is considered "answered".
export function hasAnswer(type, value) {
  if (type === 'section_heading') return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  // For task_list, "answered" means at least one task row has a description.
  if (type === 'task_list') {
    if (!Array.isArray(value)) return false;
    return value.some((t) => t && typeof t.description === 'string' && t.description.trim() !== '');
  }
  // For time_range, both start and end must be set.
  if (type === 'time_range') {
    return !!(value && typeof value === 'object' && value.start && value.end);
  }
  // For budget_table, at least one revenue or expense amount must be > 0.
  if (type === 'budget_table') {
    if (!value || typeof value !== 'object') return false;
    const rev = value.revenue || {};
    const exp = value.expenses || {};
    const sumNums = (a) => Array.isArray(a) ? a.reduce((s, x) => s + (Number(x) || 0), 0) : 0;
    const sumTravel = (a) => Array.isArray(a) ? a.reduce((s, x) => s + (Number(x?.to) || 0) + (Number(x?.from) || 0), 0) : 0;
    const sumLabeled = (a) => Array.isArray(a) ? a.reduce((s, x) => s + (Number(x?.amount_paise) || 0), 0) : 0;
    const total =
      (rev.participation?.participants || 0) * (rev.participation?.fee_paise || 0) +
      sumLabeled(rev.other) +
      sumNums(exp.stay) + sumTravel(exp.travel) + sumNums(exp.food_faculty) +
      sumLabeled(exp.memento) + sumNums(exp.cab) + sumLabeled(exp.food_event) + sumLabeled(exp.venue) +
      (exp.photography || 0) + (exp.material || 0) + (exp.transportation || 0) +
      (exp.printing || 0) + (exp.flower || 0) + (exp.light_sound || 0) + (exp.led_screen || 0) +
      sumLabeled(exp.other);
    return total > 0;
  }
  return true;
}
