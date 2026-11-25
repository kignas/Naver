# Data source seam

One interface, two implementations. Pages never call `fetch`; they call the
`DataSource` (or a hook that wraps it), so demo data and the live API stay
interchangeable.

```
src/data/dataSource.ts      the interface + the shared types (ApiFailure, Quote, Address, …)
src/data/demoDataSource.ts  the bundled demo data, behind the same interface
src/data/api/http.ts        transport: base URL, envelope, timeouts, errors, cache, tokens
src/data/api/apiDataSource.ts  mappers + the endpoint calls
src/data/api/fixtures.json  scrubbed live payloads (recorded by scripts/api-readonly.ts)
src/data/api/fixtures.ts    offline fetcher used only when VITE_API_FIXTURES=1
src/data/index.ts           mode selection + the React hooks
```

## Modes

| mode | how | data | network |
| --- | --- | --- | --- |
| `demo` (default) | nothing to do | `src/data/demo.ts` | none |
| `api` | `VITE_DATA_SOURCE=api` at build time, or the debug panel switch, or `localStorage.navereat_data_source = 'api'` | `https://api.eatswada.com/api` | yes |
| `api` + fixtures | `VITE_DATA_SOURCE=api VITE_API_FIXTURES=1` | the recorded payloads | none |

The demo path is **synchronous**: in demo mode the pages keep reading the
bundled data directly, so the first paint, the route CSS and every parity
screenshot are exactly what they were before the seam existed. Only api mode
waits for a promise.

The api source is a **separate chunk** (`apiDataSource-*.js`) and the demo
source too, so the demo entry bundle does not pay for the transport. Fixtures
are a third chunk, imported only when `VITE_API_FIXTURES=1`.

## Interface

```ts
interface DataSource {
  mode: 'demo' | 'api';
  getHome(): Promise<{ restaurants; categories; banners }>;
  getRestaurant(id): Promise<{ restaurant; menu }>;
  getMenu(id): Promise<MenuItem[]>;
  search(query): Promise<SearchResult[]>;
  getCategories(): Promise<Category[]>;
  getBanners(placement?): Promise<Banner[]>;
  getPlatformStatus(): Promise<PlatformStatus>;
  getQuote(request): Promise<Quote>;
  validateCoupon(input): Promise<CouponCheck>;
  login(credentials): Promise<Session>;
  getProfile(): Promise<DemoUser>;
  getAddresses(): Promise<Address[]>;
  getOrders(): Promise<Order[]>;
  getOrder(id): Promise<Order | null>;
  getCoupons(): Promise<Coupon[]>;
}
```

Money is **rupees** on both sides of the seam (`Quote.bill`, `MenuItem.price`),
matching the API.

### Restaurant ids

The API keys restaurants by ObjectId; the app routes by number
(`/restaurant/3`). `apiDataSource` keeps a per-session registry that assigns a
stable number to each ObjectId as the feed is read, and `externalRestaurantId()`
turns the number back into the ObjectId for `/restaurants/:id` and
`/restaurants/:id/menu`. Demo ids are already numbers and are untouched.

## Hooks

```tsx
const feed = useHomeFeed();          // { mode, data, loading, error, reload }
const detail = useRestaurantData(id); // { mode, restaurant, menu, loading, error }
const status = usePlatformStatusData();
const hits = useSearchResults(query);
```

Every hook is a no-op in demo mode (`loading:false`, `data:null`), which is why
demo rendering never waits.

## What is wired today

| surface | demo | api |
| --- | --- | --- |
| Home feed + category strip | bundled data | `GET /restaurants`, `GET /categories` (card skeletons until they land) |
| Search overlay | local walk over the demo menus | `GET /restaurants/search?scope=home` |
| Restaurant page + menu | bundled data | `GET /restaurants/:id` + `/menu` |
| Ordering-closed gate | never shown (demo is always open) | `GET /platform/public-status`, banner + home overlay, checkout refused while closed, 30 s re-check, fail-open |
| Cart pricing, orders, profile, addresses, coupons | demo | **not wired yet** — the methods exist and are verified read-only; see `docs/API_VERIFICATION.md` |

