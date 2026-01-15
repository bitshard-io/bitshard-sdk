import {
    KeygenSession,
    SignSession,
    Keyshare
} from '@silencelaboratories/dkls-wasm-ll-node';
import type { PartyConfig, WireMessage } from './types';
import { ThresholdConfig } from './ThresholdConfig';
import { DKLSService } from './DKLSService';

/**
 * Represents a single party in the MPC protocol
 */
export class DKLSParty {
    private readonly config: PartyConfig;
    private readonly thresholdConfig: ThresholdConfig;
    private keygenSession?: KeygenSession;
    private signSession?: SignSession;
    private keyshare?: Keyshare;
    private messageQueue: WireMessage[] = [];

    /**
     * Create a new DKLS party
     * @param config Party configuration
     */
    constructor(config: PartyConfig) {
        this.config = config;
        this.thresholdConfig = new ThresholdConfig(
            config.totalParties,
            config.threshold,
            Array.from({ length: config.totalParties }, (_, i) => i)
        );
        
        // Validate party ID
        if (!this.thresholdConfig.isValidParty(config.partyId)) {
            throw new Error(`Invalid party ID: ${config.partyId}`);
        }
    }

    /**
     * Get party ID
     */
    get partyId(): number {
        return this.config.partyId;
    }

    /**
     * Get party role
     */
    get role(): string {
        return this.config.role ?? 'signer';
    }

    /**
     * Check if this party is the coordinator
     */
    isCoordinator(): boolean {
        return this.config.role === 'coordinator';
    }

    /**
     * Initialize key generation session
     */
    initializeKeygen(): void {
        if (this.keygenSession) {
            throw new Error('Keygen session already initialized');
        }
        
        this.keygenSession = new KeygenSession(
            this.config.totalParties,
            this.config.threshold,
            this.config.partyId
        );
    }

    /**
     * Initialize key rotation session
     * @param existingKeyshare Existing keyshare to rotate
     */
    initializeKeyRotation(existingKeyshare: Keyshare): void {
        if (this.keygenSession) {
            throw new Error('Keygen session already initialized');
        }
        
        this.keygenSession = KeygenSession.initKeyRotation(existingKeyshare);
    }

    /**
     * Create first message for current protocol
     * @returns Wire format message
     */
    createFirstMessage(): WireMessage {
        if (this.keygenSession) {
            const msg = this.keygenSession.createFirstMessage();
            return DKLSService.toWireMessage(msg);
        } else if (this.signSession) {
            const msg = this.signSession.createFirstMessage();
            return DKLSService.toWireMessage(msg);
        } else {
            throw new Error('No active session');
        }
    }

    /**
     * Handle incoming messages
     * @param messages Array of wire format messages
     * @param commitments Optional commitments for keygen round 3
     * @returns Array of response messages
     */
    handleMessages(messages: WireMessage[], commitments?: any[]): WireMessage[] {
        const dklsMessages = messages.map(m => DKLSService.fromWireMessage(m));
        
        if (this.keygenSession) {
            const responses = this.keygenSession.handleMessages(dklsMessages, commitments);
            return responses.map(m => DKLSService.toWireMessage(m));
        } else if (this.signSession) {
            const responses = this.signSession.handleMessages(dklsMessages);
            return responses.map(m => DKLSService.toWireMessage(m));
        } else {
            throw new Error('No active session');
        }
    }

    /**
     * Calculate chain code commitment (for keygen)
     * @returns Commitment data
     */
    calculateChainCodeCommitment(): any {
        if (!this.keygenSession) {
            throw new Error('No active keygen session');
        }
        return this.keygenSession.calculateChainCodeCommitment();
    }

    /**
     * Finalize key generation and extract keyshare
     * @returns The generated keyshare
     */
    finalizeKeygen(): Keyshare {
        if (!this.keygenSession) {
            throw new Error('No active keygen session');
        }
        
        this.keyshare = this.keygenSession.keyshare();
        this.keygenSession = undefined; // Session is consumed
        
        return this.keyshare;
    }

    /**
     * Finalize key rotation
     * @param oldKeyshare The old keyshare being rotated
     */
    finalizeKeyRotation(oldKeyshare: Keyshare): void {
        if (!this.keyshare) {
            throw new Error('No new keyshare generated');
        }
        
        this.keyshare.finishKeyRotation(oldKeyshare);
    }

