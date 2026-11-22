import { create } from 'zustand';
import {
  DEMO_ADDRESS,
  PLATFORM_FEE,
  coupons as demoCoupons,
  demoOrders,
  demoUser,
  type Coupon,
  type DemoUser,
  type MenuItem,
  type Order,
  type OrderLine,
} from '../data/demo';
import { billFor, cartSubtotal, couponDiscount, type Cart } from '../lib/cart';

export const STORAGE_KEYS = {
  token: 'nearbite_token',
  cart: 'nearbite_cart',
  user: 'nearbite_user',
  orders: 'nearbite_orders',
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface ApplyCouponResult {
  ok: boolean;
  message: string;
}

interface AppState {
  token: string | null;
  user: DemoUser | null;
  cart: Cart;
  orders: Order[];
  coupon: Coupon | null;
  lastOrderId: string | null;
  selectedRestaurantId: number | null;
  login: (phone: string) => void;
  logout: () => void;
  addItem: (item: MenuItem, resId: number) => void;
  decrementItem: (name: string) => void;
  setQty: (name: string, qty: number) => void;
  removeItem: (name: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => ApplyCouponResult;
  removeCoupon: () => void;
  placeOrder: (paymentMethod: string) => Order | null;
  selectRestaurant: (id: number | null) => void;
}

const storedCart = readJSON<Cart>(STORAGE_KEYS.cart, {});
const storedOrders = readJSON<Order[]>(STORAGE_KEYS.orders, demoOrders);

export const useAppStore = create<AppState>((set, get) => ({
  token: readString(STORAGE_KEYS.token),
  user: readJSON<DemoUser | null>(STORAGE_KEYS.user, null),
  cart: storedCart,
  orders: storedOrders,
  coupon: null,
  lastOrderId: null,
  selectedRestaurantId: null,

  login: (phone) =>
    set({
      token: `demo-token-${Date.now()}`,
      user: { ...demoUser, phone: phone.trim() || demoUser.phone },
    }),

  logout: () =>
    set({
      token: null,
      user: null,
      cart: {},
      coupon: null,
      lastOrderId: null,
    }),

  addItem: (item, resId) =>
    set((state) => {
      const existing = state.cart[item.name];
      const line = existing
        ? { ...existing, quantity: existing.quantity + 1 }
        : { quantity: 1, price: item.price, resId };
      return { cart: { ...state.cart, [item.name]: line } };
    }),

  decrementItem: (name) =>
    set((state) => {
      const existing = state.cart[name];
      if (!existing) return state;
      if (existing.quantity <= 1) {
        const next = { ...state.cart };
        delete next[name];
        return { cart: next };
      }
      return { cart: { ...state.cart, [name]: { ...existing, quantity: existing.quantity - 1 } } };
    }),

  setQty: (name, qty) =>
    set((state) => {
      const existing = state.cart[name];
      if (!existing) return state;
      const next = { ...state.cart };
      if (qty <= 0) delete next[name];
      else next[name] = { ...existing, quantity: qty };
      return { cart: next };
    }),

  removeItem: (name) =>
    set((state) => {
      const next = { ...state.cart };
      delete next[name];
      return { cart: next };
    }),

  clearCart: () => set({ cart: {}, coupon: null }),

  applyCoupon: (code) => {
    const normalized = code.trim().toUpperCase();
    const coupon = demoCoupons.find((c) => c.code === normalized);
    if (!coupon) return { ok: false, message: 'Invalid coupon code' };
    const subtotal = cartSubtotal(get().cart);
    if (subtotal < coupon.minOrder) {
      return { ok: false, message: `Add items worth ₹${coupon.minOrder - subtotal} more to use ${coupon.code}` };
    }
    set({ coupon });
    return { ok: true, message: `${coupon.code} applied · ${coupon.title}` };
  },

  removeCoupon: () => set({ coupon: null }),

  placeOrder: (paymentMethod) => {
    const { cart, coupon } = get();
    const lines: OrderLine[] = Object.entries(cart).map(([name, line]) => ({
      name,
      qty: line.quantity,
      price: line.price,
    }));
    if (lines.length === 0) return null;
    const subtotal = cartSubtotal(cart);
    const discount = couponDiscount(coupon, subtotal);
    const firstLine = Object.values(cart)[0];
    const restaurantId = firstLine?.resId ?? 0;
    const restaurantName =
      get().orders.find((o) => o.restaurantId === restaurantId)?.restaurantName ??
      `Restaurant #${restaurantId}`;
    const order: Order = {
      id: `NAV-${Math.floor(100000 + Math.random() * 900000)}`,
      restaurantId,
      restaurantName,
      lines,
      subtotal,
      platformFee: PLATFORM_FEE,
      discount,
      total: Math.max(0, subtotal + PLATFORM_FEE - discount),
      status: 'confirmed',
      placedAt: new Date().toISOString(),
      eta: '30 mins',
      paymentMethod,
      address: DEMO_ADDRESS,
    };
    set((state) => ({
      orders: [order, ...state.orders],
      cart: {},
      coupon: null,
      lastOrderId: order.id,
    }));
    return order;
  },

  selectRestaurant: (id) => set({ selectedRestaurantId: id }),
}));

export const currentBill = (): ReturnType<typeof billFor> =>
  billFor(useAppStore.getState().cart, useAppStore.getState().coupon);

useAppStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart));
    localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(state.orders));
    if (state.token) localStorage.setItem(STORAGE_KEYS.token, state.token);
    else localStorage.removeItem(STORAGE_KEYS.token);
    if (state.user) localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
    else localStorage.removeItem(STORAGE_KEYS.user);
  } catch {
    /* storage may be unavailable in private mode; the demo still works in memory */
  }
});
