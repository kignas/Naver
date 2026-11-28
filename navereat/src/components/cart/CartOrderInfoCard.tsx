import { memo } from 'react';
import { Icon } from '../Icon';
import { toast } from '../../store/toastStore';
import { CartBillRow } from './CartBillRow';
import { chevron, clockIcon } from './cartIcons';


const DI_PRESETS = [
  {
    label: 'Directions to reach',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    label: 'Leave at the door',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4 21h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="14" cy="13" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'Avoid calling',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6c0 8 6 14 14 14l-1-3.5-3.5-1-1.5 1.5c-2.6-1.3-4.7-3.4-6-6L11 9.5 10 6H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Avoid ringing',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 16V11a5.5 5.5 0 0 1 11 0v5l1.5 2H5l1.5-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Leave at gate',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 21V10l9-6 9 6v11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

interface CartOrderInfoCardProps {
  eta: string;
  displayName: string;
  phone: string;
  instructions: string[];
  diOpen: boolean;
  onToggleDi: () => void;
  onToggleInstruction: (label: string) => void;
  tip: number;
  unavailable: boolean;
  onOpenBill: () => void;
  addressTag: string;
  addressLine: string;
  /** Legacy `hasAddress()`: house + area + usable coordinates. */
  addressOk: boolean;
  loggedIn: boolean;
  onChangeAddress: () => void;
}

export const CartOrderInfoCard = memo(function CartOrderInfoCard({
  eta,
  displayName,
  phone,
  instructions,
  diOpen,
  onToggleDi,
  onToggleInstruction,
  tip,
  unavailable,
  onOpenBill,
  addressTag,
  addressLine,
  addressOk,
  loggedIn,
  onChangeAddress,
}: CartOrderInfoCardProps) {
  return (
    <section aria-label="Delivery and bill details" className="ct-oi-card" id="ct-order-info">
      <div className="ct-oi-row ct-oi-row--eta">
        <span aria-hidden="true" className="ct-oi-ic">
          {clockIcon}
        </span>
        <div className="ct-oi-copy">
          <span className="ct-oi-line">
            <span className="ct-oi-lead">Delivery in</span> <b>{eta}</b>
          </span>
          <button className="ctp-schedule-link" type="button" onClick={() => toast('Scheduling is not part of this demo')}>
            Want this later? Schedule it
          </button>
        </div>
      </div>
      <div className="ct-oi-row ct-oi-row--addr">
        <span aria-hidden="true" className="ct-oi-ic">
          <Icon name="solid:location-dot" size={22} />
        </span>
        <div className="ct-oi-copy">
          <button className="ct-oi-hit" type="button" onClick={onChangeAddress}>
            <span className="ct-oi-hit-copy">
              <span className="ct-oi-line">
                Delivery at <b>{addressOk ? addressTag : loggedIn ? 'Home' : 'Log in to order'}</b>
              </span>
              <span className={addressOk ? 'ct-oi-sub' : 'ct-oi-sub ct-prompt'}>
                {addressOk
                  ? addressLine
                  : loggedIn
                    ? 'Tap to add your delivery address'
                    : 'Log in with your phone to add a delivery address'}
              </span>
            </span>
            {chevron}
          </button>
          <button
            aria-controls="ct-oi-di-panel"
            aria-expanded={diOpen}
            className="ct-oi-dashlink"
            id="ct-oi-di-toggle"
            type="button"
            onClick={onToggleDi}
          >
            {instructions.length ? 'Delivery instructions' : 'Add instructions for delivery partner'}
            {instructions.length > 0 && (
              <span className="ct-oi-count" id="ct-di-count">
                {instructions.length}
              </span>
            )}
          </button>
        </div>
        {diOpen && (
          <div className="ct-oi-di" id="ct-oi-di-panel">
            <div aria-label="Delivery instructions" className="ct-di-pills" id="ct-di-pills" role="group">
              {DI_PRESETS.map((preset) => (
                <button
                  aria-pressed={instructions.includes(preset.label)}
                  className="ct-di-pill"
                  data-di={preset.label}
                  key={preset.label}
                  type="button"
                  onClick={() => onToggleInstruction(preset.label)}
                >
                  {preset.icon}
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="ct-oi-row ct-oi-row--link" type="button" onClick={() => toast('Contact details are part of the demo')}>
        <span aria-hidden="true" className="ct-oi-ic">
          <Icon name="solid:phone" size={22} />
        </span>
        <div className="ct-oi-copy">
          <span className="ct-oi-line">
            <span>{displayName}</span>
            <span aria-hidden="true" className="ct-oi-comma">, </span>
            <b>{phone}</b>
          </span>
          <span className="ct-oi-sub">Your rider may call this number for delivery updates</span>
        </div>
        {chevron}
      </button>
      <CartBillRow tip={tip} unavailable={unavailable} onOpenBill={onOpenBill} />
    </section>
  );
});
