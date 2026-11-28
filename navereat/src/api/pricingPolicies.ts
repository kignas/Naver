import type { PricingPolicy } from '../logic/pricingEngine';

/** The zero-fee policy the demo cart has always rendered. */
export const ZERO_FEE_POLICY: PricingPolicy = {
  deliveryFeeBands: [{ maxKm: 99, fee: 0 }],
  distanceFeePerKm: null,
  minimumOrderByDistance: [{ maxKm: 99, min: 0 }],
  freeDeliveryThresholdByDistance: [{ maxKm: 99, threshold: 399 }],
  smallOrderFeeEnabled: false,
  smallOrderFee: 0,
  taxPercent: 0,
  packagingPerItem: 0,
  platformFee: 0,
  codFee: 0,
  codMaxOrderAmount: 2000,
  firstOrderFreeDelivery: false,
  rainSurgeFee: 0,
  couponFundingBudget: 150,
};

/** The restaurant's zone policy: 3-zone delivery, 5% GST, ₹15 COD handling. */
export const ZONE_POLICY: PricingPolicy = {
  deliveryFeeBands: [
    { maxKm: 3, fee: 13 },
    { maxKm: 5, fee: 29 },
    { maxKm: 6, fee: 35 },
    { maxKm: 7, fee: 50 },
    { maxKm: 8, fee: 55 },
    { maxKm: 9, fee: 60 },
    { maxKm: 10, fee: 65 },
  ],
  distanceFeePerKm: null,
  minimumOrderByDistance: [
    { maxKm: 3, min: 99 },
    { maxKm: 5, min: 149 },
    { maxKm: 10, min: 249 },
  ],
  freeDeliveryThresholdByDistance: [
    { maxKm: 3, threshold: 349 },
    { maxKm: 5, threshold: 399 },
    { maxKm: 10, threshold: 599 },
  ],
  smallOrderFeeEnabled: false,
  smallOrderFee: 20,
  taxPercent: 5,
  packagingPerItem: 0,
  platformFee: 0,
  codFee: 15,
  codMaxOrderAmount: 2000,
  firstOrderFreeDelivery: false,
  rainSurgeFee: 0,
  couponFundingBudget: 150,
};

export const policyFor = (zoneFees: boolean): PricingPolicy => (zoneFees ? ZONE_POLICY : ZERO_FEE_POLICY);

/** Every restaurant in the demo sits inside a delivery zone, so the bill shows
 *  the zone fee and GST unless the `zoneFees` scenario is switched off. */
export const DEFAULT_POLICY = ZONE_POLICY;
