import express from 'express';
import { config } from 'dotenv';
import { ethers } from 'ethers';

config();

const router = express.Router();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const walletAddress = process.env.WALLET_PUBLIC_ADDRESS;

router.get('/balance', async (req, res) => {
  try {
    const balance = await provider.getBalance(walletAddress);
    const balanceInBDAG = ethers.formatEther(balance);
    res.json({ balance: balanceInBDAG });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

export default router;