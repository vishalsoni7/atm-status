import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { DetailScreen } from './screens/DetailScreen'
import { MapScreen } from './screens/MapScreen'
import { PrivacyScreen } from './screens/PrivacyScreen'
import { ReportScreen } from './screens/ReportScreen'
import { ThanksScreen } from './screens/ThanksScreen'

export default function App() {
  return (
    <BrowserRouter>
      <Pages />
    </BrowserRouter>
  )
}

// Each screen fades in when the path changes.
function Pages() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page page-enter">
      <Routes location={location}>
        <Route path="/" element={<MapScreen />} />
        <Route path="/atm/:id" element={<DetailScreen />} />
        <Route path="/atm/:id/report" element={<ReportScreen />} />
        <Route path="/atm/:id/thanks" element={<ThanksScreen />} />
        <Route path="/privacy" element={<PrivacyScreen />} />
        <Route path="*" element={<MapScreen />} />
      </Routes>
    </div>
  )
}
