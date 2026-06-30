// Helpers for rendering member names in the UI.
//
// Almost every CA stores their name with the "CA " honorific prefixed
// ("CA Swaroopa Wazalwar"). Naive first-word extraction then renders the
// honorific in places where we expect the actual first name — the welcome
// banner becomes "Welcome back, CA" instead of "Welcome back, Swaroopa",
// and avatar initials come out as "CS" instead of "SW".
//
// These helpers strip a leading "CA"/"CA."/"Ca." (case-insensitive) before
// extracting the first name or the initials. Other honorifics (Mr/Ms/Dr/
// Adv/Prof) are stripped too for consistency.

const HONORIFIC_RE = /^(?:CA|Ca|ca|Mr|Mrs|Ms|Dr|Adv|Prof)\.?\s+/;

function stripHonorific(name) {
  return String(name ?? '').replace(HONORIFIC_RE, '').trim();
}

/** Returns the first name proper, with any honorific dropped. */
export function firstName(name) {
  const stripped = stripHonorific(name);
  if (!stripped) return name || '';
  const first = stripped.split(/\s+/)[0];
  return first || stripped;
}

/** Returns up-to-2-letter initials, ignoring honorifics. */
export function initials(name) {
  const stripped = stripHonorific(name);
  if (!stripped) return '';
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
