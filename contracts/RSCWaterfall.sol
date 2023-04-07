// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BaseRSCWaterfall.sol";

contract RSCWaterfall is BaseRSCWaterfall {
    mapping(address => address) tokenNativeTokenPriceFeeds;
    event TokenPriceFeedSet(address token, address priceFeed);

    // Throws when trying to fetch native token price for token without oracle
    error TokenMissingNativeTokenPriceOracle();

    /**
     * @dev Constructor function, can be called only once
     * @param _settings Contract settings, check InitContractSetting struct
     * @param _initialRecipients Addresses to be added as a initial recipients
     * @param _maxCaps Maximum amount recipient will receive
     * @param _priorities Priority when recipient is going to be current recipient
     */
    function initialize(
        InitContractSetting memory _settings,
        address payable[] memory _initialRecipients,
        uint256[] memory _maxCaps,
        uint256[] memory _priorities
    ) public initializer {
        // Contract settings
        controller = _settings.controller;

        uint256 distributorsLength = _settings._distributors.length;
        for (uint256 i = 0; i < distributorsLength; ) {
            distributors[_settings._distributors[i]] = true;
            unchecked {
                i++;
            }
        }

        immutableController = _settings.immutableController;
        autoNativeTokenDistribution = _settings.autoNativeTokenDistribution;
        minAutoDistributionAmount = _settings.minAutoDistributionAmount;
        factory = IFeeFactory(_settings.factoryAddress);
        platformFee = _settings.platformFee;
        _transferOwnership(_settings.owner);
        uint256 supportedErc20Length = _settings.supportedErc20addresses.length;
        if (supportedErc20Length != _settings.erc20PriceFeeds.length) {
            revert InconsistentDataLengthError();
        }
        for (uint256 i = 0; i < supportedErc20Length; ) {
            _setTokenNativeTokenPriceFeed(
                _settings.supportedErc20addresses[i],
                _settings.erc20PriceFeeds[i]
            );
            unchecked {
                i++;
            }
        }

        // Recipients settings
        _setRecipients(_initialRecipients, _maxCaps, _priorities);
    }

    /**
     * @notice Internal function to redistribute native token
     * @param _valueToDistribute amount in native token to be distributed
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeNativeToken(
        uint256 _valueToDistribute,
        bool _recursive
    ) internal override {
        if (currentRecipient == address(0)) {
            // When there is not currentRecipient _valueToDistribute stays in the RSC contract
            return;
        }

        // if any, subtract platform Fee and send it to platformWallet
        if (platformFee > 0 && !_recursive) {
            uint256 fee = (_valueToDistribute / 10000000) * platformFee;
            _valueToDistribute -= fee;
            address payable platformWallet = factory.platformWallet();
            (bool feeSuccess, ) = platformWallet.call{ value: fee }("");
            if (feeSuccess == false) {
                revert TransferFailedError();
            }
        }

        RecipientData storage recipientData = recipientsData[currentRecipient];
        uint256 remainCap = recipientData.maxCap - recipientData.received;
        uint256 currentBalance = address(this).balance;
        uint256 nativeTokenValueToSent = _valueToDistribute +
            (currentBalance - _valueToDistribute);

        // Check if current recipient was fulfilled
        bool setNewCurrentRecipient = false;
        if (nativeTokenValueToSent >= remainCap) {
            nativeTokenValueToSent = remainCap;
            setNewCurrentRecipient = true;
        }

        // Send native token to current currentRecipient
        recipientData.received += nativeTokenValueToSent;
        (bool success, ) = payable(currentRecipient).call{
            value: nativeTokenValueToSent
        }("");
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
     * @notice Internal function to redistribute ERC20 token based waterfall rules
     * @param _token address of token to be distributed
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeToken(
        address _token,
        bool _recursive
    ) internal override {
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
            uint256 fee = (tokenValueToSent / 10000000) * platformFee;
            tokenValueToSent -= fee;
            address payable platformWallet = factory.platformWallet();
            erc20Token.transfer(platformWallet, fee);
        }

        uint256 remainCap = recipientData.maxCap - recipientData.received;
        uint256 nativeTokenValueToSent = _convertTokenToNativeToken(
            _token,
            tokenValueToSent
        );

        // Check if current recipient was fulfilled
        bool setNewCurrentRecipient = false;
        if (nativeTokenValueToSent >= remainCap) {
            nativeTokenValueToSent = remainCap;
            tokenValueToSent = _convertNativeTokenToToken(
                _token,
                nativeTokenValueToSent
            );
            setNewCurrentRecipient = true;
        }
        recipientData.received += nativeTokenValueToSent;
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
     * @notice internal function that returns erc20/native token price from external oracle
     * @param _token Address of the token
     */
    function _getTokenNativeTokenPrice(
        address _token
    ) private view returns (uint256) {
        address tokenOracleAddress = tokenNativeTokenPriceFeeds[_token];
        if (tokenOracleAddress == address(0)) {
            revert TokenMissingNativeTokenPriceOracle();
        }
        AggregatorV3Interface tokenNativeTokenPriceFeed = AggregatorV3Interface(
            tokenOracleAddress
        );
        (, int256 price, , , ) = tokenNativeTokenPriceFeed.latestRoundData();
        return uint256(price);
    }

    /**
     * @notice Internal function to convert token value to native token value
     * @param _token token address
     * @param _tokenValue Token value to be converted to USD
     */
    function _convertTokenToNativeToken(
        address _token,
        uint256 _tokenValue
    ) internal view returns (uint256) {
        return (_getTokenNativeTokenPrice(_token) * _tokenValue) / 1e18;
    }

    /**
     * @notice Internal function to convert native token value to token value
     * @param _token token address
     * @param _nativeTokenValue native token value to be converted
     */
    function _convertNativeTokenToToken(
        address _token,
        uint256 _nativeTokenValue
    ) internal view returns (uint256) {
        return
            (((_nativeTokenValue * 1e25) / _getTokenNativeTokenPrice(_token)) *
                1e25) / 1e32;
    }

    /**
     * @notice External function for setting price feed oracle for token
     * @param _token address of token
     * @param _priceFeed address of Native token price feed for given token
     */
    function setTokenNativeTokenPriceFeed(
        address _token,
        address _priceFeed
    ) external onlyOwner {
        _setTokenNativeTokenPriceFeed(_token, _priceFeed);
    }

    /**
     * @notice internal function for setting price feed oracle for token
     * @param _token address of token
     * @param _priceFeed address of native token price feed for given token
     */
    function _setTokenNativeTokenPriceFeed(
        address _token,
        address _priceFeed
    ) internal {
        tokenNativeTokenPriceFeeds[_token] = _priceFeed;
        emit TokenPriceFeedSet(_token, _priceFeed);
    }
}
