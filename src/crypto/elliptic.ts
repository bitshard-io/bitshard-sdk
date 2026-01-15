/**
 * Decompress a compressed ECDSA public key
 * @param compressedHex - Hex string of compressed public key (33 bytes)
 * @returns Uncompressed public key hex string (64 bytes, without 04 prefix)
 */
export function decompressPublicKey(compressedHex: string): string {
    // Remove 0x prefix if present
    const cleanHex = compressedHex.replace(/^0x/, '');

    if (cleanHex.length !== 66) {
        throw new Error('Invalid compressed public key length');
    }

    const prefix = cleanHex.slice(0, 2);
    if (prefix !== '02' && prefix !== '03') {
        throw new Error('Invalid compressed public key prefix');
    }

    // Get x coordinate
    const x = BigInt('0x' + cleanHex.slice(2));

    // secp256k1 curve parameters
    const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
    const a = BigInt(0);
    const b = BigInt(7);

    // Calculate y^2 = x^3 + ax + b (mod p)
    const x3 = modPow(x, 3n, p);
    const ax = (a * x) % p;
    const y2 = (x3 + ax + b) % p;

    // Calculate y = sqrt(y^2) mod p
    let y = modSqrt(y2, p);

    if (y === null) {
        throw new Error('Invalid public key - no valid y coordinate');
    }

    // Choose the correct y based on prefix
    const isEven = y % 2n === 0n;
    const shouldBeEven = prefix === '02';

    if (isEven !== shouldBeEven) {
        y = p - y;
    }

    // Convert to hex strings (32 bytes each)
    const xHex = x.toString(16).padStart(64, '0');
    const yHex = y.toString(16).padStart(64, '0');

    return xHex + yHex;
}

/**
 * Modular exponentiation: (base^exp) % mod
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
        if (exp % 2n === 1n) {
            result = (result * base) % mod;
        }
        exp = exp >> 1n;
        base = (base * base) % mod;
    }

    return result;
}

/**
 * Modular square root using Tonelli-Shanks algorithm
 * For secp256k1, p ≡ 3 (mod 4), so we can use the simpler formula
 */
function modSqrt(a: bigint, p: bigint): bigint | null {
    // Check if a is a quadratic residue
    const legendreSymbol = modPow(a, (p - 1n) / 2n, p);
    if (legendreSymbol !== 1n) {
        return null; // No square root exists
    }

    // For p ≡ 3 (mod 4), sqrt(a) = a^((p+1)/4) mod p
    if (p % 4n === 3n) {
        return modPow(a, (p + 1n) / 4n, p);
    }

    // For other cases, would need full Tonelli-Shanks
    throw new Error('Unsupported prime for square root');
}

/**
 * Check if a public key is compressed
 * @param publicKeyHex - Hex string of public key
 * @returns True if compressed (33 bytes), false if uncompressed (64 or 65 bytes)
 */
export function isCompressedPublicKey(publicKeyHex: string): boolean {
    const cleanHex = publicKeyHex.replace(/^0x/, '');

    // Compressed keys are 33 bytes (66 hex chars)
    if (cleanHex.length === 66) {
        const prefix = cleanHex.slice(0, 2);
        return prefix === '02' || prefix === '03';
    }

    return false;
}

/**
 * Get uncompressed public key, handling both compressed and uncompressed inputs
 * @param publicKeyHex - Hex string of public key (compressed or uncompressed)
 * @returns Uncompressed public key hex string (64 bytes, without 04 prefix)
 */
export function getUncompressedPublicKey(publicKeyHex: string): string {
    const cleanHex = publicKeyHex.replace(/^0x/, '');

    // Check if compressed
    if (isCompressedPublicKey(cleanHex)) {
        return decompressPublicKey(cleanHex);
    }

    // If uncompressed with 04 prefix, remove it
    if (cleanHex.startsWith('04')) {
        return cleanHex.slice(2);
    }

    // If already uncompressed without prefix (128 chars = 64 bytes)
    if (cleanHex.length === 128) {
        return cleanHex;
    }

    throw new Error(`Invalid public key format: ${cleanHex.length} hex chars`);
}