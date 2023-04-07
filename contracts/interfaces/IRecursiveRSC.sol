// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IRecursiveRSC {
    function distributors(address _distributor) external returns (bool);

    function redistributeToken(address _token) external;

    function redistributeNativeToken() external;

    function autoNativeTokenDistribution() external returns (bool);
}
