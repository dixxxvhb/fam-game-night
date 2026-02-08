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
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Top gradient glow */}
      <div className="h-4 bg-gradient-to-t from-midnight-900/95 to-transparent pointer-events-none" />
      <div className="bg-midnight-900/95 backdrop-blur-md pb-safe">
        <div className="flex items-center justify-around h-[68px]">
          {tabs.map(tab => {
            const isActive = tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path)
            const Icon = tab.icon

            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-150 active:scale-90 relative ${
                  isActive ? 'text-nin-red' : 'text-midnight-400 hover:text-midnight-200'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute top-0 left-3 right-3 h-[3px] rounded-full bg-nin-red shadow-[0_0_8px_rgba(230,0,18,0.5)]" />
                )}
                <Icon className={`w-6 h-6 ${isActive ? 'drop-shadow-[0_0_8px_rgba(230,0,18,0.5)]' : ''}`} />
                <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : 'font-semibold'}`}>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
