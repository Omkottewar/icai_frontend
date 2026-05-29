import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../hooks/useRoute';
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
      <div className="tiny-eyebrow" style={{ color: 'var(--secondary)' }}>STUDENT WING</div>
      <h3 style={{ marginTop: '.25rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
        WICASA — Nagpur Branch
      </h3>
      <p className="muted-text" style={{ marginTop: '.5rem', lineHeight: 1.6 }}>
        The Nagpur Branch CA Students' Association supports articleship trainees through
        orientation courses, mock tests, soft-skills training and the annual festival.
      </p>

      {/* New updates */}
      <div className="wicasa-subhead">New updates</div>
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
        <span>Student suggestions</span>
        {!user && <span className="wicasa-signin-hint">Sign in to upvote</span>}
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
        STUDENT RESOURCES <IconArrowRight size="sm" />
      </a>
    </div>
  );
}
