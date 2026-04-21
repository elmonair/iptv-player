import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="text-center">
        <Loader2 className="w-16 h-16 mx-auto mb-6 text-indigo-500 animate-spin" />
        <h2 className="text-3xl font-bold text-white mb-3">Loading playlist...</h2>
        <p className="text-slate-500 text-base">Parsing will be implemented in the next step</p>
      </div>
    </div>
  )
}
