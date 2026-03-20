// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IPolkaStreamServicePlanRegistry} from "./interfaces/IPolkaStreamServicePlanRegistry.sol";

/// @title PolkaStreamServicePlanRegistry
/// @notice Provider-owned service plan registry for commercial pending streams.
contract PolkaStreamServicePlanRegistry is IPolkaStreamServicePlanRegistry {
    uint8 private constant TRIGGER_POLICY_SENDER_ONLY = 1;
    uint8 private constant TRIGGER_POLICY_RECEIVER_ONLY = 2;
    uint8 private constant TRIGGER_POLICY_EITHER_PARTY = 3;
    uint8 private constant TRIGGER_POLICY_BOTH_PARTIES = 4;
    uint8 private constant TRIGGER_POLICY_AUTHORIZED_OPERATOR = 5;

    uint256 public nextPlanId = 1;

    struct ServicePlan {
        address provider;
        address token;
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 minDuration;
        uint256 maxDuration;
        uint256 cliffInSeconds;
        uint256 activationWindow;
        uint8 triggerPolicy;
        address authorizedActivator;
        bytes32 termsHash;
        bool isActive;
    }

    mapping(uint256 => ServicePlan) private servicePlans;
    mapping(address => uint256[]) private providerPlanIds;

    event ServicePlanCreated(
        uint256 indexed planId,
        address indexed provider,
        address indexed token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 minDuration,
        uint256 maxDuration,
        uint256 cliffInSeconds,
        uint256 activationWindow,
        uint8 triggerPolicy,
        address authorizedActivator,
        bytes32 termsHash
    );

    event ServicePlanUpdated(
        uint256 indexed planId,
        address indexed provider,
        address indexed token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 minDuration,
        uint256 maxDuration,
        uint256 cliffInSeconds,
        uint256 activationWindow,
        uint8 triggerPolicy,
        address authorizedActivator,
        bytes32 termsHash
    );

    event ServicePlanStatusUpdated(uint256 indexed planId, address indexed provider, bool indexed isActive);

    function createServicePlan(
        address token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 minDuration,
        uint256 maxDuration,
        uint256 cliffInSeconds,
        uint256 activationWindow,
        uint8 triggerPolicy,
        address authorizedActivator,
        bytes32 termsHash
    ) external returns (uint256 planId) {
        _validatePlan(token, minDeposit, maxDeposit, minDuration, maxDuration, triggerPolicy, authorizedActivator);

        planId = nextPlanId;
        nextPlanId = planId + 1;

        servicePlans[planId] = ServicePlan({
            provider: msg.sender,
            token: token,
            minDeposit: minDeposit,
            maxDeposit: maxDeposit,
            minDuration: minDuration,
            maxDuration: maxDuration,
            cliffInSeconds: cliffInSeconds,
            activationWindow: activationWindow,
            triggerPolicy: triggerPolicy,
            authorizedActivator: authorizedActivator,
            termsHash: termsHash,
            isActive: true
        });

        providerPlanIds[msg.sender].push(planId);

        emit ServicePlanCreated(
            planId,
            msg.sender,
            token,
            minDeposit,
            maxDeposit,
            minDuration,
            maxDuration,
            cliffInSeconds,
            activationWindow,
            triggerPolicy,
            authorizedActivator,
            termsHash
        );
    }

    function updateServicePlan(
        uint256 planId,
        address token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 minDuration,
        uint256 maxDuration,
        uint256 cliffInSeconds,
        uint256 activationWindow,
        uint8 triggerPolicy,
        address authorizedActivator,
        bytes32 termsHash
    ) external {
        ServicePlan storage plan = servicePlans[planId];
        require(plan.provider != address(0), "PLAN_NOT_FOUND");
        require(plan.provider == msg.sender, "ONLY_PROVIDER");

        _validatePlan(token, minDeposit, maxDeposit, minDuration, maxDuration, triggerPolicy, authorizedActivator);

        plan.token = token;
        plan.minDeposit = minDeposit;
        plan.maxDeposit = maxDeposit;
        plan.minDuration = minDuration;
        plan.maxDuration = maxDuration;
        plan.cliffInSeconds = cliffInSeconds;
        plan.activationWindow = activationWindow;
        plan.triggerPolicy = triggerPolicy;
        plan.authorizedActivator = authorizedActivator;
        plan.termsHash = termsHash;

        emit ServicePlanUpdated(
            planId,
            msg.sender,
            token,
            minDeposit,
            maxDeposit,
            minDuration,
            maxDuration,
            cliffInSeconds,
            activationWindow,
            triggerPolicy,
            authorizedActivator,
            termsHash
        );
    }

    function setServicePlanActive(uint256 planId, bool isActive) external {
        ServicePlan storage plan = servicePlans[planId];
        require(plan.provider != address(0), "PLAN_NOT_FOUND");
        require(plan.provider == msg.sender, "ONLY_PROVIDER");

        plan.isActive = isActive;
        emit ServicePlanStatusUpdated(planId, msg.sender, isActive);
    }

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
        )
    {
        ServicePlan storage plan = servicePlans[planId];
        require(plan.provider != address(0), "PLAN_NOT_FOUND");

        return (
            plan.provider,
            plan.token,
            plan.minDeposit,
            plan.maxDeposit,
            plan.minDuration,
            plan.maxDuration,
            plan.cliffInSeconds,
            plan.activationWindow,
            plan.triggerPolicy,
            plan.authorizedActivator,
            plan.termsHash,
            plan.isActive
        );
    }

    function getProviderPlans(address provider) external view returns (uint256[] memory) {
        return providerPlanIds[provider];
    }

    function _validatePlan(
        address token,
        uint256 minDeposit,
        uint256 maxDeposit,
        uint256 minDuration,
        uint256 maxDuration,
        uint8 triggerPolicy,
        address authorizedActivator
    ) internal pure {
        require(token != address(0), "INVALID_TOKEN");
        require(minDeposit > 0, "INVALID_MIN_DEPOSIT");
        require(maxDeposit >= minDeposit, "INVALID_DEPOSIT_RANGE");
        require(minDuration > 0, "INVALID_MIN_DURATION");
        require(maxDuration >= minDuration, "INVALID_DURATION_RANGE");
        require(
            triggerPolicy >= TRIGGER_POLICY_SENDER_ONLY && triggerPolicy <= TRIGGER_POLICY_AUTHORIZED_OPERATOR,
            "INVALID_TRIGGER_POLICY"
        );

        if (triggerPolicy == TRIGGER_POLICY_AUTHORIZED_OPERATOR) {
            require(authorizedActivator != address(0), "INVALID_ACTIVATOR");
        } else {
            require(authorizedActivator == address(0), "UNEXPECTED_ACTIVATOR");
        }
    }
}
