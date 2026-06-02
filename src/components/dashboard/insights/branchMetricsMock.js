// Fallback dataset for the branch chairman dashboard. Used to seed any
// section the live API hasn't filled yet, so the page always renders the
// full chairman-pulse layout instead of empty skeletons. Numbers mirror
// the chairman-pulse-main demo.

const MONTHLY = [
  { month: 'Jul', events: 12, registrations: 184 },
  { month: 'Aug', events: 18, registrations: 256 },
  { month: 'Sep', events: 22, registrations: 312 },
  { month: 'Oct', events: 16, registrations: 224 },
  { month: 'Nov', events: 24, registrations: 388 },
  { month: 'Dec', events: 19, registrations: 276 },
  { month: 'Jan', events: 28, registrations: 412 },
  { month: 'Feb', events: 32, registrations: 498 },
  { month: 'Mar', events: 36, registrations: 564 },
  { month: 'Apr', events: 27, registrations: 392 },
  { month: 'May', events: 31, registrations: 478 },
  { month: 'Jun', events: 38, registrations: 612 },
];

function monthIso(offsetFromNow) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetFromNow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const MOCK_EVENTS_PER_MONTH = MONTHLY.map((row, i) => ({
  month: monthIso(i - (MONTHLY.length - 1)),
  n: row.events,
}));

export const MOCK_REGS_PER_MONTH = MONTHLY.map((row, i) => ({
  month: monthIso(i - (MONTHLY.length - 1)),
  n: row.registrations,
}));

