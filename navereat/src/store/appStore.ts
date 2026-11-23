import { create } from 'zustand';
import {
  DEMO_ADDRESS,
  PLATFORM_FEE,
  coupons as demoCoupons,
  demoOffersFor,
  demoOrders,
  demoUser,
  findRestaurant,
  type Coupon,
  type DemoUser,
  type MenuItem,
  type Order,
  type OrderLine,
} from '../data/demo';
import { billFor, cartSubtotal, couponDiscount, offerDiscountFor, type Cart, type CartLine } from '../lib/cart';
import {
  compositeNameFor,
  flatCustomizationsFor,
  labelsFor,
  unitPriceFor,
  type CustomizationSelection,
} from '../lib/customization';

const emitCartUpdated = (detail: Record<string, unknown>): void => {
  try {
    window.dispatchEvent(new CustomEvent('eatswada:cart-updated', { detail }));
  } catch {
    /* non-browser test environment */
  }
};

const notifyGlobalCart = (): void => {
  try {
    (window as Window & { updateGlobalCart?: () => void }).updateGlobalCart?.();
  } catch {
    /* non-browser test environment */
  }
};

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
  addCustomizedItem: (
    item: MenuItem,
    resId: number,
    selections: CustomizationSelection[],
    qty: number,
    editKey?: string | null,
  ) => void;
  removeCustomizedUnit: (item: MenuItem) => void;
  decrementItem: (name: string) => void;
  setQty: (name: string, qty: number) => void;
  removeItem: (name: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => ApplyCouponResult;
  removeCoupon: () => void;
  placeOrder: (paymentMethod: string, options?: { keepCart?: boolean; tip?: number }) => Order | null;
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
      const cart = Object.values(state.cart).some((line) => line.resId !== resId) ? {} : state.cart;
      const existing = cart[item.name];
      const restaurant = findRestaurant(resId);
      const line = existing
        ? {
            ...existing,
            quantity: existing.quantity + 1,
            isVeg: existing.isVeg ?? item.isVeg,
            originalPrice: existing.originalPrice ?? item.originalPrice,
            image: existing.image ?? item.image,
            resName: existing.resName ?? restaurant?.name,
            restaurantName: existing.restaurantName ?? restaurant?.name,
            menuItem: existing.menuItem ?? item.id,
            name: existing.name ?? item.name,
          }
        : {
            quantity: 1,
            price: item.price,
            resId,
            isVeg: item.isVeg,
            originalPrice: item.originalPrice,
            image: item.image,
            resName: restaurant?.name,
            restaurantName: restaurant?.name,
            menuItem: item.id,
            name: item.name,
          };
      emitCartUpdated({ source: 'addItem', itemName: item.name });
      return { cart: { ...cart, [item.name]: line } };
    }),

  addCustomizedItem: (item, resId, selections, qty, editKey = null) =>
    set((state) => {
      const cart: Cart = Object.values(state.cart).some((line) => line.resId !== resId)
        ? {}
        : { ...state.cart };
      const labels = labelsFor(selections);
      const composite = compositeNameFor(item, selections);
      const unit = unitPriceFor(item, selections);
      const restaurant = findRestaurant(resId);
      const hasPortion = selections.some((selection) => selection.pricingMode === 'portion');
      const originalPrice =
        !hasPortion && Number(item.originalPrice) > Number(item.price)
          ? Number(item.originalPrice) + (unit - Number(item.price))
          : undefined;
      const entry: CartLine = {
        quantity: Math.max(0, Math.round(qty)),
        price: unit,
        originalPrice,
        resId,
        menuItem: item.id,
        image: item.image,
        name: composite,
        isVeg: item.isVeg,
        resName: restaurant?.name,
        restaurantName: restaurant?.name,
        customizations: flatCustomizationsFor(selections),
      };

      if (entry.quantity <= 0) {
        if (editKey && cart[editKey]) delete cart[editKey];
        emitCartUpdated({ source: 'addCustomizedItem', customized: true, removed: true, itemName: item.name });
        notifyGlobalCart();
        return { cart };
      }

      if (editKey && cart[editKey]) {
        delete cart[editKey];
        if (editKey === composite) {
          cart[composite] = { ...entry };
        } else if (cart[composite]) {
          cart[composite] = {
            ...cart[composite],
            quantity: Number(cart[composite].quantity) + entry.quantity,
            price: unit,
            customizations: entry.customizations,
          };
        } else {
          cart[composite] = entry;
        }
      } else if (cart[composite]) {
        cart[composite] = {
          ...cart[composite],
          quantity: Number(cart[composite].quantity) + entry.quantity,
          price: unit,
          customizations: entry.customizations,
        };
      } else {
        cart[composite] = entry;
      }

      emitCartUpdated({ source: 'addCustomizedItem', customized: true, itemName: item.name, labels });
      notifyGlobalCart();
      return { cart };
    }),

  removeCustomizedUnit: (item) =>
    set((state) => {
      const cart = { ...state.cart };
      const keys = Object.keys(cart);
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        const line = cart[key];
        if (!line || Number(line.quantity) <= 0) continue;
        const sameId = String(line.menuItem ?? '') === item.id;
        const composite = key === item.name || key.startsWith(`${item.name} (`);
        if (!sameId && !composite) continue;
        if (Number(line.quantity) <= 1) delete cart[key];
        else cart[key] = { ...line, quantity: Number(line.quantity) - 1 };
        emitCartUpdated({ source: 'removeCustomizedUnit', customized: true, itemName: item.name });
        notifyGlobalCart();
        return { cart };
      }
      return state;
    }),

  decrementItem: (name) =>
    set((state) => {
      const existing = state.cart[name];
      if (!existing) return state;
      emitCartUpdated({ source: 'decrementItem', itemName: name });
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
      emitCartUpdated({ source: 'setQty', itemName: name });
      const next = { ...state.cart };
      if (qty <= 0) delete next[name];
      else next[name] = { ...existing, quantity: qty };
      return { cart: next };
    }),

  removeItem: (name) =>
    set((state) => {
      emitCartUpdated({ source: 'removeItem', itemName: name });
      const next = { ...state.cart };
      delete next[name];
      return { cart: next };
    }),

  clearCart: () => {
    emitCartUpdated({ source: 'clearCart', cleared: true });
    try {
      localStorage.removeItem('nearbite_cart_extras');
    } catch {
      /* storage may be unavailable */
    }
    set({ cart: {}, coupon: null });
  },

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

  placeOrder: (paymentMethod, options) => {
    const { cart, coupon } = get();
    const lines: OrderLine[] = Object.entries(cart).map(([name, line]) => ({
      name,
      qty: line.quantity,
      price: line.price,
    }));
    if (lines.length === 0) return null;
    const subtotal = cartSubtotal(cart);
    const couponOff = couponDiscount(coupon, subtotal);
    const offerOff = offerDiscountFor(demoOffersFor(subtotal));
    const tip = Math.max(0, Math.round(options?.tip ?? 0));
    const discount = couponOff + offerOff;
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
      total: Math.max(0, subtotal + PLATFORM_FEE - discount + tip),
      status: 'confirmed',
      placedAt: new Date().toISOString(),
      eta: '30 mins',
      paymentMethod,
      address: DEMO_ADDRESS,
    };
    if (!options?.keepCart) {
      try {
        localStorage.removeItem('nearbite_cart_extras');
      } catch {
        /* storage may be unavailable */
      }
    }
    set((state) => ({
      orders: [order, ...state.orders],
      ...(options?.keepCart ? {} : { cart: {}, coupon: null }),
      lastOrderId: order.id,
    }));
    return order;
  },

  selectRestaurant: (id) => set({ selectedRestaurantId: id }),

}));

export const currentBill = (): ReturnType<typeof billFor> =>
  billFor(useAppStore.getState().cart, useAppStore.getState().coupon);

if (typeof window !== 'undefined') {
  (window as Window & { updateGlobalCart?: () => void }).updateGlobalCart = () => {
    useAppStore.setState({ cart: { ...useAppStore.getState().cart } });
  };
}

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
