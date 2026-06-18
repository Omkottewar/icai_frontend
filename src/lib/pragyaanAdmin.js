// API client for the Pragyaan admin console.
//
// Wraps every endpoint under /api/admin/pragyaan. All requests send the
// session cookie (credentials:'include' — handled inside cachedGet/apiWrite).
// Reads go through the shared GET cache (cachedGet) so concurrent callers
// dedupe; writes go through apiWrite, which also invalidates the matching
// cache entries so the next read is fresh. Both helpers already throw an
// Error carrying the server's `error`/`message` on a non-2xx response.
//
// See backend: routes under /api/admin/pragyaan (admin auth; approve/reject/
// retention also allow branch/committee chairmen).

import { cachedGet, apiWrite, revalidate } from './apiCache';

const BASE = '/api/admin/pragyaan';

// Invalidate every cached Pragyaan GET. Called after any write so lists,
// detail views and analytics all re-read from the network on next access.
const ALL = BASE;

// ─────────────────────────── Sources ───────────────────────────

// GET /sources?status&scope&q&page&pageSize
// -> { rows, total, page, pageSize }
export function listSources({ status, scope, q, page, pageSize } = {}) {
  return cachedGet(`${BASE}/sources`, { status, scope, q, page, pageSize });
}

// GET /sources/:id -> { source, version_chain }
export function getSource(id) {
  return cachedGet(`${BASE}/sources/${id}`);
}

// POST /sources { title?, file_id?|url?|text?, scope, lang?, source_type }
// Exactly one of file_id / url / text. Admin uploads are NOT auto-approved.
// -> 201 { id, ..., status, version, chunk_count, approved_at }
export function createSource(body) {
  return apiWrite(`${BASE}/sources`, { method: 'POST', body, invalidates: ALL });
}

// POST /sources/:id/reindex -> { id, status, version, chunk_count, skipped }
export function reindexSource(id) {
  return apiWrite(`${BASE}/sources/${id}/reindex`, { method: 'POST', invalidates: ALL });
}

// POST /sources/:id/rollback
// -> { ok, reactivated_id, retired_id, active_version }  (needs a prior version)
export function rollbackSource(id) {
  return apiWrite(`${BASE}/sources/${id}/rollback`, { method: 'POST', invalidates: ALL });
}

// POST /sources/:id/retire -> { ok, id, retired_at }
export function retireSource(id) {
  return apiWrite(`${BASE}/sources/${id}/retire`, { method: 'POST', invalidates: ALL });
}

// PATCH /sources/:id/retention { retention_expires_at: ISO|null }
// -> { ok, id, retention_expires_at }
export function setRetention(id, retention_expires_at) {
  return apiWrite(`${BASE}/sources/${id}/retention`, {
    method: 'PATCH',
    body: { retention_expires_at },
    invalidates: ALL,
  });
}

// ─────────────────────────── Ingest ────────────────────────────

// POST /ingest/public -> 202 { accepted, message }
export function ingestPublic(body) {
  return apiWrite(`${BASE}/ingest/public`, { method: 'POST', body, invalidates: ALL });
}

// ───────────────────────── Approvals ───────────────────────────
// (admin OR branch/committee chairman)

// GET /approvals -> { rows, total }
export function listApprovals() {
  return cachedGet(`${BASE}/approvals`);
}

// POST /sources/:id/approve { note? } -> { ok, id, approved_at, approved_by }
export function approveSource(id, note) {
  return apiWrite(`${BASE}/sources/${id}/approve`, {
    method: 'POST',
    body: { note },
    invalidates: ALL,
  });
}

// POST /sources/:id/reject { reason? } -> { ok, id, status:'failed' }
export function rejectSource(id, reason) {
  return apiWrite(`${BASE}/sources/${id}/reject`, {
    method: 'POST',
    body: { reason },
    invalidates: ALL,
  });
}

// ───────────────────────── Feedback ────────────────────────────

// GET /feedback?rating=up|down&page&pageSize -> { rows, total, page, pageSize }
export function listFeedback({ rating, page, pageSize } = {}) {
  return cachedGet(`${BASE}/feedback`, { rating, page, pageSize });
}

// ──────────────────────── Analytics ────────────────────────────

// GET /analytics?days=30
// -> { window_days, total, answered, no_answer_count, no_answer_rate,
//      citation_coverage, avg_top_similarity, top_questions, by_day }
export function getAnalytics({ days = 30 } = {}) {
  return cachedGet(`${BASE}/analytics`, { days });
}

// ───────────────────────── Uploads ─────────────────────────────

// Upload a file to the shared admin files endpoint, then use the returned
// `id` as `file_id` when creating a source. Mirrors the base64 POST pattern
// used elsewhere in the admin (see SiteContentAdminPage's ImageField).
// -> { id, url, ... }
export function uploadFile({ name, mime_type, data_base64, bucket = 'pragyaan' }) {
  return apiWrite('/api/admin/files', {
    method: 'POST',
    body: { name, mime_type, bucket, data_base64 },
  });
}

// Force a fresh read of any cached Pragyaan GET (bypasses the TTL).
// Thin re-export of apiCache.revalidate scoped to this module's BASE so
// callers don't have to repeat the path prefix.
export function refreshSources(qs) {
  return revalidate(`${BASE}/sources`, qs);
}
