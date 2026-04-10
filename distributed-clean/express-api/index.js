const express = require("express");

const app = express();
app.use(express.json());

const products = [
  { id: 1, name: "Mechanical Keyboard", price: 149.99, stock: 25 },
  { id: 2, name: "USB-C Hub", price: 59.99, stock: 12 },
  { id: 3, name: "Monitor Stand", price: 89.99, stock: 8 },
];

const cart = [];

function validatePayment() {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ valid: true }), 2000);
  });
}

app.get("/products/:id", (req, res) => {
  const product = products.find((p) => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

app.post("/cart", async (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find((p) => p.id === Number(productId));
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (product.stock < quantity)
    return res.status(400).json({ error: "Insufficient stock" });

  if (process.env.ENABLE_PAYMENT_VALIDATION === "true") {
    await validatePayment();
  }

  const cartId = cart.length + 1;
  cart.push({ cartId, productId: product.id, quantity });
  product.stock -= quantity;

  res.json({ success: true, cartId });
});

app.get("/cart", (_req, res) => {
  res.json(cart);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`express-api listening on port ${PORT}`);
});
