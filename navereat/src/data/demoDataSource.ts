import {
  categories,
  coupons,
  demoOffers,
  demoOrders,
  demoUser,
  findOrder,
  findRestaurant,
  restaurants,
  type MenuItem,
  type Order,
  type Restaurant,
} from './demo';
import type {
  Address,
  Banner,
  CouponCheck,
  DataSource,
  LoginCredentials,
  PlatformStatus,
  Quote,
  QuoteRequest,
  RestaurantDetail,
  SearchResult,
  Session,
} from './dataSource';

const DEMO_ADDRESSES: Address[] = [
  {
    id: 'demo-home',
    tag: 'Home',
    house: '42 Demo Street',
    area: 'Demo City',
    city: 'Demo City',
    pincode: '735101',
    isDefault: true,
  },
];

const DEMO_STATUS: PlatformStatus = {
  isUnderMaintenance: false,
  maintenanceTitle: '',
  maintenanceMessage: '',
  maintenanceEta: '',
  isDeliveryPausedShortage: false,
  shortageBannerMessage: '',
  isRainSurgeActive: false,
  rainSurgeFee: 0,
  rainExtraEtaMinutes: 0,
  isGlobalFreeDelivery: false,
  freeDeliveryMinSubtotal: 149,
  isFirstOrderFreeDelivery: false,
  platformHandlingFee: 0,
  smallCartThreshold: 99,
  smallCartFee: 0,
  packagingChargePerItem: 0,
  taxPercent: 0,
  isUpiEnabled: true,
  isCodEnabled: true,
  maxCodOrderAmount: 1000,
  codAdvanceThreshold: 1000,
  codAdvancePercent: 0,
  codDisplayLabel: 'Cash on Delivery',
  service: {
    state: 'open',
    canOrder: true,
    title: '',
    message: '',
    detail: '',
    nextOpenAt: null,
    nextOpenLabel: null,
    retryAfterSeconds: null,
    serverTime: null,
  },
};

const toDetail = (restaurant: Restaurant): RestaurantDetail => ({ restaurant, menu: restaurant.menu });

const allMenuItems = (): Array<{ item: MenuItem; restaurant: Restaurant }> =>
  restaurants.flatMap((restaurant) => restaurant.menu.map((item) => ({ item, restaurant })));

export const demoDataSource: DataSource = {
  mode: 'demo',

  async getHome() {
    return {
      restaurants,
      categories,
      banners: demoOffers.map((offer) => ({
        id: offer.id,
        title: offer.big,
        image: '',
        link: '',
        placement: 'home',
        priority: 0,
      })) satisfies Banner[],
    };
  },

  async getRestaurant(id) {
    const restaurant = findRestaurant(id);
    if (!restaurant) throw Object.assign(new Error('Not found.'), { kind: 'http', status: 404, message: 'Not found.' });
    return toDetail(restaurant);
  },

  async getMenu(id) {
    return findRestaurant(id)?.menu ?? [];
  },

  async search(query) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return allMenuItems()
      .filter(({ item }) => item.name.toLowerCase().includes(needle))
      .slice(0, 24)
      .map(({ item, restaurant }): SearchResult => ({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        isVeg: item.isVeg,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      }));
  },

  async getCategories() {
    return categories;
  },

  async getBanners(placement = 'home') {
    return (await this.getHome()).banners.filter((banner) => banner.placement === placement);
  },

  async getPlatformStatus() {
    return DEMO_STATUS;
  },

  async getQuote(input: QuoteRequest): Promise<Quote> {
    const restaurant = findRestaurant(input.restaurantId);
    const items = input.items.map((line) => {
      const item = restaurant?.menu.find((entry) => entry.id === line.menuItem);
      return { price: item?.price ?? 0, quantity: line.quantity };
    });
    const itemTotal = items.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const deliveryFee = itemTotal >= 149 ? 0 : 30;
    const total = itemTotal + deliveryFee;
    return {
      bill: {
        grandTotal: total,
        total,
        itemTotal,
        deliveryFee,
        taxes: 0,
        packaging: 0,
        platformFee: 0,
        couponDiscount: 0,
        tip: input.tipAmount ?? 0,
        roundOff: 0,
      },
      freeDelivery: deliveryFee === 0,
      discount: 0,
      quoteId: 'demo-quote',
      quoteIssuedAt: new Date().toISOString(),
      quoteExpiresAt: null,
      isFirstOrder: false,
      isCod: input.paymentMethod === 'cod',
      paymentMethod: input.paymentMethod,
    };
  },

  async validateCoupon(input): Promise<CouponCheck> {
    const coupon = coupons.find((entry) => entry.code.toUpperCase() === input.code.trim().toUpperCase());
    if (!coupon) return { ok: false, code: 'COUPON_INVALID', message: 'Invalid coupon code' };
    if (input.subtotal < coupon.minOrder) {
      return { ok: false, code: 'COUPON_MIN_ORDER', message: `Minimum order ₹${coupon.minOrder}` };
    }
    const raw = coupon.type === 'percent' ? (input.subtotal * coupon.value) / 100 : coupon.value;
    const discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
    return { ok: true, code: coupon.code, discount: Math.round(discount), description: coupon.title };
  },

  async login(credentials: LoginCredentials): Promise<Session> {
    if (!credentials.password) {
      throw Object.assign(new Error('Enter your password'), { kind: 'http', message: 'Enter your password' });
    }
    return { token: 'demo-token', user: demoUser };
  },

  async getProfile() {
    return demoUser;
  },

  async getAddresses() {
    return DEMO_ADDRESSES;
  },

  async getOrders(): Promise<Order[]> {
    return demoOrders;
  },

  async getOrder(id) {
    return findOrder(id) ?? null;
  },

  async getCoupons() {
    return coupons;
  },
};
