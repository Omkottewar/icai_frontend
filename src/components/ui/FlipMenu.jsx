import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Universal flip-aware dropdown / popover.
//
// Why this exists:
//   The codebase had ~15 places using `position: absolute; top: 100%` to
//   pin a menu under its trigger. That works in the middle of the page
//   but gets cropped at the viewport bottom — the menu just stops at the
//   browser's edge instead of flipping up. It also gets clipped by any
//   parent `overflow: hidden` (drawers, sticky bars, cards).
//
// What this gives you:
//   • A React Portal at document.body so no parent can clip it.
//   • `position: fixed` with computed coords from the trigger's
//     `getBoundingClientRect()`, so the menu sits next to the trigger
//     regardless of stacking context.
//   • Auto-flip: if there isn't enough room below the trigger, we render
//     above it. The decision is recomputed on each open + on every
//     scroll / resize.
//   • Click-outside + Escape close the menu (you still own `open` state).
//
// Usage:
//   const triggerRef = useRef(null);
//   const [open, setOpen] = useState(false);
//
//   <button ref={triggerRef} onClick={() => setOpen(o => !o)}>⋯</button>
//   <FlipMenu open={open} triggerRef={triggerRef} onClose={() => setOpen(false)}>
//     <div className="my-menu">…items…</div>
//   </FlipMenu>

const VIEWPORT_PADDING = 8;

export default function FlipMenu({
  open,
  triggerRef,
  onClose,
  align = 'right',
  offset = 4,
  minWidth,
  maxHeight,
  zIndex = 1000,
  children,
  style: extraStyle,
  className,
}) {
  const menuRef = useRef(null);
  // pos === null means "first frame after open, dimensions not measured
  // yet". We render the menu in the DOM (so we can read its size) but
  // keep it invisible until pos is computed.
  const [pos, setPos] = useState(null);

  const recompute = useCallback(() => {
    const trigger = triggerRef?.current;
    const menu    = menuRef.current;
    if (!trigger || !menu) return;

    const t  = trigger.getBoundingClientRect();
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const roomBelow = vh - t.bottom - VIEWPORT_PADDING;
    const roomAbove = t.top - VIEWPORT_PADDING;
    // Open below by default. Flip above only when there isn't enough
    // room below AND above has more.
    const placement = (mh + offset > roomBelow && roomAbove > roomBelow) ? 'top' : 'bottom';

    const top = placement === 'bottom'
      ? t.bottom + offset
      : t.top    - offset - mh;

    let left;
    let width;
    if (align === 'stretch') {
      left  = t.left;
      width = t.width;
    } else if (align === 'left') {
      left  = t.left;
      width = undefined;
    } else {
      left  = t.right - mw;
      width = undefined;
    }

    if (left + mw > vw - VIEWPORT_PADDING) left = vw - mw - VIEWPORT_PADDING;
    if (left < VIEWPORT_PADDING)            left = VIEWPORT_PADDING;

    const cap = placement === 'bottom'
      ? Math.max(120, roomBelow)
      : Math.max(120, roomAbove);
    const effectiveMaxHeight = Math.min(maxHeight ?? Infinity, cap);

    setPos({ top, left, width, placement, maxHeight: effectiveMaxHeight });
  }, [triggerRef, align, offset, maxHeight]);

  // Measure & position synchronously after first DOM commit, then again on
  // scroll/resize. Using useLayoutEffect (not useEffect) so the menu
  // doesn't flash in the wrong place before being positioned.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    recompute();
    let raf = 0;
    const onWin = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin);
    };
  }, [open, recompute]);

  // Click-outside + Escape. The consumer owns `open` — we just call
  // onClose() when the user dismisses.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      const trigger = triggerRef?.current;
      const menu    = menuRef.current;
      if (trigger && trigger.contains(e.target)) return;
      if (menu    && menu.contains(e.target))    return;
      onClose?.();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    // pointerdown fires for both mouse and touch; sits before `click` so
    // the menu closes snappily, and avoids the case where the next click
    // target receives an unintended event.
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open || typeof document === 'undefined') return null;

  // First frame after open: pos is null → render menu in DOM but invisible
  // so the next useLayoutEffect can measure it and set the real position.
  const style = pos
    ? {
        position: 'fixed',
        top:  pos.top,
        left: pos.left,
        width: pos.width,
        minWidth,
        maxHeight: pos.maxHeight,
        overflowY: 'auto',
        zIndex,
        ...extraStyle,
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        minWidth,
        zIndex,
        visibility: 'hidden',
        pointerEvents: 'none',
        ...extraStyle,
      };

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      style={style}
      data-placement={pos?.placement}
      // Mousedown inside the menu should never bubble up to a parent that
      // treats it as "outside" (e.g. the legacy outside-click handlers
      // some pages still have).
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