export const MOCK_BY_COMMITTEE = [
  { committee_id: 'AUD', committee_code: 'AUD', committee_name: 'Audit & Assurance',           events_count: 38, registrations_count: 612 },
  { committee_id: 'DTX', committee_code: 'DTX', committee_name: 'Direct Taxation',             events_count: 34, registrations_count: 548 },
  { committee_id: 'GST', committee_code: 'GST', committee_name: 'Indirect Taxation (GST)',     events_count: 31, registrations_count: 502 },
  { committee_id: 'CLG', committee_code: 'CLG', committee_name: 'Corporate Laws & CG',         events_count: 27, registrations_count: 418 },
  { committee_id: 'ITC', committee_code: 'ITC', committee_name: 'Information Technology',      events_count: 24, registrations_count: 386 },
  { committee_id: 'SSE', committee_code: 'SSE', committee_name: 'Students Skill Enrichment',   events_count: 21, registrations_count: 344 },
  { committee_id: 'INT', committee_code: 'INT', committee_name: 'International Taxation',      events_count: 18, registrations_count: 268 },
  { committee_id: 'BIP', committee_code: 'BIP', committee_name: 'Banking, Insurance & Pension', events_count: 14, registrations_count: 196 },
  { committee_id: 'PFG', committee_code: 'PFG', committee_name: 'Public Finance & Govt',       events_count: 11, registrations_count: 142 },
  { committee_id: 'WME', committee_code: 'WME', committee_name: 'Women Members Empowerment',   events_count: 9,  registrations_count: 128 },
];

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function hoursAgo(n) {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export const MOCK_RECENT_EVENTS = [
  { id: 'm1', title: 'GST Annual Return Filing — Practical Workshop',    committee_code: 'GST', starts_at: daysFromNow(12), status: 'published',         registered_count: 184, capacity: 200 },
  { id: 'm2', title: 'Forensic Audit Masterclass with Live Case Studies', committee_code: 'AUD', starts_at: daysFromNow(14), status: 'published',         registered_count: 142, capacity: 150 },
  { id: 'm3', title: 'Transfer Pricing — Recent Tribunal Rulings',        committee_code: 'INT', starts_at: daysFromNow(16), status: 'pending_approval',  registered_count: 76,  capacity: 120 },
  { id: 'm4', title: 'AI & Automation in CA Practice',                    committee_code: 'ITC', starts_at: daysFromNow(18), status: 'published',         registered_count: 198, capacity: 200 },
  { id: 'm5', title: 'CSR Compliance & Reporting Standards 2026',         committee_code: 'CLG', starts_at: daysFromNow(20), status: 'draft',             registered_count: 0,   capacity: 180 },
  { id: 'm6', title: 'Bank Branch Audit — Updated RBI Guidelines',        committee_code: 'BIP', starts_at: daysFromNow(22), status: 'completed',         registered_count: 156, capacity: 160 },
  { id: 'm7', title: 'Income Tax Return — AY 26-27 Walkthrough',          committee_code: 'DTX', starts_at: daysFromNow(24), status: 'published',         registered_count: 245, capacity: 300 },
  { id: 'm8', title: 'Women in Leadership — Panel Discussion',            committee_code: 'WME', starts_at: daysFromNow(26), status: 'approved',          registered_count: 88,  capacity: 120 },
];

export const MOCK_PENDING_APPROVALS = [
  { id: 'a1', event_title: 'Transfer Pricing — Tribunal Rulings',     committee_name: 'Audit',     committee_code: 'AUD', updated_at: hoursAgo(14) },
  { id: 'a2', event_title: 'Industrial Visit — RBI Regional Office',  committee_name: 'Banking',   committee_code: 'BIP', updated_at: hoursAgo(9) },
  { id: 'a3', event_title: 'Sub-Branch Annual Meet — Wardha',         committee_name: 'Branch Office', committee_code: 'OFF', updated_at: hoursAgo(6) },
  { id: 'a4', event_title: 'Joint Programme with NIA, Pune',          committee_name: 'Insurance', committee_code: 'BIP', updated_at: hoursAgo(4) },
  { id: 'a5', event_title: 'GST Refund Workshop — Drafting',          committee_name: 'GST',       committee_code: 'GST', updated_at: hoursAgo(2) },
];

export const MOCK_KPIS = {
  events: {
    total: 297,
    this_month: 38,
    upcoming_30d: 24,
    by_status: { published: 142, draft: 38, pending_approval: 17, completed: 94, cancelled: 6 },
  },
  registrations: {
    total: 5418,
    this_month: 612,
    attendance_rate: 0.82,
    attended: 4443,
  },
  approvals: {
    pending: 17,
    avg_cycle_hours: 11.4,
    approved_this_month: 42,
  },
  users: {
    total: 4540,
    new_this_month: 62,
    by_primary_role: { fellow_ca: 1842, associate_ca: 1264, student: 892, article: 478, honorary: 64 },
  },
  people: {
    active_mcm: 184,
    active_committee_chair: 18,
    active_committees: 18,
  },
};

// Shallow-merge any missing live fields with mock data so the dashboard
// never renders a half-empty page. Returns a brand-new object.
export function mergeWithMock(live) {
  const base = {
    kpis: MOCK_KPIS,
    events_per_month: MOCK_EVENTS_PER_MONTH,
    registrations_per_month: MOCK_REGS_PER_MONTH,
    by_committee: MOCK_BY_COMMITTEE,
    recent_events: MOCK_RECENT_EVENTS,
    pending_approvals: MOCK_PENDING_APPROVALS,
  };
  if (!live) return base;

  return {
    ...base,
    ...live,
    kpis: live.kpis ? deepMergeKpis(base.kpis, live.kpis) : base.kpis,
    events_per_month:        live.events_per_month?.length        ? live.events_per_month        : base.events_per_month,
    registrations_per_month: live.registrations_per_month?.length ? live.registrations_per_month : base.registrations_per_month,
    by_committee:            live.by_committee?.length            ? live.by_committee            : base.by_committee,
    recent_events:           live.recent_events?.length           ? live.recent_events           : base.recent_events,
    pending_approvals:       live.pending_approvals?.length       ? live.pending_approvals       : base.pending_approvals,
  };
}

function deepMergeKpis(base, live) {
  const out = { ...base };
  for (const k of Object.keys(base)) {
    out[k] = { ...base[k], ...(live[k] || {}) };
  }
  for (const k of Object.keys(live)) {
    if (!out[k]) out[k] = live[k];
  }
  return out;
}
