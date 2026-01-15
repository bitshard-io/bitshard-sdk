import crypto from 'crypto';
import {
    KeygenSession,
    SignSession,
    Keyshare,
    Message
} from '@silencelaboratories/dkls-wasm-ll-node';
import type {
    DKGResult,
    FlexibleDKGResult,
    SignatureResult,
    MPCSession,
    PartyKeyshare,
    BlockchainAddresses
} from './types';
import { deriveAddressesFromBytes } from '../crypto/addresses';

/**
 * Core DKLS protocol service for distributed key generation and threshold signatures
 */
export class DKLSService {
    private sessions: Map<string, MPCSession> = new Map();

    /**
     * Wire format for DKLS Message over WS
     */
    static toWireMessage(msg: Message): { from_id: number; to_id?: number; payload: string } {
        return {
            from_id: msg.from_id,
            to_id: msg.to_id,
            payload: Buffer.from(msg.payload).toString('base64')
        };
    }

    /**
     * Reconstruct DKLS Message from wire payload
     */
    static fromWireMessage(w: { from_id: number; to_id?: number; payload: string }): Message {
        const bytes = new Uint8Array(Buffer.from(w.payload, 'base64'));
        // Note: Message constructor requires payload, from, and optional to
        return new Message(bytes, w.from_id, w.to_id);
    }

    /**
     * Generate DKG using DKLS protocol with flexible threshold
     * @param totalParties Total number of parties (n)
     * @param threshold Threshold required for signing (t)
     * @param partyIds Optional array of party IDs (defaults to 0..n-1)
     */
    async generateDKG(
        totalParties: number = 3,
        threshold: number = 2,
        partyIds?: number[]
    ): Promise<FlexibleDKGResult> {
        try {
            console.log(`🔐 Starting DKLS DKG for ${threshold}-of-${totalParties} threshold scheme...`);

            // Validate parameters
            if (threshold > totalParties) {
                throw new Error('Threshold cannot be greater than total parties');
            }
            if (threshold < 2) {
                throw new Error('Threshold must be at least 2');
            }

            // Use provided party IDs or default to 0..n-1
            const ids = partyIds ?? Array.from({ length: totalParties }, (_, i) => i);
            if (ids.length !== totalParties) {
                throw new Error('Party IDs array length must match totalParties');
            }

            // Create KeygenSession for each party
            const parties: KeygenSession[] = [];
            for (let i = 0; i < totalParties; i++) {
                parties.push(new KeygenSession(totalParties, threshold, ids[i]!));
            }

            // Execute DKG protocol
            const keyshares = this.executeDKG(parties);

            // Get public key from first keyshare
            const publicKeyBytes = keyshares[0]!.publicKey;
            const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

            // Generate addresses for different blockchains
            const addresses = this.deriveAllAddresses(publicKeyBytes);

            // Create party keyshares with commitments
            const partyKeyshares: PartyKeyshare[] = keyshares.map((ks, idx) => {
                const shareBytes = ks.toBytes();
                const shareData = Buffer.from(shareBytes).toString('base64');
                const commitment = crypto.createHash('sha256')
                    .update(shareData)
                    .digest('hex');

                return {
                    partyId: ids[idx]!,
                    share: shareData,
                    commitment
                };
            });

            // Generate DKG commitment
            const dkgCommitment = crypto.createHash('sha256')
                .update(publicKeyHex)
                .digest('hex');

            console.log(`✅ DKLS DKG completed successfully`);
            console.log(`📍 Ethereum address: ${addresses.ethereum}`);
            console.log(`📍 Bitcoin address: ${addresses.bitcoin}`);

            return {
                totalParties,
                threshold,
                publicKey: '0x' + publicKeyHex,
                dkgCommitment,
                keyshares: partyKeyshares,
                addresses
            };
        } catch (error) {
            console.error('❌ DKLS DKG generation error:', error);
            throw new Error(`Failed to generate DKG: ${(error as Error).message}`);
        }
    }

    /**
     * Legacy method for backward compatibility - generates standard 2-of-3 setup
     */
    async generateDKGCommitments(): Promise<DKGResult> {
        const result = await this.generateDKG(3, 2);

        // Map to legacy format
        return {
            dkgCommitment: result.dkgCommitment,
            serverShareCommitment: result.keyshares[0]!.commitment,
            masterPublicKey: result.publicKey,
            serverShare: result.keyshares[0]!.share,
            backupShare: result.keyshares[1]!.share,
            mobileShare: result.keyshares[2]!.share,
            publicKey: result.publicKey,
            ethAddress: result.addresses.ethereum,
            btcAddress: result.addresses.bitcoin,
            cosmosAddress: result.addresses.cosmos,
            bnbAddress: result.addresses.bnb,
            polygonAddress: result.addresses.polygon,
            avaxAddress: result.addresses.avalanche,
            arbAddress: result.addresses.arbitrum
        };
    }

