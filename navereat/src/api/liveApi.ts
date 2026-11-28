/**
 * Live implementation stub.
 *
 * Same method signatures, endpoint paths and payload shapes as the legacy
 * `api.js` / `cart-page.js`, but nothing is wired yet. Every method throws
 * `live mode not enabled` so a real request can never happen by accident.
 *
 * Switching on the backend is a separate task and only touches this file and
 * the env vars: set `VITE_DATA_MODE=live` and `VITE_API_BASE_URL`.
 */
import type { RestaurantApi } from './restaurantApi';

const NOT_ENABLED = (method: string): never => {
  throw new Error(`live mode not enabled: ${method}`);
};

export const liveApiBaseUrl = (): string => String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const liveApi: RestaurantApi = {
  mode: 'live',
  restaurantSync: () => NOT_ENABLED('restaurantSync'),
  couponsSync: () => NOT_ENABLED('couponsSync'),
  offersSync: () => NOT_ENABLED('offersSync'),
  pricingPolicy: () => NOT_ENABLED('pricingPolicy'),
  getRestaurant: () => NOT_ENABLED('GET /restaurants/:id'),
  getMenu: () => NOT_ENABLED('GET /restaurants/:id/menu'),
  getCoupons: () => NOT_ENABLED('getCoupons'),
  getQuote: () => NOT_ENABLED('POST /pricing/quote'),
  validateCoupon: () => NOT_ENABLED('POST /coupons/validate'),
  previewBill: () => NOT_ENABLED('previewBill'),
  createOrder: () => NOT_ENABLED('POST /orders'),
  createPayment: () => NOT_ENABLED('POST /payments/create'),
  getPaymentStatus: () => NOT_ENABLED('GET /payments/:id'),
  verifyPayment: () => NOT_ENABLED('POST /payments/verify'),
  getOrder: () => NOT_ENABLED('GET /orders/:id'),
  getProfile: () => NOT_ENABLED('GET /users/profile'),
  getAddresses: () => NOT_ENABLED('GET /users/addresses'),
  saveAddress: () => NOT_ENABLED('POST /users/addresses'),
  deleteAddress: () => NOT_ENABLED('DELETE /users/addresses/:id'),
  getOrders: () => NOT_ENABLED('GET /orders'),
  getPlatformStatus: () => NOT_ENABLED('GET /platform/public-status'),
};
