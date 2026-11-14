# OpenMarket — API Contracts

**Document version:** 0.1.0 (Draft — team review required)  
**Last updated:** 14 November 2026  
**Project:** OpenMarket — Distributed Multi-Vendor Marketplace  
**Project Leader:** Bineth  
**Team Member:** Dausni  
**Known working milestone:** Customer Frontend (`http://localhost:5173`) successfully fetches sample products from Product Service (`http://localhost:8788`).

> **Purpose:** This is the shared agreement between frontend developers and service owners. Do not change an agreed API field, endpoint, status code, or event payload without updating this file, reviewing the change together, and updating the affected tests. Endpoints other than the existing product-list route are **proposed**, not yet implemented.

## 1. Service ownership

| Service / app | Owner | Responsibilities |
|---|---|---|
| Customer Web (`apps/customer-web`) | Bineth | Customer browsing, auth pages, cart UI, checkout and order history |
| API Gateway (`gateway/api-gateway`) | Bineth | Public API routing, authentication enforcement, CORS and service bindings |
| Auth Service | Bineth | Authentication integration, customer/seller identity, roles, user profile |
| Inventory Service | Bineth | Stock, atomic reservations, release and confirmation |
| Order Service | Bineth | Order lifecycle, pricing snapshots, coordination and recovery |
| Payment Service | Bineth | **Simulated** payment only; no real money collected |
| Seller Dashboard (`apps/seller-dashboard`) | Dausni | Shop setup, products, seller order views |
| Store Service | Dausni | Stores, shop ownership and seller profiles |
| Product Service | Dausni | Product CRUD, listing, categories and product image URL |
| Cart Service | Dausni | Customer cart management |
| Notification Service | Dausni | In-app notifications, order/payment status messages |

## 2. Shared conventions

- **Transport:** HTTPS in deployed environments; HTTP on localhost.
- **Path style (MVP):** `/api/...` (keep the existing `/api/products` route working). Introducing `/api/v1` later requires a coordinated API version change.
- **Content type:** `application/json` for requests/responses, unless explicitly noted.
- **Field naming:** `camelCase`; entity IDs are strings (e.g., `p001`, `store001`).
- **Time values:** ISO 8601 strings in UTC, e.g., `2026-11-14T10:30:00Z`.
- **Currency/prices:** `currency: "LKR"`, `price` is a nonnegative **integer number of Sri Lankan rupees** in the initial MVP (no fractional rupee prices). Do not use floating-point arithmetic for real-money settlements; this project uses mock payments only. All order totals are recomputed server-side.
- **Successful list response:** **plain JSON array** for `GET /api/products` to preserve the current working Customer Frontend integration. Do not silently wrap it in `{ products: [...] }`.
- **Errors:** use a consistent object, as below; status codes: `400` invalid input, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict (e.g., insufficient stock), `500` internal error. For validation errors, `422` may be used if both developers agree.
- **Authentication:** `Authorization: Bearer <access_token>` on protected routes. Supabase Auth Free is the planned identity provider; verify tokens on the server. Never trust a client-submitted `userId`, `sellerId`, `role`, total price, or payment confirmation as authority. Admin role must never be self-assigned at registration.
- **Roles:** `CUSTOMER`, `SELLER`, `ADMIN`. Public product browsing needs no login.
- **Database ownership:** each microservice owns its tables/database. A service may **not** read/write another service's database directly; call the owning service or consume its events.
- **Local addresses:** Customer Frontend `http://localhost:5173`; Product Service `http://localhost:8788`. Other service ports and gateway address are **to be assigned** and recorded in this document before integration.
- **External interface:** once the API Gateway is in place, frontend apps should call the gateway rather than the individual service URLs.

### Standard error example

```json
{
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "The requested product was not found."
  }
}
```

## 3. Product Service — Dausni (first agreed contract)

**Service code:** `services/product-service`  
**Local base URL:** `http://localhost:8788`  
**Dependencies:** Store Service is required for real seller-owned product creation; authentication is required for protected writes. Public list/read must work independently.

| Method | Endpoint | Access | Purpose | Status on success |
|---|---|---|---|---|
| GET | `/health` | Public | Service health | 200 |
| GET | `/api/products` | Public | List active products | 200 |
| GET | `/api/products/:productId` | Public | Read a product | 200 |
| POST | `/api/products` | SELLER | Create product for an owned store | 201 |
| PATCH | `/api/products/:productId` | Seller owner | Update product | 200 |
| DELETE | `/api/products/:productId` | Seller owner | Soft deactivate product | 204 |

