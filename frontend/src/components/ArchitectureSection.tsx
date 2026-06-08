import { motion } from 'framer-motion'

export default function ArchitectureSection() {
  return (
    <section style={{ padding: '6rem 2rem', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <div style={{ color: '#00E5B0', fontSize: 12, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1rem' }}>
            System Design
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 900, letterSpacing: '-1.5px', margin: 0, color: '#F8FAFC' }}>
            Architecture
          </h2>
          <p style={{ color: '#64748B', marginTop: '1rem', fontSize: 16, maxWidth: 500, margin: '1rem auto 0' }}>
            Four contracts. No external dependencies for the primary hedge. The RSC handles only edge cases.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          {/* Diagram */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{
              background: '#0B1220',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              padding: '3rem 2rem',
              position: 'relative',
            }}
          >
            <svg viewBox="0 0 400 320" style={{ width: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="line-g" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00E5B0" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#2563FF" stopOpacity="0.3" />
                </linearGradient>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(0,229,176,0.5)" />
                </marker>
              </defs>

              {/* Connecting lines */}
              {/* vault → hook */}
              <motion.line x1="200" y1="52" x2="200" y2="96"
                stroke="url(#line-g)" strokeWidth="1.5" strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
              />
              {/* hook → uniswap */}
              <motion.line x1="200" y1="126" x2="200" y2="170"
                stroke="url(#line-g)" strokeWidth="1.5" strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.5 }}
              />
              {/* uniswap → reactive (diagonal left) */}
              <motion.line x1="180" y1="195" x2="80" y2="242"
                stroke="rgba(0,229,176,0.3)" strokeWidth="1.5" strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, duration: 0.5 }}
              />
              {/* reactive → recovery */}
              <motion.line x1="130" y1="258" x2="280" y2="258"
                stroke="rgba(0,194,255,0.3)" strokeWidth="1.5" strokeDasharray="4 3"
                markerEnd="url(#arrowhead)"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.9, duration: 0.5 }}
              />
              {/* hook → reactive (side line) */}
              <motion.line x1="148" y1="115" x2="80" y2="242"
                stroke="rgba(0,229,176,0.15)" strokeWidth="1" strokeDasharray="3 4"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1, duration: 0.5 }}
              />

              {/* Nodes */}
              {[
                { label: 'DeltaDepositor', sub: 'Single-user depositor', x: 200, y: 30, color: '#00E5B0' },
                { label: 'DeltaHook', sub: 'v4 · Event Emitter', x: 200, y: 110, color: '#00C2FF' },
                { label: 'Uniswap v4', sub: 'PoolManager', x: 200, y: 188, color: '#2563FF' },
                { label: 'Reactive Net', sub: 'Event Subscriptions', x: 72, y: 258, color: '#00E5B0' },
                { label: 'DeltaHookRSC', sub: 'Edge Cases', x: 328, y: 258, color: '#00C2FF' },
              ].map((node, i) => (
                <motion.g key={node.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  style={{ cursor: 'default' }}
                >
                  <rect
                    x={node.x - 62} y={node.y - 18}
                    width={124} height={38}
                    rx={8}
                    fill="#0d1b2e"
                    stroke={`${node.color}40`}
                    strokeWidth="1"
                  />
                  <text x={node.x} y={node.y - 2} textAnchor="middle"
                    fill={node.color} fontSize="11" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={node.x} y={node.y + 12} textAnchor="middle"
                    fill="#475569" fontSize="9">
                    {node.sub}
                  </text>
                </motion.g>
              ))}
            </svg>
          </motion.div>

          {/* Contract details */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            {[
              {
                name: 'DeltaDepositor.sol',
                desc: 'Single-user depositor. LP entry point. Splits capital 50/50 across two sub-positions. Calls modifyLiquidity on PoolManager for deposits, withdrawals, and rebalances.',
                color: '#00E5B0',
              },
              {
                name: 'DeltaHook.sol',
                desc: 'v4 Hook. afterAddLiquidity registers sub-positions. afterSwap computes net delta and emits RebalanceNeeded when threshold is breached. Reentrancy guard enforced. updatePositionRanges() syncs state after rebalancing.',
                color: '#00C2FF',
              },
              {
                name: 'DeltaEngine.sol',
                desc: 'Pure math library. No state. Computes position delta given sqrtPriceX96, tick ranges, and liquidity. Compiled into DeltaHook.',
                color: '#2563FF',
              },
              {
                name: 'DeltaHookRSC.sol',
                desc: 'Reactive Smart Contract. Subscribes to hook events. Calls triggerRebalance() on DeltaDepositor when RebalanceNeeded is detected. Handles out-of-range recovery and edge cases.',
                color: '#00E5B0',
              },
            ].map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{
                  padding: '1.25rem 1.5rem',
                  background: '#0B1220',
                  border: `1px solid ${c.color}15`,
                  borderRadius: 12,
                  display: 'flex', gap: '1rem',
                  transition: 'border-color 0.3s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${c.color}35`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = `${c.color}15`)}
              >
                <div style={{
                  width: 8, borderRadius: 4, flexShrink: 0,
                  background: `linear-gradient(to bottom, ${c.color}, ${c.color}40)`,
                }} />
                <div>
                  <div style={{ color: c.color, fontWeight: 700, fontSize: 13, fontFamily: 'monospace', marginBottom: 4 }}>
                    {c.name}
                  </div>
                  <div style={{ color: '#64748B', fontSize: 13, lineHeight: 1.6 }}>{c.desc}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
