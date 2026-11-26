import type { Category, Coupon, DemoUser, MenuItem, Order, OrderStatus, Restaurant } from '../demo';
import type {
  Address,
  Banner,
  DataSource,
  LoginCredentials,
  PlatformStatus,
  Quote,
  QuoteRequest,
  Session,
} from '../dataSource';
import { CACHE_KEYS, CACHE_TTL, cachedRequest, clearSession, failure, menuCache, readUser, request, saveSession } from './http';
import placeholder from '../../assets/placeholders/restaurant-dosa.svg';

type Raw = Record<string, unknown>;

const num = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : value === undefined || value === null ? fallback : String(value);
const bool = (value: unknown): boolean => value === true;
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Cloudinary delivery with the original's transform, inserted right after
 * `/upload/` and only when the URL does not already carry a transform.
 */
export const cloudinaryUrl = (url: string, width = 480): string => {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const [head, tail] = url.split('/upload/');
  if (/^[a-z]_[^/]+/.test(tail) || tail.startsWith('w_')) return url;
  return `${head}/upload/f_auto,q_auto,w_${width}/${tail}`;
};

const imageOr = (value: unknown, width = 480): string => {
  const raw = str(value);
  return raw ? cloudinaryUrl(raw, width) : placeholder;
};

/* ------------------------------------------------------------------ ids */
/** The app routes by number; the API keys by ObjectId. */
const externalById = new Map<number, string>();
const idByExternal = new Map<string, number>();

const registerRestaurant = (external: string): number => {
  if (!external) return 0;
  const existing = idByExternal.get(external);
  if (existing !== undefined) return existing;
  const id = externalById.size + 1;
  externalById.set(id, external);
  idByExternal.set(external, id);
  return id;
};

export const externalRestaurantId = (id: number | string): string => {
  const numeric = typeof id === 'number' ? id : Number.parseInt(id, 10);
  const mapped = externalById.get(numeric);
  if (mapped) return mapped;
  const asString = String(id);
  return /^[0-9a-f]{24}$/i.test(asString) ? asString : mapped ?? asString;
};

export const knownRestaurantCount = (): number => externalById.size;

/* -------------------------------------------------------------- mappers */
export const toRestaurant = (raw: Raw): Restaurant => {
  const external = str(raw._id ?? raw.id);
  const id = registerRestaurant(external);
  const cuisine = Array.isArray(raw.cuisine) ? list<string>(raw.cuisine).join(', ') : str(raw.cuisineDisplay || raw.cuisine);
  const images = list<string>(raw.images);
  const image = str(raw.image) || images[0] || '';
  const etaMin = num(raw.estimatedDeliveryMin);
  const etaMax = num(raw.estimatedDeliveryMax);
  const time = str(raw.time) || (etaMin && etaMax ? `${etaMin}-${etaMax} mins` : '');
  const distanceMeters = num(raw.distanceMeters);
  const distance = str(raw.distance) || (distanceMeters ? `${(distanceMeters / 1000).toFixed(1)} km` : '');
  const offer = raw.offer && typeof raw.offer === 'object' ? str((raw.offer as Raw).title || (raw.offer as Raw).text) : str(raw.offer);
  return {
    id,
    name: str(raw.name, 'Restaurant'),
    rating: raw.rating === undefined || raw.rating === null ? '0.0' : num(raw.rating).toFixed(1),
    ratingCount: num(raw.ratingCount),
    time,
    distance,
    distanceKm: distanceMeters ? Number((distanceMeters / 1000).toFixed(1)) : undefined,
    deliveryMin: etaMin || undefined,
    deliveryMax: etaMax || undefined,
    offer,
    cuisine,
    priceForTwo: num(raw.priceForTwo),
    image: image ? cloudinaryUrl(image, 480) : placeholder,
    minimumOrder: num(raw.minOrder),
    freeDeliveryAbove: num(raw.freeDeliveryAbove) || undefined,
    pureVeg: bool(raw.isVeg),
    available: bool(raw.isOpen),
    menu: [],
  };
};

