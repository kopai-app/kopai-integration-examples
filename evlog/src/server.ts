import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { DrainContext, RequestLogger } from 'evlog'
import { createError, createRequestLogger, initLogger, parseError } from 'evlog'
import { createOTLPDrain } from 'evlog/otlp'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

// --- evlog init with OTLP drain ---

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
const otlpDrain = createOTLPDrain({ endpoint: otlpEndpoint })

initLogger({
  env: { service: 'evlog-example' },
  pretty: process.env.NODE_ENV !== 'production',
  drain: otlpDrain,
})

// --- App ---

type AppBindings = {
  Variables: {
    log: RequestLogger
  }
}

const app = new Hono<AppBindings>()

// Wide event middleware — one event per request
app.use('/api/*', async (c, next) => {
  const startedAt = Date.now()

  const log = createRequestLogger({
    method: c.req.method,
    path: c.req.path,
    requestId: c.req.header('x-request-id'),
  })

  c.set('log', log)

  try {
    await next()
  } catch (error) {
    log.error(error as Error)
    throw error
  } finally {
    log.emit({
      status: c.res.status,
      duration: Date.now() - startedAt,
    })
  }
})

// --- Browser ingest ---

app.post('/v1/ingest', async (c) => {
  const batch = await c.req.json<DrainContext[]>()
  for (const ctx of batch) {
    console.log('[BROWSER]', JSON.stringify(ctx.event))
  }
  await otlpDrain(batch)
  return c.body(null, 204)
})

// --- API routes ---

app.get('/api/products', (c) => {
  const log = c.get('log')

  const products = [
    { id: 'tshirt-1', name: 'T-Shirt', price: 29.99, currency: 'EUR', inStock: true },
    { id: 'hoodie-1', name: 'Hoodie', price: 59.99, currency: 'EUR', inStock: true },
    { id: 'cap-1', name: 'Cap', price: 14.99, currency: 'EUR', inStock: false },
  ]

  log.set({ catalog: { count: products.length, inStock: products.filter((p) => p.inStock).length } })

  return c.json({ products })
})

app.get('/api/users/:id', (c) => {
  const log = c.get('log')
  const userId = c.req.param('id')

  log.set({ user: { id: userId } })

  // Simulate user lookup
  const user = { id: userId, name: 'Alice', plan: 'pro', email: 'alice@example.com' }

  // PII masking for logs
  const [local, domain] = user.email.split('@')
  log.set({ user: { name: user.name, plan: user.plan, email: `${local![0]}***@${domain}` } })

  // Simulate order aggregation
  const orders = [
    { id: 'order_1', total: 4999 },
    { id: 'order_2', total: 1299 },
  ]
  log.set({
    orders: { count: orders.length, totalRevenue: orders.reduce((sum, o) => sum + o.total, 0) },
  })

  return c.json({ user, orders })
})

app.post('/api/checkout', async (c) => {
  const log = c.get('log')

  let body: { email?: string; productId?: string }
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }

  log.set({ checkout: { email: !!body.email, productId: body.productId || 'unknown' } })

  // Simulate payment failure with structured error
  throw createError({
    message: 'Payment failed',
    status: 402,
    why: 'Card declined by issuer — insufficient funds',
    fix: 'Try a different payment method or contact your bank',
    link: 'https://docs.example.com/payments/declined',
  })
})

app.get('/health', (c) => {
  return c.json({ ok: true })
})

// --- Error handler with structured errors ---

app.onError((error, c) => {
  const parsed = parseError(error)

  return c.json(
    {
      message: parsed.message,
      why: parsed.why,
      fix: parsed.fix,
      link: parsed.link,
    },
    (parsed.status || 500) as ContentfulStatusCode,
  )
})

// --- Static files ---

app.use('/dist/*', serveStatic({ root: './' }))

// --- Demo page ---

