import { useState } from 'react'
import './index.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MetricsBar from './components/MetricsBar'
import ProblemSection from './components/ProblemSection'
import HowItWorks from './components/HowItWorks'
import ArchitectureSection from './components/ArchitectureSection'
import DashboardSection from './components/DashboardSection'
import SimulationSection from './components/SimulationSection'
import WhySection from './components/WhySection'
import CTASection from './components/CTASection'
import Footer from './components/Footer'
import AppScreen from './components/AppScreen'

export default function App() {
  const [page, setPage] = useState<'landing' | 'app'>('landing')

  if (page === 'app') {
    return <AppScreen onBack={() => setPage('landing')} />
  }

  return (
    <div style={{ background: '#030712', minHeight: '100vh' }}>
      <Navbar onLaunchApp={() => setPage('app')} />
      <Hero onLaunchApp={() => setPage('app')} onViewDemo={() => setPage('app')} />
      <MetricsBar />
      <ProblemSection />
      <HowItWorks />
      <ArchitectureSection />
      <DashboardSection />
      <SimulationSection />
      <WhySection />
      <CTASection onLaunchApp={() => setPage('app')} />
      <Footer />
    </div>
  )
}