const toMenuItem = (raw: Raw, category: string): MenuItem => {
  const groups = list<Raw>(raw.customizations).map((group) => ({
    title: str(group.title),
    required: bool(group.required) || num(group.minSelect) > 0,
    maxSelect: num(group.maxSelect) || undefined,
    pricingMode: (str(group.pricingMode, 'extra') === 'portion' ? 'portion' : 'extra') as 'extra' | 'portion',
    options: list<Raw>(group.options).map((option) => ({
      label: str(option.label),
      extraPrice: num(option.extraPrice),
      isVeg: option.isVeg === undefined ? undefined : bool(option.isVeg),
    })),
  }));
  const available = raw.inStock === undefined ? true : bool(raw.inStock);
  return {
    id: str(raw._id ?? raw.id),
    name: str(raw.name),
    price: num(raw.price),
    isVeg: bool(raw.isVeg),
    bestseller: bool(raw.isBestseller) || bool(raw.isRecommended),
    desc: str(raw.description),
    image: imageOr(raw.image, 320),
    originalPrice: num(raw.originalPrice) || undefined,
    category,
    customizations: groups.length ? groups : undefined,
    isCustomisable: groups.length > 0,
    available,
  };
};

/** `/restaurants/:id/menu` answers `{category: items[]}` (settled 2026-11-25). */
export const toMenu = (payload: unknown): MenuItem[] => {
  const data = (payload as Raw)?.data ?? payload;
  if (!data) return [];
  if (Array.isArray(data)) {
    return list<Raw>(data).map((item) => toMenuItem(item, str(item.category)));
  }
  const record = data as Raw;
  const entries = Object.entries(record);
  if (entries.every(([, value]) => Array.isArray(value))) {
    return entries.flatMap(([category, items]) => list<Raw>(items).map((item) => toMenuItem(item, category)));
  }
  if (Array.isArray(record.items)) return list<Raw>(record.items).map((item) => toMenuItem(item, str(item.category)));
  return [];
};

export const toCategory = (raw: Raw): Category => ({
  id: str(raw._id ?? raw.id ?? raw.name),
  name: str(raw.name),
  query: str(raw.name),
  image: imageOr(raw.image, 160),
});

export const toBanner = (raw: Raw): Banner => ({
  id: str(raw._id ?? raw.id),
  title: str(raw.title),
  subtitle: str(raw.subtitle),
  offerText: str(raw.offerText),
  badgeText: str(raw.badgeText),
  ctaText: str(raw.ctaText),
  image: imageOr(raw.mobileImage || raw.image, 780),
  link: str(raw.ctaUrl || raw.link),
  placement: str(raw.placement, 'home'),
  priority: num(raw.priority),
});

