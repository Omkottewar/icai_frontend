// Frontend mirror of backend/server/lib/checklistQuestions.ts.
// One source of truth for the question type catalogue + per-type defaults.
//
// Keep in sync with the backend — the order here drives the builder palette.

export const QUESTION_TYPES = [
  { type: 'short_text',      label: 'Short text',     hint: 'Single-line answer',                 group: 'Text' },
  { type: 'long_text',       label: 'Long text',      hint: 'Multi-line paragraph',               group: 'Text' },
  { type: 'number',          label: 'Number',         hint: 'Numeric input with optional min/max',group: 'Numbers' },
  { type: 'money',           label: 'Money (INR)',    hint: 'Amount in rupees (stored as paise)', group: 'Numbers' },
  { type: 'date',            label: 'Date',           hint: 'Calendar date picker',               group: 'Dates' },
  { type: 'datetime',        label: 'Date + time',    hint: 'Date and time picker',               group: 'Dates' },
  { type: 'radio',           label: 'Radio',          hint: 'Pick one (visible options)',         group: 'Choice' },
  { type: 'dropdown',        label: 'Dropdown',       hint: 'Pick one (compact select)',          group: 'Choice' },
  { type: 'yes_no',          label: 'Yes / No',       hint: 'Quick toggle',                       group: 'Choice' },
  { type: 'checkbox',        label: 'Checkboxes',     hint: 'Pick many',                          group: 'Choice' },
  { type: 'rating',          label: 'Rating',         hint: 'Star rating',                        group: 'Other' },
  { type: 'file',            label: 'File upload',    hint: 'Attach a document or image',         group: 'Other' },
  { type: 'section_heading', label: 'Section heading',hint: 'Visual separator — not a question', group: 'Other' },
];

export const QUESTION_TYPE_MAP = Object.fromEntries(
  QUESTION_TYPES.map((q) => [q.type, q]),
);

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
    default:
      return {};
  }
}

export function newQuestion(type = 'short_text') {
  return {
    // Client-side draft id — replaced server-side. Used as React key.
    _draftId: `q_${Math.random().toString(36).slice(2, 9)}`,
    type,
    label: '',
    help_text: '',
    required: type !== 'section_heading',
    config: defaultConfig(type),
  };
}

// Quick check whether a stored response is considered "answered".
export function hasAnswer(type, value) {
  if (type === 'section_heading') return true;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
