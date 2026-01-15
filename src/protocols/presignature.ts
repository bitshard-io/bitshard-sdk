/**
 * Pre-signature generation and management
 * 
 * CRITICAL SECURITY WARNING:
 * Pre-signatures MUST NOT be reused. Reusing a pre-signature will expose the private key.
 */

import { SignSession, Keyshare, Message } from '@silencelaboratories/dkls-wasm-ll-node';
import type { PreSignature } from '../core/types';

/**
 * Pre-signature manager for secure pre-signature generation and tracking
 */
export class PreSignatureManager {
    private consumedPreSignatures: Set<string> = new Set();
    private preSignaturePool: Map<string, PreSignature> = new Map();

    /**
     * Generate pre-signatures that can be computed ahead of time
     * @param keyshares Array of keyshares
     * @param threshold Threshold value
     * @param count Number of pre-signatures to generate
     * @returns Array of pre-signatures
     */
    async generatePreSignatures(
        keyshares: Keyshare[],
        threshold: number,
        count: number = 1
    ): Promise<PreSignature[]> {
        if (keyshares.length < threshold) {
            throw new Error(`Insufficient keyshares: need ${threshold}, got ${keyshares.length}`);
        }

        const preSignatures: PreSignature[] = [];

        for (let i = 0; i < count; i++) {
            const id = this.generateId();
            
            // Use first threshold keyshares
            const signingShares = keyshares.slice(0, threshold);
            
            // Create sign sessions
            const parties: SignSession[] = signingShares.map(ks => 
                new SignSession(ks, "m")
            );

            // Execute pre-signature rounds
            const preSignature = await this.executePreSignatureRounds(
                parties,
                id
            );

            preSignatures.push(preSignature);
            this.preSignaturePool.set(id, preSignature);
        }

        return preSignatures;
    }

    /**
     * Execute pre-signature generation rounds
     */
    private async executePreSignatureRounds(
        parties: SignSession[],
        id: string
    ): Promise<PreSignature> {
        // Round 1: Create first messages
        const msg1: Message[] = parties.map(p => p.createFirstMessage());
        const selfIds: number[] = msg1.map(m => m.from_id);

        // Round 2: Broadcast first messages
        const msg2: Message[] = parties.flatMap((p, idx) =>
            p.handleMessages(this.filterMessages(msg1, selfIds[idx]!))
        );

        // Round 3: Handle P2P messages
        const msg3: Message[] = parties.flatMap((p, idx) =>
            p.handleMessages(this.selectMessages(msg2, selfIds[idx]!))
        );

        // Round 4: Complete pre-signature
        parties.forEach((p, idx) =>
            p.handleMessages(this.selectMessages(msg3, selfIds[idx]!))
        );

        return {
            id,
            parties,
            createdAt: new Date(),
            consumed: false
        };
    }

    /**
     * Use a pre-signature to sign a message
     * @param messageHash Message hash to sign
     * @param preSignature Pre-signature to consume
     * @returns Signature components
     */
    async signWithPreSignature(
        messageHash: Uint8Array,
        preSignature: PreSignature
    ): Promise<[Uint8Array, Uint8Array]> {
        // Check if pre-signature has already been used
        if (this.consumedPreSignatures.has(preSignature.id)) {
            throw new Error(
                'CRITICAL: Pre-signature has already been used! ' +
                'Reusing pre-signatures exposes the private key!'
            );
        }

        if (preSignature.consumed) {
            throw new Error('Pre-signature has already been consumed');
        }

        // Mark as consumed IMMEDIATELY
        this.consumedPreSignatures.add(preSignature.id);
        preSignature.consumed = true;

        const { parties } = preSignature;
        const selfIds = parties.map((_, idx) => idx);

        // Generate last message with actual message hash
        const msg4: Message[] = parties.map(p => p.lastMessage(messageHash));

        // Combine to produce signature (consumes session)
        const signatures = parties.map((p, idx) => 
            p.combine(this.filterMessages(msg4, selfIds[idx]!))
        );

        // All parties should produce the same signature
        return signatures[0]!;
    }

    /**
     * Check if a pre-signature has been consumed
     * @param id Pre-signature ID
     * @returns True if consumed
     */
    isConsumed(id: string): boolean {
        return this.consumedPreSignatures.has(id);
    }

    /**
     * Get available pre-signature count
     * @returns Number of unused pre-signatures
     */
    getAvailableCount(): number {
        return Array.from(this.preSignaturePool.values())
            .filter(ps => !ps.consumed).length;
    }

    /**
     * Get next available pre-signature
     * @returns Pre-signature or undefined
     */
    getNextAvailable(): PreSignature | undefined {
        return Array.from(this.preSignaturePool.values())
            .find(ps => !ps.consumed);
    }

    /**
     * Clear consumed pre-signatures from pool
     */
    cleanupConsumed(): void {
        for (const [id, preSignature] of this.preSignaturePool.entries()) {
            if (preSignature.consumed) {
                this.preSignaturePool.delete(id);
            }
        }
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `presig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Filter messages for broadcast
     */
    private filterMessages(msgs: Message[], party: number): Message[] {
        return msgs.filter((m) => m.from_id !== party).map(m => m.clone());
    }

    /**
     * Select P2P messages
     */
    private selectMessages(msgs: Message[], party: number): Message[] {
        return msgs.filter((m) => m.to_id === party).map(m => m.clone());
    }
}

// Export singleton instance
export const preSignatureManager = new PreSignatureManager();
