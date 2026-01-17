# BitShard SDK API Specification

## Overview

The BitShard SDK provides a complete implementation for threshold signatures using the DKLS23 protocol. This specification covers the full lifecycle from wallet creation through transaction broadcasting.

## Core Functionality

### 1. Wallet Creation

#### Distributed Key Generation (DKG)

The SDK implements a complete DKG ceremony that generates threshold keyshares:

```typescript
// Create a 2-of-3 threshold wallet
const wallet = await sdk.createLocalWallet({
  totalParties: 3,
  threshold: 2
});
```

**Process:**
1. Initialize DKLS keygen sessions for each party
2. Execute 4 rounds of message exchange
3. Generate public key and individual keyshares
4. Derive blockchain addresses from public key

**Output:**
- Public key (compressed, 33 bytes)
- Individual keyshares for each party
- Derived addresses for all supported chains

### 2. Message Signing

#### Personal Sign (EIP-191)

Signs messages with Ethereum personal sign format:

```typescript
const signature = await sdk.personalSignWithWallet(
  message: string,
  wallet: LocalWallet,
  options?: { threshold?: number }
): Promise<SignatureResult>
```

**Process:**
1. Prepend EIP-191 prefix: `\x19Ethereum Signed Message:\n${length}`
2. Hash with Keccak256
3. Sign with DKLS threshold signature
4. Calculate correct v value (27 or 28)

**Security:** Messages are always hashed before signing per DKLS requirements.

### 3. Transaction Signing

#### Raw Hash Signing

Signs transaction hashes for blockchain submission:

```typescript
const signature = await sdk.signTransactionWithWallet(
  hash: string | Uint8Array,
  wallet: LocalWallet,
  options?: { threshold?: number }
): Promise<SignatureResult>
```

**Process:**
1. Validate hash is 32 bytes
2. Sign with threshold parties
3. Calculate v value using public key recovery
4. Return signature components (r, s, v)

#### Complete Transaction Flow

```javascript
// 1. Build transaction
const tx = {
  to: '0x...',
  value: ethers.utils.parseEther('0.001'),
  data: '0x626974736861726421696f',  // Custom data
  gasLimit: 50000,
  gasPrice: gasPrice,
  nonce: nonce,
  chainId: 421614  // Arbitrum Sepolia
};

// 2. Serialize and hash
const serializedTx = ethers.utils.serializeTransaction(tx);
const txHash = ethers.utils.keccak256(serializedTx);

// 3. Sign with MPC wallet
const signature = await sdk.signTransactionWithWallet(txHash, wallet);

// 4. Apply EIP-155 for replay protection
const recoveryId = signature.v - 27;
const eip155V = tx.chainId * 2 + 35 + recoveryId;

// 5. Create signed transaction
const signedTx = ethers.utils.serializeTransaction(tx, {
  r: signature.r,
  s: signature.s,
  v: eip155V
});

// 6. Broadcast
const txResponse = await provider.sendTransaction(signedTx);
```

### 4. Address Derivation

#### Multi-Chain Address Support

Derives addresses for multiple blockchains from a single public key:

```typescript
const addresses = sdk.deriveAddresses(publicKey: string): BlockchainAddresses
```

**Ethereum/EVM Chains:**
1. Decompress public key if needed (33 → 64 bytes)
2. Hash with Keccak256
3. Take last 20 bytes as address

**Bitcoin:**
1. Use compressed public key
2. SHA256 → RIPEMD160
3. Add network byte and checksum
4. Base58 encode for P2PKH address

### 5. Signature Verification

#### Address Recovery

Verifies signatures by recovering the signing address:

```javascript
// Using ethers.js
const fullSig = signature.signature + signature.v.toString(16).padStart(2, '0');
const recoveredAddress = ethers.utils.verifyMessage(message, fullSig);

// Verify match
const valid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
```

## Technical Implementation Details

### Public Key Compression

The SDK handles compressed/uncompressed key conversion:

