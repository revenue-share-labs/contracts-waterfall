// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

interface IFeeFactory {
    function platformWallet() external returns (address payable);
}
