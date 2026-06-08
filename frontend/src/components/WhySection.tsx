import { motion } from 'framer-motion'
import { Zap, Shield, TrendingUp, Network } from 'lucide-react'

const reasons = [
  {
    icon: Zap,
    title: 'RSC-Triggered Rebalancing',
    description: 'When afterSwap detects threshold breach, it emits RebalanceNeeded. The Reactive Network RSC fires triggerRebalance() automatically. No keeper bot. No server. No scheduled job.',
    color: '#00E5B0',
    tag: 'Core Innovation',
  },
  {
    icon: Shield,
    title: 'No External Hedging',
    description: 'No perpetuals. No external collateral. No funding rate exposure. The hedge is structural — built into the position itself, not layered on top.',
    color: '#00C2FF',
    tag: 'Capital Efficient',
  },
  {
    icon: TrendingUp,
    title: 'Always Productive Capital',
    description: 'Both sub-positions earn swap fees at all times when in-range. No idle margin sitting on an exchange. Every dollar works.',
    color: '#2563FF',
    tag: 'Fee Optimized',
  },
  {
    icon: Network,
    title: 'Reactive Automation',
    description: 'Out-of-range recovery, mass withdrawal cleanup, and health monitoring handled automatically by the Reactive Network RSC.',
    color: '#00E5B0',
    tag: 'Edge Case Safe',
  },
]

export default function WhySection() {
  return (
    <section style={{ padding: '6rem 2rem', position: 'relative' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(0,229,176,0.02) 50%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{ color: '#00E5B0', fontSize: 12, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Differentiation
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC' }}>
            Why This Wins
          </h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: 16, maxWidth: 500, margin: '1rem auto 0' }}>
            Vixa changes the structural payoff of the LP position itself — not by hedging externally,
            but by deploying two internally offsetting sub-positions within the same pool. Both legs earn
            fees. The RSC on Reactive Network handles edge-case recovery autonomously. No external protocols.
            No idle collateral. Zero keeper infrastructure.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
          {reasons.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
              whileHover={{ y: -4 }}
              style={{
                background: '#0B1220',
                border: `1px solid ${r.color}15`,
                borderRadius: 20,
                padding: '2.5rem',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'default',
                transition: 'border-color 0.3s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${r.color}30`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = `${r.color}15`)}
            >
              {/* Corner glow */}
              <div style={{
                position: 'absolute', top: -30, right: -30,
                width: 150, height: 150, borderRadius: '50%',
                background: `radial-gradient(circle, ${r.color}08 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `${r.color}12`,
                  border: `1px solid ${r.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <r.icon size={22} color={r.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', margin: 0, letterSpacing: '-0.3px' }}>
                      {r.title}
                    </h3>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                      color: r.color,
                      background: `${r.color}12`,
                      border: `1px solid ${r.color}25`,
                      borderRadius: 100,
                      padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>{r.tag}</span>
                  </div>
                  <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    {r.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: '3rem',
            background: '#0B1220',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontWeight: 700, color: '#94A3B8', fontSize: 14 }}>Comparison with Existing IL Solutions</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {['Solution', 'Mechanism', 'External Deps', 'Idle Capital', 'Atomic'].map(h => (
                    <th key={h} style={{ padding: '1rem 1.5rem', textAlign: 'left', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Gamma / Arrakis', 'Range rebalancing', 'None', 'No', '✗'],
                  ['Umami / Neutra', 'External perp hedge', 'GMX / Perps', 'Yes (margin)', '✗'],
                  ['EulerSwap', 'Borrow-based hedge', 'Euler', 'Yes (borrow cost)', '✗'],
                  ['Bancor v2.1', 'IL insurance', 'Protocol', 'Protocol reserves', '✗'],
                  ['Vixa ✦', 'Position splitting + RSC-triggered rebalance', 'None', 'No', '–'],
                ].map((row, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: row[0].includes('Vixa') ? 'rgba(0,229,176,0.04)' : 'transparent',
                  }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{
                        padding: '1rem 1.5rem',
                        color: row[0].includes('Vixa')
                          ? (j === 0 ? '#00E5B0' : '#94A3B8')
                          : (j === 4 ? '#EF4444' : '#64748B'),
                        fontWeight: row[0].includes('Vixa') ? 600 : 400,
                        whiteSpace: 'nowrap',
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
