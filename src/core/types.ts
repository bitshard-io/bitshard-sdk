import type { Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';

/**
 * Result of distributed key generation
 */
export interface DKGResult {
    /** SHA256 hash of the public key */
    dkgCommitment: string;
    /** SHA256 hash of the server share */
    serverShareCommitment: string;
    /** Master public key in hex format with 0x prefix */
    masterPublicKey: string;
    /** Base64 encoded server keyshare */
    serverShare: string;
    /** Base64 encoded backup keyshare */
    backupShare: string;
    /** Base64 encoded mobile keyshare */
    mobileShare: string;
    /** Public key in hex format with 0x prefix */
    publicKey: string;
    /** Ethereum address */
    ethAddress: string;
    /** Bitcoin address (P2PKH) */
    btcAddress: string;
    /** Cosmos address */
    cosmosAddress: string;
    /** BNB Smart Chain address (same as ETH) */
    bnbAddress: string;
    /** Polygon address (same as ETH) */
    polygonAddress: string;
    /** Avalanche C-Chain address (same as ETH) */
    avaxAddress: string;
    /** Arbitrum address (same as ETH) */
    arbAddress: string;
}

/**
 * Extended DKG result for flexible threshold configurations
 */
export interface FlexibleDKGResult {
    /** Total number of parties */
    totalParties: number;
    /** Threshold required for signing */
    threshold: number;
    /** Public key in hex format with 0x prefix */
    publicKey: string;
    /** SHA256 hash of the public key */
    dkgCommitment: string;
    /** Array of keyshares for each party */
    keyshares: PartyKeyshare[];
    /** Derived blockchain addresses */
    addresses: BlockchainAddresses;
}

/**
 * Keyshare data for a specific party
 */
export interface PartyKeyshare {
    /** Party identifier (0-based index) */
    partyId: number;
    /** Base64 encoded keyshare data */
    share: string;
    /** SHA256 hash of the keyshare */
    commitment: string;
}

/**
 * Blockchain addresses derived from public key
 */
export interface BlockchainAddresses {
    /** Ethereum address */
    ethereum: string;
    /** Bitcoin address (P2PKH) */
    bitcoin: string;
    /** Cosmos address */
    cosmos: string;
    /** Arbitrum address (same as ETH) */
    arbitrum: string;
    /** Polygon address (same as ETH) */
    polygon: string;
    /** BNB Smart Chain address (same as ETH) */
    bnb: string;
    /** Avalanche C-Chain address (same as ETH) */
    avalanche: string;
}

/**
 * MPC session for tracking protocol execution
 */
export interface MPCSession {
    /** Unique session identifier */
    id: string;
    /** Associated wallet ID */
    walletId: string;
    /** Type of MPC operation */
    sessionType: 'keygen' | 'signing' | 'refresh';
    /** Current session status */
    status: 'active' | 'completed' | 'failed';
    /** List of participant IDs */
    participants: string[];
    /** Current protocol round */
    currentRound?: number;
    /** Total number of rounds */
    totalRounds?: number;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}

/**
 * Signature result from threshold signing
 */
export interface SignatureResult {
    /** Full signature in hex format with 0x prefix */
    signature: string;
    /** R component of signature */
    r: string;
    /** S component of signature */
    s: string;
    /** V value for Ethereum signatures */
    v?: number;
}

/**
 * Wire format for DKLS messages over network
 */
export interface WireMessage {
    /** Sender party ID */
    from_id: number;
    /** Recipient party ID (optional for broadcast) */
    to_id?: number;
    /** Base64 encoded message payload */
    payload: string;
}

/**
 * Party configuration for distributed setup
 */
export interface PartyConfig {
    /** Unique party identifier (0-based) */
    partyId: number;
    /** Total number of parties */
    totalParties: number;
    /** Threshold required for operations */
    threshold: number;
    /** Role of this party */
    role?: 'coordinator' | 'signer';
}

/**
 * Local wallet for testing (all parties in one process)
 */
export interface LocalWallet {
    /** Public key in hex format */
    publicKey: string;
    /** All keyshares for local testing */
    keyshares: Keyshare[];
    /** Threshold configuration */
    config: {
        totalParties: number;
        threshold: number;
        partyIds: number[];
    };
}

/**
 * Pre-signature data structure
 */
export interface PreSignature {
    /** Unique identifier for tracking */
    id: string;
    /** Sign sessions ready for final round */
    parties: any[]; // Will be SignSession[] but avoiding import
    /** Creation timestamp */
    createdAt: Date;
    /** Whether this pre-signature has been consumed */
    consumed: boolean;
}

/**
 * Chain configuration for multi-chain support
 */
export interface ChainConfig {
    /** Chain ID */
    chainId: number;
    /** Human-readable chain name */
    name: string;
    /** RPC endpoint URL */
    rpcUrl: string;
    /** Block explorer URL */
    explorer?: string;
    /** Native currency info */
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    /** Gas configuration */
    gasConfig?: {
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
    };
}

/**
 * Bitcoin network configuration
 */
export interface BitcoinConfig {
    /** Network type */
    network: 'mainnet' | 'testnet' | 'regtest';
    /** RPC endpoint URL */
    rpcUrl?: string;
    /** API URL for UTXO queries */
    apiUrl?: string;
    /** Default fee rate in sats/vbyte */
    feeRate?: number;
}

/**
 * WebSocket session for protocol coordination
 */
export interface WebSocketSession {
    /** Session identifier */
    sessionId: string;
    /** Session type */
    type: 'keygen' | 'signing' | 'refresh';
    /** Connected parties */
    parties: Set<number>;
    /** Message queue */
    messages: WireMessage[];
    /** Session metadata */
    metadata?: Record<string, any>;
}

/**
 * SDK configuration options
 */
export interface SDKConfig {
    /** WebSocket server URL for coordination */
    websocketUrl?: string;
    /** Default chain configuration */
    defaultChain?: string;
    /** Custom chain configurations */
    chains?: Record<string, ChainConfig>;
    /** Bitcoin network configuration */
    bitcoin?: BitcoinConfig;
    /** Enable debug logging */
    debug?: boolean;
}

// Re-export types from DKLS library for convenience
export type { Message, Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';