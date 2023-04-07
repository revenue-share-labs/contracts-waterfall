// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

contract UsdPriceFeedMock {
    function latestRoundData()
        external
        pure
        returns (uint80, int256, uint256, uint256, uint80)
    {
        uint80 roundId = 10;
        int256 answer = 1000 * 1e8; // 132607070000
        uint256 startedAt = 0;
        uint256 updatedAt = 0;
        uint80 answeredInRound = 0;
        return (roundId, answer, startedAt, updatedAt, answeredInRound);
    }
}