export const toPlatformStatus = (payload: unknown): PlatformStatus => {
  const raw = ((payload as Raw)?.data ?? payload ?? {}) as Raw;
  const service = ((raw.serviceStatus ?? {}) as Raw) || {};
  return {
    isUnderMaintenance: bool(raw.isUnderMaintenance),
    maintenanceTitle: str(raw.maintenanceTitle),
    maintenanceMessage: str(raw.maintenanceMessage),
    maintenanceEta: str(raw.maintenanceEta),
    isDeliveryPausedShortage: bool(raw.isDeliveryPausedShortage),
    shortageBannerMessage: str(raw.shortageBannerMessage),
    isRainSurgeActive: bool(raw.isRainSurgeActive),
    rainSurgeFee: num(raw.rainSurgeFee),
    rainExtraEtaMinutes: num(raw.rainExtraEtaMinutes),
    isGlobalFreeDelivery: bool(raw.isGlobalFreeDelivery),
    freeDeliveryMinSubtotal: num(raw.freeDeliveryMinSubtotal),
    isFirstOrderFreeDelivery: bool(raw.isFirstOrderFreeDelivery),
    platformHandlingFee: num(raw.platformHandlingFee),
    smallCartThreshold: num(raw.smallCartThreshold),
    smallCartFee: num(raw.smallCartFee),
    packagingChargePerItem: num(raw.packagingChargePerItem),
    taxPercent: num(raw.taxPercent),
    isUpiEnabled: bool(raw.isUpiEnabled),
    isCodEnabled: bool(raw.isCodEnabled),
    maxCodOrderAmount: num(raw.maxCodOrderAmount),
    codAdvanceThreshold: num(raw.codAdvanceThreshold),
    codAdvancePercent: num(raw.codAdvancePercent),
    codDisplayLabel: str(raw.codDisplayLabel),
    service: {
      state: (str(service.state, 'open') as PlatformStatus['service']['state']) || 'open',
      canOrder: service.canOrder === undefined ? true : bool(service.canOrder),
      title: str(service.title),
      message: str(service.message),
      detail: str(service.detail),
      nextOpenAt: service.nextOpenAt ? str(service.nextOpenAt) : null,
      nextOpenLabel: service.nextOpenLabel ? str(service.nextOpenLabel) : null,
      retryAfterSeconds: service.retryAfterSeconds === undefined ? null : num(service.retryAfterSeconds),
      serverTime: service.serverTime ? str(service.serverTime) : null,
    },
  };
};

export const toQuote = (payload: unknown, paymentMethod: 'upi' | 'cod'): Quote => {
  const raw = ((payload as Raw)?.data ?? payload ?? {}) as Raw;
  const bill = (raw.bill ?? {}) as Raw;
  return {
    bill: {
      grandTotal: num(bill.grandTotal),
      total: num(bill.total),
      itemTotal: num(bill.itemTotal),
      deliveryFee: num(bill.deliveryFee),
      taxes: num(bill.taxes),
      packaging: num(bill.packaging),
      platformFee: num(bill.platformFee),
      couponDiscount: num(bill.couponDiscount),
      tip: num(bill.tip),
      roundOff: num(bill.roundOff),
    },
    freeDelivery: bool(raw.freeDelivery),
    discount: num(raw.discount),
    quoteId: raw.quoteId ? str(raw.quoteId) : null,
    quoteIssuedAt: raw.quoteIssuedAt ? str(raw.quoteIssuedAt) : null,
    quoteExpiresAt: raw.quoteExpiresAt ? str(raw.quoteExpiresAt) : null,
    isFirstOrder: bool(raw.isFirstOrder),
    isCod: raw.isCod === undefined ? paymentMethod === 'cod' : bool(raw.isCod),
    paymentMethod,
  };
};

const STATUS_MAP: Record<string, OrderStatus> = {
  placed: 'confirmed',
  confirmed: 'confirmed',
  accepted: 'confirmed',
  preparing: 'preparing',
  ready: 'preparing',
  picked_up: 'picked_up',
  picked: 'picked_up',
  on_the_way: 'on_the_way',
  out_for_delivery: 'on_the_way',
  delivered: 'delivered',
  completed: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
};

