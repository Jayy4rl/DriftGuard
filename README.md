# Vixa
**Structural Impermanent Loss Reduction for Uniswap v4**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Unichain](https://img.shields.io/badge/Chain-Unichain-blue)](https://unichain.org) [![Reactive Network](https://img.shields.io/badge/Automation-Reactive%20Network-purple)](https://reactive.network) [![Solidity](https://img.shields.io/badge/Solidity-0.8.26-grey)](https://soliditylang.org)

[Live Demo](#demo) · [Demo Video](#demo) · [Docs](#how-it-works)

---

## What is Vixa?

Vixa is a Uniswap v4 hook that structurally reduces impermanent loss by splitting LP deposits into two internally offsetting sub-positions; a long-vol leg below the current price and a short-vol leg above it, within a single pool.

Both legs earn swap fees continuously while their delta exposures partially cancel each other, changing the payoff structure of the position itself rather than compensating for impermanent loss after the fact. No external protocols, no idle collateral, no keeper infrastructure. 

A Reactive Smart Contract on Reactive Network subscribes to hook events on Unichain. When net delta exceeds the configured threshold, the RSC delivers a `triggerRebalance()` callback autonomously, repositioning both legs around the new price with no server, and no human intervention required.

**Built for:** Uniswap Hook Incubator Cohort 9 — Impermanent Loss & Yield Systems Track  
**Sponsor Integrations:** Uniswap v4 · Reactive Network · Unichain

---

## How It Works

```
LP → DeltaDepositor → PoolManager (long-vol leg + short-vol leg)
                           ↓
                    DeltaHook._afterSwap()
                    (delta computation on every swap)
                           ↓
                    emit RebalanceNeeded
                           ↑
              Reactive Network RSC (event subscription)
                           ↑
              DeltaDepositor.triggerRebalance()
              (reposition both legs around new price)
```

1. **Deposit** — LP deposits into DeltaDepositor. Capital is split 50/50 into two concentrated positions via `poolManager.unlock()`.
2. **Split** — `afterAddLiquidity` registers the long-vol leg `[center - 2000 ticks, center]` and short-vol leg `[center + spacing, center + 2000 ticks]` in `SubPositionState`.
3. **Monitor** — `afterSwap` recomputes net delta on every swap using precomputed sqrtPrice bounds. No oracle dependency.
4. **Signal** — When `|netDelta| > deltaThreshold`, `RebalanceNeeded` is emitted. When both legs are fully out-of-range, `PositionOutOfRange` is emitted.
5. **Recover** — RSC on Reactive Network detects the event and delivers `triggerRebalance()` to DeltaDepositor via Callback Proxy.
6. **Rebalance** — DeltaDepositor removes both legs, re-adds at new ranges centered on current price, and calls `hook.updatePositionRanges()` to sync stored state.
7. **Withdraw** — LP withdraws at any time. Nonce check ensures withdrawal cannot land against mid-rebalance state.

---

## Deployed Contracts

### Unichain Sepolia (Chain ID: 1301)

| Contract | Address | Explorer |
|---|---|---|
| PoolManager | `0x00b036b58a818b1bc34d502d3fe730db729e62ac` | [View](https://sepolia.uniscan.xyz/address/0x00b036b58a818b1bc34d502d3fe730db729e62ac) |
| DeltaHook | `0xC8874581894D8C7EBd3b9FfFAbdDC96238b88dc0` | [View](https://sepolia.uniscan.xyz/address/0xC8874581894D8C7EBd3b9FfFAbdDC96238b88dc0) |
| DeltaDepositor | `0x4384bcb8B523687f3618D13FE77677B6E158112f` | [View](https://sepolia.uniscan.xyz/address/0x4384bcb8B523687f3618D13FE77677B6E158112f) |
| Mock WETH | `0xae3E277b72400Aa5197f0044FD4B131d9458a9DC` | [View](https://sepolia.uniscan.xyz/address/0xae3E277b72400Aa5197f0044FD4B131d9458a9DC) |
| Mock USDC | `0xB0E97552e6b63F52943Ba92189E902d118488fC0` | [View](https://sepolia.uniscan.xyz/address/0xB0E97552e6b63F52943Ba92189E902d118488fC0) |

### Reactive Network Lasna (Chain ID: 5318007)

| Contract | Address | Explorer |
|---|---|---|
| DeltaHookRSC | `0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4` | [View](https://lasna.reactscan.net/address/0x9299472A6399Fd1027ebF067571Eb3e3D7837FC4) |

---

## Partner Integrations

### Uniswap v4

| File | Integration |
|---|---|
| `contracts/src/DriftGuard.sol` | Inherits `BaseHook`. Uses `IPoolManager`, `StateLibrary`, `TickMath`, `SqrtPriceMath`, `TransientStateLibrary`. 5 hook permission flags encoded in CREATE2 address via `HookMiner`. |
| `contracts/src/DeltaDepositor.sol` | Implements `IUnlockCallback`. Calls `poolManager.unlock()`, `modifyLiquidity()`, `currencyDelta()`, `settle()`, `take()` for all position operations. |
| `contracts/script/Deploy.s.sol` | Uses `HookMiner` from v4-hooks-public to mine correct permission address. Calls `poolManager.initialize()` for pool creation. |

**Verify:** Run `forge test --match-contract DeltaHookForkTest -vvv` with `UNICHAIN_RPC_URL` and `UNICHAIN_POOL_MANAGER` set. Tests execute against the live Unichain Sepolia PoolManager.

---

### Reactive Network

| File | Integration |
|---|---|
| `contracts/src/DeltaHookRSC.sol` | Inherits `AbstractPausableReactive`. Calls `service.subscribe()` for 3 event topics on Unichain. Emits `Callback` to deliver `triggerRebalance()` to DeltaDepositor. Implements `getPausableSubscriptions()` for pause/resume. |
| `contracts/script/DeployRSC.s.sol` | Deploys RSC to Reactive Network Lasna. Passes hook address, depositor address, chain ID 1301. |
| `contracts/src/DriftGuard.sol` | Stores `rscRelay` (Callback Proxy). Events `RebalanceNeeded`, `PositionOutOfRange`, `PositionClosed` are RSC subscription targets. `triggerRebalance` authorized for position owner OR `rscRelay`. |

**Subscriptions:**

| Event | Action |
|---|---|
| `RebalanceNeeded(bytes32,int256,uint256)` | Deliver `triggerRebalance()` callback (300s cooldown per position) |
| `PositionOutOfRange(bytes32,uint256)` | Deliver `triggerRebalance()` callback (300s cooldown per position) |
| `PositionClosed(bytes32,int256)` | Mark position closed, clean up cooldown state |

**Verify:** After triggering `RebalanceNeeded` via swaps, the `triggerRebalance()` transaction on Uniscan will show the Reactive Network Callback Proxy as the `from` address — not your wallet. This confirms autonomous RSC delivery.

---

### Unichain

| File | Integration |
|---|---|
| `contracts/script/Deploy.s.sol` | Targets Unichain Sepolia (`https://sepolia.unichain.org`, chain ID 1301). Reads `UNICHAIN_POOL_MANAGER`. |
| `contracts/src/DeltaHookRSC.sol` | `CHAIN_ID` immutable set to 1301. All subscriptions and callbacks target Unichain Sepolia. |
| `contracts/test/DeltaHookForkTest.t.sol` | Forks Unichain Sepolia. All fork tests run against live PoolManager. |
| `frontend/src/simulation/runSimulation.ts` | Sends simulation transactions to Unichain Sepolia. WebSocket subscription for live event streaming. |

**Verify:** Deployed contracts visible at `https://sepolia.uniscan.xyz`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hook | Uniswap v4 (`beforeAddLiquidity`, `afterAddLiquidity`, `beforeSwap`, `afterSwap`, `afterRemoveLiquidity`) |
| Chain | Unichain Sepolia (chain ID 1301) |
| Automation | Reactive Network RSC (Lasna testnet) |
| Contracts | Solidity 0.8.26 · Foundry |
| Frontend | React 18 · TypeScript · Vite |
| Web3 | ethers.js v6 · wagmi |

---

## Quick Start

**Prerequisites:** Foundry · Node.js 20+

```bash
git clone https://github.com/Jayy4rl/Vixa.git

# Contracts
cd contracts && forge install && forge build && forge test

# Frontend
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

### Testing

```bash
cd contracts

# Unit tests (no RPC needed)
forge test --match-contract DeltaHookTest -vvv
forge test --match-contract DeltaHookRSCTest -vvv

# Fork tests (requires env vars)
source .env && forge test --match-contract DeltaHookForkTest -vvv
```

---

## Project Structure

```
vixa/
├── contracts/
│   ├── src/
│   │   ├── Vixa.sol         DeltaHook — v4 hook, delta monitoring, event emission
│   │   ├── DeltaDepositor.sol    LP entry point — deposit, withdraw, rebalance
│   │   └── DeltaHookRSC.sol      Reactive Smart Contract — autonomous recovery
│   ├── script/
│   │   ├── Deploy.s.sol          Deploy hook, depositor, tokens, initialize pool
│   │   ├── DeployRSC.s.sol       Deploy RSC to Reactive Network Kopli
│   │   └── Simulate.s.sol        End-to-end simulation script
│   └── test/
│       ├── DeltaHookTest.t.sol      Unit tests
│       ├── DeltaHookForkTest.t.sol  Fork tests against Unichain Sepolia
│       ├── DeltaHookRSCTest.t.sol   RSC unit tests
│       └── VixaTest.t.sol
│
└── frontend/
    └── src/
        ├── components/           Landing, dashboard, deposit UI
        └── wagmi.config.ts       Wallet connection config
```

---

## Key Features

| Feature | Description |
|---|---|
| Dual-leg position splitting | Deposits split into long-vol (below price) and short-vol (above price) sub-positions. Both earn fees. Delta exposures offset each other. |
| Per-swap delta monitoring | `afterSwap` computes net delta on every swap using precomputed sqrtPrice bounds — no TickMath on the hot path, no oracle dependency. |
| Vault-only deposit enforcement | `beforeAddLiquidity` reverts any deposit not from DeltaDepositor — prevents untracked positions corrupting delta accounting. |
| RSC-triggered rebalancing | Reactive Network RSC delivers `triggerRebalance()` autonomously when threshold is breached. No keeper, no bot, no server. |
| Out-of-range recovery | RSC detects `PositionOutOfRange` and repositions both legs around new price when hook goes silent. |
| State nonce coherence | Nonce increments on every rebalance. Withdrawal encodes nonce at call time — mismatch causes clean revert. |
| Per-position salt isolation | Each LP's PoolManager positions use position-specific salts — one LP cannot drain another's liquidity. |
| Emergency pause | `pausePool` halts all swaps via `beforeSwap`. Only deployer can unpause. |

---

## Demo

### 2-Minute Demo (No Wallet Required)

1. Open the frontend
2. Click **"View Demo"** — interactive IL price slider, no wallet needed
3. Drag slider ±20% — vanilla LP delta drifts, Vixa delta stays near zero
4. Click **"Run Simulation"** — 14-step sequence executes against real Unichain Sepolia
5. Click any transaction hash in the step timeline — opens real transaction on Uniscan
6. Note `RebalanceExecuted` step — sender on Uniscan is the Reactive Network Callback Proxy, not the demo wallet

---

## Roadmap

- **v2:** Atomic in-swap rebalancing via hook-owned positions
- **v2:** ERC-4626 shared vault with proportional share accounting
- **v2:** Residual perp overflow hedge for tail scenarios
- **v2:** Adaptive delta threshold optimizer

---

## License

[MIT](https://mit-license.org/2016)

Built for the Uniswap Hook Incubator Cohort 9 — Impermanent Loss & Yield Systems
