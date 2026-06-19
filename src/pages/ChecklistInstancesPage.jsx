import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import { useRoute, navigate } from '../hooks/useRoute';
import { useAuth } from '../context/AuthContext';
import QuestionRenderer from '../components/checklists/QuestionRenderer';
import { hasAnswer, ROLE_OPTIONS } from '../lib/checklistQuestions';
import { IconX } from '../icons';
import { CHECKLIST_STATUS, toneStyle } from '../lib/eventStatus';
import { useRoleFlags } from '../hooks/useRoleFlags';
import { Shimmer, ShimmerLines, ShimmerDrawerBody } from '../components/ui/Shimmer';

// Friendly label for an internal role code. Falls back to a prettified
// version of the code if it's not in our known list.
function roleLabel(code) {
  if (!code) return '';
  const match = ROLE_OPTIONS.find((r) => r.code === code);
  if (match) return match.label;
  return code.replace(/_/g, ' ');
}

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api(url, opts = {}) {
  const r = await fetch(url, {
    credentials: 'include',
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ChecklistInstancesPage() {
  const route = useRoute();
  const openId = route.query.id || null;

  return (
    <>
      <PageHeader title="My checklists" subtitle="Fill or review checklists assigned to you" />
      <section className="container" style={{ padding: '2rem 1rem' }}>
        <InstancesList onOpen={(id) => navigate('/my-checklists?id=' + id)} />
      </section>
      {openId && <InstanceDrawer id={openId} onClose={() => navigate('/my-checklists')} />}
    </>
  );
}

function StatusPill({ status }) {
  const meta = CHECKLIST_STATUS[status];
  const c = toneStyle(meta?.tone);
  return (
    <span
      title={meta?.long ?? status}
      style={{
        display: 'inline-block', padding: '.15rem .55rem', borderRadius: 999,
        background: c.bg, color: c.fg, fontSize: '.7rem', fontWeight: 600,
      }}
    >
      {meta?.short ?? status}
    </span>
  );
}

function InstancesList({ onOpen }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/api/checklist-instances')
      .then((j) => { if (!cancelled) setRows(j.rows || []); })
      .catch((e) => { if (!cancelled) setErr(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (err)        return <p className="muted-text" style={{ color: 'var(--destructive)' }}>{err}</p>;
  if (rows === null) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <Shimmer height="1rem" width={`${50 + ((i * 11) % 30)}%`} />
            <Shimmer height=".7rem" width="65%" />
          </div>
          <Shimmer height="1.25rem" width="4rem" radius="999px" />
        </div>
      ))}
    </div>
  );
  if (rows.length === 0) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <p className="muted-text">Nothing assigned to you right now.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.625rem' }}>
      {rows.map((r) => (
        <button key={r.id} onClick={() => onOpen(r.id)} className="ci-row">
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }}>{r.title}</div>
            <div className="muted-text" style={{ fontSize: '.8125rem' }}>
              {r.template_name} v{r.template_version}
              {r.event_title ? ` · ${r.event_title}` : ''}
              {' · '}Updated {fmt(r.updated_at)}
            </div>
          </div>
          <StatusPill status={r.status} />
          <style>{`
            .ci-row {
              display: flex; align-items: center; gap: 1rem;
              width: 100%; padding: 1rem 1.25rem;
              background: var(--card); border: 1px solid var(--border); border-radius: .5rem;
              cursor: pointer; transition: border-color .12s, background .12s;
            }
            .ci-row:hover { border-color: var(--primary); background: var(--muted, #fafaf9); }
          `}</style>
        </button>
      ))}
    </div>
  );
}

