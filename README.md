# BitShard SDK

BitShard SDK is a TypeScript library for distributed key generation (DKG) and threshold signatures using the DKLs23 protocol. It enables secure multi-party computation (MPC) wallets with flexible n-of-m threshold configurations.

## Features

- **Distributed Key Generation**: Secure generation of threshold key shares across multiple parties
- **Threshold Signatures**: Sign transactions with any t-of-n parties
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
  threshold: 2 
});
```

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

See [SECURITY.md](./SECURITY.md) for detailed security considerations.

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

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

For support, please open an issue on GitHub or contact support@bitshard.io