```typescript
// DKLS returns compressed (33 bytes)
// 0x02... or 0x03... prefix indicates y-coordinate parity

// Decompression for Ethereum
function decompressPublicKey(compressed: string): string {
  // Extract x coordinate
  const x = BigInt('0x' + compressed.slice(2));
  
  // Calculate y from curve equation: y² = x³ + 7
  const y = modSqrt(x³ + 7, p);
  
  // Select correct y based on prefix
  return xHex + yHex;  // 64 bytes uncompressed
}
```

### V Value Determination

The SDK automatically calculates the correct recovery ID:

```typescript
// Test both possible v values
for (const testV of [27, 28]) {
  const recovered = recoverAddress(hash, { r, s, v: testV });
  if (recovered === expectedAddress) {
    return testV;  // Found correct v
  }
}
```

### Hash Functions

- **Personal Sign:** Keccak256 (Ethereum standard)
- **Transaction Hash:** Keccak256
- **Bitcoin Address:** SHA256 → RIPEMD160
- **Keyshare Commitment:** SHA256

### Gas Calculation

Dynamic gas calculation for transaction data:

```javascript
const baseGas = 21000;  // Base transaction cost
const dataGas = data.length * 68;  // ~68 gas per byte
const totalGas = baseGas + dataGas;
```

## Supported Chains

### EVM Compatible
- Ethereum (mainnet, sepolia)
- Arbitrum (One, Sepolia)
- Polygon
- BNB Smart Chain
- Avalanche C-Chain
- Optimism
- Base

### Chain-Specific Parameters

**Arbitrum Sepolia:**
- Chain ID: 421614
- RPC: https://sepolia-rollup.arbitrum.io/rpc
- Explorer: https://sepolia.arbiscan.io

## Security Considerations

### Message Hashing
All messages MUST be hashed before signing per DKLS requirements:
- Prevents signature malleability attacks
- Ensures consistent 32-byte input
- Required by the underlying DKLS protocol

### Keyshare Protection
- Never expose keyshares in logs
- Store encrypted when at rest
- Use secure channels for distribution

### Threshold Security
- Minimum 2-of-3 recommended
- Higher thresholds for production
- Geographic distribution of parties

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INSUFFICIENT_KEYSHARES` | Not enough keyshares for threshold | Provide at least threshold keyshares |
| `INVALID_HASH_LENGTH` | Hash is not 32 bytes | Ensure proper hash format |
| `INVALID_PUBLIC_KEY` | Public key format invalid | Check compression/format |
| `SIGNATURE_VERIFICATION_FAILED` | Signature doesn't match address | Check v value calculation |
| `INVALID_TRANSACTION` | Transaction serialization failed | Verify transaction format |

## Testing

### Local Testing Flow

1. **Create wallet:**
```javascript
const wallet = await sdk.createLocalWallet();
```

2. **Fund address:**
```javascript
console.log('Send testnet ETH to:', addresses.ethereum);
```

3. **Monitor balance:**
```javascript
const balance = await provider.getBalance(addresses.ethereum);
```

4. **Send transaction:**
```javascript
// See complete example above
```

### Testnet Faucets

**Arbitrum Sepolia:**
- https://faucet.quicknode.com/arbitrum/sepolia
- Bridge from Sepolia: https://bridge.arbitrum.io

## Performance Considerations

### DKG Ceremony
- ~2-3 seconds for 3-party setup
- Increases with party count
- One-time operation per wallet

### Signature Generation
- ~500ms for 2-of-3 threshold
- Includes v value calculation
- Parallelizable for batch operations

### Gas Optimization
- Use appropriate gas limits
- Monitor gas prices
- Batch transactions when possible

## Compatibility

### Dependencies
- `@silencelaboratories/dkls-wasm-ll-node`: DKLS protocol
- `ethers`: v5.x for Ethereum operations
- `viem`: Keccak256 hashing
- Node.js: 16.x or higher

### Browser Support
- Requires WASM support
- Use `dkls-wasm-ll-web` for browser
- WebSocket for coordination