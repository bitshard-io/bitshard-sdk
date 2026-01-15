// Core exports
export { DKLSService } from './core/DKLSService';
export { DKLSParty } from './core/DKLSParty';
export { ThresholdConfig } from './core/ThresholdConfig';
export * from './core/types';

// Crypto exports
export * from './crypto/addresses';
export * from './crypto/encoding';

// Protocol exports
export * from './protocols/keygen';
export * from './protocols/signing';
export * from './protocols/presignature';
export * from './protocols/refresh';

// Chain exports
export * from './chains/config';
export * from './chains/evm/EVMChain';
export * from './chains/bitcoin/BitcoinChain';

// RPC exports
export * from './rpc/RPCProvider';
export * from './rpc/methods';

// Wire format exports
export * from './wire/format';
export * from './wire/validation';

// WebSocket exports
export * from './websocket/coordinator';
export * from './websocket/session';
export * from './websocket/messages';

// Main SDK class
export { BitShardSDK } from './BitShardSDK';

// Re-export classes and types from WASM library
// This ensures all consumers use the same WASM instance
export { Message, Keyshare, KeygenSession, SignSession } from '@silencelaboratories/dkls-wasm-ll-node';
