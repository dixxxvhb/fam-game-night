import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, Gamepad2 } from 'lucide-react'
import { DEFAULT_APP_NAME } from '../../lib/constants'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isSubPage = location.pathname.includes('/night/') || location.pathname.includes('/history/')

  return (
    <header className="sticky top-0 z-50 bg-midnight-900/95 backdrop-blur-md border-b-2 border-midnight-700/60">
      <div className="flex items-center h-14 px-4">
        {isSubPage && (
          <button
            onClick={() => navigate(-1)}
            className="mr-2 p-1.5 -ml-1 rounded-xl hover:bg-midnight-700/50 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {isHome && (
          <Gamepad2 className="w-5 h-5 text-nin-red mr-2" />
        )}
        <h1 className="text-lg font-black tracking-wide">
          {isHome ? DEFAULT_APP_NAME : getPageTitle(location.pathname)}
        </h1>
      </div>
    </header>
  )
}

function getPageTitle(path: string): string {
  if (path.startsWith('/night/') && path.endsWith('/summary')) return 'Night Summary'
  if (path.startsWith('/night/')) return 'Game Night'
  if (path.startsWith('/history/')) return 'Game Night Details'
  if (path === '/history') return 'History'
  if (path === '/leaderboard') return 'Leaderboard'
  if (path === '/settings') return 'Settings'
  return DEFAULT_APP_NAME
}
