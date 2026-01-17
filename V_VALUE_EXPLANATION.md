# Understanding V Values in Ethereum Signatures

## What is the V value?

The `v` value is the recovery ID in ECDSA signatures that helps determine which of two possible public keys created the signature.

## Why are there two possible values?

For any ECDSA signature (r, s) on the secp256k1 curve, there are mathematically **two possible public keys** that could have produced that signature. The recovery ID tells us which one is correct.

## Standard V Values

### Pre-EIP-155 (Legacy)
- `v = 27`: Recovery ID 0
- `v = 28`: Recovery ID 1

### Post-EIP-155 (With Replay Protection)
- `v = chainId * 2 + 35 + recoveryId`
- For Arbitrum Sepolia (chainId = 421614):
  - `v = 843263` when recovery ID is 0
  - `v = 843264` when recovery ID is 1

## How the SDK Determines V

The BitShard SDK automatically calculates the correct v value:

```javascript
// In DKLSService.ts
for (const testV of [27, 28]) {
    const sig = { r, s, v: testV };
    const recoveredAddress = ethers.utils.recoverAddress(msgHashHex, sig);
    
    if (recoveredAddress === expectedAddress) {
        v = testV;  // Found the correct v value!
        break;
    }
}
```

## Is it always 28?

**No!** The v value depends on the specific signature generated:
- Different messages will produce different signatures
- The same message signed multiple times may produce different v values
- It's deterministic for a given (private key, message, k-value) combination

## Example Distribution

In practice, you'll see roughly:
- ~50% of signatures with v=27 (recovery ID 0)
- ~50% of signatures with v=28 (recovery ID 1)

## Transaction Signing Flow

1. **Create transaction object**
   ```javascript
   const tx = { to, value, gasLimit, gasPrice, nonce, chainId }
   ```

2. **Serialize and hash**
   ```javascript
   const serializedTx = ethers.utils.serializeTransaction(tx);
   const txHash = ethers.utils.keccak256(serializedTx);
   ```

3. **Sign with MPC wallet**
   ```javascript
   const signature = await sdk.signTransactionWithWallet(txHash, wallet);
   // Returns { r, s, v } where v is 27 or 28
   ```

4. **Convert to EIP-155 format**
   ```javascript
   const recoveryId = signature.v - 27;  // 0 or 1
   const eip155V = chainId * 2 + 35 + recoveryId;
   ```

5. **Broadcast transaction**
   ```javascript
   const signedTx = ethers.utils.serializeTransaction(tx, {
       r: signature.r,
       s: signature.s,
       v: eip155V
   });
   ```

## Key Takeaways

1. **V is not constant** - it varies based on the signature
2. **The SDK handles this automatically** - it tests both values and picks the correct one
3. **For transactions** - convert from legacy (27/28) to EIP-155 format
4. **Always verify** - ensure the recovered address matches the expected signer
