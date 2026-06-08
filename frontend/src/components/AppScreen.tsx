import { useState, useEffect, useCallback, type ReactNode, type CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import {
  Copy, ExternalLink, CheckCircle2, Loader2, Wallet, ArrowLeft,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#030712',
  card: '#0B1220',
  border: 'rgba(255,255,255,0.07)',
  cyan: '#00E5B0',
  blue: '#00C2FF',
  indigo: '#2563FF',
  text: '#F8FAFC',
  muted: '#64748B',
  dim: '#334155',
  warn: '#F59E0B',
  danger: '#EF4444',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────
type WorkflowStep = 1 | 2 | 3 | 4
type PageMode = 'workflow' | 'dashboard'
interface LiveEvent {
  id: number
  label: string
  detail: string
  time: string
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`
const priceToTick = (p: number) => Math.round(Math.log(p) / Math.log(1.0001))

let evId = 1000
function mkEvent(label: string, detail: string, color: string): LiveEvent {
  return { id: evId++, label, detail, time: 'just now', color }
}

function generateHistory() {
  const out = []
  let v = 2, x = 0.025
  for (let i = 0; i < 60; i++) {
    const n = (Math.random() - 0.5) * 0.2
    v += n * 1.5; x += n * 0.07
    if (Math.abs(x) > 0.08) x *= 0.3
    out.push({ t: i, vanilla: +v.toFixed(3), vixa: +x.toFixed(3) })
  }
  return out
}

// ─── Shared card shell ────────────────────────────────────────────────────────
function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: '1.5rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function AppHeader({ onBack, address, isConnected, onConnect, onDisconnect }: {
  onBack: () => void
  address?: string
  isConnected: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (address) { navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${C.border}`,
      padding: '0 2rem', height: 60,
      display: 'flex', alignItems: 'center', gap: '1rem',
    }}>
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: C.muted, background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 13, padding: '4px 8px',
        borderRadius: 6, transition: 'color 0.2s',
      }}
        onMouseEnter={e => (e.currentTarget.style.color = C.cyan)}
        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{ width: 1, height: 24, background: C.border }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 16, fontWeight: 900, letterSpacing: '-0.5px',
          background: 'linear-gradient(135deg,#00E5B0,#00C2FF)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>VIXA</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '1.5px', color: C.muted, textTransform: 'uppercase' }}>
          Terminal
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 100,
        background: 'rgba(0,229,176,0.06)',
        border: '1px solid rgba(0,229,176,0.15)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan }} className="pulse-glow" />
        <span style={{ fontSize: 12, color: C.cyan, fontWeight: 500 }}>Reactive Network Connected</span>
      </div>

      <div style={{ width: 1, height: 24, background: C.border }} />

      {isConnected && address ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '5px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan }} />
            <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{fmtAddr(address)}</span>
            <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: copied ? C.cyan : C.dim, display: 'flex' }}>
              {copied ? <CheckCircle2 size={12} color={C.cyan} /> : <Copy size={12} />}
            </button>
          </div>
          <button onClick={onDisconnect} style={{
            padding: '5px 10px', borderRadius: 8,
            background: 'none', border: `1px solid ${C.border}`,
            color: C.muted, fontSize: 12, cursor: 'pointer',
          }}>
            Disconnect
          </button>
        </div>
      ) : (
        <button onClick={onConnect} style={{
          padding: '6px 16px', borderRadius: 8,
          background: 'linear-gradient(135deg,#00E5B0,#00C2FF)',
          border: 'none', color: '#030712', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          Connect Wallet
        </button>
      )}
    </div>
  )
}

