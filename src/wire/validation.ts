/**
 * Wire message validation
 */

import type { WireMessage } from '../core/types';

export function validateWireMessage(message: any): message is WireMessage {
    return (
        typeof message === 'object' &&
        typeof message.from_id === 'number' &&
        typeof message.payload === 'string' &&
        (message.to_id === undefined || typeof message.to_id === 'number')
    );
}
