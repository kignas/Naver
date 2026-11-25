# Eatswada customer API — contract

Read from the original static frontend (`kignas/Nearbite`, `ORIGINAL_DIR`):
`api.js`, `config.js`, `js/auth-token.js`, `js/ew-pricing.js`, `js/ew-quote.js`,
`js/ew-coupon.js`, `js/cart-page.js`, `js/order-payload.js`,
`js/payment-verify.js`, `js/ew-tracking.js`, `js/ew-menu-cache.js`,
`js/under99-core.js`, `home.js`, `home-banners.js`, `search-overlay.js`,
`restaurant-shell.html`, `restaurant-details.html`, `cart.html`,
`orders.html`, `track-order.html`, `profile.html`, `address-api.js`,
`address-new.js`, `address-model.js`, `order-support.html`, `rate-us.html`,
`login.html`, `complete-profile.html`, `forgot-password.html`,
`push.js`, `customer-upload.js`, `platform-status.js`,
`service-closed-gate.js`, `location-onboarding.html`.

No secrets in this document. `config.js` in the original holds third-party
browser keys (Firebase web config, Ola Maps, MapTiler). They are **not**
reproduced here; the app takes them from build-time env and they must never be
committed. The API base URL is public and may be a constant.

## 1. Transport

| item | value |
| --- | --- |
| Base URL | `https://api.eatswada.com/api` (`CONFIG.API_BASE_URL`) |
| Envelope | `{ success: true, data: … }`; list endpoints answer a bare array or `{data:[…]}`; `unwrap()` accepts both |
| Auth header | `Authorization: Bearer <jwt>` on every authenticated call |
| Content type | `application/json` on every write |
| Cache | `cache: 'no-store'` on every call — caching is explicit, never HTTP |
| Timeout | 12 s default (`api.js`); direct `fetch` callers use 15 s / 30 s |
| Idempotency | `Idempotency-Key: <uuid>` on `POST /orders`, keyed to a payload fingerprint |

`api.js` normalises every failure into one error with a `kind` and a
user-facing `message`:

| kind | condition | message |
| --- | --- | --- |
| `network` | fetch rejects | "Can't reach the server. Check your connection." |
| `timeout` | 12 s abort | "The server took too long to respond." |
| `parse` | body is not JSON | "The server sent a response we could not read." |
| `shape` | `data` is not a list/object | "The server sent unexpected data." |
| `http` 404 | | "Not found." |
| `http` ≥ 500 | | "The server is having trouble right now." |
| `http` other | | server `message` when present, else "Something went wrong while loading." |

`success:false` inside a 200 is turned into an `http` error carrying
`payload.message`.

### Caching (browsing data only — never prices, stock or totals)

| data | store | key | max age |
| --- | --- | --- | --- |
| restaurant feed | sessionStorage + localStorage mirror | `es_restaurants_v4` / `es_p:es_restaurants_v4` | 10 min (mirror: caller-set) |
| categories | same | `es_categories_v4` / `es_p:…` | 10 min |
| restaurant + menu | localStorage | `ew_menu_v1:<id>` (+ `ew_menu_v1:index`) | 10 min, max 6 entries, 600 KB |
| home banners | localStorage | banner cache | 10 min |
| platform status | memory | — | 60 s cache, 90 s refresh |
| serviceability | memory | lat/lng | 60 s (failures never cached) |

An empty array is never valid cached data.

### Hosts the WebView must be allowed to reach

* `https://api.eatswada.com` — API
* `https://res.cloudinary.com` — every restaurant / dish / banner image

Nothing else. The original also calls Ola Maps (geocoding) and Firebase
(auth + FCM); those are out of scope for the API layer and are covered in the
auth section below.

## 2. Endpoints

46 endpoints. "Auth" = JWT required. "Fields used" lists only what the
customer frontend actually reads.

### 2.1 Catalogue (public)

