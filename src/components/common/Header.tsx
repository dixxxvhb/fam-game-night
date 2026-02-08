import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Gamepad2 } from 'lucide-react'
import { DEFAULT_APP_NAME } from '../../lib/constants'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isSubPage = location.pathname.includes('/night/') || location.pathname.includes('/history/')

  return (
    <header className="sticky top-0 z-50 pt-safe">
      <div className="bg-midnight-900/95 backdrop-blur-md">
        <div className="flex items-center h-16 px-4">
          {isSubPage && (
            <button
              onClick={() => navigate(-1)}
              className="mr-2 p-2 -ml-1 rounded-2xl hover:bg-midnight-700/50 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {isHome && (
            <Gamepad2 className="w-6 h-6 text-nin-red mr-2.5 drop-shadow-[0_0_8px_rgba(230,0,18,0.5)]" />
          )}
          <h1 className={isHome
            ? 'text-xl font-display text-gradient-fire tracking-wide'
            : 'text-lg font-display text-white tracking-wide'
          }>
            {isHome ? DEFAULT_APP_NAME : getPageTitle(location.pathname)}
          </h1>
        </div>
        {/* Bottom gradient fade instead of hard border */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-midnight-500/40 to-transparent" />
      </div>
    </header>
  )
}

function getPageTitle(path: string): string {
  if (path.startsWith('/night/') && path.endsWith('/summary')) return 'Night Summary'
  if (path.startsWith('/night/') && path.endsWith('/randomizer')) return 'Randomizer'
  if (path.startsWith('/night/')) return 'Game Night'
  if (path.startsWith('/history/')) return 'Game Night Details'
  if (path === '/history') return 'History'
  if (path === '/leaderboard') return 'Leaderboard'
  if (path === '/randomizer') return 'Randomizer'
  if (path === '/settings') return 'Settings'
  return DEFAULT_APP_NAME
}
