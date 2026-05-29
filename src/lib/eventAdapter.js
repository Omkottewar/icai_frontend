// Maps the public /api/events row shape onto the prop shape that
// EventRow + CategoryCard already expect. Keeps both surfaces working
// without touching every consumer.
export function apiEventToCardEvent(row) {
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    committee: row.committee_code || row.committee_name || '',
    audience:
      row.audience === 'members' ? 'Members' :
      row.audience === 'students' ? 'Students' : 'All',
    date: starts
      ? starts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    time: starts
      ? starts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      : '',
    venue: row.mode === 'online' ? 'Online' : (row.venue || ''),
    highlights: row.highlights || [],
    cpe: Number(row.cpe_hours || 0),
    bannerUrl: row.banner_url || null,
    fee_paise: Number(row.fee_paise || 0),
    capacity: row.capacity,
    registered_count: Number(row.registered_count || 0),
    starts_at: row.starts_at,
  };
}
