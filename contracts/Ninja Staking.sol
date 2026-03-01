// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface INinjaCoin {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
}

contract NinjaStaking {
    INinjaCoin public ninjaCoin;
    
    uint256 public constant REWARD_RATE = 10; // 10% APY
    uint256 public constant SECONDS_IN_YEAR = 31536000;

    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public lastUpdateTime;
    mapping(address => uint256) public rewards;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);

    constructor(address _ninjaCoinAddress) {
        ninjaCoin = INinjaCoin(_ninjaCoinAddress);
    }

    // מעדכן את הרווחים בכל פעם שמשתמש עושה פעולה
    modifier updateReward(address account) {
        if (account != address(0)) {
            rewards[account] = earned(account);
            lastUpdateTime[account] = block.timestamp;
        }
        _;
    }

    // חישוב הרווחים בזמן אמת
    function earned(address account) public view returns (uint256) {
        uint256 timeElapsed = block.timestamp - lastUpdateTime[account];
        uint256 rewardFromTime = (stakedBalance[account] * REWARD_RATE * timeElapsed) / (100 * SECONDS_IN_YEAR);
        return rewards[account] + rewardFromTime;
    }

    // הפקדה (נעילה)
    function stake(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        stakedBalance[msg.sender] += amount;
        
        // מושך את המטבעות מהמשתמש לחוזה (דורש Approve קודם)
        ninjaCoin.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    // משיכת הקרן
    function withdraw(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");
        stakedBalance[msg.sender] -= amount;
        
        // מחזיר את המטבעות למשתמש
        ninjaCoin.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // משיכת הרווחים בלבד (מתוך הקופה של הדוג'ו)
    function claimReward() external updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards to claim");
        rewards[msg.sender] = 0;
        
        // כאן הקסם: החוזה משלם את הרווחים מתוך הקופה שלו ישירות לארנק!
        ninjaCoin.transfer(msg.sender, reward); 
        emit RewardClaimed(msg.sender, reward);
    }
}