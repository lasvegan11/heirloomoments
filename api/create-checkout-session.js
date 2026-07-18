import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Prices in cents. Keep in sync with PLAN_LIMITS in src/lib/supabase.js.
const PLAN_PRICES = {
  free: { amount: 1900, label: 'Starter' },
  plus: { amount: 3900, label: 'Plus' },
  pro: { amount: 9900, label: 'Pro' },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { eventId, slug, plan, eventTitle, origin } = req.body || {}
  const priceInfo = PLAN_PRICES[plan]

  if (!eventId || !slug || !priceInfo || !origin) {
    return res.status(400).json({ error: 'Missing or invalid required fields' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${priceInfo.label} event — ${eventTitle || slug}` },
          unit_amount: priceInfo.amount,
        },
        quantity: 1,
      }],
      metadata: { event_id: eventId },
      success_url: `${origin}/dashboard/events/${slug}?paid=1`,
      cancel_url: `${origin}/dashboard/events/${slug}?canceled=1`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
