import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning'

interface ToastMessage {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-[100px] left-4 right-4 z-[200] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), 4000)
    return () => clearTimeout(timer)
  }, [t.id, onDismiss])

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-nin-green shrink-0" />,
    error: <XCircle className="w-4 h-4 text-nin-red shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-gold-400 shrink-0" />,
  }

  const borders = {
    success: 'border-nin-green/30',
    error: 'border-nin-red/30',
    warning: 'border-gold-400/30',
  }

  return (
    <div className={`pointer-events-auto animate-slide-up bg-midnight-800/95 backdrop-blur-md border ${borders[t.type]} rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg`}>
      {icons[t.type]}
      <span className="text-sm font-semibold flex-1">{t.message}</span>
      <button onClick={() => onDismiss(t.id)} className="text-midnight-400 hover:text-white p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
