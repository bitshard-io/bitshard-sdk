import { BitShardSDK } from '../src/BitShardSDK';
import { ethers } from 'ethers';

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
        const message = 'Hello BitShard!';
        const signatureWithWallet = await sdk.personalSignWithWallet(message, wallet, { threshold: 2 });
        const walletV = signatureWithWallet.v;
        if (walletV === undefined) {
            throw new Error('Signature v is undefined for personalSignWithWallet');
        }
        const fullSigWithWallet =
            signatureWithWallet.signature + walletV.toString(16).padStart(2, '0');
        const recoveredWithWallet = ethers.utils.verifyMessage(message, fullSigWithWallet);
        console.log(
            `personalSignWithWallet: recovered=${recoveredWithWallet} expected=${addresses.ethereum}`
        );
        expect(recoveredWithWallet.toLowerCase()).toBe(addresses.ethereum.toLowerCase());
    });

    it('personalSign recovers matching address with publicKey', async () => {
        const message = 'Hello BitShard!';
        const signatureWithPublicKey = await sdk.personalSign(message, wallet.keyshares, {
            threshold: 2,
            publicKey: wallet.publicKey
        });
        const publicKeyV = signatureWithPublicKey.v;
        if (publicKeyV === undefined) {
            throw new Error('Signature v is undefined for personalSign');
        }
        const fullSigWithPublicKey =
            signatureWithPublicKey.signature + publicKeyV.toString(16).padStart(2, '0');
        const recoveredWithPublicKey = ethers.utils.verifyMessage(message, fullSigWithPublicKey);
        console.log(
            `personalSign: recovered=${recoveredWithPublicKey} expected=${addresses.ethereum}`
        );
        expect(recoveredWithPublicKey.toLowerCase()).toBe(addresses.ethereum.toLowerCase());
    });
});
