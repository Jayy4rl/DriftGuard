import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'

const vanillaProblems = [
  { icon: AlertTriangle, text: 'High Impermanent Loss', sub: 'AMM continuously sells your best asset' },
  { icon: TrendingDown, text: 'Large Delta Drift', sub: 'Position skews with every price move' },
  { icon: AlertTriangle, text: 'Manual Management', sub: 'No automation, constant vigilance required' },
  { icon: TrendingDown, text: 'Unhedged Exposure', sub: 'Structurally short volatility at all times' },
]

const vixaBenefits = [
  { icon: CheckCircle, text: 'Reduced IL', sub: 'Internal position splitting offsets directional loss' },
  { icon: TrendingUp, text: 'Near Neutral Delta', sub: 'Both legs partially cancel each other out' },
  { icon: CheckCircle, text: 'Automated Rebalancing', sub: 'Automated corrections via Reactive Network RSC' },
  { icon: TrendingUp, text: 'Self-Hedging Structure', sub: 'No external collateral or protocol needed' },
]

export default function ProblemSection() {
  return (
    <section id="how-it-works" style={{ padding: '6rem 2rem', position: 'relative' }}>
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 800, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,194,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{
            display: 'inline-block',
            color: '#00E5B0', fontSize: 12, fontWeight: 600,
            letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>The Problem</div>
          <h2 style={{
            fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900,
            letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC',
          }}>
            Why LPs Lose Money
          </h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: 16, maxWidth: 520, margin: '1rem auto 0' }}>
            AMM liquidity provision is structurally short volatility. Every price move
            works against you. Vixa changes the math.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Vanilla LP */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              background: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 20,
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)',
            }} />
            <div style={{
              fontSize: 12, color: '#EF4444', fontWeight: 600,
              letterSpacing: '1.5px', textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}>Vanilla LP</div>
            <h3 style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC', marginBottom: '2rem', letterSpacing: '-0.5px' }}>
              Standard Uniswap LP
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {vanillaProblems.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                    padding: '12px 16px',
                    background: 'rgba(239,68,68,0.06)',
                    borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.1)',
                  }}
                >
                  <item.icon size={18} color="#EF4444" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: 14 }}>{item.text}</div>
                    <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{item.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Vixa */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              background: 'rgba(0,229,176,0.04)',
              border: '1px solid rgba(0,229,176,0.18)',
              borderRadius: 20,
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{
              position: 'absolute', top: 0, right: 0, width: 200, height: 200,
              background: 'radial-gradient(circle, rgba(0,229,176,0.07) 0%, transparent 70%)',
            }} />
            <div style={{
              fontSize: 12, color: '#00E5B0', fontWeight: 600,
              letterSpacing: '1.5px', textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}>Vixa LP</div>
            <h3 style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC', marginBottom: '2rem', letterSpacing: '-0.5px' }}>
              Vixa Position
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {vixaBenefits.map((item, i) => (
                <motion.div
                  key={item.text}
                  initial={{ opacity: 0, x: 15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                    padding: '12px 16px',
                    background: 'rgba(0,229,176,0.06)',
                    borderRadius: 10,
                    border: '1px solid rgba(0,229,176,0.1)',
                  }}
                >
                  <item.icon size={18} color="#00E5B0" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: 14 }}>{item.text}</div>
                    <div style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{item.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
