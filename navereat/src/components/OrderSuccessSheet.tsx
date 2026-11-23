import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import badgeSvg from '../assets/order-success-badge.svg?raw';
import planeSvg from '../assets/order-success-plane.svg?raw';
import { registerSheet } from '../lib/sheetStack';
import { lockPageScroll } from '../lib/scrollLock';
import '../styles/original/order-success-sheet.css';

type Stage = 'processing' | 'speed' | 'placed';

export interface OrderSuccessHandle {
  processing: (options?: { title?: string; message?: string }) => void;
  show: () => void;
}

interface OrderSuccessSheetProps {
  onContinue: () => void;
  autoMs?: number;
}

const PROC_MIN_MS = 1500;
const SPEED_MS = 500;
const GREEN_STAY_MS = 2000;
const CONF_COLORS = ['#FFFFFF', '#FDE68A', '#BAE6FD', '#FBCFE8', '#FACC15', '#FFFFFF', '#A7F3D0'];

function confettiStyle(index: number, total: number): CSSProperties {
  const angle = (index / total) * Math.PI * 2 + ((index % 3) - 1) * 0.12;
  const radius = 96 + ((index * 37) % 5) * 16;
  const pill = index % 3 === 1;
  const width = pill ? 4 : 5 + (index % 4);
  const height = pill ? 10 : 5 + (index % 4);
  return {
    '--c': CONF_COLORS[index % CONF_COLORS.length],
    '--dx': `${Math.round(Math.sin(angle) * radius * 1.15)}px`,
    '--dy': `${Math.max(-104, Math.round(-Math.cos(angle) * radius * 0.8))}px`,
    '--r': `${(index % 2 ? 1 : -1) * (180 + ((index * 53) % 220))}deg`,
    '--w': `${width}px`,
    '--h': `${height}px`,
    '--br': pill ? '2px' : '50%',
    '--d': `${(index % 4) * 0.025}s`,
  } as CSSProperties;
}

const CONFETTI = Array.from({ length: 18 }, (_, index) => (
  <i key={index} style={confettiStyle(index, 18)} />
));

export const OrderSuccessSheet = forwardRef<OrderSuccessHandle, OrderSuccessSheetProps>(
  function OrderSuccessSheet({ onContinue, autoMs = GREEN_STAY_MS }, ref) {
    const [stage, setStage] = useState<Stage | null>(null);
    const [entered, setEntered] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [title, setTitle] = useState('Processing');
    const [message, setMessage] = useState('Placing your order');
    const timers = useRef<number[]>([]);
    const stageRef = useRef<Stage | null>(null);
    const continuedRef = useRef(false);
    const onContinueRef = useRef(onContinue);

    useEffect(() => {
      onContinueRef.current = onContinue;
    }, [onContinue]);

    useEffect(() => {
      stageRef.current = stage;
    }, [stage]);

    const clearTimers = useCallback(() => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    }, []);

    const finish = useCallback(() => {
      if (stageRef.current !== 'placed' || continuedRef.current) return;
      continuedRef.current = true;
      clearTimers();
      setLeaving(true);
      window.setTimeout(() => {
        setStage(null);
        setEntered(false);
        setLeaving(false);
        onContinueRef.current();
      }, 260);
    }, [clearTimers]);

    const open = useCallback(() => {
      clearTimers();
      continuedRef.current = false;
      setLeaving(false);
      setStage('processing');
      setTitle('Processing');
      setMessage('Placing your order');
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => setEntered(true)));
      timers.current.push(
        window.setTimeout(() => {
          setStage('speed');
        }, PROC_MIN_MS),
      );
      timers.current.push(
        window.setTimeout(() => {
          setStage('placed');
          setTitle('Order placed');
          setMessage('The restaurant is getting your order ready.');
          if (navigator.vibrate) navigator.vibrate([18, 40, 22]);
        }, PROC_MIN_MS + SPEED_MS),
      );
      if (autoMs > 0) {
        timers.current.push(
          window.setTimeout(() => {
            finish();
          }, PROC_MIN_MS + SPEED_MS + 650 + autoMs),
        );
      }
    }, [autoMs, clearTimers, finish]);

    useImperativeHandle(
      ref,
      () => ({
        processing: open,
        show: () => {
          clearTimers();
          continuedRef.current = false;
          setLeaving(false);
          setStage('placed');
          setTitle('Order placed');
          setMessage('The restaurant is getting your order ready.');
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => setEntered(true)));
          if (autoMs > 0) timers.current.push(window.setTimeout(finish, 650 + autoMs));
        },
      }),
      [autoMs, clearTimers, finish, open],
    );

    useEffect(() => {
      if (!stage) return;
      return lockPageScroll();
    }, [stage]);

    useEffect(() => {
      if (stage !== 'placed') return;
      const unregister = registerSheet(finish);
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish();
        }
      };
      document.addEventListener('keydown', onKeyDown, true);
      return () => {
        unregister();
        document.removeEventListener('keydown', onKeyDown, true);
      };
    }, [finish, stage]);

    useEffect(() => () => clearTimers(), [clearTimers]);

    if (!stage) return null;

    const rootClass = [
      'ew-os',
      stage === 'placed' ? 'ew-os--done' : 'ew-os--proc',
      stage === 'speed' ? 'ew-os--speed' : '',
      entered ? 'is-open' : '',
      leaving ? 'is-leaving' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return createPortal(
      <div
        className={rootClass}
        role={stage === 'placed' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="ew-os-title"
        aria-busy={stage === 'placed' ? undefined : 'true'}
      >
        <div className="ew-os__scrim" onClick={finish} />
        <div className="ew-os__sheet" tabIndex={-1}>
          <div className="ew-os__wash">
            <div className="ew-os__wash-fill" />
          </div>
          <span className="ew-os__grab" />
          <div className="ew-os__hero">
            <div className="ew-os__flyer">
              <span className="ew-os__shadow" />
              <div className="ew-os__craft">
                <div className="ew-os__float" dangerouslySetInnerHTML={{ __html: planeSvg }} />
              </div>
            </div>
            <span className="ew-os__pulse" />
            <span className="ew-os__ring" />
            <span className="ew-os__ring ew-os__ring--2" />
            <div className="ew-os__confetti">{CONFETTI}</div>
            <span dangerouslySetInnerHTML={{ __html: badgeSvg }} />
          </div>
          <h2 className={`ew-os__title${stage === 'placed' ? '' : ' ew-os__title--proc'}`} id="ew-os-title">
            {title}
          </h2>
          <p className="ew-os__msg" role="status">
            {message}
          </p>
          <div className="ew-os__actions">
            <button className="ew-os__btn" type="button" onClick={finish}>
              Track my order
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  },
);
