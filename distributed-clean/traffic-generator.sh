#!/bin/bash
BASE_URL="${1:-http://localhost:3000}"

echo "Traffic generator targeting $BASE_URL (every 2s)"
echo "Waiting for next-app to be ready..."

until curl -sf "$BASE_URL" > /dev/null 2>&1; do
  sleep 2
done

echo "next-app is up. Starting traffic loop."

while true; do
  curl -s "$BASE_URL/products/1" > /dev/null
  curl -s "$BASE_URL/products/2" > /dev/null
  curl -s -X POST "$BASE_URL/api/cart" -H "Content-Type: application/json" -d '{"productId":1,"quantity":1}' > /dev/null
  curl -s -X POST "$BASE_URL/api/cart" -H "Content-Type: application/json" -d '{"productId":2,"quantity":3}' > /dev/null
  echo "[$(date +%H:%M:%S)] 4 requests sent"
  sleep 2
done
