// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./IToken.sol";
import "./TokenMinter.sol";

contract Farm is Ownable, ReentrancyGuard {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    struct FeeWallets {
        address communityAddr;
        address devAddr;
        address marketAddr;
        address stakersAddr;
    }

    FeeWallets feeWallets;

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
        address depositFeeAddr;
        uint16 withdrawFeeBP;
        address withdrawFeeAddr;
        uint16 withdrawLockPeriod;
        uint16 noFeeIfAbovePeriod;
    }

    IToken public immutable token;
    TokenMinter public immutable minter;
    IERC20 public immutable migrate_token;

    address public devFeeAddr;
    uint256 public TokenPerBlock;
    uint256 public constant BONUS_MULTIPLIER = 1;
    uint256 public bonusEndBlock;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => bool) public whitelistedContracts;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;
    bool lockStart;

    address burnAddr = address(0x000000000000000000000000000000000000dEaD);

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Migration(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /*
    event LOG_CALL (bytes4 indexed sig, address indexed caller, bytes data) anonymous;
    modifier _logs_() {
        emit LOG_CALL(msg.sig, _msgSender(), _msgData());
        _;
    }
    */

    constructor(
        IToken _token,
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
            depositFeeAddr: msg.sender,
            withdrawFeeBP : 0,
            withdrawFeeAddr: msg.sender,
            withdrawLockPeriod : 0,
            noFeeIfAbovePeriod: 0
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
        address _depositFeeAddr,
        uint16 _withdrawFeeBP,
        address _withdrawFeeAddr,
        uint16 _withdrawLockPeriod,
        uint16 _noFeeIfAbovePeriod,
        bool _withUpdate)
    public onlyOwner nonDuplicated(_lpToken) {
        require(_depositFeeBP <= 1000, "add: invalid deposit fee basis points");
        require(_withdrawFeeBP <= 1000, "add: invalid withdraw fee basis points");
        require(_withdrawLockPeriod <= 2764800, "add: invalid withdraw lock period");
        require(_noFeeIfAbovePeriod <= 2764800, "add: invalid noFeeIfAbovePeriod period");
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
        depositFeeAddr: _depositFeeAddr,
        withdrawFeeBP : _withdrawFeeBP,
        withdrawFeeAddr: _withdrawFeeAddr,
        withdrawLockPeriod : _withdrawLockPeriod,
        noFeeIfAbovePeriod : _noFeeIfAbovePeriod
        }));
        updateStakingPool();
    }

    function set(uint256 _pid, uint256 _allocPoint,
        uint16 _depositFeeBP,
        address _depositFeeAddr,
        uint16 _withdrawFeeBP,
        address _withdrawFeeAddr,
        uint16 _withdrawLockPeriod,
        uint16 _noFeeIfAbovePeriod,
        bool _withUpdate)
    public onlyOwner {
        require(_depositFeeBP <= 1000, "set: invalid deposit fee basis points");
        require(_withdrawFeeBP <= 1000, "set: invalid withdraw fee basis points");
        require(_withdrawLockPeriod <= 2764800, "set: invalid withdraw lock period");
        require(_noFeeIfAbovePeriod <= 2764800, "set: invalid noFeeIfAbovePeriod period");

        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFeeBP = _depositFeeBP;
        poolInfo[_pid].depositFeeAddr = _depositFeeAddr;
        poolInfo[_pid].withdrawFeeBP = _withdrawFeeBP;
        poolInfo[_pid].withdrawFeeAddr = _withdrawFeeAddr;
        poolInfo[_pid].withdrawLockPeriod = _withdrawLockPeriod;
        poolInfo[_pid].noFeeIfAbovePeriod = _noFeeIfAbovePeriod;
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

    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
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

        token.mintUnlockedToken(devFeeAddr, TokenReward.div(10));
        token.mintLockedToken(address(minter), TokenReward);
        pool.accTokenPerShare = pool.accTokenPerShare.add(TokenReward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount) public nonReentrant notContract {

        require(_pid != 0, 'deposit Token by staking');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            safeTokenTransfer(msg.sender, pending, _pid, false);
        }
        if (_amount > 0) {
            // migrate old token and stake it
            if (pool.lpToken == migrate_token) {

                // burn old token
                // TODO: discuss with token economics designer.
                pool.lpToken.safeTransferFrom(address(msg.sender), burnAddr, _amount);

                // we mint new token
                token.mintLockedToken(address(this), _amount);

                // stake minted amount in the native pool
                internalEnterStaking(msg.sender, _amount, false, true);
                emit Migration(msg.sender, _pid, _amount);

            } else {
                // security: prevent Cerberus exploit
                uint256 oldBalance = pool.lpToken.balanceOf( address(this) );
                pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
                uint256 newBalance = pool.lpToken.balanceOf( address(this) );

                // security: new balance must be bigger than old or user is trying to exploit
                require(newBalance >= oldBalance, "invalid deposited amount");

                _amount = newBalance.sub(oldBalance);

                if (pool.depositFeeBP > 0) {
                    uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                    pool.lpToken.safeTransfer(devFeeAddr, depositFee);
                    user.amount = user.amount.add(_amount).sub(depositFee);
                } else {
                    user.amount = user.amount.add(_amount);
                }
            }
            user.lastDepositTime = block.timestamp;
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @notice Do all staking operations.
     * @dev Moved to an internal function to allow migration
     */
    function internalEnterStaking(address _user, uint256 _amount, bool _doTransfer, bool _internalTransfer) internal {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][_user];
        updatePool(0);
        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            safeTokenTransfer(_user, pending, 0, _internalTransfer);
        }
        if (_amount > 0) {
            if (_doTransfer) {
                // if migration we mint to contract, if not, transfer from user.
                pool.lpToken.safeTransferFrom(_user, address(this), _amount);
            }
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        minter.mint(_user, _amount);
        emit Deposit(_user, 0, _amount);
    }


    function compoundAll() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            compound(pid);
        }
    }
    // Stake Token tokens to MasterChef
    function compound( uint256 _pid ) public nonReentrant notContract {
        if( _pid != 0 ){
            withdraw(_pid, 0);
        }else{
            leaveStaking(0);
        }
        uint256 _amount = token.balanceOf( msg.sender );
        internalEnterStaking(msg.sender, _amount, true, true);
    }

    // Stake Token tokens to MasterChef
    function enterStaking(uint256 _amount) public nonReentrant notContract {
        internalEnterStaking(msg.sender, _amount, true, false);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant notContract {

        require(_pid != 0, 'withdraw Token by unstaking');
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        updatePool(_pid);

        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        safeTokenTransfer(msg.sender, pending, _pid, false);
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw Token tokens from STAKING.
    function leaveStaking(uint256 _amount) public nonReentrant notContract {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0 && isLocked(msg.sender, 0) == false) {
            safeTokenTransfer(msg.sender, pending, 0, false);
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
    function emergencyWithdraw(uint256 _pid) public nonReentrant notContract {
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

    function adminSetStartBlock(uint256 _startBlock) external onlyOwner {
        require(lockStart == false);
        startBlock = _startBlock;
    }

    function adminSetLock() external onlyOwner {
        lockStart = true;
    }

    function adminSetBurnAddr(address _burnAddr) external onlyOwner {
        burnAddr = _burnAddr;
    }

    function adminSetContractStatus(address _contract, bool _status) external onlyOwner {
        // allow a contract to interact with this contract
        whitelistedContracts[_contract] = _status;
    }

    /**
         * @notice Checks if the msg.sender is a contract or a proxy
         */
    modifier notContract() {
        if (whitelistedContracts[msg.sender] == false) {
            require(!_isContract(msg.sender), "contract not allowed");
            require(msg.sender == tx.origin, "proxy contract not allowed");
        }
        _;
    }



    // Safe Token transfer function, just in case if rounding error causes pool to not have enough Tokens.
    function safeTokenTransfer(address _to, uint256 _total, uint256 _pid, bool _internalTransfer) internal {
        if( _total == 0 ){
            return;
        }
        if( isLocked(msg.sender, _pid) == true ){
            return;
        }
        bool _noFee = getNoFeePeriod(_to, _pid);
        minter.safeTokenTransfer(_to, _total, _noFee, _internalTransfer);
    }
    function getNoFeePeriod(address _user, uint256 _pid) public view returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        if (pool.noFeeIfAbovePeriod == 0) {
            return false;
        }
        if (user.lastDepositTime == 0) {
            return false;
        }
        if (block.timestamp > user.lastDepositTime + pool.noFeeIfAbovePeriod ) {
            return false;
        }
        if (whitelistedContracts[msg.sender]) {
            // allow vault to auto-compound
            return false;
        }
        return true;
    }
    /**
     * @notice Checks if address is a contract
     * @dev It prevents contract from being targetted
     */
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    function getLockPeriod(address _user, uint256 _pid) public view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        if (pool.withdrawLockPeriod == 0) {
            return 0;
        }
        if (user.lastDepositTime == 0) {
            return 0;
        }
        return user.lastDepositTime + pool.withdrawLockPeriod;
    }
    function isLocked(address _user, uint256 _pid) public view returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];

        if (whitelistedContracts[msg.sender]) {
            // allow vault to auto-compound
            return false;
        }

        if (pool.withdrawLockPeriod == 0) {
            return false;
        }

        UserInfo storage user = userInfo[_pid][msg.sender];
        if (user.lastDepositTime == 0) {
            return false;
        }
        if (block.timestamp > getLockPeriod(_user, _pid)) {
            return false;
        }

        return true;
    }


}
