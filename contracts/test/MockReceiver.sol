// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

error CantAcceptEtherDirectly();

contract MockReceiver {
    receive() external payable {
        revert CantAcceptEtherDirectly();
    }

    constructor() {}
}
