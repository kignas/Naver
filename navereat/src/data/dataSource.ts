import type { Category, Coupon, DemoUser, MenuItem, Order, Restaurant } from './demo';

export type DataSourceMode = 'demo' | 'api';

/** Banner slot on the home hero (the ₹99 store has its own placement). */
export interface Banner {
  id: string;
  title: string;
  image: string;
  link: string;
  placement: string;
  priority: number;
}

export interface SearchResult {
  id: string;
  name: string;
  price: number;
  image: string;
  isVeg: boolean;
  restaurantId: number;
  restaurantName: string;
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

/** `/platform/public-status`, normalised. Money fields stay in rupees. */
export interface PlatformStatus {
  isUnderMaintenance: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEta: string;
  isDeliveryPausedShortage: boolean;
  shortageBannerMessage: string;
  isRainSurgeActive: boolean;
  rainSurgeFee: number;
  rainExtraEtaMinutes: number;
  isGlobalFreeDelivery: boolean;
  freeDeliveryMinSubtotal: number;
  isFirstOrderFreeDelivery: boolean;
  platformHandlingFee: number;
  smallCartThreshold: number;
  smallCartFee: number;
  packagingChargePerItem: number;
  taxPercent: number;
  isUpiEnabled: boolean;
  isCodEnabled: boolean;
  maxCodOrderAmount: number;
  codAdvanceThreshold: number;
  codAdvancePercent: number;
  codDisplayLabel: string;
  service: {
    state: 'open' | 'closed_hours' | 'closed_manual' | 'maintenance' | 'shortage';
    canOrder: boolean;
    title: string;
    message: string;
    detail: string;
    nextOpenAt: string | null;
    nextOpenLabel: string | null;
    retryAfterSeconds: number | null;
    serverTime: string | null;
  };
}

/** Money is rupees, straight from the backend bill. */
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

export interface Quote {
  bill: QuoteBill;
  freeDelivery: boolean;
  discount: number;
  quoteId: string | null;
  quoteIssuedAt: string | null;
  quoteExpiresAt: string | null;
  isFirstOrder: boolean;
  isCod: boolean;
  paymentMethod: 'upi' | 'cod';
}

export interface QuoteRequest {
  restaurantId: string;
  addressId?: string;
  items: Array<{ menuItem: string; quantity: number }>;
  paymentMethod: 'upi' | 'cod';
  couponCode?: string;
  tipAmount?: number;
}

export interface CouponCheck {
  ok: boolean;
  code?: string;
  discount?: number;
  description?: string;
  minOrder?: number;
  paymentMethods?: string[];
  message?: string;
}

export interface RestaurantDetail {
  restaurant: Restaurant;
  menu: MenuItem[];
}

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface Session {
  token: string;
  user: DemoUser;
}

export type ApiFailureKind = 'network' | 'timeout' | 'parse' | 'shape' | 'http' | 'auth';

/** One error shape for every call, with the original's user-facing text. */
export interface ApiFailure {
  kind: ApiFailureKind;
  status?: number;
  code?: string;
  message: string;
  retryable: boolean;
}

export const isApiFailure = (value: unknown): value is ApiFailure =>
  typeof value === 'object' && value !== null && 'kind' in value && 'message' in value;

export interface DataSource {
  readonly mode: DataSourceMode;

  /** Restaurants, categories and hero banners for the home screen. */
  getHome(): Promise<{ restaurants: Restaurant[]; categories: Category[]; banners: Banner[] }>;
  getRestaurant(id: number | string): Promise<RestaurantDetail>;
  getMenu(id: number | string): Promise<MenuItem[]>;
  search(query: string): Promise<SearchResult[]>;
  getCategories(): Promise<Category[]>;
  getBanners(placement?: string): Promise<Banner[]>;
  /** `fresh` bypasses the 60 s in-memory cache (the closed gate's re-check). */
  getPlatformStatus(options?: { fresh?: boolean }): Promise<PlatformStatus>;

  getQuote(request: QuoteRequest): Promise<Quote>;
  validateCoupon(input: { code: string; subtotal: number; restaurantId?: string; paymentMethod?: 'upi' | 'cod' }): Promise<CouponCheck>;

  login(credentials: LoginCredentials): Promise<Session>;
  getProfile(): Promise<DemoUser>;
  getAddresses(): Promise<Address[]>;
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;

  /** Coupon list is a demo-only convenience; the API has no such endpoint. */
  getCoupons(): Promise<Coupon[]>;
}
