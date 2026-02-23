import { Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';
import { DKLSService } from './core/DKLSService';
import { DKLSParty } from './core/DKLSParty';
import type {
    SDKConfig,
    LocalWallet,
    PartyConfig,
    SignatureResult,
    BlockchainAddresses,
    ChainConfig,
    BitcoinConfig
} from './core/types';
import { deriveAddresses } from './crypto/addresses';
import { ALL_CHAINS } from './chains/config';

/**
 * Main SDK class for BitShard MPC operations
 */
export class BitShardSDK {
    private readonly dklsService: DKLSService;
    private readonly chains: Map<string, ChainConfig>;
    private bitcoinConfig?: BitcoinConfig;

    /**
     * Create a new BitShardSDK instance
     * @param config SDK configuration options
     */
    constructor(config: SDKConfig = {}) {
        this.dklsService = new DKLSService();
        this.chains = new Map();

        // Initialize default chains
        this.initializeDefaultChains();

        // Add custom chains from config
        if (config.chains) {
            Object.entries(config.chains).forEach(([name, chainConfig]) => {
                this.chains.set(name, chainConfig);
            });
        }

        // Set Bitcoin config
        if (config.bitcoin) {
            this.bitcoinConfig = config.bitcoin;
        }
    }

    /**
     * Create a local wallet for testing (all parties in one process)
     * @param config Wallet configuration
     * @returns Local wallet with all keyshares
     */
    async createLocalWallet(config: {
        totalParties?: number;
        threshold?: number;
        partyIds?: number[];
    } = {}): Promise<LocalWallet> {
        const totalParties = config.totalParties ?? 3;
        const threshold = config.threshold ?? 2;
        const partyIds = config.partyIds ?? Array.from({ length: totalParties }, (_, i) => i);

        // Generate DKG locally
        const dkgResult = await this.dklsService.generateDKG(totalParties, threshold, partyIds);

        // Reconstruct keyshares from base64
        const keyshares = dkgResult.keyshares.map(pk =>
            Keyshare.fromBytes(new Uint8Array(Buffer.from(pk.share, 'base64')))
        );

        return {
            publicKey: dkgResult.publicKey,
            keyshares,
            config: {
                totalParties,
                threshold,
                partyIds
            }
        };
    }

    /**
     * Serialize keyshares (WASM objects) to base64 array for storage
     * @param keyshares Array of Keyshare WASM objects
     * @returns Array of base64-encoded strings
     */
    static serializeKeyshares(keyshares: Keyshare[]): string[] {
        return keyshares.map(ks => {
            const bytes = ks.toBytes();
            return Buffer.from(bytes).toString('base64');
        });
    }

    /**
     * Deserialize base64 array back to Keyshare WASM objects
     * @param serialized Array of base64-encoded strings
     * @returns Array of Keyshare WASM objects
     */
    static deserializeKeyshares(serialized: string[]): Keyshare[] {
        return serialized.map(b64 => {
            const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
            return Keyshare.fromBytes(bytes);
        });
    }

    /**
     * Create a party for distributed setup
     * @param config Party configuration
     * @returns DKLS party instance
     */
    createParty(config: PartyConfig): DKLSParty {
        return new DKLSParty(config);
    }

    /**
     * Convert DKLS Message to wire format
     * @param msg DKLS Message
     * @returns Wire format message
     */
    toWireMessage(msg: any): any {
        return DKLSService.toWireMessage(msg);
    }

    /**
     * Convert wire format to DKLS Message
     * @param wire Wire format message
     * @returns DKLS Message
     */
    fromWireMessage(wire: any): any {
        return DKLSService.fromWireMessage(wire);
    }

    /**
     * Derive addresses from public key
     * @param publicKeyHex Public key in hex format
     * @returns Blockchain addresses
     */
    deriveAddresses(publicKeyHex: string): BlockchainAddresses {
        const addresses = deriveAddresses(publicKeyHex);
        return {
            ethereum: addresses.ethereum,
            bitcoin: addresses.bitcoin,
            cosmos: addresses.cosmos,
            arbitrum: addresses.arbitrum,
            polygon: addresses.polygon,
            bnb: addresses.bnb,
            avalanche: addresses.avalanche
        };
    }

    /**
     * Sign a personal message (EIP-191)
     * @param message Message to sign
     * @param keyshares Keyshares for signing
     * @param options Signing options including publicKey for v calculation
     * @returns Signature result
     */
    async personalSign(
        message: string,
        keyshares: Keyshare[],
        options: { threshold?: number; publicKey: string }
    ): Promise<SignatureResult> {
        // Prepare message with EIP-191 prefix
        const messageBytes = Buffer.from(message, 'utf8');
        const prefix = `\x19Ethereum Signed Message:\n${messageBytes.length}`;
        const prefixedMessage = Buffer.concat([
            Buffer.from(prefix, 'utf8'),
            messageBytes
        ]);

        // Hash the prefixed message with Keccak256 (Ethereum standard)
        const { keccak256 } = require('viem');
        const messageHash = Buffer.from(keccak256(prefixedMessage).slice(2), 'hex');

        // Sign with DKLS (public key required for v calculation)
        const threshold = options.threshold ?? keyshares.length;
        const publicKey = options.publicKey;

        return this.dklsService.signMessage(messageHash, keyshares, threshold, publicKey);
    }

    /**
     * Sign a personal message using a wallet (convenience method)
     * @param message Message to sign
     * @param wallet Local wallet containing keyshares and public key
     * @param options Additional signing options
     * @returns Signature result
     */
    async personalSignWithWallet(
        message: string,
        wallet: LocalWallet,
        options: { threshold?: number } = {}
    ): Promise<SignatureResult> {
        return this.personalSign(message, wallet.keyshares, {
            threshold: options.threshold ?? wallet.config.threshold,
            publicKey: wallet.publicKey
        });
    }

    /**
     * Sign a raw hash (for transactions)
     * @param hash Hash to sign (32 bytes)
     * @param keyshares Keyshares for signing
     * @param options Signing options including publicKey for v calculation
     * @returns Signature result
     */
    async signHash(
        hash: string | Uint8Array,
        keyshares: Keyshare[],
        options: { threshold?: number; publicKey?: string } = {}
    ): Promise<SignatureResult> {
        // Convert hash to Uint8Array if needed
        const hashBytes = typeof hash === 'string'
            ? Buffer.from(hash.replace('0x', ''), 'hex')
            : hash;

        if (hashBytes.length !== 32) {
            throw new Error(`Invalid hash length: expected 32 bytes, got ${hashBytes.length}`);
        }

        // Sign with DKLS
        const threshold = options.threshold ?? keyshares.length;
        const publicKey = options.publicKey;

        return this.dklsService.signMessage(hashBytes, keyshares, threshold, publicKey);
    }

    /**
     * Sign a transaction hash using a wallet
     * @param hash Transaction hash to sign
     * @param wallet Local wallet containing keyshares and public key
     * @param options Additional signing options
     * @returns Signature result
     */
    async signTransactionWithWallet(
        hash: string | Uint8Array,
        wallet: LocalWallet,
        options: { threshold?: number } = {}
    ): Promise<SignatureResult> {
        return this.signHash(hash, wallet.keyshares, {
            threshold: options.threshold ?? wallet.config.threshold,
            publicKey: wallet.publicKey
        });
    }

    /**
     * Sign typed data (EIP-712)
     * @param typedData Typed data to sign
     * @param keyshares Keyshares for signing
     * @param options Signing options
     * @returns Signature result
     */
    async signTypedDataV4(
        typedData: any,
        keyshares: Keyshare[],
        options: { threshold?: number } = {}
    ): Promise<SignatureResult> {
        // TODO: Implement proper EIP-712 hashing
        // For now, use a placeholder
        const messageHash = Buffer.from(JSON.stringify(typedData), 'utf8');
        const hash = require('crypto').createHash('sha256').update(messageHash).digest();

        const threshold = options.threshold ?? keyshares.length;
        return this.dklsService.signMessage(hash, keyshares, threshold);
    }

    /**
     * Send raw transaction (sign and prepare for broadcast)
     * @param tx Transaction data
     * @param keyshares Keyshares for signing
     * @param options Signing options
     * @returns Signed transaction hash
     */
    async sendRawTransaction(
        tx: any,
        keyshares: Keyshare[],
        options: { threshold?: number } = {}
    ): Promise<string> {
        // TODO: Implement proper transaction signing
        // This is a placeholder
        const txHash = Buffer.from(JSON.stringify(tx), 'utf8');
        const hash = require('crypto').createHash('sha256').update(txHash).digest();

        const threshold = options.threshold ?? keyshares.length;
        const signature = await this.dklsService.signMessage(hash, keyshares, threshold);

        return signature.signature;
    }

    /**
     * Configure a custom chain
     * @param name Chain name
     * @param config Chain configuration
     */
    configureChain(name: string, config: ChainConfig): void {
        this.chains.set(name, config);
    }

    /**
     * Use a preset chain configuration
     * @param name Preset name
     */
    usePresetChain(name: string): void {
        const preset = this.getPresetChain(name);
        if (preset) {
            this.chains.set(name, preset);
        } else {
            throw new Error(`Unknown preset chain: ${name}`);
        }
    }

    /**
     * Configure Bitcoin network
     * @param config Bitcoin configuration
     */
    configureBitcoin(config: BitcoinConfig): void {
        this.bitcoinConfig = config;
    }

    /**
     * Get chain configuration
     * @param name Chain name
     * @returns Chain configuration or undefined
     */
    getChainConfig(name: string): ChainConfig | undefined {
        return this.chains.get(name);
    }

    /**
     * Get Bitcoin configuration
     * @returns Bitcoin configuration or undefined
     */
    getBitcoinConfig(): BitcoinConfig | undefined {
        return this.bitcoinConfig;
    }

    private initializeDefaultChains(): void {
        for (const [name, config] of Object.entries(ALL_CHAINS)) {
            this.chains.set(name, config);
        }
    }

    /**
     * Get preset chain configuration
     * @param name Preset name
     * @returns Chain configuration or undefined
     */
    private getPresetChain(name: string): ChainConfig | undefined {
        // Re-use initialized chains
        return this.chains.get(name);
    }

    /**
     * Get DKLS service instance (for advanced usage)
     * @returns DKLSService instance
     */
    getDKLSService(): DKLSService {
        return this.dklsService;
    }
}