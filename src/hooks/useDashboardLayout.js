import { useCallback, useEffect, useMemo, useState } from 'react';
import { cachedGet, apiWrite } from '../lib/apiCache';

const ALLOWED_SIZES = new Set(['sm', 'md', 'lg']);

// Defensive normaliser — silently drops widget ids we no longer know about
// (renamed/removed) so a stale DB row never breaks the dashboard.
function normaliseLayout(layout, knownIds) {
  if (!Array.isArray(layout)) return null;
  const seen = new Set();
  const out = [];
  for (const item of layout) {
    if (!item || typeof item !== 'object') continue;
    const { id, size } = item;
    if (typeof id !== 'string' || !knownIds.has(id) || seen.has(id)) continue;
    if (!ALLOWED_SIZES.has(size)) continue;
    seen.add(id);
    out.push({ id, size });
  }
  return out;
}

// Per-user dashboard widget layout — load from /api/dashboard/layout,
// edit in memory while in "edit mode", commit with save().
//
// `scope` targets a specific dashboard surface (chairman | treasurer) so a
// single user can hold separate layouts side-by-side. Backwards compatible:
// callers that omit `scope` get the chairman surface (the only one before
// the treasurer dashboard shipped).
//
// Optimistic by design: the visible layout updates the instant the user
// reorders/resizes a tile, and we only persist when they hit Save. Cancel
// reverts to the last persisted version. Reset blows away the DB row so the
// next load falls back to the registry default.
export function useDashboardLayout({ defaultLayout, knownIds, scope = 'chairman' }) {
  const idSet = useMemo(() => new Set(knownIds), [knownIds]);
  const endpoint = `/api/dashboard/layout?scope=${encodeURIComponent(scope)}`;

  const [persisted, setPersisted] = useState(null);   // last server-acknowledged
  const [draft, setDraft]         = useState(null);   // in-progress edits
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);

  // Initial fetch. Re-runs when `scope` changes so a user who toggles between
  // dashboards sees the right layout for each.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    cachedGet(endpoint, null, 5_000)
      .then((j) => {
        if (cancelled) return;
        const normalised = normaliseLayout(j?.layout, idSet);
        setPersisted(normalised && normalised.length ? normalised : defaultLayout);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        // 401 / network failure — fall back to default so the page still renders.
        setPersisted(defaultLayout);
        setError(e);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // defaultLayout and idSet are stable references in the consumer (built from
  // the registry which is module-scope), so we intentionally omit them from
  // deps to avoid an infinite re-fetch loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  const layout = draft ?? persisted ?? defaultLayout;

  const startEditing = useCallback(() => {
    setDraft(persisted ?? defaultLayout);
  }, [persisted, defaultLayout]);

  const cancelEditing = useCallback(() => {
    setDraft(null);
  }, []);

  const editLayout = useCallback((next) => {
    if (typeof next === 'function') setDraft((d) => next(d ?? persisted ?? defaultLayout));
    else setDraft(next);
  }, [persisted, defaultLayout]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true); setError(null);
    try {
      await apiWrite(endpoint, {
        method: 'PUT',
        body: { layout: draft },
        invalidates: endpoint,
      });
      setPersisted(draft);
      setDraft(null);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [draft, endpoint]);

  const reset = useCallback(async () => {
    setSaving(true); setError(null);
    try {
      await apiWrite(endpoint, {
        method: 'DELETE',
        invalidates: endpoint,
      });
      setPersisted(defaultLayout);
      setDraft(null);
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [defaultLayout, endpoint]);

  return {
    layout,
    isEditing: draft !== null,
    loading,
    saving,
    error,
    startEditing,
    cancelEditing,
    editLayout,
    save,
    reset,
  };
}