    /**
     * Execute the DKG protocol rounds
     */
    protected executeDKG(parties: KeygenSession[]): Keyshare[] {
        // Round 1: Create first messages and capture each session's self id
        const msg1: Message[] = parties.map(p => p.createFirstMessage());
        const selfIds: number[] = msg1.map(m => m.from_id);

        // Broadcast round 1 messages (exclude own by selfId)
        const msg2: Message[] = parties.flatMap((p, idx) =>
            p.handleMessages(this.filterMessages(msg1, selfIds[idx]!))
        );

        // Calculate chain code commitments and index them by actual party id
        const commitmentsRaw = parties.map(p => p.calculateChainCodeCommitment());
        const commitments: any[] = new Array(parties.length);
        selfIds.forEach((id, idx) => {
            commitments[id] = commitmentsRaw[idx];
        });

        // Handle P2P messages (round 2) using selfId mapping
        const msg3: Message[] = parties.flatMap((p, idx) =>
            p.handleMessages(this.selectMessages(msg2, selfIds[idx]!))
        );

        // Handle P2P messages with commitments (round 3)
        const msg4: Message[] = parties.flatMap((p, idx) =>
            p.handleMessages(this.selectMessages(msg3, selfIds[idx]!), commitments)
        );

        // Handle final broadcast messages
        parties.forEach((p, idx) =>
            p.handleMessages(this.filterMessages(msg4, selfIds[idx]!))
        );

        // Extract keyshares
        return parties.map(p => p.keyshare());
    }

    /**
     * Sign a message using threshold signatures
     * @param messageHash The message hash to sign
     * @param keyshares Array of keyshares (at least threshold number required)
     * @param threshold Threshold value (must match keyshare generation)
     * @param publicKey Optional public key for v calculation
     */
    async signMessage(
        messageHash: Uint8Array,
        keyshares: Keyshare[],
        threshold: number,
        publicKey?: string
    ): Promise<SignatureResult> {
        try {
            console.log(`🖊️ Starting DKLS signature generation (${threshold}-of-${keyshares.length})...`);

            if (keyshares.length < threshold) {
                throw new Error(`Insufficient keyshares: need ${threshold}, got ${keyshares.length}`);
            }

            // Clone keyshares since SignSession consumes them
            const signingShares = keyshares.slice(0, threshold).map(ks => {
                const bytes = ks.toBytes();
                return Keyshare.fromBytes(bytes);
            });

            // Create sign sessions
            // NOTE: DKLS library currently only supports "m" path
            const parties: SignSession[] = signingShares.map(ks =>
                new SignSession(ks, "m")
            );

            // Round 1: Create first messages and capture self ids
            const msg1: Message[] = parties.map(p => p.createFirstMessage());
            const selfIds: number[] = msg1.map(m => m.from_id);

            // Broadcast the first message to all parties
            const msg2: Message[] = parties.flatMap((p, idx) =>
                p.handleMessages(this.filterMessages(msg1, selfIds[idx]!))
            );

            // Handle P2P messages (round 2)
            const msg3: Message[] = parties.flatMap((p, idx) =>
                p.handleMessages(this.selectMessages(msg2, selfIds[idx]!))
            );

            // Complete pre-signature (round 3)
            parties.forEach((p, idx) =>
                p.handleMessages(this.selectMessages(msg3, selfIds[idx]!))
            );

            // WARNING: PRE-SIGNATURES MUST NOT BE REUSED
            // Generate final signature with message hash
            const msg4: Message[] = parties.map(p => p.lastMessage(messageHash));

            // Combine to produce signature
            const signatures = parties.map((p, idx) =>
                p.combine(this.filterMessages(msg4, selfIds[idx]!))
            );

            // All parties should produce the same signature
            const signatureComponents = signatures[0]!;
            const [r_bytes, s_bytes] = signatureComponents;

            const r = Buffer.from(r_bytes).toString('hex');
            const s = Buffer.from(s_bytes).toString('hex');
            const signatureHex = r + s;

            // Calculate v value for Ethereum signature recovery
            let v = 27; // Default value

            if (publicKey) {
                // Try to recover with both v values and see which matches our public key
                const ethers = require('ethers');
                const { deriveEthereumAddress } = require('../crypto/addresses');

                const expectedAddress = deriveEthereumAddress(publicKey);
                const msgHashHex = '0x' + Buffer.from(messageHash).toString('hex');

                for (const testV of [27, 28]) {
                    try {
                        const sig = { r: '0x' + r, s: '0x' + s, v: testV };
                        const recoveredAddress = ethers.utils.recoverAddress(msgHashHex, sig);

                        if (recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()) {
                            v = testV;
                            break;
                        }
                    } catch (e) {
                        // Try next v value
                    }
                }
            }

            console.log('✅ DKLS signature generated successfully');

            return {
                signature: '0x' + signatureHex,
                r: '0x' + r,
                s: '0x' + s,
                v
            };
        } catch (error) {
            console.error('❌ DKLS signing error:', error);
            throw new Error(`Failed to sign message: ${(error as Error).message}`);
        }
    }

