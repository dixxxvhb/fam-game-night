import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { MobileNav } from './components/common/MobileNav'
import { Header } from './components/common/Header'
import { LoadingSpinner } from './components/common/LoadingSpinner'

const Home = lazy(() => import('./pages/Home'))
const History = lazy(() => import('./pages/History'))
const HistoryDetail = lazy(() => import('./pages/HistoryDetail'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const Settings = lazy(() => import('./pages/Settings'))
const LiveNight = lazy(() => import('./pages/LiveNight'))
const NightSummary = lazy(() => import('./pages/NightSummary'))
const Randomizer = lazy(() => import('./pages/Randomizer'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <div className="flex flex-col h-full bg-midnight-950 text-white">
      <Header />
      <main className="flex-1 overflow-y-auto pb-[88px]">
        <Suspense fallback={<LoadingSpinner className="h-64" />}>
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <MobileNav />
    </div>
  )
}
