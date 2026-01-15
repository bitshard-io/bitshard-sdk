/**
 * WebSocket protocol messages
 */

export interface WebSocketMessage {
    type: string;
    sessionId: string;
    payload: any;
}

// TODO: Implement protocol messages
