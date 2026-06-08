import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Activity, TrendingUp, Users, DollarSign, Zap, AlertCircle, CheckCircle } from 'lucide-react'

function generateChartData() {
  const data = []
  let vixaDelta = 0.02
  let vanillaDelta = 2.0
  for (let i = 0; i < 60; i++) {
    const noise = (Math.random() - 0.5) * 0.15
    vanillaDelta += noise * 1.8
    vixaDelta += noise * 0.08
    if (Math.abs(vixaDelta) > 0.1) vixaDelta *= 0.4
    data.push({
      t: i,
      vanilla: parseFloat(vanillaDelta.toFixed(3)),
      vixa: parseFloat(vixaDelta.toFixed(3)),
    })
  }
  return data
}

const MOCK_EVENTS = [
  { type: 'rebalance', icon: Zap, msg: 'Rebalance Executed', detail: 'Block #19438201 · Δ 0.052 ETH', color: '#00E5B0', time: '2s ago' },
  { type: 'threshold', icon: AlertCircle, msg: 'Threshold Breached', detail: 'Net delta exceeded 0.05 ETH', color: '#F59E0B', time: '14s ago' },
  { type: 'swap', icon: Activity, msg: 'Large Swap Detected', detail: '80 ETH → USDC on pool', color: '#94A3B8', time: '14s ago' },
  { type: 'recovery', icon: CheckCircle, msg: 'Reactive Recovery Triggered', detail: 'RSC detected out-of-range position', color: '#2563FF', time: '2m ago' },
  { type: 'rebalance', icon: Zap, msg: 'Rebalance Executed', detail: 'Block #19438119 · Δ 0.061 ETH', color: '#00E5B0', time: '4m ago' },
  { type: 'deposit', icon: TrendingUp, msg: 'LP Deposit', detail: '$125K USDC deposited', color: '#00C2FF', time: '11m ago' },
]

function DeltaGauge({ value }: { value: number }) {
  const pct = Math.min(Math.abs(value) / 0.15, 1)
  const angle = -130 + pct * 260
  const color = pct < 0.4 ? '#00E5B0' : pct < 0.7 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 160 90" style={{ width: 160 }}>
        <defs>
          <linearGradient id="gauge-bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5B0" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" strokeLinecap="round" />
        {/* Filled track */}
        <path d="M 20 80 A 60 60 0 0 1 140 80"
          fill="none" stroke="url(#gauge-bg)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${pct * 188.4} 188.4`} />
        {/* Needle */}
        <g transform={`rotate(${angle}, 80, 80)`}>
          <line x1="80" y1="80" x2="80" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="80" cy="80" r="4" fill={color} />
        </g>
        <text x="80" y="75" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">
          {value.toFixed(3)}
        </text>
        <text x="80" y="88" textAnchor="middle" fill="#475569" fontSize="8">ETH delta</text>
      </svg>
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: color,
        padding: '3px 12px',
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 100,
      }}>
        {pct < 0.4 ? '● Neutral' : pct < 0.7 ? '⚠ Drifting' : '✗ Rebalancing'}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1b2e', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: '#EF4444', marginBottom: 2 }}>Vanilla: {payload[0]?.value?.toFixed(3)} ETH</div>
      <div style={{ color: '#00E5B0' }}>Vixa: {payload[1]?.value?.toFixed(3)} ETH</div>
    </div>
  )
}

export default function DashboardSection() {
  const [chartData] = useState(generateChartData)
  const [delta, setDelta] = useState(0.02)
  const [liveEvents] = useState(MOCK_EVENTS)

  useEffect(() => {
    const timer = setInterval(() => {
      setDelta(prev => {
        const next = prev + (Math.random() - 0.5) * 0.012
        return parseFloat(Math.max(-0.12, Math.min(0.12, next)).toFixed(3))
      })
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  return (
    <section id="dashboard" style={{ padding: '6rem 2rem', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{ color: '#00C2FF', fontSize: 12, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Live Dashboard
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC' }}>
            Live Pool Metrics
          </h2>
        </motion.div>

        {/* Top metrics row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: DollarSign, label: 'TVL', value: '$2.41M', color: '#00E5B0' },
            { icon: TrendingUp, label: 'Fee APR', value: '18.7%', color: '#00C2FF' },
            { icon: Users, label: 'Active Positions', value: '142', color: '#2563FF' },
            { icon: Activity, label: 'Daily Fees', value: '$4,820', color: '#00E5B0' },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              style={{
                background: '#0B1220',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                padding: '1.5rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
                transition: 'border-color 0.3s',
              }}
              whileHover={{ scale: 1.01 }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: `${m.color}12`,
                border: `1px solid ${m.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <m.icon size={18} color={m.color} />
              </div>
              <div>
                <div style={{ color: '#475569', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ color: '#F8FAFC', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{m.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main dashboard grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1.5rem' }}>
          {/* Delta gauge */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: '#0B1220',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '2rem',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: '1.5rem' }}>
              Net Delta
            </div>
            <DeltaGauge value={delta} />
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
                <span>Target</span><span style={{ color: '#00E5B0' }}>0.00 ETH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', marginBottom: 6 }}>
                <span>Threshold</span><span style={{ color: '#94A3B8' }}>±0.05 ETH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569' }}>
                <span>Last Rebalance</span><span style={{ color: '#94A3B8' }}>2s ago</span>
              </div>
            </div>
          </motion.div>

          {/* Delta stability chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{
              background: '#0B1220',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '2rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>Delta Stability Chart</div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: '#EF4444' }} />
                  <span style={{ color: '#64748B' }}>Vanilla LP</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: '#00E5B0' }} />
                  <span style={{ color: '#64748B' }}>Vixa LP</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="t" hide />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.06)" />
                <Line type="monotone" dataKey="vanilla" stroke="#EF4444" strokeWidth={2} dot={false} strokeOpacity={0.8} />
                <Line type="monotone" dataKey="vixa" stroke="#00E5B0" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ color: '#334155', fontSize: 12, marginTop: '0.75rem', textAlign: 'center' }}>
              Vixa delta remains near-zero while vanilla LP drifts with price
            </p>
          </motion.div>

          {/* Event feed */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: '#0B1220',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16,
              padding: '2rem',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.5rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00E5B0' }} className="pulse-glow" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>Live Activity</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {liveEvents.map((ev, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    padding: '10px 12px',
                    background: `${ev.color}08`,
                    border: `1px solid ${ev.color}18`,
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <ev.icon size={13} color={ev.color} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: ev.color, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{ev.msg}</div>
                      <div style={{ color: '#334155', fontSize: 10, marginTop: 2 }}>{ev.detail}</div>
                    </div>
                  </div>
                  <div style={{ color: '#334155', fontSize: 10, marginTop: 4, textAlign: 'right' }}>{ev.time}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