// ─── Disconnected banner ──────────────────────────────────────────────────────
function DisconnectedBanner({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      style={{
        maxWidth: 600, margin: '2rem auto',
        background: 'rgba(0,229,176,0.04)',
        border: '1px solid rgba(0,229,176,0.18)',
        borderRadius: 20, padding: '2.5rem',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 200,
        background: 'radial-gradient(circle, rgba(0,229,176,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 1.5rem',
        background: 'rgba(0,229,176,0.1)', border: '1px solid rgba(0,229,176,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Wallet size={24} color={C.cyan} />
      </div>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: '0.75rem', letterSpacing: '-0.5px' }}>
        Connect Wallet to Begin
      </h3>
      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 2rem' }}>
        Connect your wallet to receive test assets, configure your position,
        and deploy liquidity into the Vixa protocol.
      </p>
      <motion.button
        whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(0,229,176,0.3)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onConnect}
        style={{
          background: 'linear-gradient(135deg,#00E5B0,#00C2FF)',
          border: 'none', borderRadius: 12,
          padding: '14px 36px', color: '#030712',
          fontSize: 15, fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.3px',
        }}
      >
        Connect Wallet
      </motion.button>
    </motion.div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, completed }: { current: WorkflowStep; completed: Set<number> }) {
  const steps = [{ n: 1, label: 'Tokens' }, { n: 2, label: 'Approve' }, { n: 3, label: 'Configure' }, { n: 4, label: 'Confirmed' }]
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
      {steps.map((s, i) => {
        const done = completed.has(s.n)
        const active = current === s.n
        const color = done ? C.cyan : active ? C.blue : C.dim
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? 'rgba(0,229,176,0.12)' : active ? 'rgba(0,194,255,0.1)' : 'rgba(51,65,85,0.4)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                {done
                  ? <CheckCircle2 size={13} color={C.cyan} />
                  : <span style={{ fontSize: 11, fontWeight: 700, color }}>{s.n}</span>
                }
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1, margin: '0 6px', marginBottom: 18,
                background: done ? C.cyan : C.dim,
                transition: 'background 0.5s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Get tokens ───────────────────────────────────────────────────────
function Step1Tokens({ weth, usdc, loading, onFaucet }: {
  weth: number; usdc: number; loading: boolean; onFaucet: () => void
}) {
  const ready = weth > 0 && usdc > 0
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ fontSize: 11, color: C.cyan, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
        Step 01 — Get Test Tokens
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { sym: 'WETH', val: weth, disp: weth.toString() },
          { sym: 'USDC', val: usdc, disp: usdc.toLocaleString() },
        ].map(t => (
          <div key={t.sym} style={{
            padding: '1rem',
            background: ready ? 'rgba(0,229,176,0.05)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${ready ? 'rgba(0,229,176,0.2)' : C.border}`,
            borderRadius: 12, transition: 'all 0.4s',
          }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: '0.5px', marginBottom: 6 }}>
              {t.sym} BALANCE
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: ready ? C.cyan : C.text, letterSpacing: '-0.5px' }}>
              {t.disp}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
              {ready ? '✓ Ready' : `Target: ${t.sym === 'WETH' ? '100' : '100,000'}`}
            </div>
          </div>
        ))}
      </div>
      {!ready ? (
        <motion.button
          whileHover={{ scale: 1.01, boxShadow: '0 10px 30px rgba(0,229,176,0.2)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onFaucet}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(0,229,176,0.12)' : 'linear-gradient(135deg,#00E5B0,#00C2FF)',
            border: 'none', borderRadius: 12,
            color: loading ? C.cyan : '#030712',
            fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading
            ? <><Loader2 size={15} style={{ animation: 'spin-slow 1s linear infinite' }} />Requesting Tokens...</>
            : 'Get Test Tokens'
          }
        </motion.button>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          background: 'rgba(0,229,176,0.08)',
          border: '1px solid rgba(0,229,176,0.2)',
          borderRadius: 10, color: C.cyan, fontSize: 14, fontWeight: 600,
        }}>
          <CheckCircle2 size={16} /> Tokens Received — Proceed to Approval
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Step 2: Approve ──────────────────────────────────────────────────────────
function Step2Approve({
  wethOk, usdcOk, approvingW, approvingU, onApproveW, onApproveU,
}: {
  wethOk: boolean; usdcOk: boolean
  approvingW: boolean; approvingU: boolean
  onApproveW: () => void; onApproveU: () => void
}) {
  const tokens = [
    { sym: 'WETH', ok: wethOk, approving: approvingW, onApprove: onApproveW },
    { sym: 'USDC', ok: usdcOk, approving: approvingU, onApprove: onApproveU },
  ]
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
        Step 02 — Approve Tokens
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {tokens.map(t => (
          <div key={t.sym} style={{
            padding: '1.25rem',
            background: t.ok ? 'rgba(0,229,176,0.05)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${t.ok ? 'rgba(0,229,176,0.2)' : C.border}`,
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'all 0.4s',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                {t.sym} Approval
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {t.ok ? 'Allowance: Unlimited' : 'Current Allowance: 0'}
              </div>
            </div>
            {t.ok ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(0,229,176,0.1)',
                border: '1px solid rgba(0,229,176,0.2)',
                borderRadius: 8, color: C.cyan, fontSize: 12, fontWeight: 600,
              }}>
                <CheckCircle2 size={13} /> Approved
              </div>
            ) : (
              <button
                onClick={t.onApprove}
                disabled={t.approving}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  background: 'linear-gradient(135deg,#00E5B0,#00C2FF)',
                  border: 'none', color: '#030712',
                  fontSize: 12, fontWeight: 700,
                  cursor: t.approving ? 'not-allowed' : 'pointer',
                  opacity: t.approving ? 0.65 : 1,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {t.approving
                  ? <><Loader2 size={12} style={{ animation: 'spin-slow 1s linear infinite' }} />Approving...</>
                  : `Approve ${t.sym}`
                }
              </button>
            )}
          </div>
        ))}
      </div>
      {wethOk && usdcOk && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          background: 'rgba(0,229,176,0.08)',
          border: '1px solid rgba(0,229,176,0.2)',
          borderRadius: 10, color: C.cyan, fontSize: 13, fontWeight: 600,
        }}>
          <CheckCircle2 size={15} /> Both tokens approved — Configure your position
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Step 3: Configure ────────────────────────────────────────────────────────
function Step3Configure({
  liquidity, setLiquidity, threshold, setThreshold,
  tick, deploying, onDeploy,
}: {
  liquidity: string; setLiquidity: (v: string) => void
  threshold: string; setThreshold: (v: string) => void
  tick: number; deploying: boolean; onDeploy: () => void
}) {
  const liq = parseFloat(liquidity) || 0
  const thresh = parseFloat(threshold) || 0.05

  const inputStyle: CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '12px 48px 12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${C.border}`,
    borderRadius: 10, color: C.text, fontSize: 16, fontWeight: 600,
    outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ fontSize: 11, color: C.indigo, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
        Step 03 — Configure Position
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'LIQUIDITY AMOUNT', value: liquidity, onChange: setLiquidity, unit: 'USDC', placeholder: '1000', focusColor: C.cyan },
          { label: 'DELTA THRESHOLD', value: threshold, onChange: setThreshold, unit: 'ETH', placeholder: '0.05', focusColor: C.blue },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 600, display: 'block', marginBottom: f.label.includes('THRESHOLD') ? 2 : 6 }}>
              {f.label}
            </label>
            {f.label.includes('THRESHOLD') && (
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>
                Defines when automatic rebalancing is triggered
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <input
                type="number" value={f.value} placeholder={f.placeholder}
                onChange={e => f.onChange(e.target.value)}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = `${f.focusColor}55`)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border)}
              />
              <span style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                color: C.muted, fontSize: 11, fontWeight: 700,
              }}>{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Position preview */}
      <div style={{
        padding: '1rem',
        background: 'rgba(0,229,176,0.04)',
        border: '1px solid rgba(0,229,176,0.12)',
        borderRadius: 12, marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          POSITION PREVIEW
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 12 }}>
          {[
            { label: 'Long-Vol Leg', range: `${tick - 2000} → ${tick}`, alloc: '50%', color: C.cyan },
            { label: 'Short-Vol Leg', range: `${tick + 10} → ${tick + 2010}`, alloc: '50%', color: C.blue },
          ].map(leg => (
            <div key={leg.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: leg.color, flexShrink: 0 }} />
                <span style={{ color: C.muted }}>{leg.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: C.dim, fontFamily: 'monospace', fontSize: 10 }}>{leg.range}</span>
                <span style={{ color: leg.color, fontWeight: 700 }}>{leg.alloc}</span>
              </div>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.muted }}>Each Leg</span>
            <span style={{ color: C.text, fontWeight: 700 }}>{liq > 0 ? `${(liq / 2).toLocaleString()} USDC` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: C.muted }}>Rebalance At</span>
            <span style={{ color: C.warn, fontWeight: 700 }}>|Δ| &gt; {thresh} ETH</span>
          </div>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.01, boxShadow: '0 12px 40px rgba(0,229,176,0.18)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onDeploy}
        disabled={deploying || !liquidity}
        style={{
          width: '100%', padding: '16px',
          background: deploying ? 'rgba(0,229,176,0.12)' : 'linear-gradient(135deg,#00E5B0,#00C2FF)',
          border: 'none', borderRadius: 12,
          color: deploying ? C.cyan : '#030712',
          fontSize: 15, fontWeight: 800,
          cursor: deploying || !liquidity ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          letterSpacing: '-0.3px',
          opacity: !liquidity ? 0.5 : 1,
          transition: 'all 0.2s',
        }}
      >
        {deploying
          ? <><Loader2 size={16} style={{ animation: 'spin-slow 1s linear infinite' }} />Deploying Position...</>
          : 'Deploy Position'
        }
      </motion.button>
    </motion.div>
  )
}

