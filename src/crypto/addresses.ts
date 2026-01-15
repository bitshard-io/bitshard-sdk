import crypto from 'crypto';
import { keccak256 } from 'viem';
import type { BlockchainAddresses } from '../core/types';
import { getUncompressedPublicKey } from './elliptic';

/**
 * Derive Ethereum address from ECDSA public key
 * @param publicKeyHex - Hex string of public key (compressed or uncompressed)
 * @returns Ethereum address with 0x prefix
 */
export function deriveEthereumAddress(publicKeyHex: string): string {
    // Remove 0x prefix if present
    const cleanHex = publicKeyHex.replace(/^0x/, '');

    // Get uncompressed public key (64 bytes, no 04 prefix)
    const uncompressedKey = getUncompressedPublicKey(cleanHex);

    // Keccak256 hash of the uncompressed public key
    const hash = keccak256(`0x${uncompressedKey}`);

    // Take the last 20 bytes (40 hex chars) as the address
    const address = '0x' + hash.slice(-40);

    return address.toLowerCase();
}

/**
 * Derive Ethereum address from public key bytes
 * @param publicKey - Uint8Array of the public key
 * @returns Ethereum address with 0x prefix
 */
export function deriveEthereumAddressFromBytes(publicKey: Uint8Array): string {
    // Remove the first byte (0x04 for uncompressed key) if present
    const pubKeyBytes = publicKey[0] === 0x04 ? publicKey.slice(1) : publicKey;

    // Convert to hex and derive address
    const pubKeyHex = Buffer.from(pubKeyBytes).toString('hex');
    return deriveEthereumAddress(pubKeyHex);
}

/**
 * Derive Bitcoin P2PKH address from ECDSA public key
 * @param publicKeyHex - Hex string of the public key
 * @param network - Network type: 'mainnet', 'testnet', or 'regtest'
 * @returns Bitcoin address in base58check format
 */
export function deriveBitcoinAddress(
    publicKeyHex: string,
    network: 'mainnet' | 'testnet' | 'regtest' = 'mainnet'
): string {
    // Remove 0x prefix if present
    const cleanHex = publicKeyHex.replace(/^0x/, '');

    // Convert to compressed public key format if uncompressed
    const compressedPubKey = compressPublicKey(cleanHex);

    // Step 1: SHA256 hash of the public key
    const sha256Hash = crypto.createHash('sha256')
        .update(Buffer.from(compressedPubKey, 'hex'))
        .digest();

    // Step 2: RIPEMD160 hash of the SHA256 hash
    const ripemd160Hash = crypto.createHash('ripemd160')
        .update(sha256Hash)
        .digest();

    // Step 3: Add version byte
    // 0x00 for mainnet P2PKH
    // 0x6f for testnet/regtest P2PKH
    const versionByte = network === 'mainnet' ? 0x00 : 0x6f;
    const versionedPayload = Buffer.concat([
        Buffer.from([versionByte]),
        ripemd160Hash
    ]);

    // Step 4: Calculate checksum (first 4 bytes of double SHA256)
    const checksum = crypto.createHash('sha256')
        .update(crypto.createHash('sha256').update(versionedPayload).digest())
        .digest()
        .slice(0, 4);

    // Step 5: Append checksum
    const finalPayload = Buffer.concat([versionedPayload, checksum]);

    // Step 6: Base58 encode
    return base58Encode(finalPayload);
}

/**
 * Derive Bitcoin address from public key bytes
 * @param publicKey - Uint8Array of the public key
 * @param network - Network type
 * @returns Bitcoin address in base58check format
 */
export function deriveBitcoinAddressFromBytes(
    publicKey: Uint8Array,
    network: 'mainnet' | 'testnet' | 'regtest' = 'mainnet'
): string {
    const pubKeyHex = Buffer.from(publicKey).toString('hex');
    return deriveBitcoinAddress(pubKeyHex, network);
}

/**
 * Derive Cosmos address from ECDSA public key
 * @param publicKeyHex - Hex string of the public key
 * @param prefix - Bech32 prefix (default: 'cosmos')
 * @returns Cosmos address with bech32 encoding
 */
