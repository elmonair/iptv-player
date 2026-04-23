import { TopNavBar } from '../components/TopNavBar'

export default function Movies() {
  return (
    <div className="min-h-screen bg-slate-900">
      <TopNavBar />
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p className="text-slate-400 text-base">Movies browser — coming in Step 12</p>
      </div>
    </div>
  )
}