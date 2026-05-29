import { useEffect, useMemo, useState } from 'react';
import { cachedGet } from '../lib/apiCache';

// Bake the existing hardcoded copy into the defaults map so a fresh install
// (no site_content rows in the DB) still renders the same page. Once admin
// seeds a slot through /admin/site-content, the DB row wins.
//
// When you add a new slot to src/lib/siteContentSlots.ts, add its default
// here too — otherwise the page renders an empty card on first load.
export const SITE_CONTENT_DEFAULTS = {
  chairman_message: {
    photo_url: null,
    quote: 'Our branch remains committed to fostering a culture of integrity, lifelong learning and service — for our members, our students and the public we serve.',
    name: 'CA. Swaroopa Wazalwar',
    role_line: 'Chairperson, Nagpur Branch · 2025–26',
  },
  home_hero: {
    tagline: 'Serving Chartered Accountants and CA students of Nagpur — through Continuing Professional Education, networking, knowledge, and member services.',
  },
  home_hero_stats: {
    stats: [
      { k: '5,000+', v: 'Members' },
      { k: '8,500+', v: 'Students' },
      { k: '150+',   v: 'Events / yr' },
      { k: '1962',   v: 'Established' },
    ],
  },
  home_leadership_banner: {
    eyebrow:  'ESTABLISHED UNDER THE CHARTERED ACCOUNTANTS ACT, 1949',
    headline: 'Nurturing excellence\nin professional services\nfor Central India.',
    body:     'The official portal of the Nagpur Branch of WIRC of ICAI — supporting over 5,000 members and 8,500+ students through education, regulation and continuous professional development.',
  },
  home_branch_premises: {
    body: 'A purpose-built three-storey facility housing the Branch office, a 220-seat seminar hall, a digital library and a dedicated student wing for residential coaching.',
    stats: [
      { k: '80 seats',      v: 'READING ROOM' },
      { k: '4,200+ titles', v: 'LIBRARY' },
    ],
  },
  about_vision: {
    body: 'To be a leading branch dedicated to the holistic development of members and students through quality education, networking, and innovative initiatives.',
  },
  about_mission: {
    body: "Deliver world-class CPE programmes, advocate for members' interests, mentor students, and contribute to financial literacy in the wider community.",
  },
  about_history: {
    body: 'The Nagpur Branch was established in 1962 and has grown into one of the most active branches of WIRC, serving over 5,000 members and 8,500+ students.',
  },
};

// Internal — fetch the bundle once per ~5 min. EventsPage, HomePage and
// AboutPage will all share this single cache entry.
function useAllSiteContent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    cachedGet('/api/site/content', null, 300_000)
      .then((j) => { if (!cancelled) setData(j); })
      .catch(() => { if (!cancelled) setData({ rows: [] }); });
    return () => { cancelled = true; };
  }, []);

  return data;
}

// Returns merged { default, ...db } payload for a single slot. While the
// initial fetch is in flight the default fires immediately so the page
// doesn't shimmer.
export function useSiteContent(slug) {
  const all = useAllSiteContent();

  return useMemo(() => {
    const fallback = SITE_CONTENT_DEFAULTS[slug] || {};
    const row = all?.rows?.find((r) => r.slug === slug);
    const data = row?.data || {};
    // shallow merge — fallback fills gaps when the DB row is partial (e.g.
    // admin only set the quote, didn't upload a photo yet).
    return { ...fallback, ...data };
  }, [all, slug]);
}
