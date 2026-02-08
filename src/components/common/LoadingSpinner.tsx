export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-10 h-10 border-4 border-midnight-600 border-t-nin-red rounded-full animate-spin" />
    </div>
  )
}