### Product schema (MVP)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Response: yes | Generated on server |
| `storeId` | string | Yes | Existing seller-owned store |
| `name` | string | Yes | 1–150 chars suggested |
| `description` | string | No | Plain text |
| `price` | integer | Yes | Whole LKR; `>= 0` |
| `currency` | string | Yes | Always `LKR` in MVP |
| `imageUrl` | string or null | No | Cloudinary-hosted image URL or `null` |
| `status` | enum | Yes | `draft`, `active`, `inactive` |
| `createdAt` | ISO date string | Response: yes | Server-generated |

> **Inventory note:** `stockQuantity` is owned by Inventory Service, not Product Service. Cart/Order services must verify inventory at checkout; just seeing a product does not guarantee stock.

### GET /api/products — response (200)

**Maintain this as a plain array; it is an agreement with Bineth's existing frontend.** Initially fields `storeId`, `description`, `imageUrl`, and `status` can be added without removing or renaming existing ones.

```json
[
  {
    "id": "p001",
    "storeId": "store001",
    "name": "Wireless Headphones",
    "description": "Bluetooth headphones",
    "price": 4500,
    "currency": "LKR",
    "imageUrl": null,
    "status": "active",
    "createdAt": "2026-11-14T10:30:00Z"
  }
]
```

**Empty success:** `[]` (HTTP 200).  
**Public behavior:** include only `active` products. Pagination/search may be added later with a coordinated change; do not silently replace array shape.

### GET /api/products/p001 — response (200)

```json
{
  "id": "p001",
  "storeId": "store001",
  "name": "Wireless Headphones",
  "description": "Bluetooth headphones",
  "price": 4500,
  "currency": "LKR",
  "imageUrl": null,
  "status": "active",
  "createdAt": "2026-11-14T10:30:00Z"
}
```

**Not found:** HTTP 404 with code `PRODUCT_NOT_FOUND`.

### POST /api/products — seller request

```http
POST /api/products
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "storeId": "store001",
  "name": "Wireless Headphones",
  "description": "Bluetooth headphones",
  "price": 4500,
  "currency": "LKR",
  "imageUrl": null,
  "status": "active"
}
```

**Response:** HTTP 201 with the saved product object and server-generated `id`, `createdAt`.  
**Security:** seller must own `store001`; the store owner is verified server-side through the Store/Auth service. Reject product creation for another seller's store with HTTP 403. This route can initially be tested locally with a clearly separated mock identity that is never accepted in production.

### PATCH /api/products/:productId — seller request

```json
{
  "name": "Wireless Headphones Pro",
  "price": 5500
}
```

**Response:** HTTP 200 with updated product object. Recalculate existing cart amounts when showing totals; Order Service creates its own trusted price snapshot at checkout.

## 4. Auth Service — Bineth

**Planned identity provider:** Supabase Auth Free. Store only the minimum required app profile/role metadata outside the identity provider; secrets remain server-side.

| Method | Endpoint | Access | Request / response summary |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Email, password, requested role (`CUSTOMER` or `SELLER` only); result includes identity/session behavior configured with Supabase |
| POST | `/api/auth/login` | Public | Email, password; result includes authenticated session/token if allowed |
| POST | `/api/auth/logout` | Authenticated | Sign out/revoke or clear session as supported by chosen session strategy |
| GET | `/api/auth/me` | Authenticated | `{ "id": "u001", "email": "seller@example.com", "role": "SELLER" }` |

**Important:** Exact Supabase signup/email-verification and token-handling behavior is a pending implementation choice. Confirm it before the frontend depends on a specific login/signup response. Never store plaintext passwords in D1. Admin identities must be provisioned by an authorized administrator, never by a public signup request.

## 5. Store Service — Dausni

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/stores` | SELLER | Create owned shop |
| GET | `/api/stores` | Public | Browse active shops |
| GET | `/api/stores/:storeId` | Public | Read shop |
| GET | `/api/stores/me` | SELLER | Fetch seller's own store(s) |
| PATCH | `/api/stores/:storeId` | Seller owner | Update own shop |

**POST request:**

```json
{
  "name": "Dausni Electronics",
  "description": "Electronics and accessories"
}
```

**201 response:**

```json
{
  "id": "store001",
  "ownerUserId": "u001",
  "name": "Dausni Electronics",
  "description": "Electronics and accessories",
  "status": "active"
}
```

`ownerUserId` must come from verified authentication, not the request body. Seller product creation depends on this store existing.

## 6. Inventory Service — Bineth

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/inventory/:productId` | Authenticated / internal | Available stock for a product |
| PUT | `/api/inventory/:productId` | Authorized store owner / internal | Initialize or adjust stock |
| POST | `/api/inventory/reservations` | Order Service only | Atomically reserve stock for an order |
| POST | `/api/inventory/reservations/:reservationId/confirm` | Order Service only | Finalize reserved stock |
| POST | `/api/inventory/reservations/:reservationId/release` | Order Service only | Restore stock after cancel/payment failure |

