const { BitShardSDK } = require('./dist/index.js');

async function testSDK() {
    console.log('Testing BitShard SDK...');

    try {
        // Create SDK instance
        const sdk = new BitShardSDK();
        console.log('✅ SDK created successfully');

        // Create a local wallet
        const wallet = await sdk.createLocalWallet({
            totalParties: 3,
            threshold: 2
        });
        console.log('✅ Local wallet created');
        console.log('   Public key:', wallet.publicKey);
        console.log('   Keyshares:', wallet.keyshares.length);

        // Derive addresses
        const addresses = sdk.deriveAddresses(wallet.publicKey);
        console.log('✅ Addresses derived:');
        console.log('   Ethereum:', addresses.ethereum);
        console.log('   Bitcoin:', addresses.bitcoin);
        console.log('   Arbitrum:', addresses.arbitrum);

        // Test signing with threshold (2 of 3)
        const message = 'Hello BitShard!';
        const signature = await sdk.personalSignWithWallet(message, wallet, { threshold: 2 });
        console.log('✅ Message signed:');
        console.log('   Signature:', signature.signature);

        // Verify the signature
        const { ethers } = require('ethers');
        try {
            const fullSig = signature.signature + signature.v.toString(16).padStart(2, '0');
            const recoveredAddress = ethers.utils.verifyMessage(message, fullSig);
            if (recoveredAddress.toLowerCase() === addresses.ethereum.toLowerCase()) {
                console.log('✅ Signature verified! Recovered address matches.');
                console.log('   Recovered address:', recoveredAddress);
            } else {
                console.log('⚠️  Recovered address:', recoveredAddress);
                console.log('   Expected address:', addresses.ethereum);
                return; // Exit if signature doesn't match
            }
        } catch (error) {
            console.log('⚠️  Verification error:', error.message);
            return;
        }

        // Arbitrum Sepolia transaction functionality
        console.log('\n' + '='.repeat(60));
        console.log('💰 ARBITRUM SEPOLIA TRANSACTION TEST');
        console.log('='.repeat(60));

        // Set up Arbitrum Sepolia provider
        const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
        const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);

        console.log('\n📡 Connected to Arbitrum Sepolia');
        console.log('   RPC:', ARBITRUM_SEPOLIA_RPC);

        // Display the address to fund
        console.log('\n💳 Please send some ETH to this address on Arbitrum Sepolia:');
        console.log('   Address:', addresses.ethereum);
        console.log('   (Minimum: 0.001 ETH for test transaction + gas)');

        // You can get testnet ETH from:
        console.log('\n🚰 Get testnet ETH from:');
        console.log('   1. Arbitrum Sepolia Faucet: https://faucet.quicknode.com/arbitrum/sepolia');
        console.log('   2. Bridge from Sepolia: https://bridge.arbitrum.io/');

        console.log('\n⏳ Monitoring balance (checking every 5 seconds)...');

        // Monitor balance
        let previousBalance = ethers.BigNumber.from(0);
        const checkBalance = async () => {
            try {
                const balance = await provider.getBalance(addresses.ethereum);
                const balanceEth = ethers.utils.formatEther(balance);

                if (balance.gt(previousBalance) && previousBalance.gt(0)) {
                    console.log(`\n💰 Funds received! New balance: ${balanceEth} ETH`);
                }

                if (balance.gt(0) && previousBalance.eq(0)) {
                    console.log(`\n✅ Funds detected! Balance: ${balanceEth} ETH`);
                    previousBalance = balance;

                    // Create and send transaction
                    await sendTransaction();
                    return true; // Stop monitoring
                }

                previousBalance = balance;

                if (balance.eq(0)) {
                    process.stdout.write('.');
                }

                return false; // Continue monitoring
            } catch (error) {
                console.error('\n❌ Error checking balance:', error.message);
                return false;
            }
        };

        // Send transaction function
        const sendTransaction = async () => {
            try {
                console.log('\n📝 Preparing transaction...');

                // Get current gas price and nonce
                const [gasPrice, nonce] = await Promise.all([
                    provider.getGasPrice(),
                    provider.getTransactionCount(addresses.ethereum)
                ]);

                // Convert message to hex data
                // You can customize this message or even pass JSON data
                const message = process.env.TX_MESSAGE || 'bitshard.io - MPC wallet transaction';
                const messageHex = '0x' + Buffer.from(message, 'utf8').toString('hex');

                // Calculate additional gas needed for data (roughly 68 gas per byte)
                const dataGas = Buffer.from(message).length * 68;

                // Create transaction with data field
                const tx = {
                    to: '0xd8424ee7cc2520f7dae828f84f99f53ac0dd6734', // G recipient
                    value: ethers.utils.parseEther('0.0001'), // Send 0.0001 ETH
                    data: messageHex, // Add custom message as data
                    gasLimit: 21000 + dataGas, // Base gas + data gas
                    gasPrice: gasPrice.mul(110).div(100), // Add 10% buffer
                    nonce: nonce,
                    chainId: 421614, // Arbitrum Sepolia chain ID
                    type: 0 // Legacy transaction for simplicity
                };

                console.log('\n📋 Transaction details:');
                console.log('   To:', tx.to);
                console.log('   Value:', ethers.utils.formatEther(tx.value), 'ETH');
                console.log('   Data:', message, `(${messageHex})`);
                console.log('   Gas Price:', ethers.utils.formatUnits(tx.gasPrice, 'gwei'), 'gwei');
                console.log('   Gas Limit:', tx.gasLimit);
                console.log('   Nonce:', tx.nonce);
                console.log('   Chain ID:', tx.chainId);

                // Serialize the transaction for signing
                const serializedTx = ethers.utils.serializeTransaction(tx);
                const txHash = ethers.utils.keccak256(serializedTx);

                console.log('\n🖊️  Signing transaction with MPC wallet...');
                console.log('   Transaction hash:', txHash);

                // Sign the transaction hash (use signTransactionWithWallet for raw hash)
                const txSignature = await sdk.signTransactionWithWallet(
                    txHash,
                    wallet,
                    { threshold: 2 }
                );

                console.log('   Signature R:', txSignature.r);
                console.log('   Signature S:', txSignature.s);
                console.log('   Signature V (recovery):', txSignature.v);

                // For Arbitrum Sepolia, we need to adjust v value for EIP-155
                // v = chainId * 2 + 35 + recovery_id (0 or 1)
                // DKLS returns 27 or 28 based on signature (27 = recovery_id 0, 28 = recovery_id 1)
                // The SDK automatically determines the correct v value by testing recovery
                const recoveryId = txSignature.v - 27; // Will be 0 or 1 depending on the signature
                const eip155V = tx.chainId * 2 + 35 + recoveryId;

                console.log('   Recovery ID:', recoveryId, `(from v=${txSignature.v})`);
                console.log('   EIP-155 V value:', eip155V);

                // Add signature to transaction
                const signedTx = ethers.utils.serializeTransaction(tx, {
                    r: txSignature.r,
                    s: txSignature.s,
                    v: eip155V
                });

                console.log('✅ Transaction signed');
                console.log('   Signed transaction:', signedTx);
                console.log('\n📡 Broadcasting transaction...');

                // Send the transaction
                const txResponse = await provider.sendTransaction(signedTx);
                console.log('✅ Transaction sent!');
                console.log('   Transaction hash:', txResponse.hash);
                console.log('   View on explorer: https://sepolia.arbiscan.io/tx/' + txResponse.hash);

                console.log('\n⏳ Waiting for confirmation...');
                const receipt = await txResponse.wait();

                console.log('✅ Transaction confirmed!');
                console.log('   Block number:', receipt.blockNumber);
                console.log('   Gas used:', receipt.gasUsed.toString());

                // Show how to view the input data
                console.log('\n📝 Transaction Data:');
                console.log('   Input data on chain:', tx.data);
                console.log('   Decoded message:', Buffer.from(tx.data.slice(2), 'hex').toString('utf8'));
                console.log('   View on explorer (check "Input Data" section):');
                console.log('   https://sepolia.arbiscan.io/tx/' + txResponse.hash);

                // Check final balance
                const finalBalance = await provider.getBalance(addresses.ethereum);
                console.log('\n💰 Final balance:', ethers.utils.formatEther(finalBalance), 'ETH');

            } catch (error) {
                console.error('\n❌ Transaction error:', error.message);
                if (error.reason) console.error('   Reason:', error.reason);
                if (error.code) console.error('   Code:', error.code);
            }
        };

        // Start monitoring loop
        const monitorInterval = setInterval(async () => {
            const shouldStop = await checkBalance();
            if (shouldStop) {
                clearInterval(monitorInterval);
            }
        }, 5000);

        // Initial balance check
        await checkBalance();

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSDK();