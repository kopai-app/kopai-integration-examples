import AddToCart from "@/components/AddToCart";

const API_BASE = process.env.API_BASE || "http://express-api:3001";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await fetch(`${API_BASE}/products/${id}`, { cache: "no-store" });

  if (!res.ok) {
    return <h1>Product not found</h1>;
  }

  const product: Product = await res.json();

  return (
    <div style={{ maxWidth: 480 }}>
      <h1>{product.name}</h1>
      <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>${product.price}</p>
      <p style={{ color: "#666" }}>{product.stock} in stock</p>
      <AddToCart productId={product.id} />
    </div>
  );
}
