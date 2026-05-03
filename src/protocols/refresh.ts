/**
 * Key refresh/rotation protocol convenience wrapper.
 *
 *   import { refreshShares } from '@bitshard.io/bitshard-sdk';
 */

import type { Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';
import { DKLSService } from '../core/DKLSService';

export { DKLSService } from '../core/DKLSService';

/**
 * Refresh all shares (key rotation) while preserving the public key.
 * All n parties must participate.
 *
 * @param service  DKLSService instance (obtain via `sdk.getDKLSService()`)
 * @param existingShares  All current keyshares
 */
export async function refreshShares(
    service: DKLSService,
    existingShares: Keyshare[]
): Promise<{ newShares: Keyshare[]; publicKey: string }> {
    return service.refreshShares(existingShares);
}