| # | Method | Path | Auth | Request | Fields used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | GET | `/restaurants` | no | — | `_id \| id \| slug`, `name`, `image`, `cuisine(s)`, `rating`, `deliveryTime`, `minOrder`, `priceForTwo`, `isOpen`, `discount`/offer, `isVeg`, `location` | Home feed, ₹99 store, search |
| 2 | GET | `/categories` | no | — | `isActive`, `name`, `image`, `order` | Home category row |
| 3 | GET | `/restaurants/search?q=&scope=` | no | `scope` = `home` \| `restaurant` \| `under99` (+ `restaurantId` for the menu overlay) | `data.menuItems[]` (`_id`, `name`, `price`, `image`, `isVeg`, restaurant id/name) | Search overlay, home search |
| 4 | GET | `/restaurants/under99` | no | — | same card fields as #1 | ₹99 store |
| 5 | GET | `/home-banners` | no | optional `?placement=under99` | `active`, `priority`, `image`, `title`, `link`, `placement` | Home hero, ₹99 hero |
| 6 | GET | `/restaurants/:id` | no | — | `name`, `image`, `images`, `cuisines`, `rating`, `ratingCount`, `deliveryTime`, `minOrder`, `deliveryFee`/radius, `isOpen`, `opensAt`, `offers`, `address`, `location`, `menu`, `badges` | Restaurant page, cart header, tracking |
| 7 | GET | `/restaurants/:id/menu` | no | — | array of `{category, items[]}` or flat items or `{category: items[]}`; item: `_id`, `name`, `price`, `originalPrice`, `image`, `isVeg`, `available`/`isAvailable`, `bestseller`, `recommended`, `customizations[]` (`title`, `options[]` with `label`, `extraPrice`, `pricingMode`, `isVeg`) | Restaurant menu, customise sheet |
| 8 | GET | `/restaurants/:id/reviews?page=&limit=5` | no | — | `data[]`, `page`, `pages`, `total`, `summary` | Restaurant reviews |
| 9 | GET | `/restaurants/serviceability?lat=&lng=` | no | — | `data.serviceable` (bool), radius/distance | Location onboarding, service-closed gate |
| 10 | GET | `/platform/public-status` (+ `?_=<ts>`) | optional | — | `isUnderMaintenance`, `maintenanceTitle`, `maintenanceMessage`, `maintenanceEta`, `isDeliveryPausedShortage`, `isRainSurgeActive`, `rainSurgeExtraMinutes`, `rainSurgeFee`, `isCodEnabled`, `isUpiEnabled`, `maxCodOrderAmount`, `freeDeliveryMinSubtotal`, `isGlobalFreeDelivery`, `isFirstOrderFreeDelivery`, `platformHandlingFee`, `smallCartFee`, `smallCartThreshold`, `packagingChargePerItem`, `taxPercent`, `isFirstOrder`, `isCodBlocked`, `canOrder`, `state` (`open` \| `closed_hours` \| `closed_manual` \| `maintenance` \| `shortage`) | Closed banner + closed overlay, payment options |
| 11 | POST | `/analytics/visit` | optional | `eventType`, `restaurantId`, `menuItemId`, `sessionId`, `eventKey`, `eventId`, `clientTimestamp`, `platform`, `referrer`, `source` | none (fire-and-forget, `keepalive`, beacon fallback) | Menu / dish views |

### 2.2 Pricing (the backend is the money authority)

| # | Method | Path | Auth | Request | Fields used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | POST | `/pricing/quote` | optional | `restaurantId`, `addressId`, `items[{menuItem, quantity}]`, `paymentMethod` (`upi`\|`cod`), `couponCode?`, `tipAmount?` — never a price, fee or distance | `bill` (`grandTotal`, `total`, `itemTotal`, `deliveryFee`, `taxes`, `packaging`, `platformFee`, `couponDiscount`, `tip`, `roundOff`), `freeDelivery`, `discount`, `contribution`, `quoteId`, `quoteIssuedAt`, `quoteExpiresAt`, `isFirstOrder`, `isCod`, `paymentMethod` | Cart bill, checkout |
| 13 | GET | `/pricing/restaurant-cards?addressId=&restaurantIds=&eligibleSubtotal=` | optional | — | per-restaurant delivery fee / ETA / free-delivery state for the card | Home / ₹99 cards |
| 14 | GET | `/pricing/payment-options?restaurantIds=&total=&foodSubtotal=&discount=` | optional | — | `payment.upi`, `payment.cod`, `payment.gates`, `restaurants[]` | Checkout payment selector (display only; `POST /orders` re-checks) |
| 15 | GET | `/pricing/config` | no | — | engine flags / limits | Debug + checkout |

`POST /pricing/quote` answers **409** with `{success:false, code, message, data:<quote>}`
when the basket is not serviceable; the quote under `data` is still rendered.
Codes the client reacts to: `PROFITABLE`, `REPRICING_REQUIRED`,
`NOT_ECONOMICALLY_SERVICEABLE`.

### 2.3 Auth

