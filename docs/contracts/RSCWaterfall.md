# RSCWaterfall

## Contract Description


License: MIT

## Events info

### ControllerChanged event

```solidity
event ControllerChanged(address oldController, address newController);
```

### CurrentRecipientChanged event

```solidity
event CurrentRecipientChanged(address oldRecipient, address newRecipient);
```

### DistributeToken event

```solidity
event DistributeToken(address token, uint256 amount);
```

### DistributorChanged event

```solidity
event DistributorChanged(address distributor, bool isDistributor);
```

### Initialized event

```solidity
event Initialized(uint8 version);
```


Triggered when the contract has been initialized or reinitialized.

### OwnershipTransferred event

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

### SetRecipients event

```solidity
event SetRecipients(address[] recipients, uint256[] maxCaps, uint256[] priorities);
```

### TokenPriceFeedSet event

```solidity
event TokenPriceFeedSet(address token, address priceFeed);
```

## Errors info

### ControllerAlreadyConfiguredError error

```solidity
error ControllerAlreadyConfiguredError();
```

### ImmutableControllerError error

```solidity
error ImmutableControllerError();
```

### InconsistentDataLengthError error

```solidity
error InconsistentDataLengthError();
```

### NullAddressRecipientError error

```solidity
error NullAddressRecipientError();
```

### OnlyControllerError error

```solidity
error OnlyControllerError();
```

### OnlyDistributorError error

```solidity
error OnlyDistributorError();
```

### RecipientAlreadyAddedError error

```solidity
error RecipientAlreadyAddedError();
```

### RecipientIsCurrentRecipientError error

```solidity
error RecipientIsCurrentRecipientError();
```

### TokenMissingNativeTokenPriceOracle error

```solidity
error TokenMissingNativeTokenPriceOracle();
```

### TransferFailedError error

```solidity
error TransferFailedError();
```

## Functions info

### autoNativeTokenDistribution (0x7a904507)

```solidity
function autoNativeTokenDistribution() external view returns (bool);
```

### controller (0xf77c4791)

```solidity
function controller() external view returns (address);
```

### currentRecipient (0x532ccada)

```solidity
function currentRecipient() external view returns (address);
```

### distributors (0xcc642784)

```solidity
function distributors(address) external view returns (bool);
```

### factory (0xc45a0155)

```solidity
function factory() external view returns (address);
```

### immutableController (0x6e4b769a)

```solidity
function immutableController() external view returns (bool);
```

### initialize (0xc67c9798)

```solidity
function initialize(
	tuple _settings,
	address[] _initialRecipients,
	uint256[] _maxCaps,
	uint256[] _priorities
) external;
```


Constructor function, can be called only once


Parameters:

| Name               | Type      | Description                                              |
| :----------------- | :-------- | :------------------------------------------------------- |
| _settings          | tuple     | Contract settings, check InitContractSetting struct      |
| _initialRecipients | address[] | Addresses to be added as a initial recipients            |
| _maxCaps           | uint256[] | Maximum amount recipient will receive                    |
| _priorities        | uint256[] | Priority when recipient is going to be current recipient |

### minAutoDistributionAmount (0x478f425a)

```solidity
function minAutoDistributionAmount() external view returns (uint256);
```

### numberOfRecipients (0xee0e01c7)

```solidity
function numberOfRecipients() external view returns (uint256);
```


External function to return number of recipients

### owner (0x8da5cb5b)

```solidity
function owner() external view returns (address);
```


Returns the address of the current owner.

### platformFee (0x26232a2e)

```solidity
function platformFee() external view returns (uint256);
```

### recipients (0xd1bc76a1)

```solidity
function recipients(uint256) external view returns (address);
```

### recipientsData (0x1dad4d98)

```solidity
function recipientsData(
	address
) external view returns (uint256 received, uint256 maxCap, uint256 priority);
```

### redistributeNativeToken (0x6194e63c)

```solidity
function redistributeNativeToken() external;
```


External function to redistribute native token based on waterfall rules

### redistributeToken (0xf4d3bdec)

```solidity
function redistributeToken(address _token) external;
```


External function to redistribute ERC20 token based on waterfall rules


Parameters:

| Name   | Type    | Description                        |
| :----- | :------ | :--------------------------------- |
| _token | address | address of token to be distributed |

### renounceOwnership (0x715018a6)

```solidity
function renounceOwnership() external;
```


Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.

### setController (0x92eefe9b)

```solidity
function setController(address _controller) external;
```


External function to set controller address, if set to address(0), unable to change it


Parameters:

| Name        | Type    | Description               |
| :---------- | :------ | :------------------------ |
| _controller | address | address of new controller |

### setDistributor (0xd59ba0df)

```solidity
function setDistributor(address _distributor, bool _isDistributor) external;
```


External function to set distributor address


Parameters:

| Name           | Type    | Description                                            |
| :------------- | :------ | :----------------------------------------------------- |
| _distributor   | address | address of new distributor                             |
| _isDistributor | bool    | bool indicating whether address is / isn't distributor |

### setRecipients (0xcc3d56e1)

```solidity
function setRecipients(
	address[] _newRecipients,
	uint256[] _maxCaps,
	uint256[] _priorities
) external;
```


External function for setting recipients


Parameters:

| Name           | Type      | Description                                              |
| :------------- | :-------- | :------------------------------------------------------- |
| _newRecipients | address[] | Addresses to be added                                    |
| _maxCaps       | uint256[] | Maximum amount recipient will receive                    |
| _priorities    | uint256[] | Priority when recipient is going to be current recipient |

### setTokenNativeTokenPriceFeed (0x6b55f4f3)

```solidity
function setTokenNativeTokenPriceFeed(address _token, address _priceFeed) external;
```


External function for setting price feed oracle for token


Parameters:

| Name       | Type    | Description                                        |
| :--------- | :------ | :------------------------------------------------- |
| _token     | address | address of token                                   |
| _priceFeed | address | address of Native token price feed for given token |

### transferOwnership (0xf2fde38b)

```solidity
function transferOwnership(address newOwner) external;
```


Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.
