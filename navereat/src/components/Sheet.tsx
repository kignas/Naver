import { createPortal } from 'react-dom';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import { registerSheet } from '../lib/sheetStack';

export interface SheetHandle {
  close: () => void;
}

export type SheetVariant = 'ct' | 'filter';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  variant?: SheetVariant;
  tabs?: ReactNode;
  headerAction?: ReactNode;
  ariaLabel?: string;
  id?: string;
  rootClassName?: string;
  sheetClassName?: string;
  bodyClassName?: string;
  floatingClose?: boolean;
  hideHeader?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet(
  {
    title,
    onClose,
    children,
    footer,
    footerClassName = '',
    variant = 'ct',
    tabs,
    headerAction,
    ariaLabel,
    id,
    rootClassName = '',
    sheetClassName = '',
    bodyClassName = '',
    floatingClose = false,
    hideHeader = false,
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const closingRef = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setDragY(0);
    dragYRef.current = 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), reduced ? 0 : 260);
  }, []);

  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.add('nb-sheet-open', variant === 'filter' ? 'filter-sheet-open' : 'ct-sheet-open');
    return () => {
      body.classList.remove('nb-sheet-open', 'filter-sheet-open', 'ct-sheet-open');
    };
  }, [variant]);

  useEffect(() => registerSheet(requestClose), [requestClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      const root = sheetRef.current;
      if (!root) return;
      const target =
        root.querySelector<HTMLElement>('input[data-autofocus], textarea[data-autofocus]') ??
        root.querySelector<HTMLElement>('[data-autofocus]') ??
        root.querySelector<HTMLElement>('.ct-sheet-x') ??
        root.querySelector<HTMLElement>('.sheet-done') ??
        root.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    }, 80);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = sheetRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !element.hasAttribute('hidden') && element.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus({ preventScroll: true });
    };
  }, [requestClose]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const beginDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (closingRef.current) return;
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    startY.current = event.clientY;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const distance = Math.max(0, event.clientY - startY.current);
    dragYRef.current = distance;
    setDragY(distance);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const shouldClose = dragYRef.current > 110;
    startY.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
    if (shouldClose) requestClose();
    else {
      dragYRef.current = 0;
      setDragY(0);
    }
  };

  const dragProps = {
    onPointerDown: beginDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  const panelStyle =
    dragY > 0
      ? { transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : undefined }
      : undefined;

  const content = variant === 'filter' ? (
    <div
      className={`filter-sheet nb-sheet${visible ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      ref={sheetRef}
    >
        <div className="sheet-backdrop" onClick={requestClose} />
        <div className="sheet-panel" style={panelStyle}>
          <div className="sheet-grabber sheet-drag-handle" aria-hidden="true" {...dragProps} />
          <div className="sheet-head sheet-drag-handle" {...dragProps}>
            <h3 className="sheet-title">{title}</h3>
            {headerAction}
          </div>
          <div className="filter-layout">
            {tabs && (
              <nav className="filter-tabs" aria-label="Filter categories">
                {tabs}
              </nav>
            )}
            <div className="filter-content">{children}</div>
          </div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </div>
    </div>
  ) : (
    <div
      id={id}
      className={`ct-sheet-root nb-sheet${visible ? ' is-open' : ''}${rootClassName ? ` ${rootClassName}` : ''}`}
      role="presentation"
    >
      <div className="ct-scrim" onClick={requestClose} />
      {floatingClose && (
        <button aria-label="Close" className="ct-cook-x" data-autofocus type="button" onClick={requestClose}>
          <Icon name="solid:xmark" size={17} />
        </button>
      )}
      <div className={`ct-sheet ${sheetClassName}`.trim()} style={panelStyle} role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} ref={sheetRef}>
        {!hideHeader && (
          <>
            <div className="ct-sheet-grab sheet-drag-handle" aria-hidden="true" {...dragProps} />
            <div className="ct-sheet-head sheet-drag-handle" {...dragProps}>
              <h2 className="ct-sheet-title">{title}</h2>
              <button aria-label="Close" className="ct-sheet-x" data-autofocus type="button" onClick={requestClose}>
                <Icon name="solid:xmark" size={16} />
              </button>
            </div>
          </>
        )}
        <div className={`ct-sheet-body ${bodyClassName}`.trim()}>{children}</div>
        {footer && <div className={`ct-sheet-foot ${footerClassName}`.trim()}>{footer}</div>}
      </div>
    </div>
  );

  return createPortal(content, document.body);
});
