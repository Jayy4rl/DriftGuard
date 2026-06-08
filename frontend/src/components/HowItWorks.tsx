import { motion } from 'framer-motion'
import { ArrowDown, Zap, GitBranch } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: GitBranch,
    title: 'Deposit',
    subtitle: 'Depositor receives your liquidity',
    description: 'LPs deposit into the DeltaDepositor contract. Capital is split 50/50 across two sub-positions. Both legs are deployed immediately.',
    color: '#00E5B0',
    visual: <DepositVisual />,
  },
  {
    number: '02',
    icon: GitBranch,
    title: 'Split Positions',
    subtitle: 'Two synthetic legs, one pool',
    description: 'The hook splits liquidity into two concentrated positions. A long-vol leg below current price, a short-vol leg above. Both legs earn fees immediately.',
    color: '#00C2FF',
    visual: <SplitVisual />,
  },
  {
    number: '03',
    icon: Zap,
    title: 'RSC-Triggered Rebalancing',
    subtitle: 'Reactive rebalancing via RSC',
    description: 'When net delta exceeds the threshold, afterSwap() emits RebalanceNeeded. The Reactive Network RSC detects this event and calls triggerRebalance() on the depositor. Both sub-positions are repositioned around the new price. No keeper. No bot. No server.',
    color: '#2563FF',
    visual: <RebalanceVisual />,
  },
]

function DepositVisual() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {['LP  $100K'].map((lp, i) => (
        <motion.div
          key={lp}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: 'rgba(0,229,176,0.1)',
            border: '1px solid rgba(0,229,176,0.2)',
            color: '#00E5B0', fontSize: 13, fontWeight: 600,
          }}
        >{lp}</motion.div>
      ))}
      <ArrowDown size={16} color="#334155" style={{ margin: '4px 0' }} />
      <div style={{
        padding: '10px 28px', borderRadius: 10,
        background: 'rgba(0,229,176,0.15)',
        border: '1px solid rgba(0,229,176,0.3)',
        color: '#00E5B0', fontSize: 14, fontWeight: 700,
      }}>DeltaDepositor</div>
    </div>
  )
}

function SplitVisual() {
  return (
    <div style={{ width: '100%' }}>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#64748B', marginBottom: 12, letterSpacing: '1px' }}>PRICE</div>
      <div style={{ position: 'relative', height: 60 }}>
        {/* Price line */}
        <div style={{
          position: 'absolute', left: '50%', top: 0, bottom: 0,
          width: 2, background: 'rgba(248,250,252,0.3)',
          transform: 'translateX(-50%)',
        }} />
        {/* Long-vol leg */}
        <div style={{
          position: 'absolute', left: '5%', right: '52%', top: '20%', bottom: '20%',
          background: 'rgba(0,229,176,0.15)',
          border: '1px solid rgba(0,229,176,0.3)',
          borderRadius: '6px 0 0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#00E5B0', fontWeight: 600 }}>Long-Vol</span>
        </div>
        {/* Short-vol leg */}
        <div style={{
          position: 'absolute', left: '52%', right: '5%', top: '20%', bottom: '20%',
          background: 'rgba(0,194,255,0.15)',
          border: '1px solid rgba(0,194,255,0.3)',
          borderRadius: '0 6px 6px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: '#00C2FF', fontWeight: 600 }}>Short-Vol</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>$1,500</span>
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>$2,500 ←NOW</span>
        <span style={{ fontSize: 11, color: '#475569' }}>$3,500</span>
      </div>
    </div>
  )
}

function RebalanceVisual() {
  const steps = [
    { label: 'Swap Event', color: '#64748B' },
    { label: 'afterSwap()', color: '#00C2FF' },
    { label: 'RebalanceNeeded emitted', color: '#F59E0B' },
    { label: 'RSC detects', color: '#00C2FF' },
    { label: 'triggerRebalance()', color: '#00E5B0' },
    { label: '✓ Rebalanced', color: '#00E5B0' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, x: 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {i > 0 && <div style={{ width: 1, height: 8, background: '#1e2d45', marginLeft: 9, marginTop: -12, position: 'absolute' }} />}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: s.color, flexShrink: 0,
          }} />
          <div style={{
            fontSize: 13, fontWeight: 600, color: s.color,
            padding: '4px 12px',
            background: `${s.color}11`,
            border: `1px solid ${s.color}22`,
            borderRadius: 6,
          }}>{s.label}</div>
        </motion.div>
      ))}
    </div>
  )
}

export default function HowItWorks() {
  return (
    <section style={{ padding: '6rem 2rem', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '5rem' }}
        >
          <div style={{ color: '#00C2FF', fontSize: 12, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            The Mechanism
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC' }}>
            How Vixa Works
          </h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              style={{
                background: '#0B1220',
                border: `1px solid ${step.color}20`,
                borderRadius: 20,
                padding: '2.5rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color 0.3s, transform 0.3s',
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              {/* Step number watermark */}
              <div style={{
                position: 'absolute', top: -10, right: 20,
                fontSize: 100, fontWeight: 900,
                color: `${step.color}08`,
                lineHeight: 1, userSelect: 'none',
              }}>{step.number}</div>

              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${step.color}15`,
                border: `1px solid ${step.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '1.5rem',
              }}>
                <step.icon size={20} color={step.color} />
              </div>

              <div style={{ fontSize: 11, color: step.color, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Step {step.number} — {step.subtitle}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#F8FAFC', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
                {step.title}
              </h3>
              <p style={{ color: '#64748B', fontSize: 14, lineHeight: 1.7, marginBottom: '2rem' }}>
                {step.description}
              </p>

              {/* Visual */}
              <div style={{
                background: 'rgba(3,7,18,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 12,
                padding: '1.5rem',
              }}>
                {step.visual}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