**Reserve request (internal):**

```json
{
  "orderId": "ord001",
  "items": [
    { "productId": "p001", "quantity": 2 }
  ],
  "idempotencyKey": "ord001-reserve"
}
```

**Success response (200 or 201 — agree before implementing):**

```json
{
  "reservationId": "res001",
  "orderId": "ord001",
  "status": "reserved",
  "expiresAt": "2026-11-14T10:45:00Z"
}
```

**Insufficient stock:** HTTP 409, code `INSUFFICIENT_STOCK`. Two concurrent orders must not reserve the same last item. Use database atomicity and idempotent reservation keys. Server-side timeouts/reconciliation should release abandoned reservations.

## 7. Cart Service — Dausni

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/cart` | CUSTOMER | Get logged-in customer's cart |
| POST | `/api/cart/items` | CUSTOMER | Add product and quantity |
| PATCH | `/api/cart/items/:productId` | CUSTOMER | Change quantity |
| DELETE | `/api/cart/items/:productId` | CUSTOMER | Remove item |
| DELETE | `/api/cart` | CUSTOMER | Clear cart |

**Add request:**

```json
{ "productId": "p001", "quantity": 2 }
```

**Cart response:**

```json
{
  "id": "cart001",
  "items": [
    { "productId": "p001", "quantity": 2 }
  ]
}
```

Cart stores product references and quantity only. Product details/prices displayed to customers are fetched from Product Service. Adding to cart does **not** reserve stock. A cart may contain multiple stores, but MVP checkout supports one store per order; the UI must clearly separate or block mixed-store checkout.

## 8. Order Service — Bineth

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/orders` | CUSTOMER | Checkout one store from customer's cart |
| GET | `/api/orders` | CUSTOMER | Customer's order history |
| GET | `/api/orders/:orderId` | Customer owner / seller owner | View authorized order |
| POST | `/api/orders/:orderId/cancel` | Customer owner / authorized admin | Cancel if allowed by status |
| GET | `/api/orders/seller?storeId=store001` | Seller owner | Seller's orders |

**Checkout request (MVP):**

```json
{ "storeId": "store001" }
```

Order Service fetches the authenticated customer's cart from Cart Service, verifies all checked-out items belong to that store, re-fetches prices from Product Service, creates an immutable **price snapshot**, and reserves stock via Inventory Service. Never accept a payment total or customer ID from the browser as trusted information.

**Accepted response (202):**

```json
{
  "id": "ord001",
  "storeId": "store001",
  "status": "PENDING_PAYMENT",
  "currency": "LKR",
  "total": 9000,
  "items": [
    { "productId": "p001", "quantity": 2, "unitPrice": 4500 }
  ]
}
```

**MVP status choices:** `PENDING_PAYMENT`, `CONFIRMED`, `CANCELLED`, `FAILED`. Match frontend labels to these exact strings. If payment fails or reservation expires, release inventory safely. Duplicate checkout attempts must be detected with an idempotency key or equivalent guard.

## 9. Payment Service — Bineth (mock/demo only)

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/payments/mock` | CUSTOMER order owner | Simulate a success/failure for the customer's pending order |
| GET | `/api/payments/:orderId` | Authorized order party | Read simulated payment status |

**Mock request:**

```json
{
  "orderId": "ord001",
  "simulate": "success"
}
```

**Response (200):**

```json
{
  "paymentId": "pay001",
  "orderId": "ord001",
  "status": "SUCCEEDED",
  "amount": 9000,
  "currency": "LKR",
  "mode": "SIMULATION"
}
```

Other possible values: `simulate: "failure"`, payment `status: "FAILED"`. Order ownership and trusted order amount are validated server-side; never accept the amount from the browser. **No actual bank/card charge occurs.** Mock success cannot be treated as real proof of payment; the demo must clearly state this limitation.

## 10. Notification Service — Dausni

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/notifications` | Authenticated | List recipient's in-app notifications |
| PATCH | `/api/notifications/:notificationId/read` | Notification owner | Mark as read |

**Notification response example:**

```json
[
  {
    "id": "notif001",
    "recipientUserId": "u001",
    "type": "ORDER_CONFIRMED",
    "message": "Your order ord001 has been confirmed.",
    "read": false,
    "createdAt": "2026-11-14T11:00:00Z"
  }
]
```

Backend notifications are triggered asynchronously by order/payment events. Email/SMS are **not required** for the zero-budget MVP.

## 11. Event contracts (planned Cloudflare Queues integration)

**Standard envelope:**

```json
{
  "eventId": "evt001",
  "eventType": "payment.succeeded",
  "eventVersion": 1,
  "occurredAt": "2026-11-14T11:00:00Z",
  "data": {
    "orderId": "ord001",
    "paymentId": "pay001"
  }
}
```