function InstanceDrawer({ id, onClose }) {
  const { showToast } = useAuth();
  const roleFlags = useRoleFlags();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  // null = use computed defaults; Set<number> = user-controlled state.
  // Reset when the instance id changes.
  const [openSections, setOpenSections] = useState(null);
  useEffect(() => { setOpenSections(null); }, [id]);
  // Admin-only "Manage assignments" dialog state. Opens via the Manage
  // button next to the assignee summary.
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const load = async () => {
    try {
      const j = await api(`/api/checklist-instances/${id}`);
      setData(j);
      setDraft(j.responses || {});
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  if (err) return <FullDrawer onClose={onClose}><p style={{ color: 'var(--destructive)' }}>{err}</p></FullDrawer>;
  if (!data) return (
    <FullDrawer onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Shimmer height="1.4rem" width="55%" />
        <Shimmer height=".75rem" width="40%" />
        <ShimmerDrawerBody fields={6} cols={2} />
      </div>
    </FullDrawer>
  );

  const { instance, template, questions, reviews, perms, assignees, stages = [], tasks: taskMap = {}, section_assignments = [] } = data;
  const editable = (perms.canFill || perms.canFillSections) && (instance.status === 'awaiting_fill' || instance.status === 'rejected');
  const reviewable = perms.canReview && instance.status === 'awaiting_review';
  const releaseable = perms.canRelease;  // admin + status='draft'
  const isMultiStage = stages.length > 0;
  // Admin sees the "Manage assignments" affordance. canManage is set true
  // only for admins on the instance, so checking it is enough.
  const canManageAssignments = !!perms.canManage;

  // The `section_owner_role` on a section_heading now denotes who REVIEWS
  // the section after submission — it drives the multi-stage approval
  // routing (treasurer reviews Budget & IUT, VC reviews Speakers & Agenda,
  // etc.) and the per-section label rendered below. It is NOT a fill gate;
  // one person (the committee chairman) fills the entire checklist.
  const sortedQuestions = [...questions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const myRoles = roleFlags.codes;

  // Group questions into accordion sections. Each section starts with a
  // section_heading; questions before any heading go into a pre-section
  // group with `heading: null` (always open, no owner badge).
  const sectionGroups = (() => {
    const groups = [];
    let current = { heading: null, owner_role: null, questions: [] };
    for (const q of sortedQuestions) {
      if (q.type === 'section_heading') {
        if (current.heading || current.questions.length > 0) groups.push(current);
        current = { heading: q, owner_role: q.section_owner_role ?? null, questions: [] };
      } else {
        current.questions.push(q);
      }
    }
    if (current.heading || current.questions.length > 0) groups.push(current);
    return groups;
  })();

  // Default-open logic — picked once per (id, role, status) and overridden
  // by user clicks afterwards. The rule:
  //   - Pre-section groups (no heading) are always open
  //   - Filler: open EVERY section (one person fills the whole checklist)
  //   - Approver in multi-stage: open sections whose reviewer matches a
  //     pending stage I can decide. If none matched, open all (e.g.
  //     chairman whose stage isn't section-bound)
  //   - Draft / view-only: open all
  const computedOpenSet = (() => {
    const set = new Set();
    for (let i = 0; i < sectionGroups.length; i++) {
      if (!sectionGroups[i].heading) set.add(i);
    }
    if (editable) {
      // Filler edits every section. Open them all by default.
      for (let i = 0; i < sectionGroups.length; i++) set.add(i);
    } else if (reviewable && isMultiStage) {
      const myPendingStageRoles = new Set();
      for (const s of stages) {
        if (s.status === 'pending' && (myRoles.has('admin') || myRoles.has(s.required_role_code))) {
          myPendingStageRoles.add(s.required_role_code);
        }
      }
      let matched = 0;
      for (let i = 0; i < sectionGroups.length; i++) {
        if (myPendingStageRoles.has(sectionGroups[i].owner_role)) { set.add(i); matched++; }
      }
      // Fallback — approver with no matching section (e.g. chairman whose
      // role doesn't own any specific section). Show everything.
      if (matched === 0) {
        for (let i = 0; i < sectionGroups.length; i++) set.add(i);
      }
    } else {
      for (let i = 0; i < sectionGroups.length; i++) set.add(i);
    }
    return set;
  })();
  const effectiveOpen = openSections ?? computedOpenSet;
  const isOpen = (i) => effectiveOpen.has(i);
  const toggleSection = (i) => {
    setOpenSections((prev) => {
      const base = prev ?? computedOpenSet;
      const next = new Set(base);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };
  const expandAll = () => setOpenSections(new Set(sectionGroups.map((_, i) => i)));
  const collapseAll = () => {
    const next = new Set();
    // Keep pre-section groups open — they have no header to click anyway.
    for (let i = 0; i < sectionGroups.length; i++) {
      if (!sectionGroups[i].heading) next.add(i);
    }
    setOpenSections(next);
  };

  // Per-section answer progress used by the accordion header pill.
  function sectionProgress(group) {
    const required = group.questions.filter((q) => q.required);
    const answered = group.questions.filter((q) => hasAnswer(q.type, draft[q.id]));
    const requiredAnswered = required.filter((q) => hasAnswer(q.type, draft[q.id]));
    return {
      total: group.questions.length,
      answered: answered.length,
      requiredTotal: required.length,
      requiredAnswered: requiredAnswered.length,
      complete: required.length > 0 && requiredAnswered.length === required.length,
      anyAnswered: answered.length > 0,
    };
  }

  // Task actions — call the per-task endpoints + reload to reflect new status.
  const onTaskAction = async (taskId, action, body = {}) => {
    setBusy(true);
    try {
      await api(`/api/checklist-tasks/${taskId}/${action}`, { method: 'POST', body });
      showToast?.(`Task ${action}`, 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const setVal = (qid, v) => setDraft((d) => ({ ...d, [qid]: v }));

  const saveProgress = async () => {
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/responses`, {
        method: 'PUT',
        body: { responses: draft },
      });
      showToast?.('Saved', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/responses`, { method: 'PUT', body: { responses: draft } });
      await api(`/api/checklist-instances/${id}/submit`, { method: 'POST' });
      showToast?.('Submitted for review', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const approve = async () => {
    if (!confirm('Approve this checklist?')) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/approve`, { method: 'POST' });
      showToast?.('Approved', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const reject = async () => {
    const note = prompt('Reason for rejection?');
    if (!note?.trim()) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/reject`, { method: 'POST', body: { note } });
      showToast?.('Rejected', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  // Multi-stage handlers — used when the instance has approval stages
  // (event-bound). Each stage represents a parallel approver (chairman,
  // treasurer, VC). The backend trigger cascades the instance status when
  // all stages are decided.
  const approveStage = async (stageCode) => {
    if (!confirm(`Approve "${stageCode.replace(/_/g, ' ')}" stage?`)) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/approve-stage`, {
        method: 'POST',
        body: { stage_code: stageCode },
      });
      showToast?.('Stage approved', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };
  const rejectStage = async (stageCode) => {
    const note = prompt('Reason for sending this back?');
    if (!note?.trim()) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/reject-stage`, {
        method: 'POST',
        body: { stage_code: stageCode, note },
      });
      showToast?.('Stage rejected — sent back to the committee', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  // Terminal reject — closes the event for good. Triggers a stronger
  // confirm than 'send back' because the action cancels the linked event.
  const rejectFinal = async (stageCode) => {
    const okay = confirm(
      'Reject completely will CANCEL the linked event and the checklist permanently. ' +
      'The committee chairman cannot re-fill or re-submit. ' +
      'Use this only if the event is dead — not for "needs more work" cases. Continue?',
    );
    if (!okay) return;
    const note = prompt('Reason for terminal rejection? (required, will be in the audit log)');
    if (!note?.trim()) return;
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/reject-final`, {
        method: 'POST',
        body: { stage_code: stageCode, note },
      });
      showToast?.('Rejected and event cancelled', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const release = async () => {
    if (!assignees?.filler) {
      if (!confirm('No filler is assigned yet. Releasing now will rely on role-based fallback. Continue?')) return;
    } else {
      if (!confirm(`Release this checklist to ${assignees.filler.name}? After release they can fill it.`)) return;
    }
    setBusy(true);
    try {
      await api(`/api/checklist-instances/${id}/release`, { method: 'POST' });
      showToast?.('Released — chairman can now fill it.', 'success');
      await load();
    } catch (e) { showToast?.(e.message, 'error'); }
    finally { setBusy(false); }
  };

  const missing = questions.filter((q) => q.required && q.type !== 'section_heading' && !hasAnswer(q.type, draft[q.id])).length;

  return (
    <FullDrawer onClose={onClose}>
      <header style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{instance.title}</h2>
            <p className="muted-text" style={{ marginTop: '.25rem', fontSize: '.875rem' }}>
              {template.name} v{template.version} · Updated {fmt(instance.updated_at)}
            </p>
          </div>
          <StatusPill status={instance.status} />
        </div>

        {/* Assignee summary — surfaced for everyone but most useful to admin
            who needs to confirm the auto-assignment before releasing.
            Also shows per-section assignments when present, and exposes a
            "Manage" button (admin only) that opens the reassignment dialog. */}
        {(assignees?.filler || assignees?.reviewer || instance.status === 'draft' || section_assignments.length > 0) && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: 'var(--background)', border: '1px solid var(--border)',
            borderRadius: '.375rem', fontSize: '.8125rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.5rem' }}>
              <strong style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--muted-foreground)' }}>
                Assignments
              </strong>
              {canManageAssignments && (
                <button
                  type="button"
                  onClick={() => setAssignDialogOpen(true)}
                  style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: '.3rem', padding: '.15rem .55rem',
                    font: 'inherit', fontSize: '.7rem', fontWeight: 600,
                    cursor: 'pointer', color: 'var(--primary, #1e40af)',
                  }}
                >
                  Manage →
                </button>
              )}
            </div>
            <div style={{ marginTop: '.4rem', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '.3rem 1rem' }}>
              <strong>Primary filler:</strong>
              <span>
                {assignees?.filler
                  ? <>{assignees.filler.name} <span className="muted-text">· {assignees.filler.email}</span></>
                  : <em className="muted-text">— not assigned —</em>}
              </span>
              <strong>Reviewer:</strong>
              <span>
                {assignees?.reviewer
                  ? <>{assignees.reviewer.name} <span className="muted-text">· {assignees.reviewer.email}</span></>
                  : <em className="muted-text">— not assigned —</em>}
              </span>
              {section_assignments.length > 0 && (
                <>
                  <strong style={{ alignSelf: 'start' }}>By section:</strong>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {section_assignments.map((sa) => {
                      const sec = questions.find((q) => q.id === sa.section_question_id);
                      return (
                        <li key={sa.id} style={{ marginBottom: '.15rem' }}>
                          <strong>{sec?.label || '(section)'}</strong>
                          {' → '}
                          {sa.assignee_name
                            ? <>{sa.assignee_name} <span className="muted-text">· {sa.assignee_email}</span></>
                            : <em className="muted-text">no one</em>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        {missing > 0 && editable && (
          <p style={{ marginTop: '.5rem', fontSize: '.8125rem', color: '#92400e' }}>
            {missing} required question{missing !== 1 ? 's' : ''} still need an answer.
          </p>
        )}

        {/* Status-specific context messages. */}
        {instance.status === 'draft' && releaseable && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: '#fef3c7', border: '1px solid #fcd34d',
            color: '#92400e', borderRadius: '.375rem', fontSize: '.8125rem',
          }}>
            <strong>Draft — not released yet.</strong>{' '}
            The filler can't see this until you click <em>Release to filler</em> below.
            Review the assignees first, and reassign via the events admin if needed.
          </div>
        )}

        {!perms.canFill && !perms.canReview && !releaseable && (
          <div style={{
            marginTop: '.75rem', padding: '.625rem .875rem',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            color: '#1e3a8a', borderRadius: '.375rem', fontSize: '.8125rem',
          }}>
            <strong>View only.</strong>{' '}
            {instance.status === 'awaiting_fill' || instance.status === 'rejected'
              ? 'The committee chairman fills this in. As admin, you can monitor progress but cannot enter answers.'
              : instance.status === 'awaiting_review'
                ? 'The branch chairman reviews this. As admin, you can monitor but cannot approve or reject.'
                : 'You can view this record but cannot make changes.'}
          </div>
        )}

        {isMultiStage && (
          <ApprovalStagesPanel
            stages={stages}
            instanceStatus={instance.status}
            onApprove={approveStage}
            onReject={rejectStage}
            onRejectFinal={rejectFinal}
            busy={busy}
          />
        )}
      </header>

      <div>
        {/* Accordion controls — only shown when there are 2+ sections to
            manage. Single-section checklists don't benefit from expand/collapse. */}
        {sectionGroups.filter((g) => g.heading).length >= 2 && (
          <div className="acc-toolbar">
            <button type="button" className="acc-link" onClick={expandAll}>Expand all</button>
            <span className="acc-sep">·</span>
            <button type="button" className="acc-link" onClick={collapseAll}>Collapse all</button>
          </div>
        )}

        {sectionGroups.map((group, gi) => {
          const heading = group.heading;
          // The role attached to a section now means "who REVIEWS this
          // section after submission" — NOT "who fills it". The filler
          // (committee chairman) edits every section regardless.
          const reviewerRole = group.owner_role;
          const prog = sectionProgress(group);
          const open = isOpen(gi);
          // Highlight the section the current approver is being asked to
          // sign off on, even when other sections are collapsed.
          const isMyApprovalTarget = reviewable && isMultiStage && reviewerRole && stages.some(
            (s) => s.status === 'pending' && s.required_role_code === reviewerRole
                   && (myRoles.has('admin') || myRoles.has(s.required_role_code)),
          );

          const body = group.questions.map((q) => {
            // Fill rights now belong wholly to the filler — no per-section
            // gate. Read-only only when the page is in non-fill mode at all
            // (e.g. status='awaiting_review' or 'approved').
            const showAsReadonly = !editable;
            return (
              <QuestionRenderer
                key={q.id}
                question={q}
                value={draft[q.id]}
                onChange={(v) => setVal(q.id, v)}
                mode={showAsReadonly ? 'readonly' : 'fill'}
                tasks={q.type === 'task_list' ? taskMap[q.id] : undefined}
                onTaskAction={q.type === 'task_list' ? onTaskAction : undefined}
              />
            );
          });

          // Pre-section group (questions before any heading) — no
          // collapsible wrapper, just render inline.
          if (!heading) {
            return group.questions.length > 0 ? <div key={`pre-${gi}`}>{body}</div> : null;
          }

          return (
            <section key={heading.id} className={'acc-section' + (isMyApprovalTarget ? ' acc-target' : '')}>
              <button
                type="button"
                className="acc-head"
                aria-expanded={open}
                onClick={() => toggleSection(gi)}
              >
                <span className={'acc-chev' + (open ? ' open' : '')}>▸</span>
                <span className="acc-title">{heading.label || 'Untitled section'}</span>
                {reviewerRole && (
                  <span className="acc-owner readonly">
                    Reviewed by {roleLabel(reviewerRole)}
                  </span>
                )}
                {isMyApprovalTarget && (
                  <span className="acc-target-pill">Awaiting your approval</span>
                )}
                {prog.requiredTotal > 0 && (
                  <span className={'acc-prog' + (prog.complete ? ' complete' : '')}>
                    {prog.complete
                      ? '✓ All required answered'
                      : `${prog.requiredAnswered} of ${prog.requiredTotal} required`}
                  </span>
                )}
              </button>
              {open && (
                <div className="acc-body">
                  {body}
                </div>
              )}
            </section>
          );
        })}

        <style>{`
          .acc-toolbar {
            display: flex; align-items: center; gap: .35rem;
            justify-content: flex-end;
            font-size: .75rem; color: var(--muted-foreground);
            margin-bottom: .5rem;
          }
          .acc-link {
            background: transparent; border: 0; padding: 0;
            color: var(--primary, #1e40af);
            cursor: pointer; font-size: .75rem; font-weight: 600;
          }
          .acc-link:hover { text-decoration: underline; }
          .acc-sep { color: var(--border); }

          .acc-section {
            border: 1px solid var(--border);
            border-radius: .5rem;
            background: var(--card, white);
            margin: .625rem 0;
            overflow: hidden;
            transition: box-shadow .15s ease;
          }
          .acc-section.acc-target {
            border-color: #f59e0b;
            box-shadow: 0 0 0 2px rgba(245, 158, 11, .15);
          }
          .acc-head {
            display: flex; align-items: center; gap: .55rem;
            width: 100%;
            padding: .65rem .75rem;
            background: rgba(37, 99, 235, .04);
            border: 0; border-bottom: 1px solid transparent;
            text-align: left; cursor: pointer;
            font: inherit;
          }
          .acc-head:hover { background: rgba(37, 99, 235, .08); }
          .acc-section .acc-body + .acc-head,
          .acc-section .acc-head[aria-expanded="true"] {
            border-bottom-color: var(--border);
          }
          .acc-chev {
            display: inline-block;
            transition: transform .15s ease;
            color: var(--muted-foreground);
            font-size: .8rem;
            width: 1rem;
          }
          .acc-chev.open { transform: rotate(90deg); }
          .acc-title {
            flex: 1; min-width: 0;
            font-weight: 700; font-size: 1rem;
            color: var(--primary, #1e40af);
          }
          .acc-owner {
            display: inline-block;
            padding: .1rem .5rem; border-radius: 999px;
            font-size: .7rem; font-weight: 600;
          }
          .acc-owner.mine     { background: #dbeafe; color: #1e3a8a; }
          .acc-owner.readonly { background: #f1f5f9; color: #475569; }
          .acc-target-pill {
            padding: .1rem .5rem; border-radius: 999px;
            background: #fef3c7; color: #92400e;
            font-size: .7rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: .04em;
          }
          .acc-prog {
            font-size: .72rem; font-weight: 600;
            color: var(--muted-foreground);
          }
          .acc-prog.complete { color: #15803d; }
          .acc-body { padding: .25rem 1rem 1rem; }
        `}</style>
      </div>

      {reviews.length > 0 && (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '.875rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted-foreground)' }}>Activity</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {reviews.map((r) => (
              <li key={r.id} style={{ padding: '.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                <strong>{r.actor_name || '—'}</strong>{' '}
                <span className="muted-text">{r.action.replace(/_/g, ' ')}</span>
                <span className="muted-text" style={{ marginLeft: '.5rem' }}>{fmt(r.created_at)}</span>
                {r.note && <div style={{ fontSize: '.875rem' }}>{r.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ position: 'sticky', bottom: 0, background: 'var(--card)', borderTop: '1px solid var(--border)', padding: '.75rem 0', marginTop: '1.5rem', display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
        {releaseable && (
          <button className="btn-primary" onClick={release} disabled={busy}>
            Release to filler →
          </button>
        )}
        {editable && (
          <>
            <button onClick={saveProgress} disabled={busy}>Save progress</button>
            <button className="btn-primary" onClick={submit} disabled={busy || missing > 0}>Submit for review</button>
          </>
        )}
        {reviewable && !isMultiStage && (
          <>
            <button onClick={reject} disabled={busy} style={{ color: 'var(--destructive)' }}>Reject</button>
            <button className="btn-primary" onClick={approve} disabled={busy}>Approve</button>
          </>
        )}
      </footer>

      {assignDialogOpen && (
        <SectionAssignmentsDialog
          instanceId={instance.id}
          sections={questions.filter((q) => q.type === 'section_heading')}
          initialAssignments={section_assignments}
          initialFiller={assignees?.filler?.id || ''}
          initialReviewer={assignees?.reviewer?.id || ''}
          onClose={() => setAssignDialogOpen(false)}
          onSaved={async () => {
            setAssignDialogOpen(false);
            await load();
            showToast?.('Assignments updated', 'success');
          }}
          showToast={showToast}
        />
      )}
    </FullDrawer>
  );
}

// ─── Section assignments dialog (admin reassign) ────────────────────────
// Admin-only modal that re-edits the per-section filler picker AFTER
// creation. Same shape as Step 2 in the events-page create modal — wires
// to PUT /api/checklist-instances/:id/section-assignments (replace-all)
// plus an optional PATCH to the primary filler/reviewer.
function SectionAssignmentsDialog({
  instanceId, sections, initialAssignments, initialFiller, initialReviewer,
  onClose, onSaved, showToast,
}) {
  // Pre-fill the picker with whatever's already on the instance.
  const [assignments, setAssignments] = useState(() => {
    const m = {};
    for (const a of initialAssignments || []) {
      if (a.assignee_id) m[a.section_question_id] = a.assignee_id;
    }
    return m;
  });
  const [primaryFiller, setPrimaryFiller] = useState(initialFiller || '');
  const [primaryReviewer, setPrimaryReviewer] = useState(initialReviewer || '');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Pre-load users (same debounce pattern as the create modal).
  useEffect(() => {
    let cancelled = false;
    const q = userSearch.trim();
    const url = q
      ? `/api/admin/users?q=${encodeURIComponent(q)}&status=active&pageSize=25`
      : '/api/admin/users?status=active&pageSize=50';
    const t = setTimeout(() => {
      api(url)
        .then((j) => { if (!cancelled) setUsers(j.rows || []); })
        .catch(() => {});
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userSearch]);

  // Always close on Escape — matches the rest of the modal UX.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (saving) return;
    setSaving(true); setErr('');
    try {
      // 1. Replace-all section assignments.
      const list = Object.entries(assignments)
        .filter(([_, uid]) => !!uid)
        .map(([section_question_id, assignee_id]) => ({ section_question_id, assignee_id }));
      await api(`/api/checklist-instances/${instanceId}/section-assignments`, {
        method: 'PUT',
        body: { assignments: list },
      });

      // 2. Patch primary filler / reviewer only if they actually changed.
      //    Sending undefined would no-op; sending an empty string clears.
      const patch = {};
      if (primaryFiller   !== initialFiller)   patch.assigned_fill_user_id   = primaryFiller || null;
      if (primaryReviewer !== initialReviewer) patch.assigned_review_user_id = primaryReviewer || null;
      if (Object.keys(patch).length > 0) {
        await api(`/api/checklist-instances/${instanceId}`, { method: 'PATCH', body: patch });
      }

      onSaved?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sad-root" onClick={onClose}>
      <div className="sad-card" onClick={(e) => e.stopPropagation()}>
        <header className="sad-head">
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Manage assignments</h2>
          <button className="sad-x" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="sad-body">
          {err && <p style={{ color: 'var(--destructive)' }}>{err}</p>}

          <div className="sad-search">
            <input
              type="search"
              placeholder="Search users by name or email…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="sad-input"
            />
          </div>

          {sections.length === 0 && (
            <p className="muted-text" style={{ fontSize: '.85rem' }}>
              This template has no sections.
            </p>
          )}

          {sections.map((s) => {
            const value = assignments[s.id] || '';
            return (
              <div key={s.id} className="sad-row">
                <div className="sad-row-info">
                  <strong>{s.label || '(unnamed section)'}</strong>
                </div>
                <DialogUserPicker
                  users={users}
                  value={value}
                  placeholder="— Primary filler —"
                  onChange={(uid) => setAssignments((m) => ({ ...m, [s.id]: uid }))}
                />
              </div>
            );
          })}

          <div className="sad-divider">Primary filler / reviewer</div>

          <div className="sad-row">
            <div className="sad-row-info"><strong>Primary filler</strong></div>
            <DialogUserPicker
              users={users}
              value={primaryFiller}
              placeholder="— Auto (Committee Chairman) —"
              onChange={setPrimaryFiller}
            />
          </div>
          <div className="sad-row">
            <div className="sad-row-info"><strong>Reviewer</strong></div>
            <DialogUserPicker
              users={users}
              value={primaryReviewer}
              placeholder="— Auto (Branch Chairman) —"
              onChange={setPrimaryReviewer}
            />
          </div>
        </div>

        <footer className="sad-foot">
          <button type="button" className="sad-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving} style={{ padding: '.45rem 1rem' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>

        <style>{`
          .sad-root {
            position: fixed; inset: 0; z-index: 300;
            background: rgba(15,23,42,.45);
            display: flex; align-items: flex-start; justify-content: center;
            padding: 5vh 1rem; overflow-y: auto;
          }
          .sad-card {
            width: 100%; max-width: 600px;
            background: var(--card); border-radius: .5rem;
            box-shadow: 0 20px 50px rgba(0,0,0,.25);
            display: flex; flex-direction: column; max-height: 90vh;
          }
          .sad-head {
            display: flex; justify-content: space-between; align-items: center;
            padding: .85rem 1.1rem; border-bottom: 1px solid var(--border);
          }
          .sad-x {
            background: transparent; border: 0; font-size: 1.5rem; line-height: 1;
            cursor: pointer; color: var(--muted-foreground); padding: 0 .5rem;
          }
          .sad-body { padding: 1rem 1.1rem; overflow-y: auto; }
          .sad-search { margin-bottom: .65rem; }
          .sad-input {
            width: 100%; padding: .4rem .55rem;
            border: 1px solid var(--border); border-radius: .375rem;
            background: var(--card); font: inherit; color: inherit;
          }
          .sad-input:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
          .sad-divider {
            margin: .85rem 0 .4rem;
            font-size: .7rem; font-weight: 600;
            color: var(--muted-foreground);
            text-transform: uppercase; letter-spacing: .04em;
          }
          .sad-row {
            display: flex; gap: .75rem; align-items: center;
            padding: .5rem .65rem;
            background: var(--card); border: 1px solid var(--border);
            border-radius: .375rem; margin-bottom: .35rem;
          }
          .sad-row-info { flex: 1; min-width: 0; font-size: .85rem; }
          .sad-foot {
            display: flex; gap: .5rem; justify-content: flex-end;
            padding: .75rem 1rem;
            border-top: 1px solid var(--border);
            background: var(--background, #fafbfc);
          }
          .sad-cancel {
            background: transparent; border: 1px solid var(--border);
            border-radius: .375rem; padding: .4rem .75rem;
            font: inherit; font-size: .8125rem; cursor: pointer;
            color: var(--muted-foreground);
          }
          .sad-cancel:hover { color: var(--foreground); }
          .dup-wrap {
            position: relative; min-width: 220px; max-width: 260px;
            flex-shrink: 0;
          }
          .dup-trigger {
            width: 100%; padding: .35rem .55rem;
            background: var(--card); border: 1px solid var(--border);
            border-radius: .375rem;
            font: inherit; font-size: .8125rem; text-align: left;
            display: flex; align-items: center; justify-content: space-between;
            cursor: pointer;
          }
          .dup-trigger:hover { border-color: var(--primary); }
          .dup-trigger.is-empty { color: var(--muted-foreground); }
          .dup-menu {
            position: absolute; top: calc(100% + .25rem); right: 0;
            z-index: 6; min-width: 280px;
            background: white; border: 1px solid var(--border);
            border-radius: .5rem; box-shadow: 0 6px 22px rgba(0,0,0,.12);
            padding: .35rem;
            display: flex; flex-direction: column;
            max-height: 280px; overflow-y: auto;
          }
          .dup-item {
            display: flex; align-items: center; gap: .5rem;
            width: 100%; padding: .4rem .55rem;
            text-align: left; background: transparent; border: 0; cursor: pointer;
            font: inherit; font-size: .8125rem; color: var(--foreground);
            border-radius: .3rem;
          }
          .dup-item:hover { background: var(--background, #f8fafc); }
          .dup-item.is-active {
            background: rgba(37, 99, 235, .08);
            color: var(--primary, #1e40af);
            font-weight: 600;
          }
          .dup-clear {
            border-top: 1px solid var(--border); margin-top: .2rem;
            color: var(--muted-foreground);
          }
        `}</style>
      </div>
    </div>
  );
}

// Lightweight user picker for the reassign dialog. Duplicated (with
// different class names) so that styling collisions with the create-flow
// picker don't bleed across.
function DialogUserPicker({ users, value, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const picked = value ? users.find((u) => u.id === value) : null;
  return (
    <div ref={ref} className="dup-wrap">
      <button
        type="button"
        className={'dup-trigger' + (picked ? '' : ' is-empty')}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {picked ? picked.name : placeholder}
        </span>
        <span style={{ fontSize: '.65rem', opacity: .6, marginLeft: '.3rem' }}>▾</span>
      </button>
      {open && (
        <div className="dup-menu">
          {users.length === 0 ? (
            <div style={{ color: 'var(--muted-foreground)', padding: '.5rem .55rem', fontSize: '.8rem' }}>
              No users in that search
            </div>
          ) : users.map((u) => {
            const active = u.id === value;
            return (
              <button
                key={u.id}
                type="button"
                className={'dup-item' + (active ? ' is-active' : '')}
                onClick={() => { onChange(u.id); setOpen(false); }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <strong style={{ fontWeight: 600 }}>{u.name}</strong>
                  <span style={{ marginLeft: '.4rem', color: 'var(--muted-foreground)', fontSize: '.75rem' }}>{u.email}</span>
                </span>
                {active && <span style={{ color: 'var(--primary, #1e40af)' }}>✓</span>}
              </button>
            );
          })}
          {value && (
            <button
              type="button"
              className="dup-item dup-clear"
              onClick={() => { onChange(''); setOpen(false); }}
            >
              Clear (use default)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Approval stages panel ──────────────────────────────────────────────
//
// Renders the three parallel approval rows (branch chairman / treasurer /
// VC) plus a per-row Approve / Send back action visible only to a holder
// of the stage's required role. Branch chairman gets the override —
// they can act on any row.
function ApprovalStagesPanel({ stages, instanceStatus, onApprove, onReject, onRejectFinal, busy }) {
  const { codes } = useRoleFlags();
  // Strict per-role gate: each stage can only be decided by the role that
  // owns it (or admin as a system-level escape hatch). The branch chairman
  // signs off on the chairman stage, the treasurer on the treasurer stage,
  // and the VC on the VC stage. Anything else is documented in R.5 as the
  // "publish without checklist" override on the events row, not here.
  const canDecide = (stage) => {
    if (instanceStatus !== 'awaiting_review') return false;
    if (stage.status !== 'pending') return false;
    return codes.has('admin') || codes.has(stage.required_role_code);
  };

  const STATUS_LABEL = {
    pending:  { text: 'Pending', bg: '#f1f5f9', fg: '#475569' },
    approved: { text: 'Approved', bg: '#dcfce7', fg: '#166534' },
    rejected: { text: 'Sent back', bg: '#fee2e2', fg: '#991b1b' },
  };

  // Human-readable hint for a stage the viewer cannot decide on — so the
  // page doesn't feel "broken" when a chairman lands on a checklist and
  // sees no buttons on the treasurer / VC stages.
  const ROLE_LABEL = {
    branch_chairman:      "branch chairman",
    branch_vice_chairman: "vice-chairman",
    branch_treasurer:     "treasurer",
  };

  function fmtDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <section style={{
      marginTop: '.75rem', padding: '.875rem 1rem',
      background: '#f8fafc', border: '1px solid var(--border)',
      borderRadius: '.5rem',
    }}>
      <div style={{
        fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '.04em', color: 'var(--muted-foreground)',
        marginBottom: '.5rem',
      }}>
        Multi-stage approval — all three must approve to publish
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
        {stages.map((s) => {
          const label = STATUS_LABEL[s.status] ?? STATUS_LABEL.pending;
          const showActions = canDecide(s);
          return (
            <li key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '.75rem',
              padding: '.5rem .625rem',
              background: 'white', border: '1px solid var(--border)',
              borderRadius: '.375rem',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.875rem', fontWeight: 600 }}>{s.stage_label}</div>
                {(s.decider_name || s.note) && (
                  <div style={{ fontSize: '.75rem', color: 'var(--muted-foreground)', marginTop: '.15rem' }}>
                    {s.decider_name && <span>by {s.decider_name}</span>}
                    {s.decided_at && <span> · {fmtDate(s.decided_at)}</span>}
                    {s.note && <span> · "{s.note}"</span>}
                  </div>
                )}
              </div>
              <span style={{
                padding: '.15rem .55rem', borderRadius: 999,
                background: label.bg, color: label.fg,
                fontSize: '.7rem', fontWeight: 600,
              }}>{label.text}</span>
              {showActions ? (
                <div style={{ display: 'flex', gap: '.25rem', flexWrap: 'wrap' }}>
                  {/* Terminal reject — destructive, kept furthest left so it's
                      visually separate from the routine Send back / Approve. */}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRejectFinal?.(s.stage_code)}
                    title="Cancel the linked event permanently"
                    style={{
                      padding: '.25rem .55rem', fontSize: '.7rem', fontWeight: 600,
                      background: '#991b1b', border: 0,
                      color: 'white', borderRadius: '.25rem', cursor: 'pointer',
                    }}
                  >Reject completely</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReject(s.stage_code)}
                    style={{
                      padding: '.25rem .55rem', fontSize: '.7rem', fontWeight: 600,
                      background: 'transparent', border: '1px solid #fecaca',
                      color: '#b91c1c', borderRadius: '.25rem', cursor: 'pointer',
                    }}
                  >Send back</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove(s.stage_code)}
                    style={{
                      padding: '.25rem .55rem', fontSize: '.7rem', fontWeight: 700,
                      background: '#16a34a', border: 0,
                      color: 'white', borderRadius: '.25rem', cursor: 'pointer',
                    }}
                  >Approve</button>
                </div>
              ) : s.status === 'pending' && instanceStatus === 'awaiting_review' ? (
                <span style={{ fontSize: '.7rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                  Waiting for {ROLE_LABEL[s.required_role_code] ?? s.required_role_code.replace(/_/g, ' ')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FullDrawer({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.45)' }} />
      <aside style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(720px, 100vw)',
        background: 'var(--card)', boxShadow: '-8px 0 30px rgba(0,0,0,.15)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '.75rem 1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, cursor: 'pointer' }}>
            <IconX />
          </button>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>{children}</div>
      </aside>
    </div>
  );
}
