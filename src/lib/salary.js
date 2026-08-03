// Formats a job posting's salary range for display on cards, detail pages,
// digest emails, etc. Range logic:
//   • both min + max present  → "₹8L – ₹12L / year"
//   • only min                → "₹8L+ / year"
//   • only max                → "up to ₹12L / year"
//   • neither                 → returns null (caller decides whether to hide)
//
// Uses lakh (L) / crore (Cr) shorthand when the number crosses those
// thresholds — the CA audience reads those instantly and it keeps the
// card compact. Period suffix maps: monthly → /month, annual → /year,
// per_engagement → /engagement.
//
// Money in is paise (server-side unit); callers never do their own math.

const PERIOD_SUFFIX = {
  monthly:        '/month',
  annual:         '/year',
  per_engagement: '/engagement',
};

function fmtRupees(paise) {
  if (paise == null) return null;
  const rupees = Number(paise) / 100;
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(rupees % 1_00_00_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}Cr`;
  if (rupees >= 1_00_000)    return `₹${(rupees / 1_00_000).toFixed(rupees % 1_00_000 === 0 ? 0 : 1).replace(/\.?0+$/, '')}L`;
  if (rupees >= 1_000)       return `₹${(rupees / 1_000).toFixed(rupees % 1_000 === 0 ? 0 : 1).replace(/\.?0+$/, '')}k`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

export function formatSalary(posting) {
  if (!posting) return null;
  const min = posting.salary_paise_min;
  const max = posting.salary_paise_max;
  const period = PERIOD_SUFFIX[posting.salary_period] ?? '';
  const minStr = fmtRupees(min);
  const maxStr = fmtRupees(max);
  if (minStr && maxStr) return `${minStr} – ${maxStr} ${period}`.trim();
  if (minStr)           return `${minStr}+ ${period}`.trim();
  if (maxStr)           return `up to ${maxStr} ${period}`.trim();
  return null;
}

// Cleaner label for the salary period, used in forms + labels.
export const SALARY_PERIOD_LABEL = {
  monthly:        'per month',
  annual:         'per year',
  per_engagement: 'per engagement',
};
