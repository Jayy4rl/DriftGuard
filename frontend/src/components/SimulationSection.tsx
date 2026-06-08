import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts'

function buildSimData(pricePct: number) {
  const points = 80
  const data = []
  for (let i = 0; i <= points; i++) {
    const progress = i / points
    const priceMove = pricePct * progress
    const absMove = Math.abs(priceMove)

    const vanillaDelta = priceMove < 0
      ? 2.0 + absMove * 0.6
      : 2.0 - absMove * 0.55

    const vixaDelta = priceMove < 0
      ? 0.02 + absMove * 0.04
      : 0.02 - absMove * 0.035

    data.push({
      price: parseFloat((2500 * (1 + priceMove / 100)).toFixed(0)),
      vanilla: parseFloat(vanillaDelta.toFixed(3)),
      vixa: parseFloat(Math.max(-0.15, Math.min(0.15, vixaDelta)).toFixed(3)),
      il_vanilla: parseFloat((absMove * absMove * 0.025).toFixed(2)),
      il_vixa: parseFloat((absMove * absMove * 0.004).toFixed(2)),
    })
  }
  return data
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1b2e', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>ETH ${payload[0]?.payload?.price}</div>
      <div style={{ color: '#EF4444', marginBottom: 3 }}>Vanilla: {payload[0]?.value?.toFixed(3)} ETH delta</div>
      <div style={{ color: '#00E5B0' }}>Vixa: {payload[1]?.value?.toFixed(3)} ETH delta</div>
    </div>
  )
}

export default function SimulationSection() {
  const [pricePct, setPricePct] = useState(0)

  const data = useMemo(() => buildSimData(pricePct), [pricePct])
  const finalRow = data[data.length - 1]
  const absMove = Math.abs(pricePct)
  const ilReduction = absMove > 0 ? Math.round(((finalRow.il_vanilla - finalRow.il_vixa) / finalRow.il_vanilla) * 100) : 0

  return (
    <section style={{ padding: '6rem 2rem', position: 'relative' }}>
      {/* BG glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 900, height: 500, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(37,99,255,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{ color: '#2563FF', fontSize: 12, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            Interactive Simulation
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC' }}>
            Move the Price. See the Difference.
          </h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: 16, maxWidth: 520, margin: '1rem auto 0' }}>
            Drag the slider to simulate ETH price movement and watch how Vixa keeps delta near-neutral while vanilla LP drifts.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            background: '#0B1220',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 24,
            padding: '3rem',
          }}
        >
          {/* Slider */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ color: '#64748B', fontSize: 14 }}>ETH Price Move</span>
              <span style={{
                color: pricePct > 0 ? '#00E5B0' : pricePct < 0 ? '#EF4444' : '#94A3B8',
                fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px',
              }}>
                {pricePct > 0 ? '+' : ''}{pricePct}%
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="range" min={-20} max={20} step={1}
                value={pricePct}
                onChange={e => setPricePct(Number(e.target.value))}
                style={{
                  width: '100%', height: 6,
                  WebkitAppearance: 'none', appearance: 'none',
                  background: `linear-gradient(to right, #2563FF ${((pricePct + 20) / 40) * 100}%, rgba(255,255,255,0.08) ${((pricePct + 20) / 40) * 100}%)`,
                  borderRadius: 3, outline: 'none', cursor: 'pointer',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#334155', marginTop: 6 }}>
              <span>-20%</span><span>0%</span><span>+20%</span>
            </div>
          </div>

          {/* Charts side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            {/* Delta chart */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: '1rem' }}>Net Delta (ETH)</div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 2, background: '#EF4444' }} />
                  <span style={{ color: '#64748B' }}>Vanilla LP</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 2, background: '#00E5B0' }} />
                  <span style={{ color: '#64748B' }}>Vixa LP</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <XAxis dataKey="price" tick={{ fill: '#334155', fontSize: 10 }} axisLine={false} tickLine={false} tickCount={4} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" />
                  <Line type="monotone" dataKey="vanilla" stroke="#EF4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="vixa" stroke="#00E5B0" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* IL chart */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: '1rem' }}>Impermanent Loss (%)</div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 2, background: '#EF4444', opacity: 0.7 }} />
                  <span style={{ color: '#64748B' }}>Vanilla IL</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 2, background: '#00E5B0' }} />
                  <span style={{ color: '#64748B' }}>Vixa IL</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <XAxis dataKey="price" tick={{ fill: '#334155', fontSize: 10 }} axisLine={false} tickLine={false} tickCount={4} />
                  <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="il_vanilla" stroke="#EF4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="il_vixa" stroke="#00E5B0" fill="rgba(0,229,176,0.08)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'ETH Price', value: `$${(2500 * (1 + pricePct / 100)).toFixed(0)}`, color: '#94A3B8' },
              { label: 'Vanilla Delta', value: `${finalRow.vanilla.toFixed(3)} ETH`, color: '#EF4444' },
              { label: 'Vixa Delta', value: `${finalRow.vixa.toFixed(3)} ETH`, color: '#00E5B0' },
              { label: 'IL Reduction', value: absMove > 0 ? `${ilReduction}%` : '—', color: '#00E5B0' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '1rem', background: 'rgba(3,7,18,0.6)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 12, textAlign: 'center',
              }}>
                <div style={{ color: '#334155', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ color: s.color, fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
