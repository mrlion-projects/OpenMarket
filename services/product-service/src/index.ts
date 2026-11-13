
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "http://localhost:5173",
    allowMethods: ["GET", "OPTIONS"]
  })
);

app.get("/health", (c) => {
  return c.json({
    service: "product-service",
    status: "running"
  });
});

app.get("/api/products", (c) => {
  // Temporary catalog until a product database is configured.
  return c.json([
    {
      id: "p001",
      name: "Wireless Headphones",
      price: 4500,
      currency: "LKR"
    },
    {
      id: "p002",
      name: "Gaming Mouse",
      price: 3200,
      currency: "LKR"
    },
    {
      id: "p003",
      name: "Mechanical Keyboard",
      price: 8500,
      currency: "LKR"
    }
  ]);
});

export default app;
