import { motion } from 'framer-motion'

export default function CTASection({ onLaunchApp }: { onLaunchApp?: () => void }) {
  return (
    <section style={{ padding: '8rem 2rem', position: 'relative', overflow: 'hidden' }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 800, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,229,176,0.08) 0%, rgba(37,99,255,0.06) 50%, transparent 75%)',
        pointerEvents: 'none',
      }} />

      {/* Grid overlay */}
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.4 }} />

      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div style={{
            display: 'inline-block',
            color: '#00E5B0', fontSize: 12, fontWeight: 600,
            letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '1.5rem',
            padding: '6px 16px',
            background: 'rgba(0,229,176,0.08)',
            border: '1px solid rgba(0,229,176,0.2)',
            borderRadius: 100,
          }}>
            Get Started
          </div>

          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 900,
            letterSpacing: '-2px',
            margin: '0 0 1.5rem',
            color: '#F8FAFC',
            lineHeight: 1.05,
          }}>
            Ready to LP Without<br />
            <span className="text-gradient">Constant Delta Risk?</span>
          </h2>

          <p style={{
            color: '#64748B', fontSize: 18, lineHeight: 1.7,
            maxWidth: 520, margin: '0 auto 3rem',
          }}>
            Deposit into Vixa and let automated rebalancing handle your
            delta exposure — continuously, via Reactive Network.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 16px 50px rgba(0,229,176,0.3)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'linear-gradient(135deg, #00E5B0, #00C2FF)',
                color: '#030712', border: 'none', borderRadius: 12,
                padding: '16px 40px', fontWeight: 800, fontSize: 17,
                cursor: 'pointer', letterSpacing: '-0.3px',
              }}
              onClick={onLaunchApp}
            >
              Launch App
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, borderColor: 'rgba(0,229,176,0.4)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'transparent', color: '#F8FAFC',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12, padding: '16px 40px',
                fontWeight: 600, fontSize: 17, cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              Read Technical Docs
            </motion.button>
          </div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            style={{
              display: 'flex', gap: '2rem', justifyContent: 'center',
              marginTop: '3rem', flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Audited by', value: 'Pending' },
              { label: 'Hook Flags', value: '5 Verified' },
              { label: 'Deployed on', value: 'Unichain' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#334155', fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ color: '#64748B', fontSize: 14, fontWeight: 600, marginTop: 2 }}>{item.value}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
