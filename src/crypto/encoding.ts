/**
 * Encoding utilities for cryptocurrency operations
 */

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.replace(/^0x/, '');
    if (cleanHex.length % 2 !== 0) {
        throw new Error('Hex string must have even length');
    }
    
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    
    return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Uint8Array
 * @param prefix - Whether to add 0x prefix (default: false)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix: boolean = false): string {
    const hex = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    return prefix ? '0x' + hex : hex;
}

/**
 * Convert Buffer to hex string
 * @param buffer - Buffer
 * @param prefix - Whether to add 0x prefix (default: false)
 * @returns Hex string
 */
export function bufferToHex(buffer: Buffer, prefix: boolean = false): string {
    const hex = buffer.toString('hex');
    return prefix ? '0x' + hex : hex;
}

/**
 * Convert hex string to Buffer
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Buffer
 */
export function hexToBuffer(hex: string): Buffer {
    const cleanHex = hex.replace(/^0x/, '');
    return Buffer.from(cleanHex, 'hex');
}

/**
 * Convert base64 string to Uint8Array
 * @param base64 - Base64 encoded string
 * @returns Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Convert Uint8Array to base64 string
 * @param bytes - Uint8Array
 * @returns Base64 encoded string
 */
export function bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
}

/**
 * Convert UTF-8 string to Uint8Array
 * @param str - UTF-8 string
 * @returns Uint8Array
 */
export function utf8ToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to UTF-8 string
 * @param bytes - Uint8Array
 * @returns UTF-8 string
 */
export function bytesToUtf8(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

/**
 * Concatenate multiple Uint8Arrays
 * @param arrays - Arrays to concatenate
 * @returns Combined Uint8Array
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    
    return result;
}

/**
 * Compare two Uint8Arrays for equality
 * @param a - First array
 * @param b - Second array
 * @returns True if arrays are equal
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    
    return true;
}

/**
 * Convert number to big-endian Uint8Array
 * @param num - Number to convert
 * @param bytes - Number of bytes (default: 4)
 * @returns Uint8Array in big-endian format
 */
export function numberToBytes(num: number, bytes: number = 4): Uint8Array {
    const arr = new Uint8Array(bytes);
    for (let i = bytes - 1; i >= 0; i--) {
        arr[i] = num & 0xff;
        num = num >> 8;
    }
    return arr;
}

/**
 * Convert big-endian Uint8Array to number
 * @param bytes - Uint8Array in big-endian format
 * @returns Number
 */
export function bytesToNumber(bytes: Uint8Array): number {
    let num = 0;
    for (const byte of bytes) {
        num = (num << 8) | byte;
    }
    return num;
}

/**
 * Convert BigInt to Uint8Array
 * @param bigint - BigInt value
 * @param length - Optional fixed length (pads with zeros)
 * @returns Uint8Array
 */
export function bigintToBytes(bigint: bigint, length?: number): Uint8Array {
    let hex = bigint.toString(16);
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }
    
    const bytes = hexToBytes(hex);
    
    if (length && bytes.length < length) {
        const padded = new Uint8Array(length);
        padded.set(bytes, length - bytes.length);
        return padded;
    }
    
    return bytes;
}

/**
 * Convert Uint8Array to BigInt
 * @param bytes - Uint8Array
 * @returns BigInt
 */
export function bytesToBigint(bytes: Uint8Array): bigint {
    if (bytes.length === 0) return 0n;
    return BigInt('0x' + bytesToHex(bytes));
}

/**
 * Generate random bytes
 * @param length - Number of bytes to generate
 * @returns Random Uint8Array
 */
export function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        // Fallback for Node.js
        const crypto = require('crypto');
        const buffer = crypto.randomBytes(length);
        bytes.set(buffer);
    }
    return bytes;
}

/**
 * Hash data using SHA256
 * @param data - Data to hash
 * @returns SHA256 hash as Uint8Array
 */
export function sha256(data: Uint8Array): Uint8Array {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return new Uint8Array(hash.digest());
}

/**
 * Double SHA256 hash (used in Bitcoin)
 * @param data - Data to hash
 * @returns Double SHA256 hash as Uint8Array
 */
export function doubleSha256(data: Uint8Array): Uint8Array {
    return sha256(sha256(data));
}
