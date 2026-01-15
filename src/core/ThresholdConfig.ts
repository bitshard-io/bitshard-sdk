/**
 * Configuration for threshold signature schemes
 */
export class ThresholdConfig {
    /**
     * Total number of parties
     */
    public readonly totalParties: number;

    /**
     * Threshold required for signing (t-of-n)
     */
    public readonly threshold: number;

    /**
     * Party identifiers (optional, defaults to 0..n-1)
     */
    public readonly partyIds: number[];

    /**
     * Create a new threshold configuration
     * @param totalParties Total number of parties (n)
     * @param threshold Threshold required for signing (t)
     * @param partyIds Optional array of party IDs
     */
    constructor(totalParties: number, threshold: number, partyIds?: number[]) {
        // Validate parameters
        if (totalParties < 2) {
            throw new Error('Total parties must be at least 2');
        }
        
        if (threshold < 2) {
            throw new Error('Threshold must be at least 2');
        }
        
        if (threshold > totalParties) {
            throw new Error('Threshold cannot be greater than total parties');
        }
        
        this.totalParties = totalParties;
        this.threshold = threshold;
        
        // Use provided party IDs or default to sequential
        if (partyIds) {
            if (partyIds.length !== totalParties) {
                throw new Error('Party IDs array length must match totalParties');
            }
            // Check for duplicates
            const uniqueIds = new Set(partyIds);
            if (uniqueIds.size !== partyIds.length) {
                throw new Error('Party IDs must be unique');
            }
            this.partyIds = [...partyIds];
        } else {
            this.partyIds = Array.from({ length: totalParties }, (_, i) => i);
        }
    }

    /**
     * Create a standard 2-of-3 configuration
     */
    static createStandard(): ThresholdConfig {
        return new ThresholdConfig(3, 2);
    }

    /**
     * Create a 3-of-4 configuration with additional signer
     */
    static createEnhanced(): ThresholdConfig {
        return new ThresholdConfig(4, 3);
    }

    /**
     * Create an enterprise configuration
     * @param totalParties Total number of parties (5-7 recommended)
     * @param threshold Threshold (3-4 recommended)
     */
    static createEnterprise(totalParties: number = 5, threshold: number = 3): ThresholdConfig {
        if (totalParties < 5 || totalParties > 20) {
            throw new Error('Enterprise configuration should have 5-20 parties');
        }
        return new ThresholdConfig(totalParties, threshold);
    }

    /**
     * Check if a set of party IDs can sign
     * @param signingParties Array of party IDs that want to sign
     * @returns True if the parties can meet the threshold
     */
    canSign(signingParties: number[]): boolean {
        // Check if all signing parties are valid
        const validParties = signingParties.filter(id => this.partyIds.includes(id));
        
        // Check if we have enough valid parties
        return validParties.length >= this.threshold;
    }

    /**
     * Get the minimum number of additional parties needed to sign
     * @param currentParties Array of party IDs currently available
     * @returns Number of additional parties needed, or 0 if threshold is met
     */
    additionalPartiesNeeded(currentParties: number[]): number {
        const validParties = currentParties.filter(id => this.partyIds.includes(id));
        const needed = this.threshold - validParties.length;
        return Math.max(0, needed);
    }

    /**
     * Get a subset of parties for signing
     * @param availableParties Array of available party IDs
     * @returns Array of party IDs to use for signing (threshold size)
     */
    selectSigningParties(availableParties: number[]): number[] {
        const validParties = availableParties.filter(id => this.partyIds.includes(id));
        
        if (validParties.length < this.threshold) {
            throw new Error(
                `Insufficient parties: need ${this.threshold}, have ${validParties.length}`
            );
        }
        
        // Return first threshold number of valid parties
        return validParties.slice(0, this.threshold);
    }

    /**
     * Validate party ID
     * @param partyId Party ID to validate
     * @returns True if party ID is valid
     */
    isValidParty(partyId: number): boolean {
        return this.partyIds.includes(partyId);
    }

    /**
     * Get configuration summary
     */
    toString(): string {
        return `${this.threshold}-of-${this.totalParties} threshold scheme`;
    }

    /**
     * Get detailed configuration info
     */
    toJSON(): {
        totalParties: number;
        threshold: number;
        partyIds: number[];
        scheme: string;
    } {
        return {
            totalParties: this.totalParties,
            threshold: this.threshold,
            partyIds: this.partyIds,
            scheme: this.toString()
        };
    }
}
