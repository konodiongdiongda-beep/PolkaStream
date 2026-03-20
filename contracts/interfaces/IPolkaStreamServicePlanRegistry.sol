// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IPolkaStreamServicePlanRegistry {
    function getPlan(uint256 planId)
        external
        view
        returns (
            address provider,
            address token,
            uint256 minDeposit,
            uint256 maxDeposit,
            uint256 minDuration,
            uint256 maxDuration,
            uint256 cliffInSeconds,
            uint256 activationWindow,
            uint8 triggerPolicy,
            address authorizedActivator,
            bytes32 termsHash,
            bool isActive
        );

    function getProviderPlans(address provider) external view returns (uint256[] memory);
}
