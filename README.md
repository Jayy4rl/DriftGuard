# Vixa
**Structural Impermanent Loss Reduction for Uniswap v4**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Unichain](https://img.shields.io/badge/Chain-Unichain-blue)](https://unichain.org) [![Reactive Network](https://img.shields.io/badge/Automation-Reactive%20Network-purple)](https://reactive.network) [![Solidity](https://img.shields.io/badge/Solidity-0.8.26-grey)](https://soliditylang.org)

[Live Demo](#demo) · [Demo Video](#demo) · [Docs](#how-it-works)

---

## What is Vixa?

Vixa is a Uniswap v4 Hook that splits LP deposits into two internally offsetting sub-positions within the same pool — a long-vol leg below the current price and a short-vol leg above it. Both legs earn swap fees continuously. Their delta exposures partially cancel each other, structurally reducing impermanent loss without external protocols, idle collateral, or keeper infrastructure.

Every AMM LP position is mathematically equivalent to selling a straddle — the LP is structurally short volatility. Vixa changes the payoff structure of the position itself rather than compensating for IL after the fact.

A Reactive Smart Contract on Reactive Network subscribes to hook events on Unichain. When net delta exceeds the configured threshold, the RSC delivers a `triggerRebalance()` callback autonomously — repositioning both legs around the new price with no bot, no server, and no cron job.

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
| PoolManager | `<UNICHAIN_POOL_MANAGER>` | [View](https://sepolia.uniscan.xyz/address/<UNICHAIN_POOL_MANAGER>) |
| DeltaHook | `<DELTA_HOOK_ADDRESS>` | [View](https://sepolia.uniscan.xyz/address/<DELTA_HOOK_ADDRESS>) |
| DeltaDepositor | `<DELTA_DEPOSITOR_ADDRESS>` | [View](https://sepolia.uniscan.xyz/address/<DELTA_DEPOSITOR_ADDRESS>) |
| Mock WETH | `<TOKEN0_ADDRESS>` | [View](https://sepolia.uniscan.xyz/address/<TOKEN0_ADDRESS>) |
| Mock USDC | `<TOKEN1_ADDRESS>` | [View](https://sepolia.uniscan.xyz/address/<TOKEN1_ADDRESS>) |

### Reactive Network Kopli (Chain ID: 5318008)

| Contract | Address | Explorer |
|---|---|---|
| DeltaHookRSC | `<RSC_ADDRESS>` | [View](https://kopli.reactscan.net/address/<RSC_ADDRESS>) |

---

## Partner Integrations

### Uniswap v4

| File | Integration |
|---|---|
| `contracts/src/DriftGuard.sol` | Inherits `BaseHook`. Uses `IPoolManager`, `StateLibrary`, `TickMath`, `SqrtPriceMath`, `TransientStateLibrary`. 5 hook permission flags encoded in CREATE2 address via `HookMiner`. |
| `contracts/src/DeltaDepositor.sol` | Implements `IUnlockCallback`. Calls `poolManager.unlock()`, `modifyLiquidity()`, `currencyDelta()`, `settle()`, `take()` for all position operations. |
| `contracts/script/Deploy.s.sol` | Uses `HookMiner` from v4-hooks-public to mine correct permission address. Calls `poolManager.initialize()` for pool creation. |

**Verify:** Run `forge test --match-contract DeltaHookForkTest -vvv` with `UNICHAIN_RPC_URL` and `UNICHAIN_POOL_MANAGER` set — tests execute against the live Unichain Sepolia PoolManager.

---

### Reactive Network

| File | Integration |
|---|---|
| `contracts/src/DeltaHookRSC.sol` | Inherits `AbstractPausableReactive`. Calls `service.subscribe()` for 3 event topics on Unichain. Emits `Callback` to deliver `triggerRebalance()` to DeltaDepositor. Implements `getPausableSubscriptions()` for pause/resume. |
| `contracts/script/DeployRSC.s.sol` | Deploys RSC to Reactive Network Kopli. Passes hook address, depositor address, chain ID 1301. |
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

**Verify:** Deployed contracts visible at `https://sepolia.uniscan.xyz`. Chain ID 1301 confirmed in deploy summary output.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hook | Uniswap v4 (`beforeAddLiquidity`, `afterAddLiquidity`, `beforeSwap`, `afterSwap`, `afterRemoveLiquidity`) |
| Chain | Unichain Sepolia (chain ID 1301) |
| Automation | Reactive Network RSC (Kopli testnet) |
| Contracts | Solidity 0.8.26 · Foundry |
| Frontend | React 18 · TypeScript · Vite |
| Web3 | ethers.js v6 · wagmi |

---

## Quick Start

**Prerequisites:** Foundry · Node.js 20+

```bash
git clone <repo-url>
cd vixa

# Contracts
cd contracts && forge install && forge build && forge test

# Frontend
cd ../frontend && npm install && npm run dev
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

Fork tests skip silently when `UNICHAIN_RPC_URL` is unset — CI passes without credentials.

### Environment Variables

```bash
# contracts/.env
PRIVATE_KEY=
UNICHAIN_POOL_MANAGER=
UNICHAIN_RPC_URL=https://sepolia.unichain.org
CURRENCY0=
CURRENCY1=
INITIAL_TICK=0
RN_CALLBACK_PROXY=
DELTA_HOOK=
DELTA_DEPOSITOR=

# frontend/.env
VITE_DELTA_HOOK_ADDRESS=
VITE_DELTA_DEPOSITOR_ADDRESS=
VITE_TOKEN0_ADDRESS=
VITE_TOKEN1_ADDRESS=
VITE_POOL_SWAP_TEST_ADDRESS=
VITE_POOL_MANAGER_ADDRESS=
VITE_UNICHAIN_RPC_URL=https://sepolia.unichain.org
VITE_UNICHAIN_WS_URL=wss://sepolia.unichain.org
VITE_DEMO_PRIVATE_KEY=
```

---

## Project Structure

```
vixa/
├── contracts/
│   ├── src/
│   │   ├── DriftGuard.sol        DeltaHook — v4 hook, delta monitoring, event emission
│   │   ├── DeltaDepositor.sol    LP entry point — deposit, withdraw, rebalance
│   │   ├── DeltaHookRSC.sol      Reactive Smart Contract — autonomous recovery
│   │   └── Vixa.sol              Additional protocol contract
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
        ├── components/           Landing, dashboard, simulation, deposit UI
        ├── hooks/
        │   └── useSimulation.ts  React hook managing simulation state
        ├── simulation/
        │   └── runSimulation.ts  ethers.js transaction sequence
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

### 5-Minute Demo (With Wallet)

1. Connect MetaMask — switch to Unichain Sepolia (chain ID 1301)
2. Click **"Get Tokens"** — mints test WETH and USDC (verify on Uniscan)
3. Approve both tokens → enter liquidity amount and delta threshold → **Deposit**
4. Position dashboard appears with live tick ranges and net delta
5. Click **"Move Price"** 4–5 times — watch delta drift in event feed
6. Wait 10–30 seconds — `RebalanceExecuted` fires from Callback Proxy (not your wallet)
7. Verify on Uniscan: `from` address is Reactive Network Callback Proxy
8. Click **Withdraw** — tokens returned, position cleaned up

---

## Honest Limitations

- **IL is reduced, not eliminated.** The dual-leg offset is approximate and degrades between rebalance events.
- **Rebalancing is not atomic.** The depositor owns PoolManager positions, not the hook. `afterSwap` signals but cannot rebalance inline. The RSC delivers the rebalance in a separate transaction — there is a latency window of seconds to minutes.
- **Single-user depositor in MVP.** Multi-LP is supported via per-position ownership tracking but not via a shared ERC-4626 vault.

---

## Roadmap

- **v2:** Atomic in-swap rebalancing via hook-owned positions
- **v2:** ERC-4626 shared vault with proportional share accounting
- **v2:** Residual perp overflow hedge for tail scenarios
- **v2:** Adaptive delta threshold optimizer

---

## License

MIT

Built for the Uniswap Hook Incubator Cohort 9 — Impermanent Loss & Yield Systems