    /**
     * Legacy signing method for backward compatibility
     */
    async signMessageLegacy(
        messageHash: Uint8Array,
        serverShareData: string,
        backupShareData: string,
        _chain: 'ethereum' | 'bitcoin' | 'solana' = 'ethereum'
    ): Promise<SignatureResult> {
        // Deserialize keyshares
        const serverKeyshare = Keyshare.fromBytes(
            new Uint8Array(Buffer.from(serverShareData, 'base64'))
        );
        const backupKeyshare = Keyshare.fromBytes(
            new Uint8Array(Buffer.from(backupShareData, 'base64'))
        );

        return this.signMessage(messageHash, [serverKeyshare, backupKeyshare], 2);
    }

    /**
     * Refresh shares (key rotation) while preserving the public key
     */
    async refreshShares(existingShares: Keyshare[]): Promise<{
        newShares: Keyshare[];
        publicKey: string;
    }> {
        try {
            console.log('🔄 Starting DKLS key rotation...');
            console.log(`   ${existingShares.length} parties participating in rotation`);

            // Create rotation sessions
            const rotationParties: KeygenSession[] = existingShares.map(share =>
                KeygenSession.initKeyRotation(share)
            );

            console.log('Executing key generation protocol for rotation...');

            // Execute DKG protocol for rotation
            const newKeyshares = this.executeDKG(rotationParties);

            // Verify all parties got keyshares
            if (!newKeyshares.every(ks => ks !== null)) {
                throw new Error('Key rotation failed: Not all parties generated new shares');
            }

            // Get public key (should be same as before)
            const publicKeyHex = Buffer.from(newKeyshares[0]!.publicKey).toString('hex');
            const originalPubKey = Buffer.from(existingShares[0]!.publicKey).toString('hex');

            console.log('Original public key:', originalPubKey.substring(0, 20) + '...');
            console.log('Rotated public key:', publicKeyHex.substring(0, 20) + '...');

            // Finalize rotation
            console.log('Finalizing key rotation...');
            for (let i = 0; i < newKeyshares.length; i++) {
                newKeyshares[i]!.finishKeyRotation(existingShares[i]!);
                console.log(`   Party ${i} rotation finalized`);
            }

            console.log('✅ DKLS key rotation completed successfully');

            if (publicKeyHex === originalPubKey) {
                console.log('   ✅ Public key preserved: addresses remain unchanged');
            } else {
                console.log('   ⚠️ Public key changed (unexpected for rotation)');
            }

            return {
                newShares: newKeyshares,
                publicKey: '0x' + publicKeyHex
            };
        } catch (error) {
            console.error('❌ DKLS key rotation error:', error);
            throw new Error(`Failed to refresh shares: ${(error as Error).message}`);
        }
    }

    /**
     * Filter messages for broadcast (exclude own messages)
     */
    protected filterMessages(msgs: Message[], party: number): Message[] {
        return msgs.filter((m) => m.from_id !== party).map(m => m.clone());
    }

    /**
     * Select P2P messages for a specific party
     */
    protected selectMessages(msgs: Message[], party: number): Message[] {
        return msgs.filter((m) => m.to_id === party).map(m => m.clone());
    }

    /**
     * Derive all blockchain addresses from public key
     */
    protected deriveAllAddresses(publicKey: Uint8Array): BlockchainAddresses {
        return deriveAddressesFromBytes(publicKey);
    }

    /**
     * Get active session by ID
     */
    getSession(sessionId: string): MPCSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Create a new MPC session
     */
    createSession(session: Omit<MPCSession, 'createdAt' | 'updatedAt'>): MPCSession {
        const fullSession: MPCSession = {
            ...session,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.sessions.set(session.id, fullSession);
        return fullSession;
    }

    /**
     * Update session status
     */
    updateSession(sessionId: string, updates: Partial<MPCSession>): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            Object.assign(session, updates, { updatedAt: new Date() });
        }
    }
}