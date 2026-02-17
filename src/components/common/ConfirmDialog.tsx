import { Button } from './Button'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-midnight-800 border border-midnight-600/40 rounded-3xl p-6 max-w-sm w-full animate-bounce-in shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-lg mb-2">{title}</h3>
        <p className="text-sm text-midnight-300 mb-6 font-semibold">{message}</p>
        <div className="flex gap-3">
          <Button onClick={onCancel} variant="secondary" className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="danger" className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
