# Recorded API fixtures

`fixtures.json` holds real `api.eatswada.com` responses recorded once, so the
visual/perf/stress harnesses can drive the **api** data source offline (no
network in CI or on a review machine). Key = request path, value = JSON body.

The recording was taken while the backend was serving a **closed** service, so
an orderable state is restored afterwards. These are the only edits; every
other byte is what the API returned:

- `/platform/public-status` → `serviceStatus` is `open` / `canOrder:true` with
  blank `title`, `message`, `detail`.
- The restaurant (feed item and detail) is open: `isOpen`, `__isOpen`,
  `orderable`, `operational.open` are true, `availability.status` is `open`,
  and `closedReason` / `reason` / `label` are blank.

Re-record with `npx vite-node scripts/api-readonly.ts --fixtures`; never
hand-edit shapes, only those two blocks.
