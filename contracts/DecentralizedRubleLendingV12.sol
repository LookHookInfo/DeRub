// SPDX-License-Identifier: MIT

// Current contract version is MVP
// Oracle is centralized in this version.

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DecentralizedRubleLendingV12 is ERC20 {
    uint256 public constant COLLATERAL_FACTOR = 80;
    uint256 public constant LIQUIDATION_BUFFER = 20;
    uint256 public constant USDC_MARKUP = 5;
    
    address public immutable treasury;
    address public priceUpdater;

    struct Asset {
        address token;
        uint8 decimals;
    }
    Asset[] public assets;

    mapping(address => mapping(address => uint256)) public collateralBalance;
    mapping(address => uint256) public debtBalance;
    mapping(address => bool) public isBorrower;
    mapping(address => uint256) public prices;

    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount);
    event AutoLiquidated(address indexed user, uint256 debtCovered, uint256 valueSeizedDRUB);
    event PriceUpdated(address indexed token, uint256 price);
    event PriceUpdaterChanged(address indexed newUpdater);
    event BoughtDRUB(address indexed buyer, uint256 drubAmount, uint256 usdcAmount);
    event DRUBBurned(address indexed burner, uint256 amount);

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyPriceUpdater() {
        require(msg.sender == priceUpdater, "not updater");
        _;
    }

    constructor(address _treasury, address _priceUpdater) ERC20("Decentralized Ruble", "DRUB") {
        require(_treasury != address(0) && _priceUpdater != address(0), "invalid address");
        treasury = _treasury;
        priceUpdater = _priceUpdater;

        assets.push(Asset({token: 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf, decimals: 8}));
        assets.push(Asset({token: address(0), decimals: 18}));
        assets.push(Asset({token: 0xA9B631ABcc4fd0bc766d7C0C8fCbf866e2bB0445, decimals: 18}));
    }

    // --- Oracle ---
    function setPrice(address token, uint256 price) external onlyPriceUpdater {
        require(price > 0, "bad price");
        prices[token] = price;
        emit PriceUpdated(token, price);
    }

    function setPriceUpdater(address newUpdater) external onlyPriceUpdater {
        require(newUpdater != address(0), "bad updater");
        priceUpdater = newUpdater;
        emit PriceUpdaterChanged(newUpdater);
    }

    // --- Collateral helpers ---
    function _toDRUB(address token, uint8 tokenDecimals, uint256 amount) internal view returns (uint256) {
        uint256 p = prices[token];
        require(p > 0, "price=0");
        return amount * p / (10 ** tokenDecimals);
    }

    function totalCollateralValueDRUB(address user) public view returns (uint256 totalValue) {
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amt = collateralBalance[user][assets[i].token];
            if (amt == 0) continue;
            totalValue += _toDRUB(assets[i].token, assets[i].decimals, amt);
        }
    }

    function getMaxDebt(address user) public view returns (uint256) {
        return totalCollateralValueDRUB(user) * COLLATERAL_FACTOR / 100;
    }

    function isLiquidatable(address user) public view returns (bool) {
        return debtBalance[user] > getMaxDebt(user);
    }

    function getUserPosition(address user)
        external
        view
        returns (
            address[] memory tokens,
            uint256[] memory balances,
            uint256 debt,
            uint256 maxBorrow,
            uint256 totalValueDRUB
        )
    {
        uint256 count = assets.length;
        tokens = new address[](count);
        balances = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            tokens[i] = assets[i].token;
            balances[i] = collateralBalance[user][assets[i].token];
        }

        debt = debtBalance[user];
        totalValueDRUB = totalCollateralValueDRUB(user);
        maxBorrow = getMaxDebt(user);
    }

    // --- Collateral management ---
    function depositCollateral(address token, uint256 amount) external payable nonReentrant {
        (bool allowed, uint8 decs) = _findAsset(token);
        require(allowed, "asset not allowed");
        require(amount > 0, "amount=0");

        if(token == address(0)) {
            require(msg.value == amount, "bad ETH value");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
        }

        collateralBalance[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    function withdrawCollateral(address token, uint256 amount) external nonReentrant {
        (bool allowed, ) = _findAsset(token);
        require(allowed, "asset not allowed");
        require(amount > 0, "amount=0");
        require(collateralBalance[msg.sender][token] >= amount, "insufficient collateral");
        collateralBalance[msg.sender][token] -= amount;
        require(debtBalance[msg.sender] <= getMaxDebt(msg.sender), "would be undercollateralized");

        if(token == address(0)){
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).transfer(msg.sender, amount);
        }
        emit Withdrawn(msg.sender, token, amount);
    }

    // --- Borrow / Repay ---
    function borrowDrub(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(debtBalance[msg.sender] + amount <= getMaxDebt(msg.sender), "under-collateralized");

        debtBalance[msg.sender] += amount;
        isBorrower[msg.sender] = true; // быстрый чек on-chain
        _mint(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    function repayDebt(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(debtBalance[msg.sender] >= amount, "exceeds debt");
        require(balanceOf(msg.sender) >= amount, "not enough DRUB");

        debtBalance[msg.sender] -= amount;
        if(debtBalance[msg.sender] == 0) isBorrower[msg.sender] = false;
        _burn(msg.sender, amount);
        emit Repaid(msg.sender, amount);
    }

    // --- Burn DRUB ---
    function burnDRUB(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(balanceOf(msg.sender) >= amount, "not enough DRUB");
        _burn(msg.sender, amount);
        emit DRUBBurned(msg.sender, amount);
    }

    // --- Auto-liquidation ---
    function autoLiquidate(address user) public nonReentrant {
        uint256 debt = debtBalance[user];
        if(debt == 0) return;

        uint256 maxDebt = getMaxDebt(user);
        uint256 targetDebt = maxDebt * (100 - LIQUIDATION_BUFFER) / 100;
        if(debt <= targetDebt) return;

        uint256 deficit = debt - targetDebt;
        uint256 totalVal = totalCollateralValueDRUB(user);
        uint256 seizeValue = deficit <= totalVal ? deficit : totalVal;

        uint256 cover = seizeValue <= debt ? seizeValue : debt;
        _mint(address(this), cover);
        debtBalance[user] -= cover;
        _burn(address(this), cover);

        _seizeCollateral(user, seizeValue);
        emit AutoLiquidated(user, cover, seizeValue);
    }

    function autoLiquidateAll(address[] calldata users) external nonReentrant {
        for(uint256 i = 0; i < users.length; i++){
            autoLiquidate(users[i]);
        }
    }

    // --- Internal ---
    function _seizeCollateral(address user, uint256 seizeValue) internal {
        uint256 remaining = seizeValue;
        for(uint256 i=0; i<assets.length && remaining>0; i++){
            address token = assets[i].token;
            uint8 decs = assets[i].decimals;
            uint256 bal = collateralBalance[user][token];
            if(bal==0) continue;

            uint256 tokenPrice = prices[token];
            if(tokenPrice==0) continue;

            uint256 valueDRUB = _toDRUB(token, decs, bal);
            if(valueDRUB <= remaining){
                collateralBalance[user][token] = 0;
                _sendCollateralToTreasury(token, bal);
                remaining -= valueDRUB;
            } else {
                uint256 amtToSeize = remaining * (10**decs) / tokenPrice;
                collateralBalance[user][token] = bal - amtToSeize;
                _sendCollateralToTreasury(token, amtToSeize);
                remaining = 0;
            }
        }
    }

    function buyDRUB(uint256 usdcAmount) external nonReentrant {
        require(usdcAmount > 0, "amount=0");
        uint256 usdcPrice = prices[USDC];
        require(usdcPrice > 0, "USDC price=0");

        uint256 drubAmount = usdcAmount * usdcPrice / 1e6;
        drubAmount = drubAmount * 100 / (100 - USDC_MARKUP);

        IERC20(USDC).transferFrom(msg.sender, treasury, usdcAmount);
        _mint(msg.sender, drubAmount);
        emit BoughtDRUB(msg.sender, drubAmount, usdcAmount);
    }

    function assetsCount() external view returns (uint256){
        return assets.length;
    }

    function _sendCollateralToTreasury(address token,uint256 amount) internal {
        if(token==address(0)){
            (bool ok,) = payable(treasury).call{value: amount}("");
            require(ok,"ETH to treasury failed");
        } else {
            IERC20(token).transfer(treasury, amount);
        }
    }

    function _findAsset(address token) internal view returns(bool,uint8){
        for(uint256 i=0;i<assets.length;i++){
            if(assets[i].token==token) return (true, assets[i].decimals);
        }
        return (false,0);
    }

    receive() external payable {}
}
