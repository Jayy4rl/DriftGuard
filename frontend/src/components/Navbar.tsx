import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import faviconUrl from '/favicon.svg'

export default function Navbar({ onLaunchApp }: { onLaunchApp?: () => void }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '0 2rem',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: scrolled ? 'rgba(3,7,18,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.4s ease',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={faviconUrl} alt="Vixa" style={{ width: 32, height: 32 }} />
        <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px', color: '#F8FAFC' }}>
          Vixa
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
        {['Home', 'How It Works', 'Vault', 'Dashboard', 'Docs'].map(link => (
          <a
            key={link}
            href={`#${link.toLowerCase().replace(/\s+/g, '-')}`}
            style={{
              color: '#94A3B8',
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
          >
            {link}
          </a>
        ))}
      </div>

      {/* CTA */}
      <button
        style={{
          background: 'linear-gradient(135deg, #00E5B0, #00C2FF)',
          color: '#030712',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          letterSpacing: '-0.2px',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
        onClick={onLaunchApp}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        Launch App
      </button>
    </motion.nav>
  )
}
