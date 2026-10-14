import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Host, { HostNew } from './pages/Host'
import Join, { Apart, Solo } from './pages/Join'
import Play from './pages/Play'
import Season, { NightDetail } from './pages/Season'
import Hall from './pages/Hall'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host" element={<HostNew />} />
      <Route path="/host/:code" element={<Host />} />
      <Route path="/join" element={<Join />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="/apart" element={<Apart />} />
      <Route path="/solo" element={<Solo />} />
      <Route path="/play/:code" element={<Play />} />
      <Route path="/season" element={<Season />} />
      <Route path="/night/:id" element={<NightDetail />} />
      <Route path="/hall" element={<Hall />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