// ─── Step 4: Confirmed ────────────────────────────────────────────────────────
function Step4Confirmed({ txHash, positionId, blockNum, countdown }: {
  txHash: string; positionId: string; blockNum: number; countdown: number
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            width: 60, height: 60, borderRadius: '50%', margin: '0 auto 1.5rem',
            background: 'rgba(0,229,176,0.12)',
            border: '2px solid rgba(0,229,176,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CheckCircle2 size={26} color={C.cyan} />
        </motion.div>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: '0.5rem' }}>
          Position Successfully Deployed
        </h3>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: '2rem' }}>
          Redirecting to Position Dashboard...
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem', textAlign: 'left' }}>
          {[
            { label: 'Transaction Hash', value: `${txHash.slice(0, 18)}...${txHash.slice(-8)}`, link: true },
            { label: 'Position ID', value: positionId },
            { label: 'Block Number', value: `#${blockNum.toLocaleString()}` },
          ].map(item => (
            <div key={item.label} style={{
              padding: '11px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>{item.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: C.cyan, fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>{item.value}</span>
                {item.link && <ExternalLink size={10} color={C.dim} />}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', margin: '0 auto',
          background: 'rgba(0,194,255,0.1)',
          border: `2px solid ${C.blue}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{countdown}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Range Visualizer ─────────────────────────────────────────────────────────
function RangeVisualizer({ tick }: { tick: number }) {
  const totalSpan = 4400
  const rangeStart = tick - 2200
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - rangeStart) / totalSpan) * 100))

  const segments = [
    { start: pct(tick - 2000), end: pct(tick), color: C.cyan, label: 'LONG-VOL', bg: 'rgba(0,229,176,0.18)', border: 'rgba(0,229,176,0.45)' },
    { start: pct(tick + 10), end: pct(tick + 2010), color: C.blue, label: 'SHORT-VOL', bg: 'rgba(0,194,255,0.18)', border: 'rgba(0,194,255,0.45)' },
  ]
  const pricePos = pct(tick)

  return (
    <div>
      <div style={{ position: 'relative', height: 80, marginBottom: '0.75rem' }}>
        {/* Track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '38%', height: 24,
          borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
        }} />
        {/* Segments */}
        {segments.map(seg => (
          <motion.div
            key={seg.label}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: seg.label === 'SHORT-VOL' ? 0.15 : 0 }}
            style={{
              position: 'absolute',
              left: `${seg.start}%`,
              width: `${seg.end - seg.start}%`,
              top: '38%', height: 24,
              background: seg.bg,
              border: `1px solid ${seg.border}`,
              borderRadius: 4,
              transformOrigin: 'left',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 8, fontWeight: 800, color: seg.color, letterSpacing: '0.5px' }}>
              {seg.label}
            </span>
          </motion.div>
        ))}
        {/* Price marker */}
        <motion.div
          animate={{ left: `${pricePos}%` }}
          transition={{ type: 'spring', damping: 25 }}
          style={{
            position: 'absolute', top: 0, bottom: 0,
            transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          <div style={{
            position: 'absolute', top: 2, fontSize: 8, fontWeight: 700,
            color: C.text, background: 'rgba(15,25,41,0.95)',
            padding: '1px 5px', borderRadius: 3,
            border: `1px solid ${C.border}`, whiteSpace: 'nowrap',
          }}>NOW</div>
          <div style={{
            width: 2, height: '100%',
            background: 'rgba(248,250,252,0.55)',
            boxShadow: '0 0 6px rgba(248,250,252,0.25)',
          }} />
        </motion.div>
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: C.cyan }} />
          <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>
            {tick - 2000} → {tick}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: C.blue }} />
          <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>
            {tick + 10} → {tick + 2010}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Rebalance flow diagram ───────────────────────────────────────────────────
function RebalanceFlowDiagram() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % 6), 700)
    return () => clearInterval(t)
  }, [])

  const nodes = [
    { label: 'Swap Event', color: C.muted },
    { label: 'afterSwap()', color: C.blue },
    { label: 'RebalanceNeeded emitted', color: C.warn },
    { label: 'RSC detects event', color: C.cyan },
    { label: 'triggerRebalance()', color: C.cyan },
    { label: '✓ Position Updated', color: C.cyan },
  ]

  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '1rem' }}>
        AUTOMATION FLOW
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {nodes.map((node, i) => {
          const lit = i <= active
          const cur = i === active
          return (
            <div key={node.label}>
              <motion.div
                animate={{
                  background: cur ? `${node.color}14` : lit ? `${node.color}07` : 'transparent',
                  borderColor: cur ? `${node.color}45` : lit ? `${node.color}20` : C.border,
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7,
                  border: '1px solid', marginBottom: 3, transition: 'all 0.25s',
                }}
              >
                <motion.div
                  animate={{
                    background: cur ? node.color : lit ? `${node.color}55` : C.dim,
                    boxShadow: cur ? `0 0 7px ${node.color}` : 'none',
                  }}
                  style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, transition: 'all 0.25s' }}
                />
                <span style={{
                  fontSize: 11,
                  fontWeight: cur ? 700 : 400,
                  color: cur ? node.color : lit ? `${node.color}80` : C.dim,
                  transition: 'all 0.25s',
                }}>{node.label}</span>
              </motion.div>
              {i < nodes.length - 1 && (
                <div style={{
                  width: 1, height: 6, marginLeft: 17, marginBottom: 3,
                  background: lit ? `${node.color}35` : C.dim,
                  transition: 'background 0.25s',
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Delta engine card ────────────────────────────────────────────────────────
function DeltaEngineCard({ delta, threshold }: { delta: number; threshold: number }) {
  const abs = Math.abs(delta)
  const pct = Math.min(abs / threshold, 1.2)
  const breached = abs > threshold
  const color = pct < 0.6 ? C.cyan : pct < 1 ? C.warn : C.danger

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 4 }}>
            CURRENT DELTA
          </div>
          <motion.div
            key={delta.toFixed(3)}
            initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
            style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-1px' }}
          >
            {delta > 0 ? '+' : ''}{delta.toFixed(3)} ETH
          </motion.div>
        </div>
        <motion.div
          animate={{
            background: breached ? 'rgba(245,158,11,0.14)' : 'rgba(0,229,176,0.09)',
            borderColor: breached ? 'rgba(245,158,11,0.35)' : 'rgba(0,229,176,0.25)',
          }}
          style={{
            padding: '4px 10px', borderRadius: 100, border: '1px solid',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
            color: breached ? C.warn : C.cyan,
          }}
        >
          {breached ? '⚠ Rebalance Pending' : '● Within Range'}
        </motion.div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', overflow: 'hidden', position: 'relative' }}>
        <motion.div
          animate={{ width: `${Math.min(pct * 100, 100)}%` }}
          style={{
            position: 'absolute', left: 0, top: 0, height: '100%',
            background: `linear-gradient(to right, ${C.cyan}, ${color})`,
            borderRadius: 3, transition: 'width 0.6s',
          }}
        />
        {/* Threshold tick */}
        <div style={{
          position: 'absolute', left: '83%', top: -2, bottom: -2,
          width: 2, background: 'rgba(255,255,255,0.25)', borderRadius: 1,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginBottom: '1rem' }}>
        <span>0</span><span>Threshold: {threshold} ETH</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { k: 'Threshold', v: `${threshold} ETH`, c: C.muted },
          { k: 'Abs Delta', v: `${abs.toFixed(3)} ETH`, c: color },
          { k: 'Status', v: breached ? 'BREACH' : 'OK', c: breached ? C.warn : C.cyan },
        ].map(m => (
          <div key={m.k} style={{
            padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, textAlign: 'center',
          }}>
            <div style={{ fontSize: 8, color: C.dim, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{m.k}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Automation status card ───────────────────────────────────────────────────
function AutomationCard() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1400)
    return () => clearInterval(t)
  }, [])
  const indicators = ['Monitoring Delta', 'Watching Position', 'Maintaining Threshold', 'Ready To Trigger Rebalance']
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          REACTIVE AUTOMATION
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 100,
          background: 'rgba(0,229,176,0.09)',
          border: '1px solid rgba(0,229,176,0.22)',
          fontSize: 9, fontWeight: 800, color: C.cyan, letterSpacing: '0.8px',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan }} className="pulse-glow" />
          ACTIVE
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {indicators.map((label, i) => {
          const lit = i <= (tick % (indicators.length + 1))
          return (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 7,
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${C.border}`,
            }}>
              <motion.div
                animate={{ opacity: lit ? 1 : 0.25 }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan, flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, color: lit ? C.text : C.dim, fontWeight: lit ? 500 : 400, transition: 'all 0.3s', flex: 1 }}>
                {label}
              </span>
              <AnimatePresence>
                {lit && (
                  <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}>
                    <CheckCircle2 size={11} color={C.cyan} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Pool status card ─────────────────────────────────────────────────────────
function PoolStatusCard({ price, tick }: { price: number; tick: number }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          POOL STATUS
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['WETH / USDC', '0.3%', 'Unichain Sepolia'].map(b => (
            <span key={b} style={{
              fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
              color: C.muted, letterSpacing: '0.3px',
            }}>{b}</span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { k: 'Current Price', v: `$${price.toFixed(2)}`, c: C.text },
          { k: 'Current Tick', v: tick.toLocaleString(), c: C.cyan },
          { k: 'Pool TVL', v: '$4.2M', c: C.text },
          { k: '24H Volume', v: '$1.8M', c: C.text },
        ].map(m => (
          <div key={m.k} style={{
            padding: '12px', background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`, borderRadius: 10, textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{m.k}</div>
            <motion.div key={m.v} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}
              style={{ fontSize: 14, fontWeight: 800, color: m.c, letterSpacing: '-0.3px' }}
            >
              {m.v}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Live event feed ──────────────────────────────────────────────────────────
function LiveEventFeed({ events }: { events: LiveEvent[] }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.cyan }} className="pulse-glow" />
        <span style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          Live Events
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
        <AnimatePresence initial={false}>
          {events.slice(0, 10).map(ev => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: 10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                padding: '8px 10px',
                background: `${ev.color}08`,
                border: `1px solid ${ev.color}20`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: ev.color }}>{ev.label}</span>
                <span style={{ fontSize: 9, color: C.dim }}>{ev.time}</span>
              </div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{ev.detail}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Delta history chart ──────────────────────────────────────────────────────
function DeltaHistoryChart() {
  const [data] = useState(generateHistory)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          DELTA HISTORY
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {[{ label: 'Vanilla LP', color: C.danger }, { label: 'Vixa LP', color: C.cyan }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 14, height: 2, background: l.color, borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: C.muted }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <XAxis dataKey="t" hide />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#0d1b2e', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11 }}
            labelStyle={{ display: 'none' }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.05)" />
          <Line type="monotone" dataKey="vanilla" stroke={C.danger} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />
          <Line type="monotone" dataKey="vixa" stroke={C.cyan} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 10, color: C.dim, textAlign: 'center', marginTop: '0.25rem' }}>
        Vixa delta holds near-zero · Vanilla LP drifts with market price
      </p>
    </div>
  )
}

// ─── Position dashboard (left panel post-deploy) ──────────────────────────────
function PositionDashboard({ positionId, txHash, tick, delta, threshold }: {
  positionId: string; txHash: string
  tick: number; delta: number; threshold: number
}) {
  const [copiedId, setCopiedId] = useState(false)
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {/* Identity */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: 10, color: C.cyan, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
          Active Position
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>
            {positionId}
          </span>
          <button
            onClick={() => { navigator.clipboard.writeText(positionId); setCopiedId(true); setTimeout(() => setCopiedId(false), 1500) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedId ? C.cyan : C.dim, padding: 0, display: 'flex' }}
          >
            {copiedId ? <CheckCircle2 size={13} color={C.cyan} /> : <Copy size={13} />}
          </button>
          <a href={`https://sepolia.uniscan.xyz/tx/${txHash}`} target="_blank" rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 3, color: C.blue, fontSize: 11, textDecoration: 'none' }}
          >
            <ExternalLink size={11} /> Uniscan
          </a>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 100,
            background: 'rgba(0,229,176,0.08)', border: '1px solid rgba(0,229,176,0.2)',
            fontSize: 9, fontWeight: 800, color: C.cyan,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.cyan }} className="pulse-glow" />
            LIVE
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { k: 'Net Delta', v: `${delta > 0 ? '+' : ''}${delta.toFixed(3)} ETH`, c: C.cyan },
          { k: 'Threshold', v: `${threshold} ETH`, c: C.muted },
          { k: 'State Nonce', v: '3', c: C.text },
          { k: 'Pos. Value', v: '$1,000 USDC', c: C.text },
          { k: 'Est. APR', v: '18.7%', c: C.cyan },
          { k: 'Fees Earned', v: '$12.40', c: C.cyan },
        ].map(m => (
          <div key={m.k} style={{
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`, borderRadius: 10,
          }}>
            <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{m.k}</div>
            <motion.div key={m.v} initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
              style={{ fontSize: 15, fontWeight: 800, color: m.c, letterSpacing: '-0.3px' }}
            >
              {m.v}
            </motion.div>
          </div>
        ))}
      </div>

      {/* Range */}
      <div style={{
        padding: '1.25rem',
        background: 'rgba(0,229,176,0.03)',
        border: '1px solid rgba(0,229,176,0.1)',
        borderRadius: 12, marginBottom: '1rem',
      }}>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          Range Visualizer
        </div>
        <RangeVisualizer tick={tick} />
      </div>

      {/* Delta */}
      <div style={{
        padding: '1.25rem',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
      }}>
        <DeltaEngineCard delta={delta} threshold={threshold} />
      </div>
    </motion.div>
  )
}

// ─── Right panel ──────────────────────────────────────────────────────────────
function LivePreviewPanel({ price, tick, threshold, delta, deployed, events, liquidity }: {
  price: number; tick: number; threshold: string
  delta: number; deployed: boolean; events: LiveEvent[]
  liquidity: string
}) {
  const thresh = parseFloat(threshold) || 0.05
  const liq = parseFloat(liquidity) || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Pool status */}
      <Card>
        <PoolStatusCard price={price} tick={tick} />
      </Card>

      {/* Position preview + range visualizer */}
      <Card>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '1rem' }}>
          POSITION PREVIEW
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Long-Vol Leg', range: `${tick - 2000} → ${tick}`, color: C.cyan },
            { label: 'Short-Vol Leg', range: `${tick + 10} → ${tick + 2010}`, color: C.blue },
            { label: 'Rebalance At', range: `|Δ| > ${thresh} ETH`, color: C.warn },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: item.color, fontFamily: 'monospace' }}>
                {item.range}
              </div>
            </div>
          ))}
          {liq > 0 && (
            <div>
              <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>Each Leg</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                {(liq / 2).toLocaleString()} USDC
              </div>
            </div>
          )}
        </div>
        <RangeVisualizer tick={tick} />
      </Card>

      {/* Delta engine */}
      <Card>
        <DeltaEngineCard delta={delta} threshold={thresh} />
      </Card>

      {/* Automation + flow diagram (side by side) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Card>
          <AutomationCard />
        </Card>
        <Card>
          <RebalanceFlowDiagram />
        </Card>
      </div>

      {/* Always-on delta chart */}
      <Card>
        <DeltaHistoryChart />
      </Card>

      {/* Event feed (shown after deploy or always with initial events) */}
      {(deployed || events.length > 0) && (
        <Card>
          <LiveEventFeed events={events} />
        </Card>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AppScreen({ onBack }: { onBack: () => void }) {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [step, setStep] = useState<WorkflowStep>(1)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [mode, setMode] = useState<PageMode>('workflow')

  // Token state
  const [weth, setWeth] = useState(0)
  const [usdc, setUsdc] = useState(0)
  const [faucetLoading, setFaucetLoading] = useState(false)

  // Approval state
  const [wethOk, setWethOk] = useState(false)
  const [usdcOk, setUsdcOk] = useState(false)
  const [approvingW, setApprovingW] = useState(false)
  const [approvingU, setApprovingU] = useState(false)

  // Position config
  const [liquidity, setLiquidity] = useState('1000')
  const [threshold, setThreshold] = useState('0.05')
  const [deploying, setDeploying] = useState(false)

  // Post-deploy
  const [txHash, setTxHash] = useState('')
  const [positionId, setPositionId] = useState('')
  const [blockNum, setBlockNum] = useState(0)
  const [countdown, setCountdown] = useState(3)

  // Live data
  const [price, setPrice] = useState(2500)
  const [tick, setTick] = useState(priceToTick(2500))
  const [delta, setDelta] = useState(0.031)
  const [events, setEvents] = useState<LiveEvent[]>([
    mkEvent('Rebalance Executed', 'Delta returned to +0.022 ETH', C.cyan),
    mkEvent('Threshold Breached', 'Net delta exceeded 0.05 ETH', C.warn),
    mkEvent('Automation Heartbeat', 'RSC confirmed active on Reactive Network', C.blue),
    mkEvent('Fee Income Collected', 'Both legs accrued 0.012 ETH in fees', '#8B5CF6'),
  ])

  const pushEvent = useCallback((e: LiveEvent) => {
    setEvents(prev => [e, ...prev.slice(0, 19)])
  }, [])

  // Live price
  useEffect(() => {
    const t = setInterval(() => {
      setPrice(p => {
        const next = Math.max(2200, Math.min(2800, p + (Math.random() - 0.5) * 9))
        setTick(priceToTick(next))
        return +next.toFixed(2)
      })
    }, 2000)
    return () => clearInterval(t)
  }, [])

  // Live delta with auto-rebalance simulation
  useEffect(() => {
    const t = setInterval(() => {
      setDelta(prev => {
        const noise = (Math.random() - 0.5) * 0.016
        let next = prev + noise
        const thresh = parseFloat(threshold) || 0.05
        if (Math.abs(next) > thresh) {
          pushEvent(mkEvent('Threshold Breached', `Net delta exceeded ${thresh} ETH`, C.warn))
          setTimeout(() => {
            setDelta(d => +(d * 0.25).toFixed(3))
            pushEvent(mkEvent('Rebalance Executed', 'Delta returned to near-zero via RSC', C.cyan))
          }, 1600)
        }
        return +Math.max(-0.12, Math.min(0.12, next)).toFixed(3)
      })
    }, 1900)
    return () => clearInterval(t)
  }, [threshold, pushEvent])

  // Heartbeat
  useEffect(() => {
    const t = setInterval(() => {
      pushEvent(mkEvent('Automation Heartbeat', 'RSC confirmed active on Reactive Network', C.blue))
    }, 18000)
    return () => clearInterval(t)
  }, [pushEvent])

  // Auto-advance step 1 → 2
  useEffect(() => {
    if (weth > 0 && usdc > 0 && step === 1) {
      setCompleted(p => new Set([...p, 1]))
      setTimeout(() => setStep(2), 700)
    }
  }, [weth, usdc, step])

  // Auto-advance step 2 → 3
  useEffect(() => {
    if (wethOk && usdcOk && step === 2) {
      setCompleted(p => new Set([...p, 2]))
      setTimeout(() => setStep(3), 700)
    }
  }, [wethOk, usdcOk, step])

  const handleConnect = useCallback(() => {
    connect({ connector: injected() })
  }, [connect])

  const handleFaucet = useCallback(async () => {
    setFaucetLoading(true)
    await new Promise(r => setTimeout(r, 2000))
    setWeth(100); setUsdc(100000)
    setFaucetLoading(false)
  }, [])

  const handleApproveW = useCallback(async () => {
    setApprovingW(true)
    await new Promise(r => setTimeout(r, 1700))
    setWethOk(true); setApprovingW(false)
  }, [])

  const handleApproveU = useCallback(async () => {
    setApprovingU(true)
    await new Promise(r => setTimeout(r, 1700))
    setUsdcOk(true); setApprovingU(false)
  }, [])

  const handleDeploy = useCallback(async () => {
    setDeploying(true)
    await new Promise(r => setTimeout(r, 2800))
    const hash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const pos = '0x' + Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    setTxHash(hash); setPositionId(pos)
    setBlockNum(Math.floor(Math.random() * 900000) + 19100000)
    setDeploying(false)
    setCompleted(p => new Set([...p, 3]))
    setStep(4)

    let c = 3
    const cd = setInterval(() => {
      c--; setCountdown(c)
      if (c <= 0) {
        clearInterval(cd)
        setMode('dashboard')
        setCompleted(p => new Set([...p, 4]))
        pushEvent(mkEvent('Position Deployed', `Liquidity split: tick ${priceToTick(price) - 2000} → ${priceToTick(price) + 2010}`, C.cyan))
      }
    }, 1000)
  }, [price, pushEvent])

  const locked = !isConnected

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: C.text }}>
      {/* Grid background */}
      <div className="grid-bg" style={{ position: 'fixed', inset: 0, opacity: 0.35, pointerEvents: 'none', zIndex: 0 }} />
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '15%', width: 600, height: 600,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(0,229,176,0.04) 0%, transparent 70%)',
      }} />

      <AppHeader
        onBack={onBack} address={address}
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={() => disconnect()}
      />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '2rem', position: 'relative', zIndex: 1 }}>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 3fr',
          gap: '2rem',
          alignItems: 'flex-start',
          opacity: locked ? 0.45 : 1,
          pointerEvents: locked ? 'none' : 'auto',
          transition: 'opacity 0.4s',
          marginTop: isConnected ? 0 : '1rem',
        }}>

          {/* ── Left panel ── */}
          <div style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 20, padding: '2rem',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Corner glow */}
            <div style={{
              position: 'absolute', top: -50, right: -50,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,229,176,0.05) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            {mode === 'dashboard' ? null : (
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                  Deploy Position
                </h2>
                <p style={{ fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  Complete each step to activate automated liquidity management.
                </p>
              </div>
            )}

            {mode !== 'dashboard' && (
              <StepIndicator current={step} completed={completed} />
            )}

            <div style={{ minHeight: 320 }}>
              <AnimatePresence mode="wait">
                {mode === 'dashboard' ? (
                  <PositionDashboard
                    key="dash"
                    positionId={positionId}
                    txHash={txHash}
                    tick={tick}
                    delta={delta}
                    threshold={parseFloat(threshold) || 0.05}
                  />
                ) : step === 1 ? (
                  <Step1Tokens key="s1" weth={weth} usdc={usdc} loading={faucetLoading} onFaucet={handleFaucet} />
                ) : step === 2 ? (
                  <Step2Approve key="s2"
                    wethOk={wethOk} usdcOk={usdcOk}
                    approvingW={approvingW} approvingU={approvingU}
                    onApproveW={handleApproveW} onApproveU={handleApproveU}
                  />
                ) : step === 3 ? (
                  <Step3Configure key="s3"
                    liquidity={liquidity} setLiquidity={setLiquidity}
                    threshold={threshold} setThreshold={setThreshold}
                    tick={tick} deploying={deploying} onDeploy={handleDeploy}
                  />
                ) : (
                  <Step4Confirmed key="s4"
                    txHash={txHash} positionId={positionId}
                    blockNum={blockNum} countdown={countdown}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right panel ── */}
          <LivePreviewPanel
            price={price} tick={tick}
            threshold={threshold} delta={delta}
            deployed={mode === 'dashboard'}
            events={events} liquidity={liquidity}
          />
        </div>
      </div>
    </div>
  )
}
