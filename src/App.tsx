import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Host, { HostNew } from './pages/Host'
import Join, { Apart, Solo } from './pages/Join'
import Play from './pages/Play'
import Season, { NightDetail } from './pages/Season'
import Hall from './pages/Hall'
import ParkGallery from './games/board/park/Gallery'
import MgSandbox from './games/board/park/MgSandbox'
import MusicBox from './games/board/park/MusicBox'
import KartView from './games/kart/view/ViewSandbox'
import KartGarage from './games/kart/garage/Gallery'
import GameLab from './dev/GameLab'

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
      <Route path="/park-cast" element={<ParkGallery />} />
      <Route path="/park-mg/:id" element={<MgSandbox />} />
      <Route path="/park-music" element={<MusicBox />} />
      <Route path="/kart-view" element={<KartView />} />
      <Route path="/kart-garage" element={<KartGarage />} />
      <Route path="/lab/:id" element={<GameLab />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
