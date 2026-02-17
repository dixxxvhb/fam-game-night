import { useNavigate } from 'react-router-dom'
import { Gamepad2 } from 'lucide-react'
import { Button } from '../components/common/Button'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-64 p-6 text-center">
      <Gamepad2 className="w-12 h-12 text-midnight-500 mb-4" />
      <h2 className="text-xl font-display mb-2">Page Not Found</h2>
      <p className="text-sm text-midnight-400 mb-6 font-semibold">This page doesn't exist.</p>
      <Button onClick={() => navigate('/')} variant="secondary">
        Back to Home
      </Button>
    </div>
  )
}
