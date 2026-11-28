import { createPortal } from 'react-dom';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Icon } from './Icon';
import { registerSheet } from '../lib/sheetStack';
import { lockPageScroll } from '../lib/scrollLock';
import { gsap, prefersReducedMotion, SHEET_EASE, SHEET_IN_DURATION, SHEET_OUT_DURATION } from '../lib/gsap';

export interface SheetHandle {
  close: () => void;
}

export type SheetVariant = 'ct' | 'filter' | 'customize' | 'ctp';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  variant?: SheetVariant;
  tabs?: ReactNode;
  headerAction?: ReactNode;
  headerContent?: ReactNode;
  ariaLabel?: string;
  id?: string;
  titleId?: string;
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
    headerContent,
    ariaLabel,
    id,
    titleId,
    rootClassName = '',
    sheetClassName = '',
    bodyClassName = '',
    floatingClose = false,
    hideHeader = false,
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // The element GSAP slides. For the filter variant sheetRef is the backdrop
  // root, so the panel is tracked separately.
  const panelRef = useRef<HTMLDivElement | null>(null);
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
    const reduced = prefersReducedMotion();
    const panel = panelRef.current;
    if (panel && !reduced) {
      // From wherever the drag left it, so a flick closes without snapping.
      gsap.to(panel, {
        y: window.innerHeight || 800,
        yPercent: 0,
        duration: SHEET_OUT_DURATION,
        ease: 'power3.in',
        overwrite: 'auto',
      });
    }
    dragYRef.current = 0;
    closeTimer.current = window.setTimeout(
      () => onCloseRef.current(),
      reduced ? 0 : SHEET_OUT_DURATION * 1000,
    );
  }, []);

  useImperativeHandle(ref, () => ({ close: requestClose }), [requestClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Sheets rise from below the screen and settle with power3.out.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || prefersReducedMotion()) return;
    gsap.fromTo(
      panel,
      { yPercent: 100, y: 0 },
      { yPercent: 0, duration: SHEET_IN_DURATION, ease: SHEET_EASE, overwrite: 'auto' },
    );
  }, []);

  useEffect(() => {
    const body = document.body;
    const variantClass =
      variant === 'filter' ? 'filter-sheet-open' : variant === 'customize' ? 'u99-cust-open ewcs-custom-open' : 'ct-sheet-open';
    body.classList.add('nb-sheet-open', ...variantClass.split(' '));
    const unlock = lockPageScroll();
    return () => {
      unlock();
      body.classList.remove('nb-sheet-open', 'filter-sheet-open', 'ct-sheet-open', 'u99-cust-open', 'ewcs-custom-open');
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
        root.querySelector<HTMLElement>('.ewcs-close') ??
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
    const panel = panelRef.current;
    if (panel) gsap.killTweensOf(panel);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const distance = Math.max(0, event.clientY - startY.current);
    dragYRef.current = distance;
    const panel = panelRef.current;
    if (panel) gsap.set(panel, { y: distance });
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (startY.current === null) return;
    const shouldClose = dragYRef.current > 110;
    startY.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
    if (shouldClose) {
      requestClose();
      return;
    }
    dragYRef.current = 0;
    const panel = panelRef.current;
    if (panel) gsap.to(panel, { y: 0, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
  };

  const dragProps = {
    onPointerDown: beginDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  const content = variant === 'ctp' ? (
    <div className={`ct-sheet-root ctp-root nb-sheet${visible ? ' is-open' : ''}`} role="presentation">
      <div className="ct-scrim" onClick={requestClose} />
      <button aria-label="Close" className="ctp-x" data-autofocus type="button" onClick={requestClose}>
        <Icon name="solid:xmark" size={17} />
      </button>
      <div
        className={`ct-sheet ctp-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={(element) => {
          sheetRef.current = element;
          panelRef.current = element;
        }}
      >
        <h2 className="ctp-title" id={titleId}>{title}</h2>
        <div className={bodyClassName || undefined} id={id ? `${id}-body` : undefined}>
          {children}
        </div>
      </div>
    </div>
  ) : variant === 'customize' ? (
    <>
      <div className={`ewcs-backdrop${visible ? ' show' : ''}`} onClick={requestClose} />
      <div
        id={id}
        className={`ewcs-sheet${visible ? ' show' : ''}${sheetClassName ? ` ${sheetClassName}` : ''}`}
        ref={(element) => {
          sheetRef.current = element;
          panelRef.current = element;
        }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
      >
        <div className="ewcs-handle sheet-drag-handle" aria-hidden="true" {...dragProps} />
        <div className="ewcs-head sheet-drag-handle" {...dragProps}>
          <div className="ewcs-htitle">
            {headerContent ?? <h3>{title}</h3>}
          </div>
          <button className="ewcs-close" type="button" aria-label="Close" onClick={requestClose}>
            ✕
          </button>
        </div>
        <div className="ewcs-body">{children}</div>
        {footer && <div className="ewcs-foot">{footer}</div>}
      </div>
    </>
  ) : variant === 'filter' ? (
    <div
      className={`filter-sheet nb-sheet${visible ? ' open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      ref={sheetRef}
    >
        <div className="sheet-backdrop" onClick={requestClose} />
        <div className="sheet-panel" ref={panelRef}>
          <div className="sheet-grabber sheet-drag-handle" aria-hidden="true" {...dragProps} />
          <div className="sheet-head sheet-drag-handle" {...dragProps}>
            <h3 className="sheet-title" id={titleId}>{title}</h3>
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
      <div
        className={`ct-sheet ${sheetClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        ref={(element) => {
          sheetRef.current = element;
          panelRef.current = element;
        }}
      >
        {!hideHeader && (
          <>
            <div className="ct-sheet-grab sheet-drag-handle" aria-hidden="true" {...dragProps} />
            <div className="ct-sheet-head sheet-drag-handle" {...dragProps}>
              <h2 className="ct-sheet-title" id={titleId}>{title}</h2>
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
