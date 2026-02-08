import { Routes, Route } from 'react-router-dom'
import { MobileNav } from './components/common/MobileNav'
import { Header } from './components/common/Header'
import Home from './pages/Home'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'
import Leaderboard from './pages/Leaderboard'
import Settings from './pages/Settings'
import LiveNight from './pages/LiveNight'
import NightSummary from './pages/NightSummary'
import Randomizer from './pages/Randomizer'

export default function App() {
  return (
    <div className="flex flex-col h-full bg-midnight-950 text-white">
      <Header />
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<HistoryDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/night/:id" element={<LiveNight />} />
          <Route path="/night/:id/summary" element={<NightSummary />} />
          <Route path="/night/:id/randomizer" element={<Randomizer />} />
          <Route path="/randomizer" element={<Randomizer />} />
        </Routes>
      </main>
      <MobileNav />
    </div>
  )
}
