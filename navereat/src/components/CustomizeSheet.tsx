import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { MenuItem } from '../data/demo';
import { CustomizeContext, type OpenCustomizeOptions } from '../lib/customizeContext';
import {
  defaultSelectionKeys,
  editKeyFor,
  groupsFor,
  isSelectionValid,
  selectionKey,
  selectionKeysFromLine,
  selectionsFor,
  unitPriceFor,
} from '../lib/customization';
import { useAppStore } from '../store/appStore';
import { Sheet, type SheetHandle } from './Sheet';
import '../styles/original/ew-customize-sheet.css';

interface CustomizeRequest {
  item: MenuItem;
  resId: number;
  editKey: string | null;
  nonce: number;
}

export function CustomizeProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CustomizeRequest | null>(null);
  const nonce = useRef(0);

  const openCustomize = useCallback((item: MenuItem, resId: number, options: OpenCustomizeOptions = {}) => {
    const cart = useAppStore.getState().cart;
    const editKey = options.editKey ?? (options.editExisting ? editKeyFor(cart, item) : null);
    nonce.current += 1;
    setRequest({ item, resId, editKey, nonce: nonce.current });
  }, []);

  return (
    <CustomizeContext.Provider value={{ openCustomize }}>
      {children}
      {request && (
        <CustomizeSheet
          key={`${request.item.id}-${request.editKey ?? 'new'}-${request.nonce}`}
          item={request.item}
          resId={request.resId}
          editKey={request.editKey}
          onClose={() => setRequest(null)}
        />
      )}
    </CustomizeContext.Provider>
  );
}

function money(value: number): string {
  return `₹${Math.round(Number(value) || 0)}`;
}

function CustomizeSheet({
  item,
  resId,
  editKey,
  onClose,
}: {
  item: MenuItem;
  resId: number;
  editKey: string | null;
  onClose: () => void;
}) {
  const cart = useAppStore((state) => state.cart);
  const addCustomizedItem = useAppStore((state) => state.addCustomizedItem);
  const editEntry = editKey ? cart[editKey] : undefined;
  const groups = groupsFor(item);
  const [qty, setQty] = useState(() => (editEntry ? Math.min(20, Math.max(1, Number(editEntry.quantity) || 1)) : 1));
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    editEntry ? selectionKeysFromLine(item, editEntry) : defaultSelectionKeys(item),
  );
  const qtyRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const selections = selectionsFor(item, selectedKeys);
  const valid = isSelectionValid(item, selections);
  const unit = unitPriceFor(item, selections);

  const animateQty = (direction: 'up' | 'down') => {
    const element = qtyRef.current;
    if (!element || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    element.classList.remove('ewcs-qty-slide-up', 'ewcs-qty-slide-down');
    void element.offsetWidth;
    element.classList.add(direction === 'up' ? 'ewcs-qty-slide-up' : 'ewcs-qty-slide-down');
  };

  const changeQty = (delta: number) => {
    setQty((current) => {
      const next = Math.max(0, Math.min(20, current + delta));
      if (next !== current) animateQty(delta > 0 ? 'up' : 'down');
      return next;
    });
  };

  const toggle = (groupIndex: number, optionIndex: number, max: number) => {
    setSelectedKeys((current) => {
      const key = selectionKey(groupIndex, optionIndex);
      const next = new Set(current);
      if (max <= 1) {
        if (current.has(key)) return current;
        groups[groupIndex]?.options.forEach((_, index) => next.delete(selectionKey(groupIndex, index)));
        next.add(key);
        return next;
      }
      if (next.has(key)) next.delete(key);
      else {
        const count = [...next].filter((entry) => entry.startsWith(`${groupIndex}:`)).length;
        if (count < max) next.add(key);
      }
      return next;
    });
  };

  const confirm = () => {
    if (!valid) return;
    addCustomizedItem(item, resId, selections, qty, editKey);
    sheetRef.current?.close();
  };

  const actionLabel =
    qty === 0
      ? 'Remove item'
      : valid
        ? `${editKey ? 'Update item' : 'Add item'} · ${money(unit * qty)}`
        : 'Select required options';

  return (
    <Sheet
      ref={sheetRef}
      id="ewcs-sheet"
      variant="customize"
      title={item.name}
      ariaLabel={`Customise ${item.name}`}
      onClose={onClose}
      headerContent={
        <>
          {item.image && (
            <img
              className="ewcs-thumb"
              src={item.image}
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
          <span className={`ewcs-vegdot ${item.isVeg ? 'v' : 'n'}`} aria-hidden="true" />
          <h3>{item.name}</h3>
        </>
      }
      footer={
        <>
          <div className="ewcs-qty">
            <button type="button" onClick={() => changeQty(-1)} aria-label="Decrease quantity">
              −
            </button>
            <span ref={qtyRef}>{qty}</span>
            <button type="button" onClick={() => changeQty(1)} aria-label="Increase quantity">
              +
            </button>
          </div>
          <button className="ewcs-add" type="button" disabled={!valid} onClick={confirm}>
            {actionLabel}
          </button>
        </>
      }
    >
      {groups.map((group, groupIndex) => {
        const max = Math.max(1, Number(group.maxSelect) || 1);
        const multi = max > 1;
        const required = Boolean(group.required);
        const pricingMode = group.pricingMode === 'portion' ? 'portion' : 'extra';
        const checkedCount = selections.filter((selection) => selection.groupIndex === groupIndex).length;
        const full = multi && checkedCount >= max;
        return (
          <div
            className="ewcs-group"
            data-gi={groupIndex}
            data-max={max}
            data-required={required ? 1 : 0}
            data-multi={multi ? 1 : 0}
            data-pricing-mode={pricingMode}
            data-title={group.title}
            key={`${group.title}-${groupIndex}`}
          >
            <div className="ewcs-gtitle">{group.title}</div>
            <div className="ewcs-grule">
              {required && <span className="req">Required</span>}
              {required && ' · '}
              {multi ? `Select up to ${max}` : 'Select 1'}
            </div>
            {group.options.map((option, optionIndex) => {
              const key = selectionKey(groupIndex, optionIndex);
              const checked = selectedKeys.has(key);
              const extra = Number(option.extraPrice) || 0;
              const priceText =
                pricingMode === 'portion'
                  ? money(extra)
                  : extra > 0
                    ? `+${money(extra)}`
                    : required || multi
                      ? 'Free'
                      : '';
              return (
                <label className="ewcs-opt" key={`${option.label}-${optionIndex}`}>
                  <span className={`veg ${option.isVeg === false ? 'n' : 'v'}`} aria-hidden="true" />
                  <span className="lbl">{option.label}</span>
                  {priceText && <span className={`pr ${extra > 0 ? '' : 'free'}`}>{priceText}</span>}
                  <input
                    type={multi ? 'checkbox' : 'radio'}
                    name={`ewcs-g${groupIndex}`}
                    value={optionIndex}
                    checked={checked}
                    disabled={multi && full && !checked}
                    onChange={() => toggle(groupIndex, optionIndex, max)}
                  />
                </label>
              );
            })}
          </div>
        );
      })}
    </Sheet>
  );
}
