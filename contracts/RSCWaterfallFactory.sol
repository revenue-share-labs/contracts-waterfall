// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "contracts/BaseRSCWaterfall.sol";
import "contracts/RSCWaterfall.sol";
import "contracts/RSCWaterfallUsd.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RSCWaterfallFactory is Ownable {
    address payable public immutable contractImplementation;
    address payable public immutable contractImplementationUsd;

    uint256 constant version = 1;
    uint256 public platformFee;
    address payable public platformWallet;

    // creationId unique ID for each contract creation TX, it prevents users to submit tx twice
    mapping(bytes32 => bool) public processedCreationIds;

    struct RSCCreateData {
        address controller;
        address[] distributors;
        bool immutableController;
        bool autoNativeTokenDistribution;
        uint256 minAutoDistributeAmount;
        address payable[] initialRecipients;
        uint256[] maxCaps;
        uint256[] priorities;
        address[] supportedErc20addresses;
        address[] erc20PriceFeeds;
        bytes32 creationId;
    }

    struct RSCCreateUsdData {
        address controller;
        address[] distributors;
        bool immutableController;
        bool autoNativeTokenDistribution;
        address nativeTokenUsdPriceFeed;
        uint256 minAutoDistributeAmount;
        address payable[] initialRecipients;
        uint256[] maxCaps;
        uint256[] priorities;
        address[] supportedErc20addresses;
        address[] erc20PriceFeeds;
        bytes32 creationId;
    }

    event RSCWaterfallCreated(
        address contractAddress,
        address controller,
        address[] distributors,
        uint256 version,
        bool immutableController,
        bool autoNativeTokenDistribution,
        uint256 minAutoDistributeAmount,
        bytes32 creationId
    );

    event RSCWaterfallUsdCreated(
        address contractAddress,
        address controller,
        address[] distributors,
        uint256 version,
        bool immutableController,
        bool autoNativeTokenDistribution,
        uint256 minAutoDistributeAmount,
        address nativeTokenUsdPriceFeed,
        bytes32 creationId
    );

    event PlatformFeeChanged(uint256 oldFee, uint256 newFee);

    event PlatformWalletChanged(
        address payable oldPlatformWallet,
        address payable newPlatformWallet
    );

    // Throw when Fee Percentage is more than 100%
    error InvalidFeePercentage();

    // Throw when creationId was already created
    error CreationIdAlreadyProcessed();

    constructor() {
        contractImplementation = payable(new RSCWaterfall());
        contractImplementationUsd = payable(new RSCWaterfallUsd());
    }

    /**
     * @dev Public function for creating clone proxy pointing to RSC Waterfall
     * @param _data Initial data for creating new RSC Waterfall native token contract
     * @return Address of new contract
     */
    function createRSCWaterfall(
        RSCCreateData memory _data
    ) external returns (address) {
        // check and register creationId
        bytes32 creationId = _data.creationId;
        if (creationId != bytes32(0)) {
            bool processed = processedCreationIds[creationId];
            if (processed) {
                revert CreationIdAlreadyProcessed();
            } else {
                processedCreationIds[creationId] = true;
            }
        }

        address payable clone = payable(Clones.clone(contractImplementation));

        BaseRSCWaterfall.InitContractSetting
            memory contractSettings = BaseRSCWaterfall.InitContractSetting(
                msg.sender,
                _data.distributors,
                _data.controller,
                _data.immutableController,
                _data.autoNativeTokenDistribution,
                _data.minAutoDistributeAmount,
                platformFee,
                address(this),
                _data.supportedErc20addresses,
                _data.erc20PriceFeeds
            );

        RSCWaterfall(clone).initialize(
            contractSettings,
            _data.initialRecipients,
            _data.maxCaps,
            _data.priorities
        );

        emit RSCWaterfallCreated(
            clone,
            _data.controller,
            _data.distributors,
            version,
            _data.immutableController,
            _data.autoNativeTokenDistribution,
            _data.minAutoDistributeAmount,
            creationId
        );

        return clone;
    }

    /**
     * @dev Public function for creating clone proxy pointing to RSC Waterfall USD
     * @param _data Initial data for creating new RSC Waterfall USD contract
     * @return Address of new contract
     */
    function createRSCWaterfallUsd(
        RSCCreateUsdData memory _data
    ) external returns (address) {
        // check and register creationId
        bytes32 creationId = _data.creationId;
        if (creationId != bytes32(0)) {
            bool processed = processedCreationIds[creationId];
            if (processed) {
                revert CreationIdAlreadyProcessed();
            } else {
                processedCreationIds[creationId] = true;
            }
        }

        address payable clone = payable(
            Clones.clone(contractImplementationUsd)
        );

        BaseRSCWaterfall.InitContractSetting
            memory contractSettings = BaseRSCWaterfall.InitContractSetting(
                msg.sender,
                _data.distributors,
                _data.controller,
                _data.immutableController,
                _data.autoNativeTokenDistribution,
                _data.minAutoDistributeAmount,
                platformFee,
                address(this),
                _data.supportedErc20addresses,
                _data.erc20PriceFeeds
            );

        RSCWaterfallUsd(clone).initialize(
            contractSettings,
            _data.initialRecipients,
            _data.maxCaps,
            _data.priorities,
            _data.nativeTokenUsdPriceFeed
        );

        emit RSCWaterfallUsdCreated(
            clone,
            _data.controller,
            _data.distributors,
            version,
            _data.immutableController,
            _data.autoNativeTokenDistribution,
            _data.minAutoDistributeAmount,
            _data.nativeTokenUsdPriceFeed,
            creationId
        );

        return clone;
    }

    /**
     * @dev Only Owner function for setting platform fee
     * @param _fee Percentage define platform fee 100% == 10000000
     */
    function setPlatformFee(uint256 _fee) external onlyOwner {
        if (_fee > 10000000) {
            revert InvalidFeePercentage();
        }
        emit PlatformFeeChanged(platformFee, _fee);
        platformFee = _fee;
    }

    /**
     * @dev Only Owner function for setting platform fee
     * @param _platformWallet New native token wallet which will receive fees
     */
    function setPlatformWallet(
        address payable _platformWallet
    ) external onlyOwner {
        emit PlatformWalletChanged(platformWallet, _platformWallet);
        platformWallet = _platformWallet;
    }
}
