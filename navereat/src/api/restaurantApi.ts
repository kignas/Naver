/**
 * The one interface every menu/checkout screen uses.
 *
 * UI and logic code must call `api.*` only — never `fetch()` and never a
 * fixture module. `demoApi` is the default; `liveApi` is a typed stub so the
 * real backend can be plugged in later without touching a component.
 */
import type { Coupon, DemoOffer, DemoUser, MenuItem, Order, Restaurant } from '../data/demo';
import type { Bill, Cart } from '../lib/cart';
import type { PricingPolicy, Quote as EngineQuote } from '../logic/pricingEngine';
import type { OrderPayload } from '../logic/orderPayload';
import { demoApi } from './demoApi';
import { liveApi } from './liveApi';

export type DataMode = 'demo' | 'live';

export type ApiFailureKind = 'network' | 'timeout' | 'parse' | 'shape' | 'http' | 'auth';

export interface ApiFailure {
  kind: ApiFailureKind;
  status?: number;
  code?: string;
  message: string;
  retryable: boolean;
}

export const isApiFailure = (value: unknown): value is ApiFailure =>
  typeof value === 'object' && value !== null && 'kind' in value && 'message' in value;

export interface QuoteBill {
  grandTotal: number;
  total: number;
  itemTotal: number;
  deliveryFee: number;
  taxes: number;
  packaging: number;
  platformFee: number;
  couponDiscount: number;
  tip: number;
  roundOff: number;
}

export interface FreeDeliveryQuote {
  available: boolean;
  enabled: boolean;
  threshold: number;
  baseThreshold: number;
  raised: boolean;
  eligibleSubtotal: number;
  amountRemaining: number;
  unlocked: boolean;
  reachedThreshold: boolean;
  subsidised: boolean;
  deliveryFee: number;
  effectiveDeliveryFee: number;
  reason: string;
  firstOrderFreeDelivery?: boolean;
}

/** The backend quote, exactly as `POST /pricing/quote` returns it. */
export type Quote = EngineQuote;

export interface PreviewBillOptions {
  /** Tip to price into the bill, exactly what `tipAmount` sends to a quote. */
  tip?: number;
  paymentMethod?: 'upi' | 'cod';
}

export interface QuoteRequest {
  restaurantId: string | number;
  addressId?: string | null;
  distanceKm?: number;
  items: Array<{ menuItem: string | number; name?: string; price: number; quantity: number }>;
  paymentMethod: 'upi' | 'cod';
  couponCode?: string | null;
  couponValue?: number;
  couponMinSubtotal?: number;
  tipAmount?: number;
  isFirstOrder?: boolean;
}

export interface CouponCheck {
  ok: boolean;
  code?: string;
  discount?: number;
  description?: string;
  minOrder?: number;
  paymentMethods?: string[];
  message?: string;
  offer?: {
    code: string;
    title: string;
    description: string;
    type: 'percent' | 'fixed' | null;
    value: number | null;
    discount: number;
    maxDiscount: number | null;
    minSubtotal: number;
    restaurantId: string | null;
    restaurantName: string;
    image: string | null;
    paymentMethods: string[] | null;
    expiresAt: string | null;
    showPopup: boolean;
  };
}

export interface Address {
  id: string;
  tag: string;
  house: string;
  area: string;
  landmark?: string;
  city: string;
  pincode: string;
  receiverName?: string;
  receiverPhone?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  instructions?: string;
}

export interface CreateOrderInput {
  payload: OrderPayload;
  idempotencyKey: string;
  restaurantName?: string;
  address?: Address | null;
  eta?: string;
}

export interface CreateOrderResult {
  orderId: string;
  total: number;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'cod_pending';
  paymentMethod: 'upi' | 'cod';
  order: Order;
  /** Server-computed partial-COD fields, present only when an advance is due. */
  partialCodAdvanceAmount?: number;
  partialCodCashDue?: number;
  partialCodAdvanceStatus?: 'pending' | 'paid' | 'failed';
}

export interface PaymentIntent {
  paymentId: string;
  orderId: string;
  amount: number;
  method: 'upi' | 'cod';
  status: 'created' | 'authorized' | 'paid' | 'failed' | 'pending';
}

export interface PaymentStatus {
  paymentId: string;
  status: PaymentIntent['status'];
}

export interface PaymentVerifyResult {
  success: boolean;
  order: Order;
  paymentStatus: 'paid' | 'pending' | 'failed' | 'cod_pending';
  message?: string;
}

export interface PlatformStatusLite {
  service: { state: string; canOrder: boolean; title: string; message: string };
  /** Payment switches, the same fields `GET /platform/status` serves. */
  isCodEnabled?: boolean;
  isUpiEnabled?: boolean;
  isCodBlocked?: boolean;
  maxCodOrderAmount?: number;
  isUnderMaintenance?: boolean;
  maintenanceMessage?: string;
  isDeliveryPausedShortage?: boolean;
}

export interface RestaurantApi {
  readonly mode: DataMode;
  /** Demo-only synchronous readers used for first paint. */
  restaurantSync(id: string | number | undefined): Restaurant | null;
  couponsSync(): Coupon[];
  offersSync(subtotal: number): DemoOffer[];
  pricingPolicy(): PricingPolicy;

  getRestaurant(id: string | number): Promise<Restaurant>;
  getMenu(id: string | number): Promise<MenuItem[]>;
  getCoupons(): Promise<Coupon[]>;

  getQuote(request: QuoteRequest): Promise<Quote>;
  validateCoupon(input: {
    code: string;
    subtotal: number;
    restaurantId?: string | number;
    paymentMethod?: 'upi' | 'cod';
  }): Promise<CouponCheck>;

  /** Local preview bill for carts the quote cannot price (multi-restaurant / no address). */
  previewBill(cart: Cart, coupon?: Coupon | null, options?: PreviewBillOptions): Bill;

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  createPayment(input: { orderId: string; amount: number; method: 'upi' | 'cod' }): Promise<PaymentIntent>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  verifyPayment(input: {
    paymentId: string;
    orderId: string;
    signature?: string;
    /** Demo only: the result the mock gateway callback returns. */
    outcome?: 'success' | 'failure' | 'pending';
  }): Promise<PaymentVerifyResult>;
  getOrder(id: string): Promise<Order | null>;

  getProfile(): Promise<DemoUser>;
  getAddresses(): Promise<Address[]>;
  saveAddress(input: Omit<Address, 'id'> & { id?: string }): Promise<Address>;
  deleteAddress(id: string): Promise<void>;

  getOrders(): Promise<Order[]>;
  getPlatformStatus(): Promise<PlatformStatusLite>;
}

const mode: DataMode = import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'demo';

export const api: RestaurantApi = mode === 'live' ? liveApi : demoApi;
export const dataMode = mode;
