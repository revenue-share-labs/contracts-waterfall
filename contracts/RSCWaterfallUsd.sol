// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BaseRSCWaterfall.sol";


contract XLARSCWaterfallUsd is BaseRSCWaterfall {
    AggregatorV3Interface internal nativeTokenUsdPriceFeed;
    mapping(address => address) tokenUsdPriceFeeds;

    event TokenPriceFeedSet(address token, address priceFeed);
    event NativeTokenPriceFeedSet(address oldNativeTokenPriceFeed, address newNativeTokenPriceFeed);

    // Throws when trying to fetch USD price for token without oracle
    error TokenMissingUsdPriceOracle();

    /**
     * @dev Constructor function, can be called only once
     * @param _settings Contract settings, check InitContractSetting struct
     * @param _initialRecipients Addresses to be added as a initial recipients
     * @param _maxCaps Maximum amount recipient will receive
     * @param _priorities Priority when recipient is going to be current recipient
     * @param _nativeTokenUsdPriceFeed oracle address for native token / USD price
     */
    function initialize(
        InitContractSetting memory _settings,
        address payable [] memory _initialRecipients,
        uint256[] memory _maxCaps,
        uint256[] memory _priorities,
        address _nativeTokenUsdPriceFeed
    ) public initializer {
        // Contract settings
        controller = _settings.controller;

        uint256 distributorsLength = _settings._distributors.length;
        for (uint256 i = 0; i < distributorsLength;) {
            distributors[_settings._distributors[i]] = true;
            unchecked{i++;}
        }

        immutableController = _settings.immutableController;
        autoNativeTokenDistribution = _settings.autoNativeTokenDistribution;
        minAutoDistributionAmount = _settings.minAutoDistributionAmount;
        factory = IFeeFactory(_settings.factoryAddress);
        platformFee = _settings.platformFee;
        nativeTokenUsdPriceFeed = AggregatorV3Interface(_nativeTokenUsdPriceFeed);
        _transferOwnership(_settings.owner);
        uint256 supportedErc20Length = _settings.supportedErc20addresses.length;
        if (supportedErc20Length != _settings.erc20PriceFeeds.length) {
            revert InconsistentDataLengthError();
        }
        for (uint256 i = 0; i < supportedErc20Length;) {
            _setTokenUsdPriceFeed(_settings.supportedErc20addresses[i], _settings.erc20PriceFeeds[i]);
            unchecked{i++;}
        }

        // Recipients settings
        _setRecipients(_initialRecipients, _maxCaps, _priorities);
    }

    /**
     * @notice Internal function to redistribute native token
     * @param _valueToDistribute amount in native token to be distributed
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeNativeToken(uint256 _valueToDistribute, bool _recursive) internal override {
        if (currentRecipient == address(0)) {
            // When there is not currentRecipient _valueToDistribute stays in the RSC contract
            return;
        }

        // if any, subtract platform Fee and send it to platformWallet
        if (platformFee > 0 && !_recursive) {
            uint256 fee = _valueToDistribute / 10000000 * platformFee;
            _valueToDistribute -= fee;
            address payable platformWallet = factory.platformWallet();
            (bool feeSuccess,) = platformWallet.call{value: fee}("");
            if (feeSuccess == false) {
                revert TransferFailedError();
            }
        }

        RecipientData storage recipientData = recipientsData[currentRecipient];
        uint256 remainCap = recipientData.maxCap - recipientData.received;
        uint256 nativeTokenValueToSent = _valueToDistribute;
        uint256 usdValueToSent = _convertNativeTokenToUsd(nativeTokenValueToSent);

        // Check if current recipient was fulfilled
        bool setNewCurrentRecipient = false;
        if (usdValueToSent >= remainCap) {
            usdValueToSent = remainCap;
            nativeTokenValueToSent = _convertUsdToNativeToken(usdValueToSent);
            setNewCurrentRecipient = true;
        }

        // Send native token to current currentRecipient
        recipientData.received += usdValueToSent;
        (bool success,) = payable(currentRecipient).call{value: nativeTokenValueToSent}("");
        if (success == false) {
            revert TransferFailedError();
        }
        _recursiveNativeTokenDistribution(currentRecipient);

        // Set new current recipient if currentRecipient was fulfilled
        if (setNewCurrentRecipient) {
            _setCurrentRecipient();
            uint256 remainingBalance = address(this).balance;
            if (remainingBalance > 0) {
                _redistributeNativeToken(remainingBalance, true);
            }
        }
    }

    /**
     * @notice Internal function to redistribute ERC20 token based on waterfall rules
     * @param _token address of token to be distributed
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeToken(address _token, bool _recursive) internal override {
        if (currentRecipient == address(0)) {
            // When there is not currentRecipient we cannot distribute token
            return;
        }

        RecipientData storage recipientData = recipientsData[currentRecipient];
        IERC20 erc20Token = IERC20(_token);

        uint256 tokenValueToSent = erc20Token.balanceOf(address(this));
        if (tokenValueToSent == 0) {
            // Nothing to distribute
            return;
        }

        // if any subtract platform Fee and send it to platformWallet
        if (platformFee > 0 && !_recursive) {
            uint256 fee = tokenValueToSent / 10000000 * platformFee;
            tokenValueToSent -= fee;
            address payable platformWallet = factory.platformWallet();
            erc20Token.transfer(platformWallet, fee);
        }

        uint256 remainCap = recipientData.maxCap - recipientData.received;
        uint256 usdValueToSent = _convertTokenToUsd(_token, tokenValueToSent);

        // Check if current recipient was fulfilled
        bool setNewCurrentRecipient = false;
        if (usdValueToSent >= remainCap) {
            usdValueToSent = remainCap;
            tokenValueToSent = _convertUsdToToken(_token, usdValueToSent);
            setNewCurrentRecipient = true;
        }

        // Transfer token to currentRecipient
        recipientData.received += usdValueToSent;
        erc20Token.transfer(currentRecipient, tokenValueToSent);
        _recursiveERC20Distribution(currentRecipient, _token);

        // Set new current recipient if currentRecipient was fulfilled
        if (setNewCurrentRecipient) {
            _setCurrentRecipient();
            uint256 contractBalance = erc20Token.balanceOf(address(this));
            if (contractBalance > 0) {
                _redistributeToken(_token, true);
            }
        }

        emit DistributeToken(_token, tokenValueToSent);
    }

    /**
     * @notice Internal function to convert native token value to USD value
     * @param _nativeTokenValue value of native token to be converted
     */
    function _convertNativeTokenToUsd(uint256 _nativeTokenValue) internal view returns (uint256) {
        return (_getNativeTokenUsdPrice() * _nativeTokenValue) / 1e18;
    }

    /**
     * @notice Internal function to convert USD value to native token value
     * @param _usdValue value of usd to be converted
     */
    function _convertUsdToNativeToken(uint256 _usdValue) internal view returns (uint256) {
        return (_usdValue * 1e25 / _getNativeTokenUsdPrice() * 1e25) / 1e32;
    }

    /**
     * @notice Internal function to convert Token value to USD value
     * @param _token address of the token to be converted
     * @param _tokenValue amount of tokens to be converted
     */
    function _convertTokenToUsd(address _token, uint256 _tokenValue) internal view returns (uint256) {
        return (_getTokenUsdPrice(_token) * _tokenValue) / 1e18;
    }

    /**
     * @notice Internal function to convert USD value to Token value
     * @param _token address of the token to be converted
     * @param _usdValue usd value to be converted
     */
    function _convertUsdToToken(address _token, uint256 _usdValue) internal view returns (uint256) {
        return (_usdValue * 1e25 / _getTokenUsdPrice(_token) * 1e25) / 1e32;
    }

    /**
     * @notice internal function that returns native token/usd price from external oracle
     */
    function _getNativeTokenUsdPrice() private view returns (uint256) {
        (,int256 price,,,) = nativeTokenUsdPriceFeed.latestRoundData();
        return uint256(price * 1e10);
    }

    /**
     * @notice internal function that returns erc20/usd price from external oracle
     * @param _token token address
     */
    function _getTokenUsdPrice(address _token) private view returns (uint256) {
        address tokenOracleAddress = tokenUsdPriceFeeds[_token];
        if (tokenOracleAddress == address(0)) {
            revert TokenMissingUsdPriceOracle();
        }
        AggregatorV3Interface tokenUsdPriceFeed = AggregatorV3Interface(tokenOracleAddress);
        (,int256 price,,,) = tokenUsdPriceFeed.latestRoundData();
        return uint256(price * 1e10);
    }

    /**
     * @notice Internal function for setting price feed oracle for token
     * @param _token address of token
     * @param _priceFeed address of USD price feed for given token
     */
    function _setTokenUsdPriceFeed(address _token, address _priceFeed) internal {
        tokenUsdPriceFeeds[_token] = _priceFeed;
        emit TokenPriceFeedSet(_token, _priceFeed);
    }
    /**
     * @notice External function for setting price feed oracle for token
     * @param _token address of token
     * @param _priceFeed address of USD price feed for given token
     */
    function setTokenUsdPriceFeed(address _token, address _priceFeed) external onlyOwner {
        _setTokenUsdPriceFeed(_token, _priceFeed);
    }

    /**
     * @notice External function for setting price feed oracle for native token
     * @param _priceFeed address of USD price feed for native token
     */
    function setNativeTokenPriceFeed(address _priceFeed) external onlyOwner {
        emit NativeTokenPriceFeedSet(address(nativeTokenUsdPriceFeed), _priceFeed);
        nativeTokenUsdPriceFeed = AggregatorV3Interface(_priceFeed);
    }
}
