// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IntelliVaultStaker {
    address public owner;
    mapping(address => uint256) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function stake() external payable {
        require(msg.value > 0, "Must send BDAG tokens");
        stakes[msg.sender] += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        require(stakes[msg.sender] >= amount, "Not enough staked");
        stakes[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function checkStake(address user) external view returns (uint256) {
        return stakes[user];
    }

    function transferBDAG(address recipient, uint256 amount) public {
    require(recipient != address(0), "Invalid recipient");
    require(address(this).balance >= amount, "Insufficient contract balance");

    payable(recipient).transfer(amount);
}
}