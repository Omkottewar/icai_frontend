import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
import { useSiteContent } from '../../hooks/useSiteContent';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { IconArrowRight, IconChevronDown } from '../../icons';

const UPDATES = [
  'Mock Test Series for the May 2026 attempt — registration now open',
  'New ITT & Orientation batch begins 2 June at ICAI Bhawan',
  'Industrial visit to MIDC Butibori — sign up by 28 May',
];

const SUGGESTIONS = [
  { id: 's1', text: 'Add weekend revision classes before every exam attempt', votes: 31 },
  { id: 's2', text: 'More industrial visits to manufacturing and audit firms', votes: 24 },
  { id: 's3', text: 'Soft-skills workshop focused on interview preparation', votes: 18 },
];

export default function WicasaCard() {
  const { user } = useAuth();
  const [upvoted, setUpvoted] = useState({});
  // Editable labels (UPDATES + SUGGESTIONS list bodies stay hardcoded
  // per the design — only the labels around them are admin-managed).
  const t = useSiteContent('home_wicasa_card');

  const scoreFor = (id) => {
    const base = SUGGESTIONS.find((s) => s.id === id).votes;
    return base + (upvoted[id] ? 1 : 0);
  };

  const toggleUpvote = (id) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setUpvoted((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // show the highest-scoring suggestions first
  const ranked = [...SUGGESTIONS].sort((a, b) => scoreFor(b.id) - scoreFor(a.id));

  return (
    <div className="card wicasa-card">
      <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>{t.eyebrow}</div>
      <h3 style={{ marginTop: '.25rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
        {t.title}
      </h3>
      <div className="muted-text" style={{ marginTop: '.5rem', lineHeight: 1.6 }}>
        {renderMarkdown(t.body)}
      </div>

      {/* New updates */}
      <div className="wicasa-subhead">{t.updates_heading}</div>
      <ul className="wicasa-updates">
        {UPDATES.map((u) => (
          <li key={u}>
            <span className="wicasa-new">NEW</span>
            <span>{u}</span>
          </li>
        ))}
      </ul>

      {/* Student suggestions — Reddit-style upvotes */}
      <div className="wicasa-subhead">
        <span>{t.suggestions_heading}</span>
        {!user && <span className="wicasa-signin-hint">{t.signin_hint}</span>}
      </div>
      <ul className="wicasa-suggestions">
        {ranked.map((s) => {
          const isUp = !!upvoted[s.id];
          const score = scoreFor(s.id);
          return (
            <li key={s.id}>
              <span className="wicasa-sugg-text">{s.text}</span>
              <button
                type="button"
                className={'wicasa-upvote-pill' + (isUp ? ' is-active' : '')}
                onClick={() => toggleUpvote(s.id)}
                aria-pressed={isUp}
                aria-label={`Upvote: ${s.text}`}
                title={user ? (isUp ? 'Remove upvote' : 'Upvote') : 'Sign in to upvote'}
              >
                <span className="wicasa-upvote-arrow" aria-hidden="true">
                  <IconChevronDown size="sm" />
                </span>
                <span className="wicasa-upvote-count">{score}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <a href="#/students" className="wicasa-resources">
        {t.resources_label} <IconArrowRight size="sm" />
      </a>
    </div>
  );
}