| # | Method | Path | Auth | Request | Response used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | POST | `/users/login` | no | `{email, password}` or `{phone:'+91…', password}` | `success`, `token`, `user` | Login (email/password) |
| 17 | POST | `/auth/firebase` | no | `{idToken}` (Firebase ID token) | `success`, `token`, `user`; or `code:'PROFILE_REQUIRED'` + `data.profile` | Login (Google) |
| 18 | POST | `/auth/firebase/complete-profile` | no | `{idToken, name, phone, password, adultConfirmed}` | `success`, `token`, `user` | Complete profile (Google new user) |
| 19 | POST | `/users/forgot-password/email` | no | `{email}` | `success` (same answer whether or not the account exists) | Forgot password |
| 20 | POST | `/users/forgot-password/email/verify` | no | `{email, otp}` | `data.resetToken` | Forgot password |
| 21 | POST | `/users/forgot-password/email/reset` | no | `{resetToken, password}` | `success` | Reset password |

Token storage (unchanged by the app): `localStorage.nearbite_token`,
`localStorage.token`, `localStorage.nearbite_user` (JSON), and a session copy
of `nearbite_token`. There is **no refresh token**: the JWT is used until it
expires, and a `401`/`403` clears the session and sends the customer to login.

### 2.4 Profile and addresses

| # | Method | Path | Auth | Request | Fields used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 22 | GET | `/users/profile` | yes | — | `name`, `email`, `phone`, `avatar`, `adultConfirmedAt`, `isFirstOrder`, `isCodBlocked` | Profile, checkout, complete profile |
| 23 | PUT | `/users/profile` | yes | `{name, email?, phone?, password?, adultConfirmed?}` | `success`, `data` (normalised user) | Profile edit, complete profile |
| 24 | GET | `/users/addresses` | yes | — | array, or `{addresses}`, or `{data:{addresses}}`, or `{data}` | Address list, cart address block |
| 25 | POST | `/users/addresses` | yes | `{tag, house, area, landmark, city, pincode, receiverName, receiverPhone, latitude, longitude, isDefault, deliveryInstructions?}` | `data._id` | Add address |
| 26 | PUT | `/users/addresses/:id` | yes | same body | `data._id` | Edit address |
| 27 | PATCH | `/users/addresses/:id/default` | yes | — | `success` | Make default |
| 28 | DELETE | `/users/addresses/:id` | yes | — | `success` | Delete address |

### 2.5 Cart, orders, payment

| # | Method | Path | Auth | Request | Response used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 29 | POST | `/orders` | yes | `items[{menuItem, name, price, quantity, customizations}]`, `deliveryAddress`, `addressId`, `restaurantId`, `restaurantName`, `subtotal`, `deliveryFee`, `total`, `paymentMethod`, `restaurantNote`, `restaurantNotes?`, `deliveryInstructions`, `tipAmount`, `couponCode`, `quoteId`; header `Idempotency-Key` | `success`, `data._id`, `data.total`, `data.paymentStatus`, `data.orderNumber`, `payment.orderId/amount/currency`, `partialCodAdvanceAmount` | Checkout |
| 30 | GET | `/orders` | yes | — | `data[]`: `_id`, `orderNumber`, `createdAt`, `restaurantName`, `items[]`, `total`, `status`, `paymentMethod`, `paymentStatus`, `deliveryAddress`, `rider`, `timeline` | Orders list (polled every 10 s), tracking, order support |
| 31 | PUT | `/orders/:id/cancel` | yes | `{reason}` | `success`, refreshed order | Track order |
| 32 | GET | `/orders/:id/review` | yes | — | `data` (existing review: ratings, comment, photos, vendor reply) | Track order (delivered) |
| 33 | POST | `/orders/:id/review` | yes | rider/food/item ratings, `comment`, `photos[]?` | `success`, `data` | Track order (rate) |
| 34 | POST | `/cart/add` | yes | `{menuItemId, quantity, customizations}` | `success` | Reorder from Orders |
| 35 | POST | `/coupons/validate` | optional | `{code, subtotal, restaurantId?, paymentMethod}` | `data.code`, `discount`, `description`, `minOrder`, `paymentMethods[]`, `expiresAt`, `showPopup`; error `code` (`COUPON_INVALID`, …) + `message` | Cart coupon sheet |
| 36 | POST | `/payments/verify` | yes | `{razorpayOrderId, razorpayPaymentId, razorpaySignature}` | `data.paymentStatus` | Checkout (UPI) |
| 37 | GET | `/payments/:orderId/status` | yes | — | `data.paymentStatus`, `data.total` | Payment pending / failed reconciliation (poll ≤ 22 s, backoff 1.2 s → 3 s) |
| 38 | POST | `/payments/retry` | yes | `{orderId}` | `success`, `payment.orderId`, `alreadyPaid` | Payment failed |

