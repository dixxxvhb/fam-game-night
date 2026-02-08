import { useNavigate, useLocation } from 'react-router-dom'
import { Home, History, Trophy, Settings } from 'lucide-react'

const tabs = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/history', label: 'History', icon: History },
  { path: '/leaderboard', label: 'Board', icon: Trophy },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-midnight-900/95 backdrop-blur-md border-t-2 border-midnight-700/60">
      <div className="flex items-center justify-around h-16 pb-safe">
        {tabs.map(tab => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path)
          const Icon = tab.icon

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-150 active:scale-90 ${
                isActive ? 'text-nin-red' : 'text-midnight-400 hover:text-midnight-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(230,0,18,0.5)]' : ''}`} />
              <span className={`text-xs mt-1 font-bold ${isActive ? '' : 'font-semibold'}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
