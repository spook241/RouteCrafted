import Link from 'next/link'
import { auth } from '@/auth'
import { ProfileMenu } from './ProfileMenu'

export async function Header() {
  const session = await auth()

  return (
    <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl h-16 shadow-sm border-b border-surface-container/50">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href={session ? '/dashboard' : '/'}
          className="font-headline font-extrabold text-xl text-on-surface tracking-tight flex-shrink-0"
        >
          RouteCrafted
        </Link>

        {/* Center nav links (desktop only) */}
        {session && (
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              Trips
            </Link>
            <Link
              href="/"
              className="px-4 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
            >
              Explore
            </Link>
            {session.user?.role === 'admin' && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-full text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                Admin
              </Link>
            )}
          </nav>
        )}

        {/* Right icons */}
        <div className="flex items-center gap-1">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Weather overview"
              >
                <span className="material-symbols-outlined text-[22px]">cloud_queue</span>
              </Link>
              <ProfileMenu
                userName={session.user?.name ?? 'Traveler'}
                userEmail={session.user?.email ?? ''}
                isAdmin={session.user?.role === 'admin'}
              />
            </>
          ) : (
            <Link
              href="/login"
              className="horizon-gradient text-on-primary px-5 py-2 rounded-full text-sm font-headline font-semibold"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
