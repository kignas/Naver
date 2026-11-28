import { useEffect } from 'react';
import { useAppNav } from '../../lib/navigation';

interface CartLocationModalProps {
  onClose: () => void;
}

/** Port of `#ct-location-modal` (cart.html:271). */
export function CartLocationModal({ onClose }: CartLocationModalProps) {
  const nav = useAppNav();

  useEffect(() => {
    document.body.classList.add('ct-location-modal-open');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('ct-location-modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      className="ct-location-modal"
      id="ct-location-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-location-title"
      aria-describedby="ct-location-copy"
    >
      <div className="ct-location-backdrop" onClick={onClose} />
      <section className="ct-location-dialog">
        <div className="ct-location-art" aria-hidden="true">
          <i className="fa-solid fa-location-dot" />
          <span />
        </div>
        <p className="ct-location-eyebrow">PRECISE DELIVERY PRICING</p>
        <h2 id="ct-location-title">Where should we deliver?</h2>
        <p id="ct-location-copy">
          Navereat needs your delivery location to check the restaurant&apos;s service area and calculate the correct
          delivery charge. Without a precise location, the price may be wrong.
        </p>
        <div className="ct-location-points">
          <div>
            <i className="fa-solid fa-route" />
            <span>Accurate restaurant distance</span>
          </div>
          <div>
            <i className="fa-solid fa-indian-rupee-sign" />
            <span>Correct delivery charges</span>
          </div>
          <div>
            <i className="fa-solid fa-shield-halved" />
            <span>Confirm delivery availability</span>
          </div>
        </div>
        <button
          className="ct-location-primary"
          type="button"
          onClick={() => {
            onClose();
            nav.push('/address?return=cart');
          }}
        >
          Allow location / Set delivery address <i className="fa-solid fa-arrow-right" />
        </button>
        <p className="ct-location-footnote">
          You can allow device location or select your exact spot on the map. We use it to calculate delivery, not to
          change your order.
        </p>
      </section>
    </div>
  );
}
