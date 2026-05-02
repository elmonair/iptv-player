import XtreamCodesForm from '../components/XtreamCodesForm'
// Kept for future M3U URL support (post-MVP) — component file preserved at src/components/M3uUrlForm.tsx

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="mb-6 text-center sm:text-left">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-400">M2player</p>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Add Xtream Playlist</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Enter your provider details to add a new playlist.</p>
          </div>

          <XtreamCodesForm />
        </section>
      </div>
    </div>
  )
}
