import { useEffect, useRef, useState } from 'react';
import { cachedGet, apiWrite } from '../../lib/apiCache';
import { useSiteContent } from '../../hooks/useSiteContent';
import { renderMarkdown } from '../../lib/markdown.jsx';
import { toast } from '../../lib/notify';
import { IconX, IconFileText, IconCheckCircle } from '../../icons';

// In-app apply modal. Two states:
//   1. No resume on file → prompt the user to upload one right here, then
//      the button flips into "Send application".
//   2. Resume on file → straight to cover-letter + submit.
//
// Snapshotting of the resume onto the job_application row is handled server
// side (routes/jobApplications.ts); the client just POSTs the posting_id
// and cover message.

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const idx = s.indexOf(',');
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export default function ApplyModal({ posting, onClose, onApplied }) {
  const overlayRef = useRef(null);
  const fileRef = useRef(null);
  const copy = useSiteContent('job_apply_modal');
  const successCopy = useSiteContent('job_apply_success');
  const [resume, setResume] = useState(undefined); // undefined = loading; null = none; obj = present
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [coverMessage, setCoverMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cachedGet('/api/me/resume', undefined, 5_000)
      .then((j) => setResume(j.item ?? null))
      .catch(() => setResume(null));
  }, []);

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  async function onUpload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) {
      setUploadError('Please upload a PDF file');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadError('Resume must be under 5 MB');
      return;
    }
    setUploading(true); setUploadError(null);
    try {
      const b64 = await fileToBase64(f);
      const j = await apiWrite('/api/me/resume', {
        body: { name: f.name, data_base64: b64 },
        invalidates: ['/api/me/resume'],
      });
      setResume(j.item);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!resume?.id) { setError('Upload your resume first'); return; }
    setApplying(true); setError(null);
    try {
      await apiWrite('/api/job-applications', {
        body: { posting_id: posting.id, cover_message: coverMessage.trim() || null },
        invalidates: ['/api/job-applications/mine', '/api/jobs'],
      });
      setApplied(true);
      onApplied?.();
    } catch (err) {
      setError(err.message || 'Could not send your application');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto',
      }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: '.75rem',
        boxShadow: '0 24px 64px rgba(0,0,0,.25)',
        width: '100%', maxWidth: 560, maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.875rem 1.25rem', borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9375rem' }}>
              {applied ? successCopy.title : copy.heading}
            </div>
            {!applied && (
              <div className="muted-text" style={{ fontSize: '.78rem', marginTop: '.15rem' }}>
                {posting.title}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <IconX />
          </button>
        </div>

        {applied ? (
          <div style={{ padding: '1.75rem 1.5rem', textAlign: 'center', overflowY: 'auto' }}>
            <div style={{ color: 'oklch(0.52 0.15 145)', marginBottom: '.5rem' }}>
              <IconCheckCircle size="lg" />
            </div>
            <div style={{ fontSize: '.9rem', lineHeight: 1.55 }}>
              {renderMarkdown(successCopy.body)}
            </div>
            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: '1.25rem', padding: '.5rem 1.25rem' }}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.55rem .75rem', borderRadius: '.375rem', fontSize: '.8125rem' }}>
                {error}
              </div>
            )}

            {resume === undefined ? (
              <div className="muted-text" style={{ fontSize: '.85rem' }}>Loading your resume…</div>
            ) : resume === null ? (
              <div style={{ padding: '1rem', border: '1px dashed var(--border)', borderRadius: '.5rem', background: 'var(--muted)' }}>
                <div style={{ fontSize: '.875rem', lineHeight: 1.55, marginBottom: '.5rem' }}>
                  {renderMarkdown(copy.no_resume)}
                </div>
                {uploadError && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '.4rem .55rem', borderRadius: '.375rem', fontSize: '.75rem', marginBottom: '.5rem' }}>
                    {uploadError}
                  </div>
                )}
                <label className="btn btn-primary" style={{ padding: '.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '.4rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onUpload} style={{ display: 'none' }} disabled={uploading} />
                  {uploading ? 'Uploading…' : 'Upload PDF resume (≤ 5 MB)'}
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.65rem .75rem', border: '1px solid var(--border)', borderRadius: '.375rem' }}>
                <IconFileText size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {resume.name}
                  </div>
                  <div className="muted-text" style={{ fontSize: '.72rem' }}>
                    {(resume.size_bytes / 1024).toFixed(0)} KB · uploaded resume
                  </div>
                </div>
                <label className="btn btn-outline" style={{ padding: '.35rem .65rem', fontSize: '.75rem', cursor: uploading ? 'wait' : 'pointer' }}>
                  <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onUpload} style={{ display: 'none' }} disabled={uploading} />
                  {uploading ? 'Replacing…' : 'Replace'}
                </label>
              </div>
            )}

            <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              Message to the employer (optional)
              <textarea
                rows={4}
                value={coverMessage}
                onChange={(e) => setCoverMessage(e.target.value)}
                placeholder="Why you're a fit, any relevant experience, availability, etc."
                style={{ width: '100%', marginTop: '.35rem', padding: '.55rem .65rem', border: '1px solid var(--border)', borderRadius: '.375rem', fontSize: '.85rem', color: 'var(--foreground)', background: 'var(--card)', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </label>

            <div className="muted-text" style={{ fontSize: '.75rem', lineHeight: 1.55 }}>
              {renderMarkdown(copy.disclaimer)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
              <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '.5rem 1rem' }}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={applying || !resume?.id}
                style={{ padding: '.5rem 1.25rem' }}
                title={!resume?.id ? 'Upload a resume first' : undefined}
              >
                {applying ? 'Sending…' : 'Send application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
