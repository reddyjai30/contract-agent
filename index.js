import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import contractJson from '../contracts/artifacts/contracts/IntelliVaultStaker.sol/IntelliVaultStaker.json' assert { type: "json" };
import walletRoute from './routes/wallet.js';


app.use(cors());
app.use(express.json());
app.use('/wallet', walletRoute);

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractJson.abi, wallet);

// Utility: Bump gas by 20–30%
const bumpGas = (base, bumpPercent = 125) => (base * BigInt(bumpPercent)) / 100n;

app.post('/execute', async (req, res) => {
  const { intents } = req.body;
  console.log("📥 Received /execute request with intents:", intents);

  const summary = [];

  try {
    const address = await wallet.getAddress();
    let nonce = await provider.getTransactionCount(address, 'pending');

    for (const intent of intents) {
      const { action, token, amount, to } = intent;
      console.log(`🚀 Processing intent → action: ${action}, token: ${token}, amount: ${amount}, to: ${to}`);

      try {
        const feeData = await provider.getFeeData();
        const baseGasPrice = feeData.gasPrice || ethers.parseUnits('50', 'gwei');
        const bumpedGasPrice = bumpGas(baseGasPrice);

        if (action === 'stake' && token === 'BDAG') {
          // Estimate gas
          let gasLimit;
          try {
            gasLimit = await contract.stake.estimateGas({
              value: ethers.parseEther(amount.toString()),
            });
            gasLimit = bumpGas(gasLimit, 130n); // bump by 30%
          } catch (e) {
            gasLimit = 300000n; // fallback
          }

          const tx = await contract.stake({
            value: ethers.parseEther(amount.toString()),
            gasPrice: bumpedGasPrice,
            gasLimit,
            nonce,
          });

          console.log("📤 Staking TX sent:", tx.hash);

          try {
            await Promise.race([
              provider.waitForTransaction(tx.hash, 1, 30000),
              new Promise((_, reject) => setTimeout(() => reject(new Error('⏱ Confirmation timeout')), 30000)),
            ]);
            console.log("✅ Staking TX confirmed:", tx.hash);
          } catch (err) {
            console.warn("⚠️ Confirmation wait timed out. Might still be mined.");
          }

          summary.push({ status: 'success', action, txHash: tx.hash });
        }

        else if (action === 'transfer' && token === 'BDAG') {
          if (!to) {
            summary.push({ status: 'failed', action, error: 'Missing recipient address (to)' });
            nonce++;
            continue;
          }

          console.log("📤 Transferring to:", to);
          // Estimate gas
          let gasLimit;
          try {
            gasLimit = await contract.transferBDAG.estimateGas(
              ethers.getAddress(to),
              ethers.parseEther(amount.toString())
            );
            gasLimit = bumpGas(gasLimit, 130n); // bump by 30%
          } catch (e) {
            gasLimit = 300000n; // fallback
          }

          try {
            const tx = await contract.transferBDAG(
              ethers.getAddress(to),
              ethers.parseEther(amount.toString()),
              { gasPrice: bumpedGasPrice, gasLimit, nonce }
            );

            console.log("📤 Transfer TX sent:", tx.hash);

            await Promise.race([
              provider.waitForTransaction(tx.hash, 1, 30000),
              new Promise((_, reject) => setTimeout(() => reject(new Error('⏱ Confirmation timeout')), 30000)),
            ]);

            console.log("✅ Transfer TX confirmed:", tx.hash);
            summary.push({ status: 'success', action, txHash: tx.hash });
          } catch (err) {
            if (err.message && err.message.includes('already known')) {
              console.warn('⚠️ TX already known (nonce reuse). Skipping.');
              summary.push({ status: 'duplicate', action, message: 'Transaction already known to network' });
            } else if (err.message && err.message.includes('nonce')) {
              summary.push({ status: 'failed', action, error: 'Nonce error: ' + err.message });
            } else if (err.message && err.message.includes('gas')) {
              summary.push({ status: 'failed', action, error: 'Gas error: ' + err.message });
            } else {
              summary.push({ status: 'failed', action, error: err.message });
            }
          }
        }

        else {
          summary.push({ status: 'invalid', action, message: 'Unsupported action or token' });
        }
      } catch (err) {
        console.error(`❌ Error in action ${intent.action}:`, err);
        summary.push({ status: 'failed', action: intent.action, error: err.message });
      }
      nonce++;
    }
  } catch (err) {
    console.error('❌ Fatal error in /execute:', err);
    summary.push({ status: 'failed', error: err.message });
  }

  console.log("📦 Summary:", summary);
  res.json({ summary });
});

app.get('/gas-estimate', async (req, res) => {
  try {
    const feeData = await provider.getFeeData();
    const estimate = await wallet.estimateGas({
      to: wallet.address,
      value: ethers.parseEther("0.01"),
    });

    const estimatedFee = feeData.gasPrice * estimate;
    const estimatedFeeInEth = ethers.formatEther(estimatedFee);

    res.json({
      gasPrice: ethers.formatUnits(feeData.gasPrice, 'gwei') + ' Gwei',
      estimatedGas: estimate.toString(),
      estimatedFee: estimatedFeeInEth + ' ETH',
    });
  } catch (err) {
    console.error("❌ Gas estimate error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/revert', async (req, res) => {
  try {
    const { recipient, amount } = req.body;
    if (!recipient || !amount) {
      return res.status(400).json({ status: 'fail', message: 'Missing recipient or amount' });
    }

    const tx = await wallet.sendTransaction({
      to: recipient,
      value: ethers.parseEther(amount.toString()),
    });

    await tx.wait();
    res.json({ status: 'success', txHash: tx.hash });
  } catch (err) {
    console.error("❌ Revert error:", err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`✅ Contract Agent running at http://localhost:${PORT}`);
});