app.get('/', (c) => {
  return c.html(/* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Store — evlog + Kopai</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 3rem; max-width: 480px; margin: 0 auto; }
    h1 { font-size: 1.25rem; margin-bottom: 0.25rem; }
    .subtitle { color: #737373; font-size: 0.75rem; margin-bottom: 2rem; }
    .product { padding: 1.25rem; background: #171717; border: 1px solid #262626; border-radius: 0.5rem; margin-bottom: 1rem; }
    .product h2 { font-size: 1rem; margin-bottom: 0.25rem; }
    .product .price { color: #a3a3a3; font-size: 0.875rem; margin-bottom: 0.75rem; }
    .product .stock { font-size: 0.75rem; margin-bottom: 0.75rem; }
    .stock.in { color: #4ade80; }
    .stock.out { color: #f87171; }
    button {
      padding: 0.5rem 1rem; background: #e5e5e5; color: #0a0a0a; border: none;
      border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500; cursor: pointer;
    }
    button:hover { background: #d4d4d4; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    form { margin-top: 1.5rem; }
    label { display: block; font-size: 0.8125rem; color: #a3a3a3; margin-bottom: 0.375rem; }
    input {
      width: 100%; padding: 0.5rem 0.75rem; background: #171717; border: 1px solid #262626;
      border-radius: 0.375rem; color: #e5e5e5; font-size: 0.875rem; margin-bottom: 1rem;
    }
    input:focus { outline: none; border-color: #404040; }
    .hint { color: #525252; font-size: 0.6875rem; margin-top: 1.5rem; }
    .error-box { margin-top: 1rem; padding: 1rem; background: #450a0a; border: 1px solid #991b1b; border-radius: 0.5rem; font-size: 0.8125rem; display: none; }
    .error-box .why { color: #fca5a5; margin-top: 0.25rem; }
    .error-box .fix { color: #a3a3a3; margin-top: 0.25rem; font-style: italic; }
    #log-list { position: fixed; bottom: 1rem; right: 1rem; display: flex; flex-direction: column; gap: 0.375rem; z-index: 10; }
    .log-entry {
      padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.6875rem; font-family: monospace;
      animation: fade-in 0.15s ease-out;
    }
    .log-entry.info { background: #052e16; color: #4ade80; border: 1px solid #166534; }
    .log-entry.error { background: #450a0a; color: #f87171; border: 1px solid #991b1b; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <h1>Mini Store</h1>
  <p class="subtitle">evlog wide events + OTLP drain to Kopai</p>

  <div class="product">
    <h2>T-Shirt</h2>
    <p class="price">29.99 EUR</p>
    <p class="stock in">In stock</p>
    <button class="add-to-cart" data-product="tshirt-1" data-name="T-Shirt" data-price="29.99">Add to cart</button>
  </div>

  <div class="product">
    <h2>Hoodie</h2>
    <p class="price">59.99 EUR</p>
    <p class="stock in">In stock</p>
    <button class="add-to-cart" data-product="hoodie-1" data-name="Hoodie" data-price="59.99">Add to cart</button>
  </div>

  <div class="product">
    <h2>Cap</h2>
    <p class="price">14.99 EUR</p>
    <p class="stock out">Out of stock</p>
    <button class="add-to-cart" data-product="cap-1" data-name="Cap" data-price="14.99" disabled>Add to cart</button>
  </div>

  <form id="checkout-form">
    <label for="email">Email</label>
    <input id="email" type="email" placeholder="you@example.com" required>
    <button type="submit">Checkout</button>
  </form>

  <div class="error-box" id="error-box">
    <strong id="error-message"></strong>
    <p class="why" id="error-why"></p>
    <p class="fix" id="error-fix"></p>
  </div>

  <p class="hint">A page_view event is logged on load. Each interaction logs to your server via evlog/browser, then drains to OTLP.</p>

  <div id="log-list"></div>
  <script type="module" src="/dist/client.js"></script>
</body>
</html>`)
})

// --- Start ---

serve({ fetch: app.fetch, port: 3000 })

console.log(`evlog example started on http://localhost:3000`)
console.log(`OTLP endpoint: ${otlpEndpoint}`)
