import { useRef } from 'react';
import { Sheet, type SheetHandle } from './Sheet';

export type MockPaymentOutcome = 'success' | 'failure' | 'pending';

interface MockPaymentSheetProps {
  orderId: string;
  amount: number;
  onResult: (outcome: MockPaymentOutcome) => void;
  onClose: () => void;
}

/**
 * Demo stand-in for the Razorpay checkout. The real gateway is never loaded in
 * demo mode; this sheet lets all three result pages be reached.
 */
export function MockPaymentSheet({ orderId, amount, onResult, onClose }: MockPaymentSheetProps) {
  const sheetRef = useRef<SheetHandle>(null);
  return (
    <Sheet
      ref={sheetRef}
      id="mock-payment-sheet"
      titleId="mock-payment-title"
      title="Mock payment"
      onClose={onClose}
      footerClassName="is-single"
      footer={
        <button className="ct-btn ct-btn-ghost" type="button" onClick={onClose}>
          Cancel payment
        </button>
      }
    >
      <p className="ct-field-help" id="mock-payment-copy">
        Demo mode: no gateway is loaded. Order <b>{orderId}</b> for <b>₹{Math.round(amount)}</b>. Choose the
        result the gateway should return.
      </p>
      <div className="ct-pay-opts" role="group" aria-label="Simulated payment result">
        <button className="ct-btn ct-btn-primary" type="button" data-mock-pay="success" onClick={() => onResult('success')}>
          Simulate success
        </button>
        <button className="ct-btn ct-btn-ghost" type="button" data-mock-pay="failure" onClick={() => onResult('failure')}>
          Simulate failure
        </button>
        <button className="ct-btn ct-btn-ghost" type="button" data-mock-pay="pending" onClick={() => onResult('pending')}>
          Simulate pending
        </button>
      </div>
    </Sheet>
  );
}
