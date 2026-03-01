// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NinjaMiningManager is Ownable {
    IERC20 public ninjaCoin;
    bytes32 public lastBlockHash;
    uint256 public difficulty; 
    uint256 public lastMiningTime;
    uint256 public constant TARGET_BLOCK_TIME = 300; // יעד: 5 דקות לבלוק
    uint256 public rewardAmount = 50 * 10**18; // פרס לכרייה

    constructor(address _ninjaCoinAddress) Ownable(msg.sender) {
        ninjaCoin = IERC20(_ninjaCoinAddress);
        // קושי התחלתי
        difficulty = 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
        lastMiningTime = block.timestamp;
    }

    function mine(uint256 nonce) external {
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, lastBlockHash, nonce));
        require(uint256(hash) < difficulty, "Difficulty too high!");

        uint256 timePassed = block.timestamp - lastMiningTime;
        
        // עדכון קושי דינמי
        if (timePassed < TARGET_BLOCK_TIME) {
            difficulty = (difficulty * 98) / 100; // מהר מדי? תעלה קושי (תקטין מספר)
        } else {
            difficulty = (difficulty * 102) / 100; // לאט מדי? תוריד קושי
        }

        lastMiningTime = block.timestamp;
        lastBlockHash = hash;

        // שליחת הפרס מתוך המאגר של החוזה
        require(ninjaCoin.transfer(msg.sender, rewardAmount), "Pool empty!");
    }

    // פונקציה למשיכת המטבעות חזרה במקרה חירום
    function withdrawRemainingTokens() external onlyOwner {
        uint256 balance = ninjaCoin.balanceOf(address(this));
        ninjaCoin.transfer(owner(), balance);
    }
}