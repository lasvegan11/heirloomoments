import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-8 sm:py-7 max-w-6xl mx-auto">
        <span className="serif tracking-wide leading-none flex flex-col items-center text-base sm:flex-row sm:gap-1.5 sm:text-2xl">
          <span>Share</span>
          <span className="text-gold text-[10px] sm:text-2xl leading-none">2</span>
          <span>Share</span>
        </span>
        <div className="flex gap-2 sm:gap-6 items-center">
          <Link to="/login" className="text-xs sm:text-sm uppercase tracking-wider px-3 py-1.5 sm:px-6 sm:py-3 border border-border rounded-sm text-espresso hover:border-gold transition-all duration-200">Log in</Link>
          <Link to="/signup" className="text-xs sm:text-sm uppercase tracking-wider px-3 py-1.5 sm:px-6 sm:py-3 rounded-sm bg-gold text-white hover:bg-gold-light transition-all duration-200">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-24 max-w-4xl mx-auto">
        <div className="eyebrow mb-7">Event Photo Sharing · Las Vegas</div>
        <h1 className="serif text-5xl md:text-7xl leading-tight mb-7 font-medium">
          Share your event photos,<br /><em className="text-gold">as they happen.</em>
        </h1>
        <p className="text-espresso-soft text-xl mb-10 max-w-xl mx-auto leading-relaxed">
          Create an event, share a single QR code. Your guests capture the day from every angle — no app, no downloads, just memories gathered in one beautiful place.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/signup" className="btn-primary px-10 py-4">Create your event</Link>
          <a href="#how" className="btn-secondary px-10 py-4">See how it works</a>
        </div>
      </section>

      {/* Ornament */}
      <div className="text-center my-8 text-gold tracking-[0.5em] text-xl">✦ ✦ ✦</div>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-8 py-16">
        <div className="eyebrow text-center mb-3">The Experience</div>
        <h2 className="serif text-4xl text-center mb-14 font-medium">Beautifully simple</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            { step: '01', title: 'Create', desc: 'Set your event name, date, and colors. Your gallery is ready in under a minute.' },
            { step: '02', title: 'Share', desc: 'Display your QR code on tables or screens. One scan and guests are in — no app to download.' },
            { step: '03', title: 'Cherish', desc: 'Every photo and video appears in your live album instantly, ready to relive and keep forever.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="text-center">
              <div className="serif text-gold text-sm tracking-widest mb-4">{step}</div>
              <h3 className="serif text-2xl mb-3">{title}</h3>
              <p className="text-espresso-soft leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ornament */}
      <div className="text-center my-8 text-gold tracking-[0.5em] text-xl">✦ ✦ ✦</div>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-8 py-16">
        <div className="eyebrow text-center mb-3">Simple Pricing</div>
        <h2 className="serif text-4xl text-center mb-14 font-medium">Pay once, per event</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: 'Free', price: '$0', feats: ['50 uploads', '7-day gallery', 'Live slideshow', 'Batch download'], cta: 'Get started' },
            { name: 'Plus', price: '$39', feats: ['150 uploads', '30-day gallery', 'Live slideshow', 'Moderation tools'], cta: 'Choose Plus', highlight: true },
            { name: 'Pro', price: '$99', feats: ['Unlimited uploads', '3-month gallery', 'Live slideshow', 'Priority support'], cta: 'Choose Pro' },
          ].map(({ name, price, feats, cta, highlight }) => (
            <div key={name} className={`card relative text-center ${highlight ? 'border-gold' : ''}`}>
              {highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-white text-[10px] tracking-widest uppercase px-4 py-1.5 rounded-sm">Most Loved</div>}
              <div className="uppercase tracking-widest text-espresso-soft text-sm mb-2">{name}</div>
              <div className="serif text-5xl mb-1">{price}</div>
              <div className="text-espresso-soft text-sm mb-7">per event</div>
              <ul className="mb-8">
                {feats.map(f => (
                  <li key={f} className="py-2.5 text-espresso-soft border-b border-border last:border-0">
                    <span className="text-gold mr-2">—</span>{f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className={`${highlight ? 'btn-primary' : 'btn-secondary'} w-full block text-center`}>{cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-14 border-t border-border mt-10">
        <div className="serif text-xl mb-3">Share <span className="text-gold">2</span> Share</div>
        <p className="text-espresso-soft text-sm tracking-wide">Crafted in Las Vegas by <a href="https://stacktlv.com" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">STACKT</a></p>
      </footer>
    </div>
  )
}
