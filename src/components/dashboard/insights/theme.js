// Chart palette tuned for the site's navy+green light theme. Avoids neon/
// dark-mode colours that would clash with the rest of the portal.
export const CHART_PALETTE = [
  '#3622FF', // primary navy
  '#16A34A', // secondary green
  '#0891B2', // teal
  '#F59E0B', // amber
  '#7C3AED', // violet
  '#E11D48', // coral
  '#0EA5E9', // sky
  '#65A30D', // lime
];

// Accent map for KPI tiles. `soft` is the tinted background, `solid` is the
// accent line / hover ring colour.
export const ACCENTS = {
  primary: { solid: '#3622FF', soft: 'rgba(54,34,255,0.08)' },
  success: { solid: '#16A34A', soft: 'rgba(22,163,74,0.10)' },
  warning: { solid: '#F59E0B', soft: 'rgba(245,158,11,0.13)' },
  danger:  { solid: '#E11D48', soft: 'rgba(225,29,72,0.10)' },
  teal:    { solid: '#0891B2', soft: 'rgba(8,145,178,0.10)' },
  violet:  { solid: '#7C3AED', soft: 'rgba(124,58,237,0.10)' },
  amber:   { solid: '#D97706', soft: 'rgba(217,119,6,0.12)' },
  sky:     { solid: '#0EA5E9', soft: 'rgba(14,165,233,0.10)' },
  neutral: { solid: '#64748B', soft: 'rgba(100,116,139,0.10)' },
};
