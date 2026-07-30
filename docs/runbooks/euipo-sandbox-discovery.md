# EUIPO Trademark Search — sandbox discovery

Documented from OpenAPI `trademark-search` **1.1.0** and live sandbox headers.
This is **reference for corpus filling / legacy scrape** only. The engine itself
scans the local mirrored corpus and does **not** call EUIPO at scan time.

## Environment

| Item | Value |
|---|---|
| API base | `https://api-sandbox.euipo.europa.eu/trademark-search` |
| Token URL | `https://auth-sandbox.euipo.europa.eu/oidc/accessToken` |
| Auth | OAuth2 client_credentials, scope `uid` |
| Client header | `X-IBM-Client-Id: <client_id>` on every API call |
| Access token TTL | 2 hours (7200s) per EUIPO FAQ |

Sandbox ≠ production data. Sandbox is a historical/synthetic snapshot.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET | `/trademarks` | Paginated search (RSQL `query`, `page`, `size`, `sort`, `fields`) |
| GET | `/trademarks/{applicationNumber}` | Detail record |

Also defined (not used for lean woordmerk mirror): image, thumbnail, sound, video, model.

## Pagination

- 0-based `page`
- `size` hard range **10–100** (size &lt; 10 → HTTP 400)
- Response includes `totalElements`, `totalPages`

## Rate limits (Default Plan — live headers)

Observed response headers:

```
x-burstlimit-limit: name=default,200
x-ratelimit-limit:  name=default,25000
```

| Limit | Hard | Soft cap used by legacy scrape |
|---|---|---|
| Burst | **200 / minute** | 140 / minute |
| Daily | **25 000 / day** | 24 000 / day |

Exceeding plan limits → HTTP **429** with `Retry-After`.
Sandbox and production share the same plan-limit model (EUIPO FAQ).

## Word-mark volume (sandbox, measured)

| Query | `totalElements` |
|---|---|
| (all) | ~2.35M |
| `markFeature==WORD` | ~1.35M |

## Lean mirror fields (`test_database_europa`)

Stored for engine bridge experiments:

- `application_number` (PK)
- `mark_name` (verbal element)
- `status`
- `nice_classes`
- `application_date`
- `registration_date`

## Operational notes

- Prefer **one process** with shared rate limiter + low concurrency (2). Multiple independent processes easily blow the 200/min burst and cause 401/500 cascades.
- Persistent single-page **500** responses should be skipped and logged; do not stall the whole import.
- Upsert on `application_number` keeps parallel/resume runs idempotent (no duplicate PKs).
- OpenAPI copy: `openapi/trademark-search_1.1.0.json` (or under `legacy/` if relocated).

## Explicit non-assumptions (still open)

- Reliability of `updateDate` for true incremental sync
- Client-credentials privacy gaps (hidden applicants until fee paid)
- Full goods/services text quality on detail endpoints in sandbox
- How representative sandbox statuses/dates are vs production
