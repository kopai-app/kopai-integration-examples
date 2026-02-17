import { initLogger, log } from 'evlog'
import { createBrowserLogDrain } from 'evlog/browser'

// --- Visual feedback ---

const logList = document.getElementById('log-list')!

function notify(action: string, level: 'info' | 'error' = 'info') {
  const el = document.createElement('div')
  el.className = `log-entry ${level}`
  el.textContent = `${level.toUpperCase()} ${action}`
  logList.prepend(el)
  setTimeout(() => el.remove(), 4000)
}

// --- Initialize evlog with browser drain ---

const drain = createBrowserLogDrain({
  drain: { endpoint: '/v1/ingest' },
})
initLogger({
  env: { service: 'evlog-example-browser' },
  drain,
})

// --- Log page view on load + fetch products (triggers server-side wide event) ---

log.info({ action: 'page_view', path: location.pathname, referrer: document.referrer || null })
notify('page_view')

fetch('/api/products')
  .then((res) => res.json())
  .then((data) => {
    log.info({ action: 'products_loaded', count: data.products.length })
    notify('products_loaded')
  })

// --- Add to cart buttons ---

document.querySelectorAll<HTMLButtonElement>('.add-to-cart').forEach((btn) => {
  btn.addEventListener('click', () => {
    const product = btn.dataset.product
    const name = btn.dataset.name
    const price = Number(btn.dataset.price)

    log.info({ action: 'add_to_cart', product, name, price, currency: 'EUR' })
    notify(`add_to_cart: ${name}`)
  })
})

// --- Checkout form ---

const errorBox = document.getElementById('error-box')!
const errorMessage = document.getElementById('error-message')!
const errorWhy = document.getElementById('error-why')!
const errorFix = document.getElementById('error-fix')!

document.getElementById('checkout-form')!.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = (document.getElementById('email') as HTMLInputElement).value

  log.info({ action: 'checkout_started', email_provided: !!email })
  notify('checkout_started')

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, productId: 'tshirt-1' }),
    })

    if (!res.ok) {
      const error = await res.json()
      log.error({ action: 'payment_failed', reason: error.why, status: res.status })
      notify('payment_failed', 'error')

      // Show structured error to user
      errorMessage.textContent = error.message
      errorWhy.textContent = `Why: ${error.why}`
      errorFix.textContent = `Fix: ${error.fix}`
      errorBox.style.display = 'block'
    }
  } catch (err) {
    log.error({ action: 'checkout_error', reason: 'network_error' })
    notify('checkout_error', 'error')
  }

  await drain.flush()
})
