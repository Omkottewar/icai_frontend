import { useMemo, useState } from 'react';
import { WIDGET_REGISTRY as CHAIRMAN_REGISTRY } from './registry';

// Floating customize controls. Two surfaces:
//   1. The "Customize" button that lives in the page topbar (renders when NOT editing).
//   2. The sticky edit toolbar that appears at the top of the viewport while editing
//      with Save / Cancel / Reset / Add widget controls.
//
// The picker is a simple overlay; it filters out widgets already in the layout.
export function CustomizeButton({ onClick, disabled }) {
  return (
    <button className="d-btn" onClick={onClick} disabled={disabled} title="Customize this dashboard">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      Customize
    </button>
  );
}

// `registry` is optional — defaults to the chairman widget catalog. Other
// dashboards (treasurer, …) pass in their own array so the "Add widget"
// picker only offers widgets relevant to that surface.
export function EditToolbar({
  layout, isDirty, saving,
  onAddWidget, onSave, onCancel, onReset,
  registry = CHAIRMAN_REGISTRY,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const inLayout = useMemo(() => new Set(layout.map((l) => l.id)), [layout]);
  const available = useMemo(
    () => registry.filter((w) => !inLayout.has(w.id)),
    [inLayout, registry]
  );

  return (
    <>
      <div className="edit-toolbar" role="toolbar" aria-label="Dashboard edit controls">
        <div className="edit-toolbar-left">
          <span className="edit-toolbar-eyebrow">▾ EDITING DASHBOARD</span>
          <span className="edit-toolbar-hint">Drag tiles to reorder · resize with SM / MD / LG · ✕ to remove</span>
        </div>
        <div className="edit-toolbar-right">
          <button className="d-btn" onClick={() => setPickerOpen(true)} disabled={available.length === 0}>
            + Add widget {available.length > 0 && <span className="edit-toolbar-pill">{available.length}</span>}
          </button>
          <button className="d-btn d-btn-ghost" onClick={onReset} disabled={saving} title="Restore the default layout for this role">
            Reset
          </button>
          <button className="d-btn d-btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="d-btn d-btn-primary" onClick={onSave} disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {pickerOpen && (
        <WidgetPicker
          widgets={available}
          onPick={(w) => { onAddWidget(w); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function WidgetPicker({ widgets, onPick, onClose }) {
  // Group by `group` field for a tidy picker. Order: KPI → Trend → Composition → Committee → Activity.
  const ORDER = ['KPI', 'Trend', 'Composition', 'Committee', 'Activity'];
  const grouped = useMemo(() => {
    const g = {};
    for (const w of widgets) (g[w.group] ??= []).push(w);
    return ORDER.filter((k) => g[k]).map((k) => [k, g[k]]);
  }, [widgets]);

  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label="Add a widget" onClick={onClose}>
      <div className="picker-panel" onClick={(e) => e.stopPropagation()}>
        <div className="picker-head">
          <div>
            <div className="picker-eyebrow">ADD WIDGETS</div>
            <h3 className="picker-title">Pick from {widgets.length} hidden widget{widgets.length === 1 ? '' : 's'}</h3>
            <p className="picker-sub">They'll appear at the bottom of your layout — drag to wherever you want them.</p>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {grouped.length === 0 ? (
          <p className="picker-empty">Every widget is already on your dashboard. Nice work.</p>
        ) : (
          <div className="picker-groups">
            {grouped.map(([group, list]) => (
              <section key={group} className="picker-group">
                <h4 className="picker-group-title">{group}</h4>
                <div className="picker-grid">
                  {list.map((w) => (
                    <button key={w.id} type="button" className="picker-card" onClick={() => onPick(w)}>
                      <div className="picker-card-head">
                        <span className="picker-card-title">{w.title}</span>
                        <span className="picker-card-size">{w.defaultSize.toUpperCase()}</span>
                      </div>
                      <div className="picker-card-desc">{w.description}</div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
