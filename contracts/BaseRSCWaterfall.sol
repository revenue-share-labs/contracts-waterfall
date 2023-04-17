// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IFeeFactory.sol";
import "./interfaces/IRecursiveRSC.sol";

// Throw when if sender is not distributor
error OnlyDistributorError();

// Throw when sender is not controller
error OnlyControllerError();

// Throw when transaction fails
error TransferFailedError();

// Throw when submitted recipient with address(0)
error NullAddressRecipientError();

// Throw if recipient which is being added is current recipient
error RecipientIsCurrentRecipientError();

// Throw when arrays are submit without same length
error InconsistentDataLengthError();

// Throw when distributor address is same as submit one
error ControllerAlreadyConfiguredError();

// Throw when change is triggered for immutable controller
error ImmutableControllerError();

// Throw if recipient is already in the recipients pool
error RecipientAlreadyAddedError();

abstract contract BaseRSCWaterfall is OwnableUpgradeable {
    mapping(address => bool) public distributors;
    address public controller;
    bool public immutableController;
    bool public autoNativeTokenDistribution;
    uint256 public minAutoDistributionAmount;
    uint256 public platformFee;
    IFeeFactory public factory;

    address payable public currentRecipient;

    struct RecipientData {
        uint256 received; // Either USD for RSCWaterfallUsd or native token for RSCWaterfall
        uint256 maxCap;
        uint256 priority;
    }

    mapping(address => RecipientData) public recipientsData;
    address payable[] public recipients;

    struct InitContractSetting {
        address owner;
        address[] _distributors;
        address controller;
        bool immutableController;
        bool autoNativeTokenDistribution;
        uint256 minAutoDistributionAmount;
        uint256 platformFee;
        address factoryAddress;
        address[] supportedErc20addresses;
        address[] erc20PriceFeeds;
    }

    event SetRecipients(
        address payable[] recipients,
        uint256[] maxCaps,
        uint256[] priorities
    );
    event DistributeToken(address token, uint256 amount);
    event DistributorChanged(address distributor, bool isDistributor);
    event ControllerChanged(address oldController, address newController);
    event CurrentRecipientChanged(address oldRecipient, address newRecipient);

    /**
     * @dev Throws if sender is not distributor
     */
    modifier onlyDistributor() {
        if (distributors[msg.sender] == false) {
            revert OnlyDistributorError();
        }
        _;
    }

    /**
     * @dev Checks whether sender is controller
     */
    modifier onlyController() {
        if (msg.sender != controller) {
            revert OnlyControllerError();
        }
        _;
    }

    fallback() external payable {
        // Check whether automatic native token distribution is enabled
        // and that contractBalance is more than automatic distribution trash hold
        uint256 contractBalance = address(this).balance;
        if (autoNativeTokenDistribution && contractBalance >= minAutoDistributionAmount) {
            _redistributeNativeToken(contractBalance, false);
        }
    }

    receive() external payable {
        // Check whether automatic native token distribution is enabled
        // and that contractBalance + msg.value is more than automatic distribution trash hold
        uint256 contractBalance = address(this).balance;
        if (autoNativeTokenDistribution && contractBalance >= minAutoDistributionAmount) {
            _redistributeNativeToken(contractBalance, false);
        }
    }

    /**
     * @notice Internal function to redistribute native token based on waterfall rules
     * @param _valueToDistribute native token amount to be distribute
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeNativeToken(
        uint256 _valueToDistribute,
        bool _recursive
    ) internal virtual {}

    /**
     * @notice External function to redistribute native token based on waterfall rules
     */
    function redistributeNativeToken() external onlyDistributor {
        uint256 balance = address(this).balance;
        if (balance == 0) {
            // Nothing to distribute
            return;
        }
        _redistributeNativeToken(balance, false);
    }

    /**
     * @notice External function to return number of recipients
     */
    function numberOfRecipients() external view returns (uint256) {
        return recipients.length;
    }

    /**
     * @notice Internal function to redistribute ERC20 token based on waterfall rules
     * @param _token address of token to be distributed
     * @param _recursive When recursive is True we don't charge additional fee
     */
    function _redistributeToken(address _token, bool _recursive) internal virtual {}

    /**
     * @notice External function to redistribute ERC20 token based on waterfall rules
     * @param _token address of token to be distributed
     */
    function redistributeToken(address _token) external onlyDistributor {
        _redistributeToken(_token, false);
    }

    /**
     * @notice Internal function to set current recipient
     * Set currentRecipient to one of the addresses from recipients based on highest priority.
     */
    function _setCurrentRecipient() internal {
        uint256 highestPriority;
        address highestPriorityAddress;

        uint256 recipientsLength = recipients.length;

        // Search for highest priority address
        for (uint256 i = 0; i < recipientsLength; ) {
            address recipient = recipients[i];
            RecipientData memory recipientData = recipientsData[recipient];

            if (recipientData.priority > highestPriority || highestPriority == 0) {
                highestPriority = recipientData.priority;
                highestPriorityAddress = recipient;
            }
            unchecked {
                i++;
            }
        }

        // Remove highestPriorityAddress from the recipients list
        for (uint256 i = 0; i < recipientsLength; ) {
            if (recipients[i] == highestPriorityAddress) {
                recipients[i] = recipients[recipientsLength - 1];
                recipients.pop();
                break;
            }
            unchecked {
                i++;
            }
        }

        // remove currentRecipient data
        delete recipientsData[currentRecipient];
        emit CurrentRecipientChanged(currentRecipient, highestPriorityAddress);
        currentRecipient = payable(highestPriorityAddress);
    }

    /**
     * @notice Internal function enable adding new recipient.
     * @param _recipient New recipient address to be added
     * @param _maxCap max cap of new recipient provided in USD
     * @param _priority Priority of the recipient
     */
    function _addRecipient(
        address payable _recipient,
        uint256 _maxCap,
        uint256 _priority
    ) internal {
        if (_recipient == address(0)) {
            revert NullAddressRecipientError();
        } else if (_recipient == currentRecipient) {
            revert RecipientIsCurrentRecipientError();
        } else if (recipientsData[_recipient].maxCap > 0) {
            revert RecipientAlreadyAddedError();
        }

        recipients.push(_recipient);
        recipientsData[_recipient] = RecipientData(0, _maxCap, _priority);
    }

    /**
     * @notice Internal function for setting recipients
     * @param _newRecipients Recipient addresses to be added
     * @param _maxCaps List of maxCaps for recipients
     * @param _priorities List of recipients priorities
     */
    function _setRecipients(
        address payable[] memory _newRecipients,
        uint256[] memory _maxCaps,
        uint256[] memory _priorities
    ) internal {
        uint256 newRecipientsLength = _newRecipients.length;

        if (
            newRecipientsLength != _maxCaps.length ||
            newRecipientsLength != _priorities.length
        ) {
            revert InconsistentDataLengthError();
        }

        _removeAll();

        for (uint256 i = 0; i < newRecipientsLength; ) {
            _addRecipient(_newRecipients[i], _maxCaps[i], _priorities[i]);
            unchecked {
                i++;
            }
        }

        // If there is not any currentRecipient choose one
        if (currentRecipient == address(0)) {
            _setCurrentRecipient();
        }

        emit SetRecipients(_newRecipients, _maxCaps, _priorities);
    }

    /**
     * @notice External function for setting recipients
     * @param _newRecipients Addresses to be added
     * @param _maxCaps Maximum amount recipient will receive
     * @param _priorities Priority when recipient is going to be current recipient
     */
    function setRecipients(
        address payable[] memory _newRecipients,
        uint256[] memory _maxCaps,
        uint256[] memory _priorities
    ) public onlyController {
        _setRecipients(_newRecipients, _maxCaps, _priorities);
    }

    /**
     * @notice function for removing all recipients
     */
    function _removeAll() internal {
        uint256 recipientsLength = recipients.length;

        if (recipientsLength == 0) {
            return;
        }

        for (uint256 i = 0; i < recipientsLength; ) {
            address recipient = recipients[i];
            delete recipientsData[recipient];
            unchecked {
                i++;
            }
        }
        delete recipients;
    }

    /**
     * @notice External function to set distributor address
     * @param _distributor address of new distributor
     * @param _isDistributor bool indicating whether address is / isn't distributor
     */
    function setDistributor(
        address _distributor,
        bool _isDistributor
    ) external onlyOwner {
        emit DistributorChanged(_distributor, _isDistributor);
        distributors[_distributor] = _isDistributor;
    }

    /**
     * @notice External function to set controller address, if set to address(0), unable to change it
     * @param _controller address of new controller
     */
    function setController(address _controller) external onlyOwner {
        if (controller == address(0) || immutableController) {
            revert ImmutableControllerError();
        }
        if (_controller == controller) {
            revert ControllerAlreadyConfiguredError();
        }
        emit ControllerChanged(controller, _controller);
        controller = _controller;
    }

    /**
     * @notice Internal function to check whether recipient should be recursively distributed
     * @param _recipient Address of recipient to recursively distribute
     * @param _token token to be distributed
     */
    function _recursiveERC20Distribution(address _recipient, address _token) internal {
        // Handle Recursive token distribution
        IRecursiveRSC recursiveRecipient = IRecursiveRSC(_recipient);

        // Wallets have size 0 and contracts > 0. This way we can distinguish them.
        uint256 recipientSize;
        assembly {
            recipientSize := extcodesize(_recipient)
        }
        if (recipientSize > 0) {
            // Validate this contract is distributor in child recipient
            try recursiveRecipient.distributors(address(this)) returns (
                bool isBranchDistributor
            ) {
                if (isBranchDistributor) {
                    recursiveRecipient.redistributeToken(_token);
                }
            } catch {
                return;
            } // unable to recursively distribute
        }
    }

    /**
     * @notice Internal function to check whether recipient should be recursively distributed
     * @param _recipient Address of recipient to recursively distribute
     */
    function _recursiveNativeTokenDistribution(address _recipient) internal {
        // Handle Recursive token distribution
        IRecursiveRSC recursiveRecipient = IRecursiveRSC(_recipient);

        // Wallets have size 0 and contracts > 0. This way we can distinguish them.
        uint256 recipientSize;
        assembly {
            recipientSize := extcodesize(_recipient)
        }
        if (recipientSize > 0) {
            // Check whether child recipient have autoNativeTokenDistribution set to true,
            // if yes tokens will be recursively distributed automatically
            try recursiveRecipient.autoNativeTokenDistribution() returns (
                bool childAutoNativeTokenDistribution
            ) {
                if (childAutoNativeTokenDistribution == true) {
                    return;
                }
            } catch {
                return;
            }

            // Validate this contract is distributor in child recipient
            try recursiveRecipient.distributors(address(this)) returns (
                bool isBranchDistributor
            ) {
                if (isBranchDistributor) {
                    recursiveRecipient.redistributeNativeToken();
                }
            } catch {
                return;
            } // unable to recursively distribute
        }
    }
}
