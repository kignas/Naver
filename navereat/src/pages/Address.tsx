import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/restaurantApi';
import type { Address as AddressModel } from '../api/restaurantApi';
import { useAppNav } from '../lib/navigation';
import { createRouteStyleSheet } from '../lib/routeStyles';
import { toast } from '../store/toastStore';
import { announceAddressChange } from '../lib/checkoutAddress';
import addressBundleCss from '../styles/original/address.bundle.css?raw';

const SELECTED_ADDRESS_KEY = 'nearbite_selected_address_id';

const hashQuery = (): URLSearchParams => new URLSearchParams(window.location.hash.split('?')[1] ?? '');

const backIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12H4.5M10.5 18l-6-6 6-6" />
  </svg>
);

const homeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16M6 20v-7.5L12 7l6 5.5V20M9 20v-4h6v4" />
  </svg>
);
const workIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V8l7-4v16M11 20V6l9 3v11" />
  </svg>
);
const checkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const dotsIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="19" r="1.7" />
  </svg>
);

const EMPTY_FORM = {
  tag: 'Home',
  house: '',
  area: '',
  city: '',
  pincode: '',
  receiverName: '',
  receiverPhone: '',
};

type FormState = typeof EMPTY_FORM;

export default function Address() {
  const nav = useAppNav();
  const [list, setList] = useState<AddressModel[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const returnTo = hashQuery().get('return') ?? '';

  const load = useCallback(async () => {
    const [addresses, selectedId] = await Promise.all([api.getAddresses(), Promise.resolve(localStorage.getItem(SELECTED_ADDRESS_KEY) ?? '')]);
    setList(addresses);
    setSelected(selectedId || addresses.find((entry) => entry.isDefault)?.id || addresses[0]?.id || '');
    setLoading(false);
  }, []);

  useEffect(() => {
    const sheet = createRouteStyleSheet(addressBundleCss, 'navereatAddress');
    const detach = sheet.attach();
    // The bundle shows #selectView only for this root flag (address.js sets it).
    document.documentElement.dataset.addressView = 'select';
    void load().catch(() => setLoading(false));
    return () => {
      detach();
      delete document.documentElement.dataset.addressView;
    };
  }, [load]);

  const finish = (id: string) => {
    try {
      localStorage.setItem(SELECTED_ADDRESS_KEY, id);
      localStorage.setItem('nearbite_address', JSON.stringify(list.find((entry) => entry.id === id) ?? null));
    } catch {
      /* storage may be unavailable */
    }
    announceAddressChange();
    if (returnTo === 'cart') nav.back();
    else nav.back();
  };

  const chooseAddress = (address: AddressModel) => {
    setSelected(address.id);
    finish(address.id);
  };

  const remove = async (address: AddressModel) => {
    await api.deleteAddress(address.id);
    toast('Address removed');
    await load();
  };

  const save = async () => {
    if (!form || saving) return;
    if (!form.house.trim() || !form.area.trim() || !form.city.trim() || !/^\d{6}$/.test(form.pincode.trim())) {
      toast('Fill the address and a 6-digit PIN code', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await api.saveAddress({
        tag: form.tag || 'Home',
        house: form.house.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        receiverName: form.receiverName.trim() || undefined,
        receiverPhone: form.receiverPhone.trim() || undefined,
      });
      setForm(null);
      setSelected(saved.id);
      toast('Address saved');
      await load();
    } catch {
      toast('Could not save the address', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => (current ? { ...current, [key]: event.target.value } : current));

  return (
    <div className="page ls-view" id="selectView">
      <div className="ls-inner">
        <header className="ls-head">
          <button type="button" className="ls-back" onClick={() => nav.back()} aria-label="Back">
            {backIcon}
          </button>
          <h1 className="ls-title">Select Your Location</h1>
        </header>

        <div className="ls-actions">
          <button
            type="button"
            className="ls-action"
            onClick={() => toast('Current location is unavailable in demo mode', 'error')}
          >
            <span>Use my current location</span>
          </button>
          <button type="button" className="ls-action" onClick={() => setForm({ ...EMPTY_FORM })}>
            <span>Add a new address</span>
          </button>
        </div>

        <div className="ls-body">
          <h2 className="ls-eyebrow" id="lsSavedTitle">
            Saved Addresses
          </h2>
          {loading ? (
            <div className="ls-list" aria-busy="true">
              <div className="ls-skel" aria-hidden="true">
                <i />
                <span>
                  <i />
                  <i />
                </span>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="ls-empty" role="status">
              <p>No saved addresses yet.</p>
              <button type="button" className="ls-action" onClick={() => setForm({ ...EMPTY_FORM })}>
                Add a delivery address
              </button>
            </div>
          ) : (
            <div className="ls-list" id="lsSaved">
              {list.map((address) => {
                const isSelected = address.id === selected;
                return (
                  <div key={address.id} className={`ls-item${isSelected ? ' is-selected' : ''}`}>
                    <span className={`ls-ico${address.tag === 'Work' ? ' is-work' : ''}`} aria-hidden="true">
                      {address.tag === 'Work' ? workIcon : homeIcon}
                    </span>
                    <button type="button" className="ls-item-main" data-action="use" data-id={address.id} onClick={() => chooseAddress(address)}>
                      <span className="ls-item-title">
                        {address.tag}
                        {isSelected ? <span className="ls-current">{checkIcon}Delivering here</span> : null}
                      </span>
                      <span className="ls-item-sub">
                        {address.house}, {address.area}, {address.city} {address.pincode}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ls-more"
                      aria-label={`More options for ${address.tag}`}
                      onClick={() => void remove(address)}
                    >
                      {dotsIcon}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {form ? (
        <div className="ea-form" role="dialog" aria-modal="true" aria-labelledby="formTitle">
          <div className="ea-form-head">
            <div className="ea-form-head-row">
              <button type="button" className="ea-back" onClick={() => setForm(null)} aria-label="Back">
                {backIcon}
              </button>
              <div className="ea-head-body">
                <span className="ea-sr" id="formTitle">
                  Add delivery address
                </span>
                <p className="ea-head-line">
                  <span className="ea-head-primary">New address</span>
                </p>
              </div>
            </div>
          </div>

          <div className="ea-form-body">
            <div className="ea-form-inner">
              <section className="ea-sec">
                <h2 className="ea-sec-title">Location Details</h2>
                <div className="ea-panel">
                  <div className="ea-address-fields">
                    <div className="ea-float">
                      <input className="ea-input" id="tag" value={form.tag} onChange={set('tag')} placeholder=" " />
                      <label htmlFor="tag">Label (Home, Work…)</label>
                    </div>
                    <div className="ea-float">
                      <input className="ea-input" id="house" value={form.house} onChange={set('house')} placeholder=" " />
                      <label htmlFor="house">House / Flat / Floor *</label>
                    </div>
                    <div className="ea-float">
                      <input className="ea-input" id="area" value={form.area} onChange={set('area')} placeholder=" " />
                      <label htmlFor="area">Area / Street *</label>
                    </div>
                    <div className="ea-float">
                      <input className="ea-input" id="city" value={form.city} onChange={set('city')} placeholder=" " />
                      <label htmlFor="city">Town / City *</label>
                    </div>
                    <div className="ea-float">
                      <input className="ea-input" id="pincode" value={form.pincode} onChange={set('pincode')} inputMode="numeric" placeholder=" " />
                      <label htmlFor="pincode">PIN code *</label>
                    </div>
                  </div>
                </div>
              </section>

              <section className="ea-sec">
                <h2 className="ea-sec-title">Receiver Details</h2>
                <div className="ea-panel ea-receiver">
                  <div className="ea-receiver-fields">
                    <div className="ea-float">
                      <input className="ea-input" id="receiverName" value={form.receiverName} onChange={set('receiverName')} placeholder=" " />
                      <label htmlFor="receiverName">Receiver name</label>
                    </div>
                    <div className="ea-float">
                      <input className="ea-input" id="receiverPhone" value={form.receiverPhone} onChange={set('receiverPhone')} inputMode="tel" placeholder=" " />
                      <label htmlFor="receiverPhone">Receiver's number</label>
                    </div>
                  </div>
                </div>
              </section>

              <div className="ea-form-actions">
                <button type="button" className="ea-save" disabled={saving} onClick={() => void save()}>
                  {saving ? 'Saving…' : 'Save address'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
