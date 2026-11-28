import { useState } from 'react';
import {
  clearScenarios,
  readScenarios,
  scenarioPanelEnabled,
  writeScenarios,
  type CouponScenario,
  type DemoScenarios,
  type PaymentScenario,
} from '../api/scenarios';

const BOOLEANS: Array<{ key: keyof DemoScenarios; label: string }> = [
  { key: 'closed', label: 'Restaurant closed' },
  { key: 'outOfStock', label: 'Item out of stock' },
  { key: 'quoteError', label: 'Quote network error' },
  { key: 'slow', label: 'Slow network' },
  { key: 'emptyCart', label: 'Empty cart' },
  { key: 'zoneFees', label: 'Zone fees + tax (off = zero fees)' },
];

const SELECTS: Array<{ key: 'offer' | 'coupon' | 'freeDelivery' | 'address' | 'payment'; label: string; values: string[] }> = [
  { key: 'offer', label: 'Offer popup', values: ['default', 'on', 'off'] },
  { key: 'coupon', label: 'Coupon', values: ['default', 'valid', 'invalid', 'expired'] },
  { key: 'freeDelivery', label: 'Free delivery', values: ['default', 'reached', 'not'] },
  { key: 'address', label: 'Address', values: ['default', 'saved', 'missing'] },
  {
    key: 'payment',
    label: 'Payment',
    values: ['default', 'success', 'failure', 'pending', 'cod', 'verifySlow', 'verifyFlaky', 'verifyTimeout'],
  },
];

/**
 * Hidden demo switchboard. It only renders when the URL carries `?demo=…`, so
 * a normal customer never sees it.
 */
export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState<DemoScenarios>(() => readScenarios());
  if (!scenarioPanelEnabled()) return null;

  const apply = (patch: Partial<DemoScenarios>) => {
    const next = { ...scenarios, ...patch };
    setScenarios(next);
    writeScenarios(next);
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        className="demo-fab"
        aria-label="Demo scenarios"
        onClick={() => setOpen((value) => !value)}
      >
        DEMO
      </button>
      {open ? (
        <div className="demo-panel" role="dialog" aria-label="Demo scenarios">
          <header>
            <strong>Demo scenarios</strong>
            <button
              type="button"
              onClick={() => {
                clearScenarios();
                window.location.reload();
              }}
            >
              Reset
            </button>
          </header>
          {BOOLEANS.map(({ key, label }) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(scenarios[key])}
                onChange={(event) => apply({ [key]: event.target.checked } as Partial<DemoScenarios>)}
              />
              {label}
            </label>
          ))}
          {SELECTS.map(({ key, label, values }) => (
            <label key={key}>
              {label}
              <select
                value={(scenarios[key] as string) ?? 'default'}
                onChange={(event) =>
                  apply({ [key]: event.target.value === 'default' ? null : event.target.value } as Partial<DemoScenarios>)
                }
              >
                {values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}
    </>
  );
}

export type { CouponScenario, PaymentScenario };