export const toOrder = (raw: Raw): Order => {
  const restaurantRef = raw.restaurant as Raw | undefined;
  const restaurantId = str(raw.restaurantId ?? restaurantRef?._id ?? raw.restaurant);
  const items = list<Raw>(raw.items);
  const lines = items.map((item) => ({
    name: str(item.name),
    qty: num(item.quantity, 1),
    price: num(item.price),
  }));
  const address = raw.deliveryAddress;
  const addressLine =
    typeof address === 'string'
      ? address
      : address && typeof address === 'object'
        ? [str((address as Raw).tag), str((address as Raw).house), str((address as Raw).area), str((address as Raw).city)]
            .filter(Boolean)
            .join(' · ')
        : '';
  return {
    id: str(raw._id ?? raw.id ?? raw.orderNumber),
    restaurantId: restaurantId && /^[0-9a-f]{24}$/i.test(restaurantId) ? registerRestaurant(restaurantId) : num(restaurantId),
    restaurantName: str(raw.restaurantName),
    lines,
    subtotal: num(raw.subtotal) || lines.reduce((sum, line) => sum + line.price * line.qty, 0),
    platformFee: num(raw.platformFee),
    discount: num(raw.discount),
    total: num(raw.total),
    status: STATUS_MAP[str(raw.status, 'confirmed')] ?? 'confirmed',
    placedAt: str(raw.createdAt),
    eta: str(raw.eta || raw.deliveryTime),
    paymentMethod: str(raw.paymentMethod),
    address: addressLine,
  };
};

export const toAddress = (raw: Raw): Address => ({
  id: str(raw._id ?? raw.id),
  tag: str(raw.tag, 'Home'),
  house: str(raw.house),
  area: str(raw.area),
  landmark: str(raw.landmark) || undefined,
  city: str(raw.city),
  pincode: str(raw.pincode),
  receiverName: str(raw.receiverName) || undefined,
  receiverPhone: str(raw.receiverPhone) || undefined,
  latitude: num(raw.latitude) || undefined,
  longitude: num(raw.longitude) || undefined,
  isDefault: bool(raw.isDefault),
  instructions: str(raw.deliveryInstructions) || undefined,
});

export const toUser = (raw: Raw): DemoUser => ({
  name: str(raw.name),
  phone: str(raw.phone),
  email: str(raw.email),
});

const listFrom = <T>(payload: unknown, keys: string[]): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const record = (payload ?? {}) as Raw;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }
  if (record.data) return listFrom<T>(record.data, keys);
  return [];
};

/* ------------------------------------------------------------ the source */
const statusCache: { at: number; value: PlatformStatus } = { at: 0, value: toPlatformStatus({}) };

