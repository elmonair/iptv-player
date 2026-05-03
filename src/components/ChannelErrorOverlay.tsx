import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react'

export function ChannelErrorOverlay({ onRetry, onPrev, onNext }: {
  onRetry: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const [seconds, setSeconds] = useState(5)
  const advancedRef = useRef(false)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      if (advancedRef.current) {
        clearInterval(interval)
        return
      }

      const elapsed = (Date.now() - startTime) / 1000
      const remaining = Math.max(0, 5 - Math.floor(elapsed))
      setSeconds(remaining)

      if (remaining === 0) {
        advancedRef.current = true
        clearInterval(interval)
        onNext()
      }
    }, 200)

    return () => clearInterval(interval)
  }, [])

  const stopAndRun = (fn: () => void) => {
    advancedRef.current = true
    fn()
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="w-20 h-20 mb-6 rounded-full border-2 border-white/80 flex items-center justify-center text-3xl text-white">
        {seconds}
      </div>
      <p className="text-white text-lg mb-1">Channel unavailable</p>
      <p className="text-white/60 text-sm mb-6">Switching in {seconds}s</p>
      <div className="flex gap-2">
        <button onClick={() => stopAndRun(onPrev)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => stopAndRun(onRetry)} className="px-5 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm flex items-center gap-2">
          <RotateCw size={14} />
          Retry
        </button>
        <button onClick={() => stopAndRun(onNext)} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
