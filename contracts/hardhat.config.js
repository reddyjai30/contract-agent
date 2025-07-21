require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    blockdag: {
      url: "https://rpc.primordial.bdagscan.com",
      chainId: 1043,
      accounts: [`0x${process.env.PRIVATE_KEY}`]
    }
  }
};