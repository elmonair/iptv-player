import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Loading from './pages/Loading'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/loading" element={<Loading />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
