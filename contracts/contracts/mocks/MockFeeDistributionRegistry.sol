// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockFeeDistributionRegistry {
    address public activeDistributor;

    function setActiveDistributor(address distributor) external {
        activeDistributor = distributor;
    }

    function isActiveDistributor(address distributor) external view returns (bool) {
        return distributor != address(0) && distributor == activeDistributor;
    }
}
