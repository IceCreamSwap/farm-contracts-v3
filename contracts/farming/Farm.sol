// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./Token.sol";
import "./TokenMinter.sol";

contract Farm is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 lastDepositTime;
    }

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accTokenPerShare;
        uint16 depositFeeBP;
        uint16 withdrawFeeBP;
        uint16 withdrawLockPeriod;
    }

    Token public immutable token;
    TokenMinter public immutable minter;
    address public devFeeAddr;
    uint256 public TokenPerBlock;
    uint256 public constant BONUS_MULTIPLIER = 1;
    uint256 public bonusEndBlock;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;
    bool lockStart;

    address burn_addr = address(0x000000000000000000000000000000000000dEaD);
    IERC20 migrate_token;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Migration(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        Token _token,
        TokenMinter _minter,
        address _devFeeAddr,
        uint256 _TokenPerBlock,
        uint256 _startBlock,
        IERC20 _migrate_token
    ) public {
        token = _token;
        minter = _minter;
        lockStart = false;

        devFeeAddr = _devFeeAddr;
        TokenPerBlock = _TokenPerBlock;
        startBlock = _startBlock;

        // staking pool
        poolInfo.push(PoolInfo({
        lpToken : _token,
        allocPoint : 1000,
        lastRewardBlock : startBlock,
        accTokenPerShare : 0,
        depositFeeBP : 0,
        withdrawFeeBP : 0,
        withdrawLockPeriod : 0
        }));

        totalAllocPoint = 1000;

        // used to migrate GLTO to ICE
        migrate_token = _migrate_token;

    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    mapping(IERC20 => bool) public poolExistence;
    modifier nonDuplicated(IERC20 _lpToken) {
        require(poolExistence[_lpToken] == false, "nonDuplicated: duplicated");
        _;
    }
    function add(uint256 _allocPoint, IERC20 _lpToken,
        uint16 _depositFeeBP,
        uint16 _withdrawFeeBP,
        uint16 _withdrawLockPeriod,
        bool _withUpdate) public onlyOwner nonDuplicated(_lpToken) {
        require(_depositFeeBP <= 1000, "add: invalid deposit fee basis points");
        require(_withdrawFeeBP <= 1000, "add: invalid withdraw fee basis points");
        require(_withdrawLockPeriod <= 2764800, "add: invalid withdraw lock period");
        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
        lpToken : _lpToken,
        allocPoint : _allocPoint,
        lastRewardBlock : lastRewardBlock,
        accTokenPerShare : 0,
        depositFeeBP : _depositFeeBP,
        withdrawFeeBP : _withdrawFeeBP,
        withdrawLockPeriod : _withdrawLockPeriod
        }));
        updateStakingPool();
    }

    function set(uint256 _pid, uint256 _allocPoint,
        uint16 _depositFeeBP,
        uint16 _withdrawFeeBP,
        uint16 _withdrawLockPeriod,
        bool _withUpdate) public onlyOwner {
        require(_depositFeeBP <= 1000, "set: invalid deposit fee basis points");
        require(_withdrawFeeBP <= 1000, "add: invalid withdraw fee basis points");
        require(_withdrawLockPeriod <= 2764800, "add: invalid withdraw lock period");

        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (_pid != 0) {
            poolInfo[_pid].depositFeeBP = _depositFeeBP;
            poolInfo[_pid].withdrawFeeBP = _withdrawFeeBP;
            poolInfo[_pid].withdrawLockPeriod = _withdrawLockPeriod;
        }
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            updateStakingPool();
        }
    }

    function updateStakingPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        if (points != 0) {
            points = points.div(3);
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(points);
            poolInfo[0].allocPoint = points;
        }
    }

    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    function pendingToken(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 TokenReward = multiplier.mul(TokenPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accTokenPerShare = accTokenPerShare.add(TokenReward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }


    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 TokenReward = multiplier.mul(TokenPerBlock).mul(pool.allocPoint).div(totalAllocPoint);

        token.mint(devFeeAddr, TokenReward.div(10));
        token.mint(address(minter), TokenReward);
        pool.accTokenPerShare = pool.accTokenPerShare.add(TokenReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount) public nonReentrant {

        require(_pid != 0, 'deposit Token by staking');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0 ) {
                if( pool.withdrawLockPeriod == 0 || block.timestamp > user.lastDepositTime + pool.withdrawLockPeriod ){
                    safeTokenTransfer(msg.sender, pending);
                }
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(devFeeAddr, depositFee);
                user.amount = user.amount.add(_amount).sub(depositFee);
            } else {
                user.amount = user.amount.add(_amount);
            }

            // TODO: test-case pending
            // migrate old token and stake it
            if ( pool.lpToken == migrate_token) {
                // we mint new token
                token.mint(msg.sender, _amount);
                emit Migration(msg.sender, _pid, _amount);
                // stake minted amount in the native pool
                enterStaking(_amount);
                // burn old token
                // TODO: discuss with token economics designer.
                pool.lpToken.safeTransfer(burn_addr, _amount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        emit Deposit(msg.sender, _pid, _amount);
    }

    function getLockPeriod(address _user, uint256 _pid) public view returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        return block.timestamp > user.lastDepositTime + pool.withdrawLockPeriod;
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {

        require(_pid != 0, 'withdraw Token by unstaking');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);

        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            if( pool.withdrawLockPeriod == 0 || block.timestamp > user.lastDepositTime + pool.withdrawLockPeriod ){
                safeTokenTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Stake Token tokens to MasterChef
    function enterStaking(uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        updatePool(0);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        minter.mint(msg.sender, _amount);
        emit Deposit(msg.sender, 0, _amount);
    }

    // Withdraw Token tokens from STAKING.
    function leaveStaking(uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0) {
            safeTokenTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        minter.burn(msg.sender, _amount);
        emit Withdraw(msg.sender, 0, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        if (_pid == 0) {
            minter.burn(msg.sender, amount);
        }
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe Token transfer function, just in case if rounding error causes pool to not have enough Tokens.
    function safeTokenTransfer(address _to, uint256 _total) internal {
        minter.safeTokenTransfer(_to, _total);
    }


    function adminUpdateBonus(uint256 _bonusEndBlock) external onlyOwner {
        bonusEndBlock = _bonusEndBlock;
    }

    function adminUpdateTokenPerBlock(uint256 _TokenPerBlock) external onlyOwner {
        require(_TokenPerBlock <= 1 ether, "can't be more than 1 ether");
        TokenPerBlock = _TokenPerBlock;
    }

    function adminSetDevFeeAddr(address _devFeeAddr) external onlyOwner {
        devFeeAddr = _devFeeAddr;
    }

    // allow to change tax treasure via timelock
    function adminSetTaxAddr(address _taxTo) external onlyOwner {
        minter.setTaxAddr(_taxTo);
    }

    // allow to change tax via timelock
    function adminSetTax(uint16 _tax) external onlyOwner {
        minter.setTax(_tax);
    }

    // whitelist address (like vaults)
    function adminSetWhiteList(address _addr, bool _status) external onlyOwner {
        minter.setWhiteList(_addr, _status);
    }

    function adminSetMinterStatus(address _addr, bool _status) external onlyOwner {
        token.setMinterStatus(_addr, _status);
    }

    function adminSetStartBlock(uint256 _startBlock) external onlyOwner {
        require(lockStart == false);
        startBlock = _startBlock;
    }

    // to mint tokens to add liquidity
    function adminMint(address _to, uint256 _amount) external onlyOwner {
        // only allow admin minting if unlocked
        require(lockStart == false);
        token.mint(_to, _amount);

    }

    function adminSetLock() external onlyOwner {
        lockStart = true;
    }

    function adminSetBurnAddr(address _burn_addr) external onlyOwner {
        burn_addr = _burn_addr;
    }


}
