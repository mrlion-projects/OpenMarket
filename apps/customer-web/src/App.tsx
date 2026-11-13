import { useEffect, useState } from "react";
import "./App.css";

type Product = {
  id: string;
  name: string;
  price: number;
  currency: string;
};

const apiUrl = (
  import.meta.env.VITE_PRODUCT_API_URL?.trim() || "http://localhost:8788"
).replace(/\/+$/, "");

function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.id === "string" && product.id.length > 0 &&
    typeof product.name === "string" && product.name.length > 0 &&
    typeof product.price === "number" && Number.isFinite(product.price) &&
    product.price >= 0 &&
    typeof product.currency === "string" && /^[A-Z]{3}$/.test(product.currency)
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let active = true;

    fetch(`${apiUrl}/api/products`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Product request failed (HTTP ${res.status}).`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data) || !data.every(isProduct)) {
          throw new Error("The product service returned an invalid product list.");
        }
        if (active) setProducts(data);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(controller.signal.aborted
          ? "Loading products timed out. Please try again."
          : cause instanceof TypeError
            ? "Unable to reach the product service. Please check your connection and try again."
            : cause instanceof SyntaxError
              ? "The product service returned invalid JSON."
              : cause instanceof Error ? cause.message : "Unable to load products.");
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <main className="catalog">
      <h1>OpenMarket</h1>
      <h2>Browse Products</h2>

      {loading && <p role="status">Loading products…</p>}
      {!loading && error && (
        <div className="catalog-message" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => {
            setLoading(true);
            setError("");
            setAttempt((value) => value + 1);
          }}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && products.length === 0 && (
        <p role="status">No products are available yet. Please check back soon.</p>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <h3>{product.name}</h3>
              <p>
                {new Intl.NumberFormat("en-LK", {
                  style: "currency",
                  currency: product.currency,
                  currencyDisplay: "code",
                }).format(product.price)}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

export default App;
