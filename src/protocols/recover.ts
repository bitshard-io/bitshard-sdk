/**
 * Key recovery protocol convenience wrapper.
 *
 *   import { recoverShares } from '@bitshard.io/bitshard-sdk';
 */

import type { Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';
import { DKLSService } from '../core/DKLSService';

/**
 * Recover lost shares using only threshold survivors.
 * The public key and wallet addresses are preserved.
 *
 * @param service  DKLSService instance (obtain via `sdk.getDKLSService()`)
 * @param survivingShares  Keyshares from surviving parties (>= threshold)
 * @param lostPartyIds  Party IDs whose shares were lost
 */
export async function recoverShares(
    service: DKLSService,
    survivingShares: Keyshare[],
    lostPartyIds: number[]
): Promise<{ newShares: Keyshare[]; publicKey: string; recoveredPartyIds: number[] }> {
    return service.recoverShares(survivingShares, lostPartyIds);
}