export function deriveCosmosAddress(publicKeyHex: string, prefix: string = 'cosmos'): string {
    // Remove 0x prefix if present
    const cleanHex = publicKeyHex.replace(/^0x/, '');

    // Convert to compressed format
    const compressedPubKey = compressPublicKey(cleanHex);

    // SHA256 hash
    const sha256Hash = crypto.createHash('sha256')
        .update(Buffer.from(compressedPubKey, 'hex'))
        .digest();

    // RIPEMD160 hash
    const ripemd160Hash = crypto.createHash('ripemd160')
        .update(sha256Hash)
        .digest();

    // TODO: Implement proper bech32 encoding
    // For now, return a simplified version
    return prefix + '1' + ripemd160Hash.toString('hex').substring(0, 38);
}

/**
 * Compress an uncompressed ECDSA public key
 * @param publicKeyHex - Hex string of uncompressed public key (with or without 04 prefix)
 * @returns Compressed public key hex string (33 bytes)
 */
export function compressPublicKey(publicKeyHex: string): string {
    // Remove 04 prefix if present (uncompressed marker)
    const cleanHex = publicKeyHex.startsWith('04') ? publicKeyHex.slice(2) : publicKeyHex;

    // Split into x and y coordinates (32 bytes each)
    const x = cleanHex.slice(0, 64);
    const y = cleanHex.slice(64, 128);

    // Determine prefix based on y coordinate parity
    const yBigInt = BigInt('0x' + y);
    const prefix = (yBigInt % 2n === 0n) ? '02' : '03';

    return prefix + x;
}

/**
 * Base58 encoding (for Bitcoin addresses)
 */
export function base58Encode(buffer: Buffer): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(58);

    let num = BigInt('0x' + buffer.toString('hex'));
    let encoded = '';

    while (num > 0n) {
        const remainder = num % base;
        num = num / base;
        encoded = ALPHABET[Number(remainder)] + encoded;
    }

    // Handle leading zeros
    for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
        encoded = '1' + encoded;
    }

    return encoded;
}

/**
 * Base58 decoding (for Bitcoin addresses)
 */
export function base58Decode(encoded: string): Buffer {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const ALPHABET_MAP: { [key: string]: bigint } = {};
    for (let i = 0; i < ALPHABET.length; i++) {
        ALPHABET_MAP[ALPHABET[i]!] = BigInt(i);
    }

    let num = 0n;
    const base = 58n;

    for (const char of encoded) {
        num = num * base + ALPHABET_MAP[char]!;
    }

    // Convert to hex and then to buffer
    let hex = num.toString(16);
    // Ensure even length
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }

    const buffer = Buffer.from(hex, 'hex');

    // Add leading zeros for each leading '1' in the input
    let leadingZeros = 0;
    for (const char of encoded) {
        if (char === '1') {
            leadingZeros++;
        } else {
            break;
        }
    }

    return Buffer.concat([Buffer.alloc(leadingZeros), buffer]);
}

/**
 * Derive addresses for all supported blockchains from public key
 * @param publicKeyHex - Hex string of the public key
 * @returns Object with addresses for all supported chains
 */
export function deriveAddresses(publicKeyHex: string): {
    ethereum: string;
    bitcoin: string;
    bitcoinTestnet: string;
    cosmos: string;
    arbitrum: string;
    polygon: string;
    bnb: string;
    avalanche: string;
} {
    const ethAddress = deriveEthereumAddress(publicKeyHex);

    return {
        ethereum: ethAddress,
        bitcoin: deriveBitcoinAddress(publicKeyHex, 'mainnet'),
        bitcoinTestnet: deriveBitcoinAddress(publicKeyHex, 'testnet'),
        cosmos: deriveCosmosAddress(publicKeyHex),
        // EVM-compatible chains use the same address as Ethereum
        arbitrum: ethAddress,
        polygon: ethAddress,
        bnb: ethAddress,
        avalanche: ethAddress
    };
}

/**
 * Derive addresses from public key bytes
 * @param publicKey - Uint8Array of the public key
 * @returns BlockchainAddresses object
 */
export function deriveAddressesFromBytes(publicKey: Uint8Array): BlockchainAddresses {
    const pubKeyHex = Buffer.from(publicKey).toString('hex');
    const addresses = deriveAddresses(pubKeyHex);

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
 * Validate Ethereum address format
 * @param address - Address to validate
 * @returns True if valid Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Bitcoin address format (basic validation)
 * @param address - Address to validate
 * @returns True if valid Bitcoin address format
 */
export function isValidBitcoinAddress(address: string): boolean {
    // Basic format check - proper validation would verify checksum
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || // P2PKH/P2SH
        /^bc1[a-z0-9]{39,59}$/.test(address); // Bech32
}