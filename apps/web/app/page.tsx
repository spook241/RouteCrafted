import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/auth';

export default async function Home() {
  const session = await auth()
  return (
    <div className="min-h-screen bg-surface">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-50 mix-blend-multiply dark:mix-blend-screen filter blur-3xl z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-primary/20 rounded-full mix-blend-multiply dark:mix-blend-screen blur-3xl animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[40rem] h-[40rem] bg-tertiary-fixed/30 rounded-full mix-blend-multiply dark:mix-blend-screen blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          {/* Left: Headline + Curator Tip */}
          <div className="lg:col-span-5 pt-4">
            <p className="text-primary font-label font-bold text-xs uppercase tracking-widest mb-4">
              AI Travel Planning
            </p>
            <h1 className="font-headline font-extrabold text-5xl md:text-7xl text-on-surface leading-[1.08] tracking-tight mb-6">
              Where to{' '}
              <span className="italic text-primary">next?</span>
            </h1>
            <p className="text-on-surface-variant text-lg leading-relaxed mb-10 max-w-md">
              AI-powered day-by-day travel plans with weather-aware replanning and Worth&nbsp;It&nbsp;/&nbsp;Skip&nbsp;It place cards.
            </p>

            {/* Curator's Tip card */}
            <div className="bg-surface-container-low p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px] text-primary">lightbulb</span>
                <p className="text-xs font-label font-bold text-primary uppercase tracking-wider">Curator's Tip</p>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                The best itineraries balance structured highlights with free exploration time. Let AI plan the must-sees — then leave afternoons open for wandering.
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3 mt-8">
              {['AI Itineraries', 'Weather Replanning', 'Worth It / Skip It'].map((f) => (
                <span key={f} className="flex items-center gap-1.5 bg-surface-container rounded-full px-4 py-2 text-xs font-label font-semibold text-on-surface-variant hover:-translate-y-0.5 hover:shadow-sm transition">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {f}
                </span>
              ))}
            </div>

            {/* Auth CTAs */}
            <div className="flex items-center gap-3 mt-8">
              {session ? (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 horizon-gradient text-white font-headline font-bold rounded-full px-7 py-3.5 shadow-card hover:opacity-90 transition"
                >
                  <span className="material-symbols-outlined text-[20px]">dashboard</span>
                  My Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 horizon-gradient text-white font-headline font-bold rounded-full px-7 py-3.5 shadow-card hover:opacity-90 transition"
                  >
                    <span className="material-symbols-outlined text-[20px]">login</span>
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center gap-2 bg-surface-container-low text-on-surface font-headline font-bold rounded-full px-7 py-3.5 hover:bg-surface-container-high transition"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Right: Ledger card / Trip planner form */}
          <div className="lg:col-span-7">
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-card">
              <h2 className="font-headline font-bold text-2xl text-on-surface mb-8">Plan your next trip</h2>

              <div className="space-y-4">
                {/* Destination */}
                <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3.5 rounded-2xl">
                  <span className="material-symbols-outlined text-[20px] text-outline flex-shrink-0">location_on</span>
                  <span className="text-on-surface-variant text-sm font-label">Where to? — e.g. Tokyo, Japan</span>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3.5 rounded-2xl">
                    <span className="material-symbols-outlined text-[20px] text-outline flex-shrink-0">calendar_today</span>
                    <span className="text-on-surface-variant text-sm font-label">Start date</span>
                  </div>
                  <div className="flex items-center gap-3 bg-surface-container-low px-4 py-3.5 rounded-2xl">
                    <span className="material-symbols-outlined text-[20px] text-outline flex-shrink-0">event</span>
                    <span className="text-on-surface-variant text-sm font-label">End date</span>
                  </div>
                </div>

                {/* Budget chips */}
                <div>
                  <p className="text-xs font-label font-semibold text-on-surface-variant mb-2 px-1">Budget</p>
                  <div className="flex gap-2 flex-wrap">
                    {['Budget', 'Mid-range', 'Luxury', 'Ultra'].map((b, i) => (
                      <span
                        key={b}
                        className={`rounded-xl px-3 py-1.5 text-xs font-label font-semibold cursor-pointer transition ${
                          i === 1
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container-high text-on-surface-variant hover:bg-secondary-container hover:text-on-secondary-container'
                        }`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Pacing segmented control */}
                <div>
                  <p className="text-xs font-label font-semibold text-on-surface-variant mb-2 px-1">Pacing</p>
                  <div className="bg-surface-container-low rounded-2xl p-1 flex">
                    {['Relaxed', 'Balanced', 'Fast'].map((p, i) => (
                      <span
                        key={p}
                        className={`flex-1 text-center text-xs font-label font-semibold px-3 py-2 rounded-xl cursor-pointer transition ${
                          i === 1
                            ? 'bg-surface-container-lowest shadow-sm text-primary'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href="/trips/new"
                  className="flex items-center justify-center gap-3 w-full horizon-gradient text-on-primary font-headline font-bold text-lg py-5 rounded-full shadow-card hover:opacity-90 transition mt-2"
                >
                  <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                  Craft my itinerary
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

      {/* ── Trending Destinations ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-primary font-label font-bold text-xs uppercase tracking-widest mb-2">Destinations</p>
            <h2 className="font-headline font-extrabold text-3xl text-on-surface">Trending right now</h2>
          </div>
          <Link href="/trips/new" className="text-sm font-semibold text-primary hover:text-primary-container transition">
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Tokyo — wide */}
          <Link href="/trips/new?destination=Tokyo&country=Japan" className="md:col-span-8 relative h-72 rounded-3xl overflow-hidden bg-surface-container-high group cursor-pointer block">
            <Image src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1994&auto=format&fit=crop" alt="Tokyo" fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <span className="absolute top-5 left-5 bg-tertiary-fixed text-on-tertiary-fixed text-xs font-label font-bold px-3 py-1 rounded-full">Trending</span>
            <div className="absolute bottom-6 left-6">
              <p className="text-white font-headline font-extrabold text-3xl drop-shadow-sm">Tokyo</p>
              <p className="text-white/80 text-sm mt-1 drop-shadow-sm">Japan · Best in Spring</p>
            </div>
            <span className="absolute bottom-6 right-6 material-symbols-outlined text-white/60 text-[48px] group-hover:text-white/90 group-hover:-translate-y-1 transition drop-shadow-sm">arrow_outward</span>
          </Link>
          {/* Paris — narrow */}
          <Link href="/trips/new?destination=Paris&country=France" className="md:col-span-4 relative h-72 rounded-3xl overflow-hidden bg-surface-container group cursor-pointer block">
            <Image src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop" alt="Paris" fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <p className="text-white font-headline font-extrabold text-2xl drop-shadow-sm">Paris</p>
              <p className="text-white/80 text-sm mt-1 drop-shadow-sm">France · Year-round</p>
            </div>
          </Link>
          {/* New York — narrow */}
          <Link href="/trips/new?destination=New%20York&country=USA" className="md:col-span-4 relative h-64 rounded-3xl overflow-hidden bg-surface-container-highest group cursor-pointer block">
            <Image src="https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=2070&auto=format&fit=crop" alt="New York" fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <p className="text-white font-headline font-extrabold text-2xl drop-shadow-sm">New York</p>
              <p className="text-white/80 text-sm mt-1 drop-shadow-sm">USA · All seasons</p>
            </div>
          </Link>
          {/* Amalfi — wide */}
          <Link href="/trips/new?destination=Amalfi%20Coast&country=Italy" className="md:col-span-8 relative h-64 rounded-3xl overflow-hidden bg-surface-container-high group cursor-pointer block">
            <Image src="https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?q=80&w=1976&auto=format&fit=crop" alt="Amalfi Coast" fill className="object-cover group-hover:scale-105 transition-transform duration-700" unoptimized />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
            <span className="absolute top-5 left-5 bg-primary-container text-on-primary-container text-xs font-label font-bold px-3 py-1 rounded-full">Editor's pick</span>
            <div className="absolute bottom-6 left-6">
              <p className="text-white font-headline font-extrabold text-2xl drop-shadow-sm">Amalfi Coast</p>
              <p className="text-white/80 text-sm mt-1 drop-shadow-sm">Italy · Best May–Oct</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="bg-surface-container-low p-10 rounded-[2.5rem]">
          <p className="text-primary font-label font-bold text-xs uppercase tracking-widest mb-3">Why RouteCrafted</p>
          <h2 className="font-headline font-extrabold text-3xl text-on-surface mb-10">Everything your trip needs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { icon: 'map', title: 'AI Itineraries', desc: 'Personalised day-by-day plans generated by Gemini AI, tailored to your style and budget.' },
              { icon: 'cloud', title: 'Weather Replanning', desc: 'Auto-rewrites affected days when the forecast changes — no more rainy-day surprises.' },
              { icon: 'star', title: 'Worth It / Skip It', desc: 'Honest editorial verdicts for every attraction so you spend time on what actually matters.' },
            ].map((feature) => (
              <div key={feature.title} className="bg-surface-container-lowest rounded-3xl p-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-symbols-outlined text-primary text-[24px]">{feature.icon}</span>
                </div>
                <h3 className="font-headline font-bold text-on-surface text-lg mb-2">{feature.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-headline font-extrabold text-4xl text-on-surface mb-4">Ready to explore?</h2>
        <p className="text-on-surface-variant mb-8 text-lg max-w-lg mx-auto">
          Join thousands of travellers crafting smarter, more memorable trips.
        </p>
        <Link
          href={session ? '/dashboard' : '/register'}
          className="inline-flex items-center gap-2 horizon-gradient text-on-primary font-headline font-bold rounded-full px-10 py-5 text-lg shadow-card hover:opacity-90 transition"
        >
          <span className="material-symbols-outlined text-[22px]">travel_explore</span>
          {session ? 'Go to Dashboard' : "Get started — it's free"}
        </Link>
        <p className="mt-6 text-outline text-xs">
          Built with Next.js 15 · Expo · Drizzle ORM · Neon · Gemini 2.0 Flash
        </p>
      </section>

      {/* ── FAB (mobile) ── */}
      <Link
        href="/trips/new"
        className="md:hidden fixed bottom-24 right-6 w-16 h-16 rounded-full horizon-gradient shadow-card-hover flex items-center justify-center z-40"
        aria-label="Plan new trip"
      >
        <span className="material-symbols-outlined text-on-primary text-[28px]">add</span>
      </Link>
    </div>
  );
}
