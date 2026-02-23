import type { ChainConfig, BitcoinConfig } from '../core/types';

export type { ChainConfig, BitcoinConfig };

export const ARBITRUM_CHAINS: Record<string, ChainConfig> = {
    'arbitrum-one': {
        chainId: 42161,
        name: 'Arbitrum One',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        explorer: 'https://arbiscan.io',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        gasConfig: { maxFeePerGas: '0.1', maxPriorityFeePerGas: '0.01' },
        isTestnet: false,
        alchemySubdomain: 'arb-mainnet',
    },
    'arbitrum-nova': {
        chainId: 42170,
        name: 'Arbitrum Nova',
        rpcUrl: 'https://nova.arbitrum.io/rpc',
        explorer: 'https://nova.arbiscan.io',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        isTestnet: false,
        alchemySubdomain: 'arbnova-mainnet',
    },
    'arbitrum-sepolia': {
        chainId: 421614,
        name: 'Arbitrum Sepolia',
        rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
        explorer: 'https://sepolia.arbiscan.io',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        isTestnet: true,
        faucetUrl: 'https://faucet.quicknode.com/arbitrum/sepolia',
        alchemySubdomain: 'arb-sepolia',
    },
};

export const EVM_CHAINS: Record<string, ChainConfig> = {
    'ethereum': {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: 'https://eth.llamarpc.com',
        explorer: 'https://etherscan.io',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        isTestnet: false,
        alchemySubdomain: 'eth-mainnet',
    },
    'polygon': {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        isTestnet: false,
        alchemySubdomain: 'polygon-mainnet',
    },
    'bnb': {
        chainId: 56,
        name: 'BNB Smart Chain',
        rpcUrl: 'https://bsc-dataseed.binance.org',
        explorer: 'https://bscscan.com',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        isTestnet: false,
    },
    'avalanche': {
        chainId: 43114,
        name: 'Avalanche C-Chain',
        rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
        explorer: 'https://snowtrace.io',
        nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
        isTestnet: false,
    },
};

export const ALL_CHAINS: Record<string, ChainConfig> = {
    ...ARBITRUM_CHAINS,
    ...EVM_CHAINS,
};

export function getChain(network: string): ChainConfig {
    const chain = ALL_CHAINS[network];
    if (!chain) {
        throw new Error(`Unknown chain: ${network}. Supported: ${Object.keys(ALL_CHAINS).join(', ')}`);
    }
    return chain;
}

export function getArbitrumChains(): Record<string, ChainConfig> {
    return { ...ARBITRUM_CHAINS };
}

export function getSupportedChains(): Record<string, ChainConfig> {
    return { ...ALL_CHAINS };
}