## Errors

Every failure is an `ApiFailure` (`kind`, `status?`, `code?`, `message`,
`retryable`) with the original's user-facing text:

| kind | when | message |
| --- | --- | --- |
| `network` | fetch rejects | "Can't reach the server. Check your connection." |
| `timeout` | 12 s abort | "The server took too long to respond." |
| `parse` | body is not JSON | "The server sent a response we could not read." |
| `http` | non-2xx or `success:false` | the server's `message`, else a status-specific fallback |
| `auth` | 401/403 | the server's `message`; the session is cleared and `navereat:session-expired` fires |

The closed gate **fails open**: a status error means "ordering is open".

## Caching

| data | store | key | age |
| --- | --- | --- | --- |
| restaurants | sessionStorage | `es_restaurants_v4` | 10 min |
| categories | sessionStorage | `es_categories_v4` | 10 min |
| banners | localStorage | `ew_banners_v1:<placement>` | 10 min |
| menu | localStorage | `ew_menu_v1:<restaurantId>` + `ew_menu_v1:index` | 10 min, 6 entries, 600 kB |
| platform status | memory | — | 60 s |

Token storage is unchanged: `nearbite_token`, `token`, `nearbite_user`, plus the
session copy of `nearbite_token`.

## Release variants

One workflow builds two APKs from the same commit and the same signing key, so
they install side by side:

| file | `VITE_DATA_SOURCE` | applicationId | label |
| --- | --- | --- | --- |
| `Navereat.apk` | `api` | `com.navereat.app` | Navereat |
| `Navereat-demo.apk` | `demo` | `com.navereat.app.demo` | Navereat Demo |

The variance lives in `android/app/build.gradle` (`prod`/`demo` flavors, the
demo flavor adds `applicationIdSuffix ".demo"` and `versionNameSuffix "-demo"`)
and in `android/app/src/demo/res/values/strings.xml` for the label. The web
bundle is the only other difference: the workflow builds and `cap sync`s twice.

The in-app debug panel keeps the data-source switch, so a tester can move
between api and demo without reinstalling. In api mode it also reports
`API reachable` / `API unreachable` (one platform-status read, no extra
request loop).

### api mode never falls back to demo data

A failed or empty api request renders the original's own states, not demo
content:

| surface | state |
| --- | --- |
| home feed | "Couldn't load restaurants" + the error message + "Try Again" (`#home-retry-btn`) |
| search | "Search is temporarily unavailable" / "Please check your connection and try again." |
| home header location | the customer's default saved address (`Home`, `42 Demo Street`-style detail); the original's logged-out pair "Set delivery location / Choose your delivery location" when there is no session or no address |
| "Nearby restaurants · X" strip | the saved address's city, else the service town (`Maynaguri`) |
| restaurant page | its own menu/availability from the api; demo strings stay in demo mode only |

## Adding an endpoint

1. Add the method to `DataSource` and implement it in `demoDataSource`.
2. Implement it in `apiDataSource` with a `toX()` mapper that accepts the raw
   payload (the API has three shapes for lists; see `listFrom`).
3. Call it through a hook (`useApiQuery`) so demo mode stays synchronous.
4. Add a row to `docs/API_VERIFICATION.md` and, if it is a new read, re-record
   the fixtures with `npx vite-node scripts/api-readonly.ts --fixtures`.

## Tests

`npx vite-node scripts/api-readonly.ts` runs the read-only pass against the
live API and prints the parity table. Without `NAVEREAT_TEST_EMAIL` /
`NAVEREAT_TEST_PASSWORD` the logged-in flows are reported as skipped and no
account is touched. The order test is separate and only runs on request.
