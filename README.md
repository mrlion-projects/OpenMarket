# OpenMarket

## Local product catalog

From the repository root, install dependencies with `npm.cmd install` if needed.
Run the Product Service and Customer Frontend in separate terminals:

```powershell
npm.cmd run dev:products
```

```powershell
npm.cmd run dev:customer
```

Open http://localhost:5173. The frontend requests
http://localhost:8788/api/products. The Product Service also exposes `/health`.
On shells other than Windows PowerShell, `npm` can be used instead of `npm.cmd`.

The Product Service currently returns three temporary sample products with LKR
prices; no database binding is configured. Replace that catalog with database
queries when persistence is ready. The API contract is a JSON array of objects
with `id`, `name`, `price` (a number), and `currency` (a three-letter currency code).

The frontend defaults to http://localhost:8788. To override it, copy
`apps/customer-web/.env.example` to `apps/customer-web/.env.local`, edit
`VITE_PRODUCT_API_URL`, and restart Vite. This is the service origin, without
`/api/products`. Vite environment variables are public build-time values; do not
put secrets in them. For a different frontend origin, update the Product Service's
CORS allowlist in `services/product-service/src/index.ts` as well.

The Worker dev port is pinned to 8788. Vite uses port 5173 and fails if it is busy
instead of silently moving to an origin outside the CORS allowlist. If products
fail to load, check that both terminals are running and inspect the API response:

```powershell
curl.exe -i -H "Origin: http://localhost:5173" http://localhost:8788/api/products
```

The page shows loading, empty, and error states, with a retry button on errors.
Requests time out after ten seconds.

## Validation

```powershell
npm.cmd run build:customer
npm.cmd run lint -w apps/customer-web
apps/customer-web/node_modules/.bin/tsc.cmd --noEmit -p services/product-service/tsconfig.json
npm.cmd exec -w services/product-service -- wrangler deploy --dry-run
```

The final command validates and bundles the Worker locally without deploying it.

## API Documentation

The API contracts for all OpenMarket microservices
are documented here:

[OpenMarket API Contracts](docs/api-contracts.md)