    /**
     * Initialize signing session
     * @param keyshare Keyshare to use for signing
     * @param derivationPath Derivation path (currently only "m" supported)
     */
    initializeSigning(keyshare?: Keyshare, derivationPath: string = "m"): void {
        if (this.signSession) {
            throw new Error('Sign session already initialized');
        }
        
        const shareToUse = keyshare ?? this.keyshare;
        if (!shareToUse) {
            throw new Error('No keyshare available for signing');
        }
        
        // SignSession consumes the keyshare
        this.signSession = new SignSession(shareToUse, derivationPath);
        
        // Clear stored keyshare if it was consumed
        if (!keyshare && this.keyshare) {
            this.keyshare = undefined;
        }
    }

    /**
     * Generate last message with actual message hash
     * @param messageHash The message hash to sign
     * @returns Wire format message
     */
    lastMessage(messageHash: Uint8Array): WireMessage {
        if (!this.signSession) {
            throw new Error('No active sign session');
        }
        
        const msg = this.signSession.lastMessage(messageHash);
        return DKLSService.toWireMessage(msg);
    }

    /**
     * Combine messages to produce final signature
     * @param messages Final round messages
     * @returns Signature components [r, s]
     */
    combine(messages: WireMessage[]): [Uint8Array, Uint8Array] {
        if (!this.signSession) {
            throw new Error('No active sign session');
        }
        
        const dklsMessages = messages.map(m => DKLSService.fromWireMessage(m));
        const signature = this.signSession.combine(dklsMessages);
        
        // Session is consumed after combine
        this.signSession = undefined;
        
        // Ensure we have exactly 2 components
        if (!Array.isArray(signature) || signature.length !== 2) {
            throw new Error('Invalid signature format');
        }
        
        return [signature[0], signature[1]];
    }

    /**
     * Get stored keyshare
     */
    getKeyshare(): Keyshare | undefined {
        return this.keyshare;
    }

    /**
     * Set keyshare (for restoring from storage)
     * @param keyshare Keyshare to set
     */
    setKeyshare(keyshare: Keyshare): void {
        this.keyshare = keyshare;
    }

    /**
     * Serialize keyshare to base64
     * @returns Base64 encoded keyshare or undefined
     */
    serializeKeyshare(): string | undefined {
        if (!this.keyshare) {
            return undefined;
        }
        
        const bytes = this.keyshare.toBytes();
        return Buffer.from(bytes).toString('base64');
    }

    /**
     * Restore keyshare from base64
     * @param data Base64 encoded keyshare
     */
    deserializeKeyshare(data: string): void {
        const bytes = new Uint8Array(Buffer.from(data, 'base64'));
        this.keyshare = Keyshare.fromBytes(bytes);
    }

    /**
     * Add message to queue
     * @param message Wire format message
     */
    queueMessage(message: WireMessage): void {
        this.messageQueue.push(message);
    }

    /**
     * Get and clear message queue
     * @returns Queued messages
     */
    getQueuedMessages(): WireMessage[] {
        const messages = [...this.messageQueue];
        this.messageQueue = [];
        return messages;
    }

    /**
     * Get messages for this party from a list
     * @param messages Array of messages
     * @returns Messages intended for this party
     */
    filterIncomingMessages(messages: WireMessage[]): WireMessage[] {
        return messages.filter(m => 
            m.to_id === undefined || // Broadcast message
            m.to_id === this.partyId  // P2P message for this party
        ).filter(m => 
            m.from_id !== this.partyId // Exclude own messages
        );
    }

    /**
     * Check if party has an active session
     */
    hasActiveSession(): boolean {
        return !!(this.keygenSession || this.signSession);
    }

    /**
     * Get current session type
     */
    getSessionType(): 'keygen' | 'signing' | 'none' {
        if (this.keygenSession) return 'keygen';
        if (this.signSession) return 'signing';
        return 'none';
    }

    /**
     * Clear all sessions and state
     */
    reset(): void {
        this.keygenSession = undefined;
        this.signSession = undefined;
        this.messageQueue = [];
        // Note: We don't clear keyshare as it might be needed later
    }
}
