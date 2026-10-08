import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

let openSheets = 0;
const lockScroll = (lock) => {
  openSheets += lock ? 1 : -1;
  document.documentElement.classList.toggle('scroll-locked', openSheets > 0);
};

/**
 * Bottom sheet (mobile) / centered dialog (desktop).
 * Swipe the handle/header down to dismiss.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer, className, labelledBy }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf2;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    lockScroll(true);
    return () => lockScroll(false);
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const onPointerDown = (e) => {
    if (e.target.closest('button')) return;
    drag.current = { startY: e.clientY, dy: 0 };
    panelRef.current.style.transition = 'none';
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panelRef.current.style.transition = '';
    panelRef.current.style.transform = '';
    if (dy > 90) onClose?.();
  };

  return createPortal(
    <div className={clsx('sheet-root', visible && 'is-visible')}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        className={clsx('sheet', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div
          className="sheet__head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet__handle" />
          {title && (
            <div className="sheet__titlebar">
              <div>
                <h3 className="sheet__title" id={labelledBy}>{title}</h3>
                {subtitle && <p className="sheet__subtitle">{subtitle}</p>}
              </div>
              <button type="button" className="icon-btn icon-btn--sm" onClick={onClose} aria-label="Sluiten">
                <X size={18} />
              </button>
            </div>
          )}
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
