// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {PolkaStream} from "contracts/PolkaStream.sol";
import {PolkaStreamServicePlanRegistry} from "contracts/PolkaStreamServicePlanRegistry.sol";
import {IXcmNotifier} from "contracts/interfaces/IXcmNotifier.sol";

contract ServicePlanMockERC20 is ERC20 {
    constructor() ERC20("Service USD", "sUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract ServicePlanMockNotifier is IXcmNotifier {
    function notifyWithdraw(
        uint256,
        uint256,
        address,
        address,
        uint256,
        bytes32
    ) external pure returns (bool) {
        return true;
    }

    function isHealthy() external pure returns (bool) {
        return true;
    }

    function xcmPrecompile() external pure returns (address) {
        return address(0xA0000);
    }
}

contract PolkaStreamServicePlanRegistryTest is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA12);

    uint256 internal constant DECIMALS = 1e18;

    PolkaStream internal polkaStream;
    PolkaStreamServicePlanRegistry internal registry;
    ServicePlanMockERC20 internal token;

    function setUp() external {
        vm.warp(1_000_000);

        polkaStream = new PolkaStream(address(new ServicePlanMockNotifier()), 365 days, 1_000_000 * DECIMALS);
        registry = new PolkaStreamServicePlanRegistry();
        token = new ServicePlanMockERC20();

        polkaStream.setTokenAllowlist(address(token), true);
        polkaStream.setServicePlanRegistry(address(registry));

        token.mint(ALICE, 1_000_000 * DECIMALS);
        vm.prank(ALICE);
        token.approve(address(polkaStream), type(uint256).max);
    }

    function testCreatePendingStreamFromPlanBindsProviderTermsAndTrigger() external {
        bytes32 termsHash = keccak256("gpu-plan-v1");

        vm.prank(BOB);
        uint256 planId = registry.createServicePlan(
            address(token),
            100 * DECIMALS,
            1_000 * DECIMALS,
            100,
            1_000,
            30,
            3_600,
            uint8(PolkaStream.TriggerPolicy.RECEIVER_ONLY),
            address(0),
            termsHash
        );

        uint256 beforeCreate = block.timestamp;
        vm.prank(ALICE);
        uint256 streamId = polkaStream.createPendingStreamFromPlan(planId, 250 * DECIMALS, 300, keccak256("order-1"));

        (address tokenAddr, PolkaStream.Stream memory streamData) = polkaStream.getStream(streamId);
        assertEq(tokenAddr, address(token), "token mismatch");
        assertEq(streamData.sender, ALICE, "sender mismatch");
        assertEq(streamData.receiver, BOB, "provider should be receiver");
        assertEq(streamData.deposit, 250 * DECIMALS, "deposit mismatch");
        assertEq(streamData.startTime, 0, "pending stream should not start yet");

        (
            PolkaStream.StreamStatus status,
            PolkaStream.TriggerPolicy triggerPolicy,
            uint256 createdAt,
            uint256 activatedAt,
            uint256 activationDeadline,
            address authorizedActivator,
            bytes32 serviceRef,
            bool senderConfirmed,
            bool receiverConfirmed
        ) = polkaStream.getStreamCommercialState(streamId);

        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.PENDING), "status mismatch");
        assertEq(uint256(triggerPolicy), uint256(PolkaStream.TriggerPolicy.RECEIVER_ONLY), "trigger policy mismatch");
        assertEq(createdAt, beforeCreate, "createdAt mismatch");
        assertEq(activatedAt, 0, "activatedAt should be zero while pending");
        assertEq(activationDeadline, beforeCreate + 3_600, "activation deadline mismatch");
        assertEq(authorizedActivator, address(0), "unexpected operator");
        assertEq(serviceRef, keccak256("order-1"), "serviceRef mismatch");
        assertFalse(senderConfirmed, "sender should not be confirmed");
        assertFalse(receiverConfirmed, "receiver should not be confirmed");

        (uint256 boundPlanId, bytes32 boundTermsHash) = polkaStream.getStreamPlanBinding(streamId);
        assertEq(boundPlanId, planId, "bound plan mismatch");
        assertEq(boundTermsHash, termsHash, "bound terms hash mismatch");

        vm.prank(BOB);
        polkaStream.activateStream(streamId);

        (PolkaStream.StreamStatus activeStatus,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(activeStatus), uint256(PolkaStream.StreamStatus.ACTIVE), "stream should activate");
    }

    function testCreatePendingStreamFromPlanRejectsOutOfRangeValues() external {
        vm.prank(BOB);
        uint256 planId = registry.createServicePlan(
            address(token),
            100 * DECIMALS,
            500 * DECIMALS,
            100,
            600,
            0,
            0,
            uint8(PolkaStream.TriggerPolicy.SENDER_ONLY),
            address(0),
            keccak256("bounds")
        );

        vm.prank(ALICE);
        vm.expectRevert(bytes("PLAN_DEPOSIT_OUT_OF_RANGE"));
        polkaStream.createPendingStreamFromPlan(planId, 50 * DECIMALS, 300, keccak256("too-small-deposit"));

        vm.prank(ALICE);
        vm.expectRevert(bytes("PLAN_DURATION_OUT_OF_RANGE"));
        polkaStream.createPendingStreamFromPlan(planId, 200 * DECIMALS, 999, keccak256("too-long-duration"));
    }

    function testInactivePlanCannotBeUsed() external {
        vm.prank(BOB);
        uint256 planId = registry.createServicePlan(
            address(token),
            100 * DECIMALS,
            500 * DECIMALS,
            100,
            600,
            0,
            0,
            uint8(PolkaStream.TriggerPolicy.SENDER_ONLY),
            address(0),
            keccak256("inactive")
        );

        vm.prank(BOB);
        registry.setServicePlanActive(planId, false);

        vm.prank(ALICE);
        vm.expectRevert(bytes("PLAN_INACTIVE"));
        polkaStream.createPendingStreamFromPlan(planId, 200 * DECIMALS, 300, keccak256("inactive-plan"));
    }

    function testAuthorizedOperatorPlanRequiresConfiguredActivator() external {
        vm.prank(BOB);
        uint256 planId = registry.createServicePlan(
            address(token),
            100 * DECIMALS,
            1_000 * DECIMALS,
            100,
            1_000,
            0,
            600,
            uint8(PolkaStream.TriggerPolicy.AUTHORIZED_OPERATOR),
            CAROL,
            keccak256("operator-plan")
        );

        vm.prank(ALICE);
        uint256 streamId = polkaStream.createPendingStreamFromPlan(planId, 200 * DECIMALS, 300, keccak256("operator-order"));

        vm.prank(BOB);
        vm.expectRevert(bytes("ACTIVATION_NOT_ALLOWED"));
        polkaStream.activateStream(streamId);

        vm.prank(CAROL);
        polkaStream.activateStream(streamId);

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.ACTIVE), "operator should activate plan-bound stream");
    }

    function testOnlyProviderCanUpdatePlan() external {
        vm.prank(BOB);
        uint256 planId = registry.createServicePlan(
            address(token),
            100 * DECIMALS,
            500 * DECIMALS,
            100,
            600,
            0,
            0,
            uint8(PolkaStream.TriggerPolicy.SENDER_ONLY),
            address(0),
            keccak256("plan")
        );

        vm.prank(ALICE);
        vm.expectRevert(bytes("ONLY_PROVIDER"));
        registry.setServicePlanActive(planId, false);
    }
}