| Event | Producer | Consumers | Expected action |
|---|---|---|---|
| `order.created` | Order Service (Bineth) | Notification Service (Dausni) | Notify customer/seller of pending order |
| `payment.succeeded` | Payment Service (Bineth) | Order Service (Bineth) | Confirm order and reserved stock |
| `payment.failed` | Payment Service (Bineth) | Order Service (Bineth) | Mark failed and release stock |
| `order.confirmed` | Order Service (Bineth) | Notification Service (Dausni) | Notify customer and seller |
| `order.cancelled` | Order Service (Bineth) | Notification Service (Dausni) | Notify parties of cancellation |

**Event rules:** consumers must deduplicate by `eventId`, tolerate retries/out-of-order delivery where relevant, and never assume event delivery happens exactly once. Queue configuration, dead-letter handling and reservation timeout recovery must be tested before the final demo.

## 12. Dependencies and handoff order

| Build / handoff | Owner | Depends on | Unblocks |
|---|---|---|---|
| Product read API (existing) | Dausni | Nothing for mock data | Bineth's Customer Product UI (already working) |
| Product D1 storage | Dausni | D1 schema/migrations | Persistent customer catalog |
| Auth token & role contract | Bineth | Supabase Auth configuration | Protected seller endpoints and Seller Dashboard login |
| Store creation | Dausni | Auth identity (can mock locally first) | Seller product creation |
| Product write API | Dausni | Store ownership + Auth | Seller Dashboard product forms |
| Inventory API | Bineth | Product identifiers | Stock management and orders |
| Cart API | Dausni | Product identifiers | Bineth's Cart UI and checkout |
| Order API | Bineth | Cart + Product + Inventory | Customer checkout |
| Payment mock API | Bineth | Order status | Payment confirmation demo |
| Notification consumer | Dausni | Order/Payment events | In-app updates |

### Work in parallel without blocking each other

1. Bineth builds Auth Service, Customer login UI, the API Gateway skeleton, and Inventory Service contract; Dausni builds Product D1 read CRUD and Seller Dashboard static product pages.
2. For endpoints not yet available, use **explicit frontend mocks** with the same response shapes as this document; disable mocks before production/demo integration.
3. Agree on the Product/Store/Auth handoff before enabling protected seller writes.
4. Agree on Cart/Order API and event envelope before implementing checkout or notifications.

## 13. Git and contract-change workflow

1. Bineth creates `docs/api-contracts.md` and commits it to a feature/docs branch.
2. Open a PR into `develop`; Dausni reviews Product, Store, Cart, Notification sections.
3. Both approve the **field names, types, response envelopes, status codes, authentication and permissions** before merging.
4. Whenever an endpoint changes, update this document **in the same PR** as the code and tests.
5. Add a sample request and response, an error case, and a test for each implemented endpoint.
6. Never merge an API breaking change without coordinating the dependent frontend/service update.

### Example branch/commit commands

```powershell
git switch develop
git pull origin develop
git switch -c docs/api-contracts
# Create or edit docs/api-contracts.md
git add docs/api-contracts.md
git commit -m "docs: define OpenMarket API contracts"
git push -u origin docs/api-contracts
```

## 14. First API verification checklist

- [ ] `npm run dev:products` serves `GET http://localhost:8788/api/products` with HTTP 200.
- [ ] Response is a **JSON array**, not an object wrapper.
- [ ] Each product has `id`, `name`, numeric `price`, `currency`.
- [ ] `npm run dev:customer` loads and shows products on `http://localhost:5173`.
- [ ] Browser has no CORS/network errors.
- [ ] Product Service returns `[]` (not an exception) when no active products exist.
- [ ] `GET /api/products/:productId` returns 404 for an unknown ID.
- [ ] Protected seller writes reject missing/invalid authentication once Auth integration is ready.
- [ ] Both developers have approved the document and linked it from `README.md`.

### Check locally in PowerShell

```powershell
Invoke-RestMethod http://localhost:8788/health
Invoke-RestMethod http://localhost:8788/api/products | ConvertTo-Json -Depth 10
```

## 15. Pending decisions (do not silently assume)

- Exact local ports and gateway URL for every new service.
- Auth signup/email verification/session behavior and D1 app profile schema.
- Whether each seller may create one store or multiple stores.
- Inventory reservation TTL and allowed stock adjustments.
- Error codes/status codes for all write endpoints and rate-limits.
- Multi-store cart checkout behavior (MVP: one store/order; UI must guide this).
- Additional product metadata, product search/pagination shape, categories and image-upload method.

**Version approval**

- Bineth — Project Leader: ____________________  Date: __________
- Dausni — Project Member: ____________________  Date: __________
