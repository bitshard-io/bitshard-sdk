# BitShard SDK

[![npm version](https://img.shields.io/npm/v/@bitshard.io/bitshard-sdk.svg)](https://www.npmjs.com/package/@bitshard.io/bitshard-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

BitShard SDK is a TypeScript library for distributed key generation (DKG) and threshold signatures using the DKLs23 protocol. It enables secure multi-party computation (MPC) wallets with flexible n-of-m threshold configurations.

## Features

- **Distributed Key Generation**: Secure generation of threshold key shares across multiple parties
- **Threshold Signatures**: Sign transactions with any t-of-n parties
- **Key Rotation**: Proactively refresh all shares without changing the wallet address
- **Key Recovery**: Recover lost shares using only the threshold number of surviving parties
- **Multi-Chain Support**: Native support for Ethereum, Bitcoin, and EVM-compatible chains
- **WebSocket Coordination**: Real-time protocol coordination between parties
- **Flexible Configuration**: Support for any n-of-m threshold scheme
- **Pre-signature Management**: Secure generation and consumption of pre-signatures
- **Address Derivation**: Consistent address generation across all supported chains

## Installation

```bash
npm i @bitshard.io/bitshard-sdk
```

For browser environments, you'll also need the web WASM module:

```bash
npm install @silencelaboratories/dkls-wasm-ll-web
```

## Quick Start

### Local Testing (All Parties in One Process)

```typescript
import { BitShardSDK } from '@bitshard.io/bitshard-sdk'

const sdk = new BitShardSDK();

// Create a 2-of-3 threshold wallet locally
const wallet = await sdk.createLocalWallet({
  totalParties: 3,
  threshold: 2,
  partyIds: [0, 1, 2]
});

// Derive addresses
const addresses = sdk.deriveAddresses(wallet.publicKey);
console.log('Ethereum address:', addresses.ethereum);
console.log('Bitcoin address:', addresses.bitcoin);

// Sign a message
const message = 'Hello BitShard!';
const signature = await sdk.personalSign(message, wallet.keyshares, {
  threshold: 2,
  publicKey: wallet.publicKey
});
```

### Key Rotation

Rotation refreshes every share without changing the public key or wallet addresses.
All `n` parties must participate.

```typescript
// Via SDK service
const dkls = sdk.getDKLSService();
const { newShares, publicKey } = await dkls.refreshShares(wallet.keyshares);

// Or via standalone import
import { refreshShares } from '@bitshard.io/bitshard-sdk';
const { newShares, publicKey } = await refreshShares(dkls, wallet.keyshares);

// publicKey === wallet.publicKey  (same addresses, new secret material)
```

### Key Recovery

Recovery recreates lost shares using only `t` (threshold) surviving parties.
The public key and all wallet addresses are preserved.

```typescript
// Party 2 lost their share; parties 0 and 1 still have theirs
const survivors = [wallet.keyshares[0], wallet.keyshares[1]];
const lostPartyIds = [2];

// Via SDK service
const dkls = sdk.getDKLSService();
const result = await dkls.recoverShares(survivors, lostPartyIds);

// Or via standalone import
import { recoverShares } from '@bitshard.io/bitshard-sdk';
const result = await recoverShares(dkls, survivors, lostPartyIds);

// result.publicKey === wallet.publicKey
// result.newShares has shares for all participants (survivors + recovered)
// Sign with the recovered shares as usual
```

**Key differences between rotation and recovery:**

| | Rotation | Recovery |
|---|---|---|
| Participants needed | All `n` parties | Only `t` (threshold) survivors |
| Use case | Proactive security refresh | Lost device / compromised share |
| Public key | Preserved | Preserved |

### Distributed Setup (WebSocket Coordination)

```typescript
// Party 0 (Coordinator)
const party0 = sdk.createParty({
  partyId: 0,
  totalParties: 3,
  threshold: 2,
  role: 'coordinator'
});

// Connect to WebSocket server
await party0.connect('ws://localhost:8080/ws');

// Initiate DKG
const session = await party0.initiateDKG();

// Other parties join using session.id
// ... coordinate protocol rounds via WebSocket ...

const keyshare = await party0.finalize();
```

## Architecture

The SDK is organized into several modules:

- **Core**: DKLS protocol implementation and party management
- **Crypto**: Address derivation and encoding utilities
- **Protocols**: DKG, signing, and key refresh protocols
- **Chains**: Multi-chain configuration and transaction handling
- **RPC**: EIP-1193 compatible RPC methods
- **WebSocket**: Real-time protocol coordination

## Security

**⚠️ CRITICAL: Pre-signatures MUST NOT be reused**

Reusing pre-signatures will expose your private key. The SDK includes built-in protection against pre-signature reuse, but developers must ensure proper handling in their applications.

## Documentation

- [Architecture Design](./ARCHITECTURE_DESIGN.md)
- [API Specification](./API_SPEC.md)
- [API Reference](./API_REFERENCE.md)

## Examples

See the [examples](./examples) directory for:
- Basic wallet creation
- WebSocket coordination
- Multi-party signing
- Chain-specific transactions
- Docker deployment

## Testing

### Jest test suite

The automated test suite covers wallet creation, signing, key rotation, key recovery, and recovery input validation (18 tests total).

```bash
npm run build
npm test
```

Test structure:

| Suite | Tests | What it verifies |
|---|---|---|
| Basic signing flow | 4 | Wallet creation, address derivation, EIP-191 signing via both `personalSign` and `personalSignWithWallet` |
| Key rotation | 4 | Public key and address preserved after rotation, share count unchanged, signing with rotated shares |
| Key recovery | 5 | Public key and address preserved after recovery, correct recovered party IDs, signing with recovered shares |
| Recovery validation | 5 | Rejects empty survivors, empty lost IDs, insufficient survivors, out-of-range party IDs, overlapping survivor/lost IDs |

### Integration demo (`test-sdk.js`)

The demo script exercises the full MPC lifecycle end-to-end: DKG, signing, key rotation, key recovery, and optionally an on-chain Arbitrum Sepolia transaction.

```bash
# Run MPC protocol tests only (no network required)
npm run build
SKIP_CHAIN_TEST=1 node test-sdk.js

# Run the full demo including Arbitrum Sepolia transaction
node test-sdk.js
```

The script walks through:

1. **DKG** -- Creates a 2-of-3 threshold wallet
2. **Signing** -- Signs a message and verifies the Ethereum address via `ethers.utils.verifyMessage`
3. **Key Rotation** -- Rotates all shares, verifies key/address stability, signs with rotated shares
4. **Key Recovery** -- Simulates party 2 losing their share, recovers with parties 0+1, verifies key/address stability, signs with recovered shares
5. **Arbitrum Sepolia transaction** (optional) -- Signs and broadcasts a real on-chain transaction with a custom data payload

Set `SKIP_CHAIN_TEST=1` to skip step 5 (it requires testnet ETH funding and waits indefinitely for a balance).

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

# Releasing new version guide

This document describes the standard release process for publishing the `@bitshard.io/bitshard-sdk` package.

> **Rule:** Always push commits and tags to GitHub **before** publishing to npm.

---

## Release Steps

### 1. Commit your changes

```bash
git add .
git commit -m "feat: describe your change"
```

---

### 2. Bump version and create a Git tag

Patch release example (`0.0.1` → `0.0.2`):

```bash
npm version patch
```

This will:
- Update `package.json`
- Create an annotated Git tag (e.g. `v0.0.2`)

---

### 3. Push commits and tags to GitHub

```bash
git push origin main --follow-tags
```

This ensures Git is the source of truth before publishing.

---

### 4. Build the package

```bash
npm run build
```

Verify:
- Build output exists (e.g. `dist/`)
- `package.json` points to built files (`main`, `module`, `types`)

---

### 5. Publish to npm

```bash
npm publish --access public
```

> Scoped packages default to private unless published with `--access public` or `publishConfig.access = "public"`.

---

### 6. Verify release

```bash
npm view @bitshard.io/bitshard-sdk version
git tag --list
```

---

## Release Checklist

- [ ] Changes committed
- [ ] Version bumped via `npm version`
- [ ] Commits and tags pushed to GitHub
- [ ] Build successful
- [ ] npm publish successful

---

## Notes

- Do not publish to npm without a Git tag
- Ensure you are authenticated with npm using a publish-capable token (2FA-compliant)
- Prefer annotated tags for all releases

## Support

For support, please open an issue on GitHub or contact dev@bitshard.io