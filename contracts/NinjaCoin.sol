// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** * @title NinjaCoin (TN)
 * @dev Advanced Smart Contract with Dynamic PoW Mining, Time-locked Staking, Minting, and Burning.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

abstract contract Ownable {
    address private _owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    function owner() public view virtual returns (address) { return _owner; }
    modifier onlyOwner() { require(owner() == msg.sender, "Ownable: caller is not the owner"); _; }
    function renounceOwnership() public virtual onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }
}

contract NinjaCoin is IERC20, Ownable {
    // --- Token Info ---
    string public name = "NinjaCoin";
    string public symbol = "TN";
    uint8 public decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    bool public isPaused = false;

    // --- Dynamic Mining Variables (PoW) ---
    uint256 public difficulty = 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    bytes32 public lastBlockHash;
    uint256 public miningReward = 50 * 10**18; // ניתן לשינוי
    uint256 public blocksMined = 0;
    uint256 public lastMiningTime;
    uint256 public miningCooldown = 5 minutes; // ניתן לשינוי

    // --- Smart Staking Variables ---
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lockDuration;
        uint256 apy; 
    }
    mapping(address => StakeInfo) public stakes;

    // Events
    event Mined(address indexed miner, uint256 reward, bytes32 newHash);
    event Staked(address indexed user, uint256 amount, uint256 durationDays, uint256 apy);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event Paused(bool status);

    modifier whenNotPaused() { require(!isPaused, "Contract is paused"); _; }

    constructor() {
        lastBlockHash = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        lastMiningTime = block.timestamp;
        
        // הדפסה ראשונית של מיליון מטבעות ליוצר החוזה
        _mint(msg.sender, 1000000 * 10**18);
    }

    // ================= ERC20 STANDARD =================
    
    function totalSupply() public view override returns (uint256) { return _totalSupply; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }
    
    function transfer(address to, uint256 value) public override whenNotPaused returns (bool) { 
        _transfer(msg.sender, to, value); 
        return true; 
    }
    
    function allowance(address ownerAddr, address spender) public view override returns (uint256) { 
        return _allowances[ownerAddr][spender]; 
    }
    
    function approve(address spender, uint256 value) public override whenNotPaused returns (bool) { 
        _allowances[msg.sender][spender] = value; 
        emit Approval(msg.sender, spender, value); 
        return true; 
    }
    
    function transferFrom(address from, address to, uint256 value) public override whenNotPaused returns (bool) {
        require(_allowances[from][msg.sender] >= value, "ERC20: Insufficient allowance");
        _allowances[from][msg.sender] -= value;
        _transfer(from, to, value);
        return true;
    }
    
    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        require(_balances[from] >= value, "ERC20: transfer amount exceeds balance");
        
        _balances[from] -= value;
        _balances[to] += value;
        emit Transfer(from, to, value);
    }

    // ================= ADMIN FUNCTIONS =================

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) external whenNotPaused {
        require(_balances[msg.sender] >= amount, "Burn amount exceeds balance");
        _balances[msg.sender] -= amount;
        _totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function togglePause() external onlyOwner {
        isPaused = !isPaused;
        emit Paused(isPaused);
    }

    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        for (uint i = 0; i < recipients.length; i++) {
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }

    // --- הגדרות כרייה נשלטות ---
    
    // שינוי גובה הפרס על כרייה (הכנס כמות ב-Wei, למשל 50 כפול 10^18)
    function setMiningReward(uint256 newReward) external onlyOwner {
        miningReward = newReward;
    }

    // שינוי זמן ההמתנה בין כרייה לכרייה (בשניות)
    function setMiningCooldown(uint256 newCooldownSeconds) external onlyOwner {
        miningCooldown = newCooldownSeconds;
    }

    // שינוי ידני של רמת הקושי (במידה ותרצה לאפס או להקשות עוד יותר)
    function setDifficulty(uint256 newDifficulty) external onlyOwner {
        difficulty = newDifficulty;
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to zero address");
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    // ================= BITCOIN-STYLE MINING (PoW) =================

    function mine(uint256 nonce) external whenNotPaused {
        require(block.timestamp >= lastMiningTime + miningCooldown, "Mining cooldown active");
        
        // בדיקת הוכחת העבודה (Proof of Work)
        bytes32 hash = keccak256(abi.encodePacked(msg.sender, lastBlockHash, nonce));
        require(uint256(hash) < difficulty, "Invalid PoW hash");
        
        // עדכון מצב
        lastBlockHash = hash;
        lastMiningTime = block.timestamp;
        blocksMined++;

        // מנגנון העלאת קושי אוטומטי: כל כרייה מקטינה את יעד הקושי ב-0.1%
        // זה הופך את הכרייה הבאה לקשה יותר סטטיסטית
        difficulty = difficulty - (difficulty / 1000);

        _mint(msg.sender, miningReward);
        emit Mined(msg.sender, miningReward, hash);
    }

    // ================= SMART STAKING =================

    // lockDurationDays can be 30, 90, or 365
    function stake(uint256 amount, uint256 lockDurationDays) external whenNotPaused {
        require(amount > 0, "Cannot stake 0");
        require(stakes[msg.sender].amount == 0, "Already staking, withdraw first");
        
        uint256 apy;
        if (lockDurationDays == 30) apy = 10;       // 10% APY
        else if (lockDurationDays == 90) apy = 18;  // 18% APY
        else if (lockDurationDays == 365) apy = 35; // 35% APY
        else revert("Invalid lock duration (30, 90, 365)");

        _transfer(msg.sender, address(this), amount);
        
        stakes[msg.sender] = StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lockDuration: lockDurationDays * 1 days,
            apy: apy
        });

        emit Staked(msg.sender, amount, lockDurationDays, apy);
    }

    function calculateReward(address user) public view returns (uint256) {
        StakeInfo memory userStake = stakes[user];
        if (userStake.amount == 0) return 0;
        
        uint256 stakedTime = block.timestamp - userStake.startTime;
        return (userStake.amount * userStake.apy * stakedTime) / (365 days * 100);
    }

    function withdrawStake() external whenNotPaused {
        StakeInfo storage userStake = stakes[msg.sender];
        require(userStake.amount > 0, "No active stake");
        require(block.timestamp >= userStake.startTime + userStake.lockDuration, "Tokens are still locked!");

        uint256 reward = calculateReward(msg.sender);
        uint256 originalAmount = userStake.amount;

        delete stakes[msg.sender];

        _transfer(address(this), msg.sender, originalAmount);
        
        if (reward > 0) {
            _mint(msg.sender, reward);
        }

        emit Unstaked(msg.sender, originalAmount, reward);
    }
}