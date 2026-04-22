import XtreamCodesForm from '../components/XtreamCodesForm'
// Kept for future M3U URL support (post-MVP) — component file preserved at src/components/M3uUrlForm.tsx

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">IPTV Player</h1>
          <p className="text-lg text-slate-400">Connect with your Xtream Codes account</p>
        </div>

        <div className="bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-800">
          <XtreamCodesForm />
        </div>
      </div>
    </div>
  )
}