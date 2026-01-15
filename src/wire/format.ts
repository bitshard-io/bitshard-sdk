/**
 * Wire message format utilities
 */

export type { WireMessage } from '../core/types';
import { DKLSService } from '../core/DKLSService';

// Re-export wire format methods
export const toWireMessage = DKLSService.toWireMessage;
export const fromWireMessage = DKLSService.fromWireMessage;
