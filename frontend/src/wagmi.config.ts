import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import type { Chain } from 'viem'

export const unichainSepolia = {
  id: 1301,
  name: 'Unichain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://sepolia.unichain.org'] },
    public:  { http: ['https://sepolia.unichain.org'] },
  },
  blockExplorers: {
    default: { name: 'Uniscan', url: 'https://sepolia.uniscan.xyz' },
  },
  testnet: true,
} satisfies Chain

export const wagmiConfig = createConfig({
  chains: [unichainSepolia],
  connectors: [injected()],
  transports: {
    [unichainSepolia.id]: http('https://sepolia.unichain.org'),
  },
})
