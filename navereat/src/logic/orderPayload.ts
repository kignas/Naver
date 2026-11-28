/**
 * Port of `order-payload.js`: the one place that turns the local cart plus
 * checkout extras into the exact JSON body sent to POST /orders.
 */
export interface OrderCartLine {
  menuItem?: string | number;
  price?: number | string;
  quantity?: number | string;
  customizations?: unknown;
  resId?: string | number;
  restaurantName?: string;
  resName?: string;
}

export type OrderCart = Record<string, OrderCartLine>;

export interface OrderItem {
  menuItem: string | number | null;
  name: string;
  price: number | string | undefined;
  quantity: number | string | undefined;
  customizations: unknown;
}

export interface OrderPayloadOptions {
  items?: OrderItem[];
  restaurantId?: string | number | null;
  restaurantName?: string;
  deliveryAddress?: unknown;
  addressId?: string | number | null;
  subtotal?: number | string;
  deliveryFee?: number | string;
  paymentMethod?: string;
  restaurantNote?: string;
  restaurantNotes?: Record<string, unknown>;
  deliveryInstructions?: string;
  tipAmount?: number | string;
  couponCode?: string;
  quoteId?: string | number;
}

export interface OrderPayload {
  items: OrderItem[];
  deliveryAddress: unknown;
  addressId: string | number | null;
  restaurantId: string | number | null;
  restaurantName: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'upi' | 'cod';
  restaurantNote: string;
  deliveryInstructions: string;
  tipAmount: number;
  couponCode: string;
  restaurantNotes?: Record<string, unknown>;
  quoteId?: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Menu items from the saved cart. `menuItem` is preserved exactly as stored. */
export function buildItems(cart: OrderCart | null | undefined): OrderItem[] {
  const items: OrderItem[] = [];
  const src = cart && typeof cart === 'object' ? cart : {};
  Object.keys(src).forEach((name) => {
    const info = src[name] || {};
    items.push({
      menuItem: info.menuItem && String(info.menuItem) !== 'undefined' ? info.menuItem : null,
      name,
      price: info.price,
      quantity: info.quantity,
      customizations: info.customizations || {},
    });
  });
  return items;
}

export const previewSubtotal = (items: OrderItem[] | null | undefined): number =>
  (items || []).reduce((sum, item) => sum + num(item.price) * num(item.quantity), 0);

export function restaurantIdFrom(cart: OrderCart | null | undefined): string | number | null {
  const src = cart && typeof cart === 'object' ? cart : {};
  let id: string | number | null = null;
  Object.keys(src).forEach((name) => {
    const info = src[name] || {};
    if (!id && info.resId && String(info.resId) !== 'undefined' && String(info.resId) !== 'null') id = info.resId as string | number;
  });
  return id;
}

export function restaurantNameFrom(cart: OrderCart | null | undefined): string {
  const src = cart && typeof cart === 'object' ? cart : {};
  let name = '';
  Object.keys(src).forEach((key) => {
    const info = src[key] || {};
    if (!name && info.restaurantName) name = info.restaurantName;
    if (!name && info.resName) name = info.resName;
  });
  return name;
}

export function build(cart: OrderCart | null | undefined, opts: OrderPayloadOptions | null | undefined): OrderPayload {
  const o = opts || {};
  const items = Array.isArray(o.items) ? o.items : buildItems(cart);
  const subtotal = o.subtotal != null ? num(o.subtotal) : previewSubtotal(items);
  const deliveryFee = num(o.deliveryFee);
  const method: 'upi' | 'cod' = String(o.paymentMethod || 'upi').toLowerCase() === 'cod' ? 'cod' : 'upi';

  const payload: OrderPayload = {
    items,
    deliveryAddress: o.deliveryAddress || null,
    addressId: o.addressId || null,
    restaurantId: o.restaurantId || null,
    restaurantName: o.restaurantName || '',
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    paymentMethod: method,
    restaurantNote: o.restaurantNote || '',
    deliveryInstructions: o.deliveryInstructions || '',
    tipAmount: num(o.tipAmount),
    couponCode: String(o.couponCode || ''),
  };

  const notes = o.restaurantNotes;
  if (notes && typeof notes === 'object' && Object.keys(notes).length) {
    payload.restaurantNotes = notes;
  }
  if (o.quoteId) payload.quoteId = String(o.quoteId);
  return payload;
}

export const orderPayload = { build, buildItems, previewSubtotal, restaurantIdFrom, restaurantNameFrom };
