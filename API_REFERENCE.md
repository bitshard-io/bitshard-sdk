# BitShard SDK API Reference

## Table of Contents
- [Core Classes](#core-classes)
- [Key Management](#key-management)
- [Signature Operations](#signature-operations)
- [Transaction Management](#transaction-management)
- [Address Derivation](#address-derivation)
- [Types and Interfaces](#types-and-interfaces)

## Core Classes

### BitShardSDK

The main SDK class for interacting with the BitShard MPC wallet system.

```typescript
import { BitShardSDK } from 'bitshard-sdk';

const sdk = new BitShardSDK(config?: SDKConfig);
```

#### Configuration Options

```typescript
interface SDKConfig {
  network?: 'mainnet' | 'testnet' | 'devnet';
  wsEndpoint?: string;
  chains?: ChainConfig[];
  bitcoin?: {
    network: 'mainnet' | 'testnet' | 'regtest';
  };
}
```

## Key Management

### createLocalWallet

Creates a local MPC wallet with all keyshares in one process (for testing).

```typescript
async createLocalWallet(config: {
  totalParties?: number;  // Default: 3
  threshold?: number;      // Default: 2
  partyIds?: number[];     // Default: [0, 1, 2]
}): Promise<LocalWallet>
```

**Example:**
```javascript
const wallet = await sdk.createLocalWallet({
  totalParties: 3,
  threshold: 2
});

console.log('Public key:', wallet.publicKey);
console.log('Keyshares:', wallet.keyshares.length);
```

### generateDKG

Performs Distributed Key Generation ceremony.

```typescript
async generateDKG(
  totalParties: number,
  threshold: number,
  partyIds: number[]
): Promise<FlexibleDKGResult>
```

**Example:**
```javascript
const dkgResult = await sdk.dklsService.generateDKG(3, 2, [0, 1, 2]);
console.log('Public key:', dkgResult.publicKey);
console.log('Addresses:', dkgResult.addresses);
```

## Signature Operations

### personalSign

Signs a message using EIP-191 personal sign format.

```typescript
async personalSign(
  message: string,
  keyshares: Keyshare[],
  options: {
    threshold?: number;
    publicKey: string;  // Required for v calculation
  }
): Promise<SignatureResult>
```

### personalSignWithWallet

Convenience method that automatically uses wallet's public key for proper v calculation.

```typescript
async personalSignWithWallet(
  message: string,
  wallet: LocalWallet,
  options: { threshold?: number }
): Promise<SignatureResult>
```

**Example:**
```javascript
const message = 'Hello BitShard!';
const signature = await sdk.personalSignWithWallet(message, wallet);

// Verify with ethers.js
const { ethers } = require('ethers');
const fullSig = signature.signature + signature.v.toString(16).padStart(2, '0');
const recoveredAddress = ethers.utils.verifyMessage(message, fullSig);
console.log('Verified:', recoveredAddress === addresses.ethereum);
```

### signHash

Signs a raw 32-byte hash (for transactions).

```typescript
async signHash(
  hash: string | Uint8Array,
  keyshares: Keyshare[],
  options: {
    threshold?: number;
    publicKey?: string;
  }
): Promise<SignatureResult>
```

### signTransactionWithWallet

Signs a transaction hash using the wallet's keyshares.

```typescript
async signTransactionWithWallet(
  hash: string | Uint8Array,
  wallet: LocalWallet,
  options: { threshold?: number }
): Promise<SignatureResult>
```

**Example:**
```javascript
// Create transaction
const tx = {
  to: '0x...',
  value: ethers.utils.parseEther('0.1'),
  data: '0x...',
  gasLimit: 50000,
  gasPrice: gasPrice,
  nonce: nonce,
  chainId: 421614  // Arbitrum Sepolia
};

// Sign transaction
const serializedTx = ethers.utils.serializeTransaction(tx);
const txHash = ethers.utils.keccak256(serializedTx);
const signature = await sdk.signTransactionWithWallet(txHash, wallet);

// Convert v for EIP-155
const recoveryId = signature.v - 27;
const eip155V = tx.chainId * 2 + 35 + recoveryId;

// Serialize with signature
const signedTx = ethers.utils.serializeTransaction(tx, {
  r: signature.r,
  s: signature.s,
  v: eip155V
});

// Broadcast
const txResponse = await provider.sendTransaction(signedTx);
```

## Transaction Management

### Complete Transaction Flow

```javascript
// 1. Create wallet
const wallet = await sdk.createLocalWallet({
  totalParties: 3,
  threshold: 2
});

// 2. Get addresses
const addresses = sdk.deriveAddresses(wallet.publicKey);
console.log('Send funds to:', addresses.ethereum);

// 3. Create transaction with custom data
const message = 'bitshard.io';
const messageHex = '0x' + Buffer.from(message, 'utf8').toString('hex');

const tx = {
  to: '0xrecipient...',
  value: ethers.utils.parseEther('0.001'),
  data: messageHex,  // Custom message
  gasLimit: 21000 + (message.length * 68),  // Dynamic gas
  gasPrice: await provider.getGasPrice(),
  nonce: await provider.getTransactionCount(addresses.ethereum),
  chainId: 421614  // Arbitrum Sepolia
};

// 4. Sign and broadcast
const serializedTx = ethers.utils.serializeTransaction(tx);
const txHash = ethers.utils.keccak256(serializedTx);
const signature = await sdk.signTransactionWithWallet(txHash, wallet);

// 5. Apply EIP-155
const recoveryId = signature.v - 27;
const eip155V = tx.chainId * 2 + 35 + recoveryId;

const signedTx = ethers.utils.serializeTransaction(tx, {
  r: signature.r,
  s: signature.s,
  v: eip155V
});

// 6. Send transaction
const txResponse = await provider.sendTransaction(signedTx);
await txResponse.wait();
```

## Address Derivation

### deriveAddresses

Derives blockchain addresses from a public key.

```typescript
deriveAddresses(publicKeyHex: string): BlockchainAddresses
```

**Returns:**
```typescript
interface BlockchainAddresses {
  ethereum: string;
  bitcoin: string;
  cosmos: string;
  arbitrum: string;   // Same as ethereum
  polygon: string;    // Same as ethereum
  bnb: string;        // Same as ethereum
  avalanche: string;  // Same as ethereum
}
```

**Example:**
```javascript
const addresses = sdk.deriveAddresses(wallet.publicKey);
console.log('Ethereum:', addresses.ethereum);
console.log('Bitcoin:', addresses.bitcoin);
```

## Types and Interfaces

### LocalWallet

```typescript
interface LocalWallet {
  publicKey: string;        // Hex-encoded public key
  keyshares: Keyshare[];    // Array of keyshares
  config: {
    totalParties: number;   // Total number of parties
    threshold: number;      // Threshold for signing
    partyIds: number[];     // Party identifiers
  };
}
```

### SignatureResult

```typescript
interface SignatureResult {
  signature: string;  // Full signature (0x-prefixed hex)
  r: string;         // R component (0x-prefixed hex)
  s: string;         // S component (0x-prefixed hex)
  v: number;         // Recovery ID (27 or 28)
}
```

### FlexibleDKGResult

```typescript
interface FlexibleDKGResult {
  totalParties: number;
  threshold: number;
  publicKey: string;
  keyshares: PartyKeyshare[];
  addresses: BlockchainAddresses;
}
```

### PartyKeyshare

```typescript
interface PartyKeyshare {
  partyId: number;      // Party identifier (0-based)
  share: string;        // Base64-encoded keyshare
  commitment: string;   // SHA256 hash of keyshare
}
```

## Advanced Features

### Public Key Handling

The SDK handles both compressed and uncompressed public keys:
- DKLS returns compressed keys (33 bytes, 0x02/0x03 prefix)
- Ethereum address derivation requires uncompressed keys
- Automatic decompression using elliptic curve mathematics

### V Value Calculation

The SDK automatically determines the correct v value:
- Tests both recovery IDs (0 and 1)
- Verifies which recovers to the correct address
- Returns v=27 for recovery ID 0, v=28 for recovery ID 1

### EIP-155 Transaction Support

For replay protection on specific chains:
```javascript
// Convert legacy v to EIP-155 format
const recoveryId = signature.v - 27;  // 0 or 1
const eip155V = chainId * 2 + 35 + recoveryId;
```

## Error Handling

```javascript
try {
  const signature = await sdk.personalSignWithWallet(message, wallet);
} catch (error) {
  if (error.code === 'INSUFFICIENT_KEYSHARES') {
    console.error('Not enough keyshares for threshold');
  } else if (error.code === 'INVALID_HASH_LENGTH') {
    console.error('Hash must be 32 bytes');
  }
}
```

## Best Practices

1. **Always use `personalSignWithWallet`** for message signing to ensure proper v calculation
2. **Use `signTransactionWithWallet`** for transaction signing
3. **Store keyshares securely** - never expose them in logs or client-side code
4. **Verify signatures** after signing to ensure correctness
5. **Calculate gas dynamically** when including transaction data
6. **Monitor balance** before attempting transactions

## Complete Working Example

See `test-sdk.js` for a complete working example that:
- Creates an MPC wallet
- Signs messages with verification
- Monitors balance on Arbitrum Sepolia
- Signs and broadcasts transactions with custom data
- Handles all error cases properly