export const apiDataSource: DataSource = {
  mode: 'api',

  async getHome() {
    const [feed, categories, banners] = await Promise.all([
      cachedRequest<unknown>('/restaurants', {
        key: CACHE_KEYS.restaurants,
        store: 'session',
        maxAgeMs: CACHE_TTL.tenMinutes,
      }),
      this.getCategories(),
      this.getBanners('home'),
    ]);
    const page = (feed ?? {}) as Raw;
    const rows = listFrom<Raw>(Array.isArray(page) ? page : (page.data ?? page), ['data', 'restaurants']);
    return { restaurants: rows.map(toRestaurant), categories, banners };
  },

  async getCategories() {
    const payload = await cachedRequest<unknown>('/categories', {
      key: CACHE_KEYS.categories,
      store: 'session',
      maxAgeMs: CACHE_TTL.tenMinutes,
    });
    return listFrom<Raw>(payload, ['categories']).map(toCategory);
  },

  async getBanners(placement = 'home') {
    const suffix = placement === 'under99' ? '?placement=under99' : '';
    const payload = await cachedRequest<unknown>(`/home-banners${suffix}`, {
      key: `${CACHE_KEYS.banners}:${placement}`,
      store: 'local',
      maxAgeMs: CACHE_TTL.tenMinutes,
    });
    return listFrom<Raw>(payload, ['banners'])
      .filter((banner) => bool(banner.active) || banner.active === undefined)
      .sort((a, b) => num(b.priority) - num(a.priority))
      .map(toBanner);
  },

  async getRestaurant(id) {
    // A cold deep link arrives with the app's numeric id and an empty registry;
    // one feed read is enough to map it back to the ObjectId.
    if (!externalById.size && /^\d+$/.test(String(id))) await this.getHome();
    const external = externalRestaurantId(id);
    const payload = await request<unknown>(`/restaurants/${external}`);
    const raw = ((payload as Raw)?.data ?? payload) as Raw;
    const restaurant = toRestaurant(raw);
    const menu = await this.getMenu(id);
    return { restaurant, menu };
  },

  async getMenu(id) {
    const external = externalRestaurantId(id);
    const cached = menuCache.read(external);
    if (cached !== undefined) return toMenu(cached);
    const payload = await request<unknown>(`/restaurants/${external}/menu`);
    menuCache.write(external, payload);
    return toMenu(payload);
  },

  async search(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const payload = await request<unknown>(`/restaurants/search?q=${encodeURIComponent(trimmed)}&scope=home`);
    const rows = listFrom<Raw>(((payload as Raw)?.data ?? payload) as unknown, ['menuItems']);
    return rows.map((item) => {
      const restaurantRaw = (item.restaurant ?? {}) as Raw;
      const external = str(restaurantRaw._id ?? item.restaurantId);
      return {
        id: str(item._id ?? item.id),
        name: str(item.name),
        price: num(item.price),
        image: imageOr(item.image, 160),
        isVeg: bool(item.isVeg),
        restaurantId: external ? registerRestaurant(external) : 0,
        restaurantName: str(restaurantRaw.name ?? item.restaurantName),
      };
    });
  },

  async getPlatformStatus(options?: { fresh?: boolean }) {
    if (!options?.fresh && statusCache.at && Date.now() - statusCache.at < 60000) return statusCache.value;
    const payload = await request<unknown>(`/platform/public-status?_=${Date.now()}`);
    const value = toPlatformStatus(payload);
    statusCache.at = Date.now();
    statusCache.value = value;
    return value;
  },

  async getQuote(input: QuoteRequest) {
    const payload = await request<unknown>('/pricing/quote', { method: 'POST', body: input });
    return toQuote(payload, input.paymentMethod);
  },

  async validateCoupon(input) {
    try {
      const payload = await request<unknown>('/coupons/validate', { method: 'POST', body: input });
      const raw = ((payload as Raw)?.data ?? payload ?? {}) as Raw;
      return {
        ok: true,
        code: str(raw.code, input.code),
        discount: num(raw.discount),
        description: str(raw.description),
        minOrder: num(raw.minOrder) || undefined,
        paymentMethods: list<string>(raw.paymentMethods),
      };
    } catch (error) {
      const apiError = error as { message?: string; code?: string };
      return { ok: false, code: apiError.code, message: apiError.message ?? 'Something went wrong while loading.' };
    }
  },

  async login(credentials: LoginCredentials) {
    const body: Raw = { password: credentials.password };
    if (credentials.email) body.email = credentials.email;
    if (credentials.phone) body.phone = credentials.phone;
    const payload = await request<unknown>('/users/login', { method: 'POST', body });
    const raw = (payload ?? {}) as Raw;
    const token = str(raw.token);
    if (!token) {
      clearSession();
      throw failure('shape', 'The server sent unexpected data.');
    }
    const session: Session = { token, user: toUser(((raw.user ?? raw.data) ?? {}) as Raw) };
    saveSession(session);
    return session;
  },

  async getProfile() {
    const payload = await request<unknown>('/users/profile', { auth: true });
    return toUser(((payload as Raw)?.data ?? payload ?? {}) as Raw);
  },

  async getAddresses() {
    const payload = await request<unknown>('/users/addresses', { auth: true });
    return listFrom<Raw>(payload, ['addresses']).map(toAddress);
  },

  async getOrders() {
    const payload = await request<unknown>('/orders', { auth: true });
    return listFrom<Raw>(payload, ['orders']).map(toOrder);
  },

  async getOrder(id) {
    const orders = await this.getOrders();
    return orders.find((order) => order.id === id) ?? null;
  },

  async getCoupons(): Promise<Coupon[]> {
    return [];
  },
};

/** Cached user for the header while the profile call is in flight. */
export const cachedUser = (): DemoUser | null => readUser<DemoUser>();
