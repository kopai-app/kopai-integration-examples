"use client";

import { useState } from "react";

export default function AddToCart({ productId }: { productId: number }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      style={{
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        background: status === "success" ? "#16a34a" : status === "error" ? "#dc2626" : "#2563eb",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: status === "loading" ? "wait" : "pointer",
        opacity: status === "loading" ? 0.7 : 1,
      }}
    >
      {status === "loading" ? "Adding..." : status === "success" ? "Added!" : status === "error" ? "Failed" : "Add to Cart"}
    </button>
  );
}
