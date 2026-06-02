// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockGMX {
    int256 public shortPosition;

    event OrderCreated(int256 sizeChange);
    event OrderFilled(int256 newShortPosition);

    function createOrder(int256 sizeChange) external {
        shortPosition += sizeChange;

        emit OrderCreated(sizeChange);
        emit OrderFilled(shortPosition);
    }
}
