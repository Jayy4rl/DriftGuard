import { motion } from 'framer-motion'
import Ribbon3D from './Ribbon3D'

export default function Hero({ onLaunchApp, onViewDemo }: { onLaunchApp?: () => void; onViewDemo?: () => void }) {
  return (
    <section
      id="home"
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        paddingTop: '68px',
      }}
    >
      {/* Grid background */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.7 }} />

      {/* Radial glows */}
      <div style={{
        position: 'absolute', top: '20%', left: '5%', width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,229,176,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '10%', right: '10%', width: 700, height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,255,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '5%', right: '20%', width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,194,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 1280, margin: '0 auto', width: '100%',
        padding: '0 2rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4rem',
        alignItems: 'center',
        position: 'relative', zIndex: 1,
      }}>
        {/* Left: Text */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0,229,176,0.08)',
              border: '1px solid rgba(0,229,176,0.2)',
              borderRadius: 100,
              padding: '6px 14px',
              marginBottom: '2rem',
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#00E5B0', display: 'inline-block',
            }} className="pulse-glow" />
            <span style={{ color: '#00E5B0', fontSize: 13, fontWeight: 500 }}>
              Live on Unichain · Powered by Reactive Network
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontSize: 'clamp(42px, 5vw, 72px)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-2px',
              margin: '0 0 1.5rem',
              color: '#F8FAFC',
            }}
          >
            Structurally Reduced<br />
            <span className="text-gradient">IL.</span><br />
            Autonomous Rebalancing.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              fontSize: 18,
              color: '#94A3B8',
              lineHeight: 1.7,
              maxWidth: 480,
              marginBottom: '2.5rem',
            }}
          >
            Reduce impermanent loss through synthetic position splitting,
            automated rebalancing via Reactive Network, and a self-contained
            hook — all inside a single Uniswap v4 pool.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
          >
            <button
              style={{
                background: 'linear-gradient(135deg, #00E5B0, #00C2FF)',
                color: '#030712', border: 'none', borderRadius: 10,
                padding: '14px 32px', fontWeight: 700, fontSize: 16,
                cursor: 'pointer', letterSpacing: '-0.3px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,229,176,0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              onClick={onLaunchApp}
            >
              Launch App
            </button>
            <button
              style={{
                background: 'transparent', color: '#F8FAFC',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '14px 32px',
                fontWeight: 600, fontSize: 16, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,176,0.4)'; e.currentTarget.style.color = '#00E5B0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#F8FAFC' }}
              onClick={onViewDemo}
            >
              View Demo
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            style={{ display: 'flex', gap: '1.5rem', marginTop: '2.5rem', alignItems: 'center' }}
          >
            {['Uniswap v4', 'Unichain', 'Reactive Network'].map(badge => (
              <div key={badge} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: '#64748B', fontSize: 13,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#334155' }} />
                {badge}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: Ribbon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{ height: 520, position: 'relative' }}
        >
          <Ribbon3D />
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(to bottom, transparent, #030712)',
        pointerEvents: 'none',
      }} />
    </section>
  )
}
