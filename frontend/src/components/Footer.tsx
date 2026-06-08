import { ExternalLink } from 'lucide-react'

const links = [
  { label: 'GitHub', icon: ExternalLink, href: '#' },
  { label: 'Docs', icon: ExternalLink, href: '#' },
  { label: 'Unichain', icon: ExternalLink, href: '#' },
  { label: 'Reactive Network', icon: ExternalLink, href: '#' },
  { label: 'Uniswap v4', icon: ExternalLink, href: '#' },
]

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '3rem 2rem',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 28, height: 28,
              background: 'linear-gradient(135deg, #00E5B0, #00C2FF)',
              borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 13, color: '#030712',
            }}>V</div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px', color: '#F8FAFC' }}>Vixa</span>
            <span style={{ color: '#334155', fontSize: 12, marginLeft: 4 }}>Self-Hedging Liquidity</span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {links.map(link => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  color: '#475569', textDecoration: 'none', fontSize: 14,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
                onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
              >
                <link.icon size={13} />
                {link.label}
              </a>
            ))}
          </div>

          {/* Right */}
          <div style={{ color: '#334155', fontSize: 13 }}>
            Built for Uniswap v4 Hookathon · Reactive Network Hackathon
          </div>
        </div>

        <div style={{
          marginTop: '2rem', paddingTop: '2rem',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
        }}>
          <p style={{ color: '#1e2d45', fontSize: 12, margin: 0 }}>
            © 2025 Vixa Protocol. Not financial advice. Use at your own risk.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {['Solidity 0.8.26', 'Foundry', 'Unichain', 'Vite + React'].map(t => (
              <span key={t} style={{
                fontSize: 11, color: '#334155',
                padding: '3px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 100,
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