`POST /orders` rejections the client handles by code, not by status:
`QUOTE_EXPIRED`, `QUOTE_PRICE_CHANGED`, `QUOTE_MISMATCH` → re-quote, show the
new bill, ask the customer to confirm again. `503` → platform block
(maintenance / rider shortage), surfaced through the platform banner.

### 2.6 Feedback, support, notifications

| # | Method | Path | Auth | Request | Response used | Screen |
| --- | --- | --- | --- | --- | --- | --- |
| 39 | GET | `/ratings/me` | yes | — | `data.used`, `data.max` (3), `data.ratings[]` | Rate us |
| 40 | POST | `/ratings` | yes | `{score, comment}` | `data.used`, `data.remaining` | Rate us |
| 41 | GET | `/support/tickets?orderId=` | yes | — | array or `{tickets}`; `_id`, `status`, `order`, `messages[]` | Order support |
| 42 | POST | `/support/tickets` | yes | `{orderId, category, subject, message, items[], issueCategory?, evidencePhotos[]?}` | `data._id` | Order support |
| 43 | GET | `/support/tickets/:id` | yes | — | `data` (ticket with `order`, `status`) | Order support deep link |
| 44 | POST | `/support/tickets/:id/messages` | yes | `{message}` | `data` | Order support chat |
| 45 | POST | `/notifications/register-token` | yes | `{token}` (FCM) | — | Push registration |
| 46 | POST | `/upload/customer-media` | optional | `multipart/form-data`, field `images` (JPEG ≤ 2× limit, client-shrunk) | `data.urls[]` (https) | Review photos, support evidence |

## 3. Behaviour rules that come from the backend, not the client

* Delivery fee, taxes, packaging, platform fee, coupon discount, tip folding,
  free-delivery state and the payable total come from `/pricing/quote` and
  `POST /orders` — the cart's local arithmetic is a preview only.
* Minimum basket, closed restaurant, unserviceable address, COD eligibility
  and max COD amount come from the quote / `/platform/public-status`.
* `POST /orders` is authoritative even when the client shows a quote; a
  mismatch is a re-quote, never a silent charge.

## 4. Not used by the customer frontend

`/platform/settings` (admin only), webhooks, rider and vendor routes, and the
Firebase Admin surface are never called from the customer pages.

## 5. Appendix — how the app must log in (decision pending)

What the original does today:

1. **Email or phone + password** → `POST /users/login` → `{token, user}` stored
   in `nearbite_token`, `token`, `nearbite_user`. Works in any WebView.
2. **Google** → Firebase `signInWithPopup` (falls back to
   `signInWithRedirect`) → Firebase ID token → `POST /auth/firebase`. New
   users continue on `complete-profile.html` and
   `POST /auth/firebase/complete-profile`.
3. **Forgot password** → email OTP (3 endpoints), no password needed to
   receive it.
4. **No refresh token.** The JWT is used until it expires; `401`/`403` clears
   the session and routes to login.

Inside a Capacitor 6 WebView (`https://localhost`):

| path | works? | why |
| --- | --- | --- |
| email/phone + password | yes | plain `fetch` to the API |
| email OTP reset | yes | plain `fetch` |
| Google popup | no | `window.open` is not a real popup in the WebView |
| Google redirect | no | Google rejects OAuth requests from embedded user-agents (`disallowed_useragent`), and the redirect returns to `https://localhost` |

Options for this app:

| option | effort | risk | notes |
| --- | --- | --- | --- |
| **A. Email/password only** (recommended to unblock) | ~0.5 day | low | no backend change, no Google Cloud work; Google-only customers can set a password through the email OTP reset |
| **B. Native Google sign-in** (Capacitor Google Auth plugin → ID token → `POST /auth/firebase`) | ~1–2 days | medium | needs the Android OAuth client (package `com.navereat.app` + SHA-1 for debug *and* release keystores) and the web client id as `serverClientId`; backend already accepts the ID token, so no server change |
| **C. Phone OTP login** | ~3–5 days | high | no OTP-login endpoint exists (only the email reset OTP); needs new backend routes, an SMS provider, rate limiting and per-message cost |

Recommendation: ship **A** now, add **B** as a follow-up if Google sign-in is a
hard requirement, skip **C** until the backend has phone OTP.
