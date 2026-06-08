import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const metrics = [
  { label: 'TVL', value: '$2.4M', suffix: '', color: '#00E5B0' },
  { label: 'Net Delta', value: '0.02', suffix: ' ETH', color: '#00C2FF' },
  { label: 'Fee APR', value: '18.7', suffix: '%', color: '#00E5B0' },
  { label: 'Rebalances Today', value: '124', suffix: '', color: '#00C2FF' },
  { label: 'IL Reduction', value: '68', suffix: '%', color: '#00E5B0' },
  { label: 'Chain', value: 'Unichain', suffix: '', color: '#2563FF' },
]

function AnimatedNumber({ target, suffix }: { target: string; suffix: string }) {
  const [display, setDisplay] = useState('0')
  const isNumeric = !isNaN(parseFloat(target))

  useEffect(() => {
    if (!isNumeric) { setDisplay(target); return }
    const num = parseFloat(target)
    let start = 0
    const duration = 1200
    const step = 16
    const increment = num / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= num) { setDisplay(target); clearInterval(timer) }
      else setDisplay(num < 10 ? start.toFixed(2) : Math.floor(start).toString())
    }, step)
    return () => clearInterval(timer)
  }, [target, isNumeric])

  return <span>{display}{suffix}</span>
}

export default function MetricsBar() {
  return (
    <section style={{ padding: '0 2rem 4rem', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '1px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              style={{
                padding: '2rem 1.5rem',
                background: '#0B1220',
                textAlign: 'center',
                position: 'relative',
                transition: 'background 0.3s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0f1929')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0B1220')}
            >
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                {m.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: m.color, letterSpacing: '-1px' }}>
                {m.label === 'Chain' || m.label === 'TVL'
                  ? m.value
                  : <AnimatedNumber target={m.value} suffix={m.suffix} />}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
