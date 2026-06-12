import { useCallback, useRef, useState } from 'react';
import { WIDGET_BY_ID } from './registry';

// Customizable 12-column widget grid.
//
// Sizes consume different column counts:
//   sm = 3 cols (4 across on desktop, 2 on tablet, 1 on phone)
//   md = 6 cols (2 across on desktop, 1 below)
//   lg = 12 cols (full-bleed)
//
// In edit mode each widget gets a chrome overlay: drag handle, resize
// segmented control, and a remove button. Drag uses native HTML5 DnD —
// fine for sortable grids and avoids a 30KB DnD library dep.
//
// Drop logic:
//   - The drag image is the whole widget shell.
//   - We track the dragged index on dragstart, and the *target index* on
//     dragenter of any other widget.
//   - On dragover we preventDefault so a drop is allowed.
//   - On drop we splice the array and call onChange.
//
// This produces visible reordering with no flicker because we update state
// the instant the user crosses a widget's mid-line via dragenter.
export default function WidgetGrid({ layout, isEditing, onChange, renderArgs, onRemove }) {
  const dragIndexRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragStart = useCallback((idx, id) => (ev) => {
    if (!isEditing) return;
    dragIndexRef.current = idx;
    setDragId(id);
    try {
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', id);
    } catch { /* Firefox quirk — setData can throw under certain CSPs */ }
  }, [isEditing]);

  const handleDragEnter = useCallback((idx) => () => {
    if (!isEditing || dragIndexRef.current === null) return;
    setOverIndex(idx);
  }, [isEditing]);

  const handleDragOver = useCallback((ev) => {
    if (!isEditing) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }, [isEditing]);

  const handleDrop = useCallback((targetIdx) => (ev) => {
    if (!isEditing) return;
    ev.preventDefault();
    const fromIdx = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragId(null);
    setOverIndex(null);
    if (fromIdx === null || fromIdx === targetIdx) return;
    onChange((current) => {
      const next = current.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }, [isEditing, onChange]);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragId(null);
    setOverIndex(null);
  }, []);

  const handleResize = useCallback((idx, nextSize) => {
    onChange((current) => {
      const next = current.slice();
      next[idx] = { ...next[idx], size: nextSize };
      return next;
    });
  }, [onChange]);

  return (
    <div className="widget-grid" data-editing={isEditing ? 'true' : 'false'}>
      {layout.map((item, idx) => {
        const w = WIDGET_BY_ID[item.id];
        if (!w) return null;
        const sizeClass = `is-${item.size}`;
        const isDragging = dragId === item.id;
        const isDropTarget = overIndex === idx && dragIndexRef.current !== null && dragIndexRef.current !== idx;

        return (
          <div
            key={item.id}
            className={['widget-cell', sizeClass, isDragging ? 'is-dragging' : '', isDropTarget ? 'is-drop-target' : ''].filter(Boolean).join(' ')}
            draggable={isEditing}
            onDragStart={handleDragStart(idx, item.id)}
            onDragEnter={handleDragEnter(idx)}
            onDragOver={handleDragOver}
            onDrop={handleDrop(idx)}
            onDragEnd={handleDragEnd}
          >
            {isEditing && (
              <WidgetChrome
                widget={w}
                size={item.size}
                onResize={(s) => handleResize(idx, s)}
                onRemove={() => onRemove(idx)}
              />
            )}
            <div className="widget-body" aria-hidden={isEditing ? 'true' : 'false'}>
              {w.render({ ...renderArgs, size: item.size })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WidgetChrome({ widget, size, onResize, onRemove }) {
  return (
    <div className="widget-chrome" onMouseDown={(e) => e.stopPropagation()}>
      <div className="widget-chrome-left">
        <span className="widget-handle" title="Drag to reorder">⠿</span>
        <span className="widget-chrome-title">{widget.title}</span>
      </div>
      <div className="widget-chrome-right">
        {widget.allowedSizes.length > 1 && (
          <div className="size-toggle" role="radiogroup" aria-label="Widget size">
            {widget.allowedSizes.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === size}
                className={'size-toggle-btn' + (s === size ? ' is-active' : '')}
                onClick={() => onResize(s)}
                title={s === 'sm' ? 'Small (quarter row)' : s === 'md' ? 'Medium (half row)' : 'Large (full row)'}
              >{s.toUpperCase()}</button>
            ))}
          </div>
        )}
        <button type="button" className="widget-remove" onClick={onRemove} title="Remove from dashboard" aria-label="Remove widget">
          ✕
        </button>
      </div>
    </div>
  );
}
