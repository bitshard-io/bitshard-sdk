import { BitShardSDK } from '../src/BitShardSDK';
import { Keyshare } from '@silencelaboratories/dkls-wasm-ll-node';
import { ethers } from 'ethers';

const MESSAGE = 'Hello BitShard!';

function verifyPersonalSig(sig: { signature: string; v?: number }, message: string): string {
    if (sig.v === undefined) throw new Error('Signature v is undefined');
    const fullSig = sig.signature + sig.v.toString(16).padStart(2, '0');
    return ethers.utils.verifyMessage(message, fullSig);
}

describe('BitShardSDK basic signing flow', () => {
    jest.setTimeout(30000);

    let sdk: BitShardSDK;
    let wallet: Awaited<ReturnType<BitShardSDK['createLocalWallet']>>;
    let addresses: ReturnType<BitShardSDK['deriveAddresses']>;

    beforeAll(async () => {
        sdk = new BitShardSDK();
        wallet = await sdk.createLocalWallet({
            totalParties: 3,
            threshold: 2,
            partyIds: [0, 1, 2]
        });
        addresses = sdk.deriveAddresses(wallet.publicKey);
    });

    it('createLocalWallet creates a 2-of-3 wallet', () => {
        expect(wallet.keyshares).toHaveLength(3);
        expect(typeof wallet.publicKey).toBe('string');
    });

    it('deriveAddresses returns a valid Ethereum address', () => {
        expect(addresses.ethereum).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('personalSignWithWallet recovers matching address', async () => {
        const sig = await sdk.personalSignWithWallet(MESSAGE, wallet, { threshold: 2 });
        const recovered = verifyPersonalSig(sig, MESSAGE);
        expect(recovered.toLowerCase()).toBe(addresses.ethereum.toLowerCase());
    });

    it('personalSign recovers matching address with publicKey', async () => {
        const sig = await sdk.personalSign(MESSAGE, wallet.keyshares, {
            threshold: 2,
            publicKey: wallet.publicKey
        });
        const recovered = verifyPersonalSig(sig, MESSAGE);
        expect(recovered.toLowerCase()).toBe(addresses.ethereum.toLowerCase());
    });
});

describe('Key rotation (refreshShares)', () => {
    jest.setTimeout(30000);

    let sdk: BitShardSDK;
    let wallet: Awaited<ReturnType<BitShardSDK['createLocalWallet']>>;
    let originalPubKey: string;
    let originalEthAddr: string;
    let rotatedShares: Keyshare[];
    let rotatedPubKey: string;

    beforeAll(async () => {
        sdk = new BitShardSDK();
        wallet = await sdk.createLocalWallet({
            totalParties: 3,
            threshold: 2,
            partyIds: [0, 1, 2]
        });
        originalPubKey = wallet.publicKey;
        originalEthAddr = sdk.deriveAddresses(originalPubKey).ethereum;

        const result = await sdk.getDKLSService().refreshShares(wallet.keyshares);
        rotatedShares = result.newShares;
        rotatedPubKey = result.publicKey;
    });

    it('preserves the public key after rotation', () => {
        const norm = (k: string) => k.replace(/^0x/i, '').toLowerCase();
        expect(norm(rotatedPubKey)).toBe(norm(originalPubKey));
    });

    it('preserves the ETH address after rotation', () => {
        const rotatedAddr = sdk.deriveAddresses(rotatedPubKey).ethereum;
        expect(rotatedAddr.toLowerCase()).toBe(originalEthAddr.toLowerCase());
    });

    it('produces the same number of shares', () => {
        expect(rotatedShares).toHaveLength(3);
    });

    it('signs correctly with rotated shares', async () => {
        const rotatedWallet = {
            publicKey: rotatedPubKey,
            keyshares: rotatedShares,
            config: wallet.config
        };
        const sig = await sdk.personalSignWithWallet(MESSAGE, rotatedWallet, { threshold: 2 });
        const recovered = verifyPersonalSig(sig, MESSAGE);
        expect(recovered.toLowerCase()).toBe(originalEthAddr.toLowerCase());
    });
});

describe('Key recovery (recoverShares)', () => {
    jest.setTimeout(30000);

    let sdk: BitShardSDK;
    let wallet: Awaited<ReturnType<BitShardSDK['createLocalWallet']>>;
    let originalPubKey: string;
    let originalEthAddr: string;
    let recoveryResult: Awaited<ReturnType<BitShardSDK['getDKLSService']>['recoverShares']>;

    beforeAll(async () => {
        sdk = new BitShardSDK();
        wallet = await sdk.createLocalWallet({
            totalParties: 3,
            threshold: 2,
            partyIds: [0, 1, 2]
        });
        originalPubKey = wallet.publicKey;
        originalEthAddr = sdk.deriveAddresses(originalPubKey).ethereum;

        const survivors = [wallet.keyshares[0], wallet.keyshares[1]];
        recoveryResult = await sdk.getDKLSService().recoverShares(survivors, [2]);
    });

    it('preserves the public key after recovery', () => {
        const norm = (k: string) => k.replace(/^0x/i, '').toLowerCase();
        expect(norm(recoveryResult.publicKey)).toBe(norm(originalPubKey));
    });

    it('preserves the ETH address after recovery', () => {
        const recoveredAddr = sdk.deriveAddresses(recoveryResult.publicKey).ethereum;
        expect(recoveredAddr.toLowerCase()).toBe(originalEthAddr.toLowerCase());
    });

    it('reports the correct recovered party IDs', () => {
        expect(recoveryResult.recoveredPartyIds).toEqual([2]);
    });

    it('returns shares for all parties (survivors + recovered)', () => {
        expect(recoveryResult.newShares).toHaveLength(3);
    });

    it('signs correctly with recovered shares', async () => {
        const msgHash = Buffer.from(
            ethers.utils.hashMessage(MESSAGE).slice(2),
            'hex'
        );
        const sig = await sdk.getDKLSService().signMessage(
            new Uint8Array(msgHash),
            recoveryResult.newShares,
            2,
            recoveryResult.publicKey
        );
        const recovered = verifyPersonalSig(sig, MESSAGE);
        expect(recovered.toLowerCase()).toBe(originalEthAddr.toLowerCase());
    });
});

describe('Key recovery validation', () => {
    jest.setTimeout(30000);

    let sdk: BitShardSDK;
    let wallet: Awaited<ReturnType<BitShardSDK['createLocalWallet']>>;

    beforeAll(async () => {
        sdk = new BitShardSDK();
        wallet = await sdk.createLocalWallet({
            totalParties: 3,
            threshold: 2,
            partyIds: [0, 1, 2]
        });
    });

    it('rejects empty surviving shares', async () => {
        await expect(sdk.getDKLSService().recoverShares([], [2]))
            .rejects.toThrow('At least one surviving share');
    });

    it('rejects empty lost party IDs', async () => {
        await expect(sdk.getDKLSService().recoverShares(wallet.keyshares, []))
            .rejects.toThrow('At least one lost party ID');
    });

    it('rejects when survivors < threshold', async () => {
        await expect(sdk.getDKLSService().recoverShares([wallet.keyshares[0]], [1, 2]))
            .rejects.toThrow('Insufficient survivors');
    });

    it('rejects out-of-range lost party ID', async () => {
        const survivors = [wallet.keyshares[0], wallet.keyshares[1]];
        await expect(sdk.getDKLSService().recoverShares(survivors, [5]))
            .rejects.toThrow('out of range');
    });

    it('rejects lost party ID that has a surviving share', async () => {
        const survivors = [wallet.keyshares[0], wallet.keyshares[1]];
        await expect(sdk.getDKLSService().recoverShares(survivors, [0]))
            .rejects.toThrow('listed as lost but has a surviving share');
    });
});
