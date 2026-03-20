// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {IXcmNotifier} from "contracts/interfaces/IXcmNotifier.sol";
import {PolkaStream} from "contracts/PolkaStream.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockNotifier is IXcmNotifier {
    enum Mode {
        SUCCESS,
        RETURN_FALSE,
        REVERT
    }

    Mode public mode = Mode.SUCCESS;
    bool public healthy = true;

    event Notified(uint256 indexed streamId, uint256 indexed withdrawId, address receiver, uint256 amount);

    function setMode(Mode nextMode) external {
        mode = nextMode;
    }

    function setHealthy(bool nextHealthy) external {
        healthy = nextHealthy;
    }

    function notifyWithdraw(
        uint256 streamId,
        uint256 withdrawId,
        address receiver,
        address,
        uint256 amount,
        bytes32
    ) external returns (bool) {
        if (mode == Mode.REVERT) {
            revert("NOTIFY_FAILED");
        }
        if (mode == Mode.RETURN_FALSE) {
            return false;
        }

        emit Notified(streamId, withdrawId, receiver, amount);
        return true;
    }

    function isHealthy() external view returns (bool) {
        return healthy;
    }

    function xcmPrecompile() external pure returns (address) {
        return address(0xA0000);
    }
}

contract PolkaStreamTest is Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA12);

    uint256 internal constant DECIMALS = 1e18;
    uint256 internal constant MAX_DURATION = 365 days;
    uint256 internal constant MAX_DEPOSIT = 1_000_000 * DECIMALS;

    PolkaStream internal polkaStream;
    MockERC20 internal token;
    MockNotifier internal notifier;

    function setUp() external {
        vm.warp(1_000_000);

        notifier = new MockNotifier();
        polkaStream = new PolkaStream(address(notifier), MAX_DURATION, MAX_DEPOSIT);
        token = new MockERC20();

        token.mint(ALICE, 1_000_000 * DECIMALS);
        token.mint(CAROL, 1_000_000 * DECIMALS);

        polkaStream.setTokenAllowlist(address(token), true);

        vm.prank(ALICE);
        token.approve(address(polkaStream), type(uint256).max);

        vm.prank(CAROL);
        token.approve(address(polkaStream), type(uint256).max);
    }

    function testCreateAndWithdrawAfterCliff() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 10);

        vm.warp(1_000_009);
        assertEq(polkaStream.getOwed(streamId), 0, "owed should be 0 before cliff end");

        vm.warp(1_000_060);
        uint256 owed = polkaStream.getOwed(streamId);
        assertEq(owed, 500 * DECIMALS, "owed should accrue linearly after cliff");

        vm.prank(BOB);
        polkaStream.withdraw(streamId);

        assertEq(token.balanceOf(BOB), 500 * DECIMALS, "receiver should get withdrawn amount");

        (address tokenAddr, PolkaStream.Stream memory streamData) = polkaStream.getStream(streamId);
        assertEq(tokenAddr, address(token), "token mismatch");
        assertEq(streamData.withdrawnAmount, 500 * DECIMALS, "withdrawn amount mismatch");

        (PolkaStream.NotifyStatus status, uint32 attempts,) = polkaStream.getNotifyStatus(1);
        assertEq(uint256(status), uint256(PolkaStream.NotifyStatus.SUCCESS), "notify should succeed");
        assertEq(attempts, 1, "notify attempts mismatch");
    }

    function testPendingStreamDoesNotAccrueBeforeActivation() external {
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 10, block.timestamp + 1 days, PolkaStream.TriggerPolicy.SENDER_ONLY, address(0));

        vm.warp(block.timestamp + 50);
        assertEq(polkaStream.getOwed(streamId), 0, "pending stream must not accrue before activation");

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.PENDING), "stream should stay pending");
    }

    function testActivatePendingStreamStartsAccrualOnlyAfterActivationAndCliff() external {
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 20, block.timestamp + 1 days, PolkaStream.TriggerPolicy.SENDER_ONLY, address(0));

        vm.warp(block.timestamp + 30);

        vm.prank(ALICE);
        polkaStream.activateStream(streamId);

        (, PolkaStream.Stream memory streamData) = polkaStream.getStream(streamId);
        assertEq(streamData.startTime, block.timestamp + 20, "start time should be activation plus cliff");
        assertEq(polkaStream.getOwed(streamId), 0, "owed should stay 0 at activation");

        vm.warp(block.timestamp + 19);
        assertEq(polkaStream.getOwed(streamId), 0, "owed should stay 0 before cliff ends");

        vm.warp(block.timestamp + 11);
        assertEq(polkaStream.getOwed(streamId), 100 * DECIMALS, "owed should accrue after cliff");
    }

    function testCancelBeforeActivationRefundsFullDeposit() external {
        uint256 aliceBefore = token.balanceOf(ALICE);
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 0, block.timestamp + 1 days, PolkaStream.TriggerPolicy.SENDER_ONLY, address(0));

        vm.prank(ALICE);
        polkaStream.cancelBeforeActivation(streamId);

        assertEq(token.balanceOf(ALICE), aliceBefore, "sender should receive full refund after pre-activation cancel");

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.CANCELED), "stream should be canceled");
        assertEq(polkaStream.getOwed(streamId), 0, "canceled pending stream should not accrue");
    }

    function testExpirePendingStreamRefundsAfterDeadline() external {
        uint256 aliceBefore = token.balanceOf(ALICE);
        uint256 deadline = block.timestamp + 100;
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 0, deadline, PolkaStream.TriggerPolicy.SENDER_ONLY, address(0));

        vm.warp(deadline + 1);
        vm.prank(CAROL);
        polkaStream.expirePendingStream(streamId);

        assertEq(token.balanceOf(ALICE), aliceBefore, "sender should recover full deposit after expiration");

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.EXPIRED), "stream should be expired");
        assertEq(polkaStream.getOwed(streamId), 0, "expired stream should not accrue");
    }

    function testReceiverOnlyPolicyBlocksSenderAndAllowsReceiverActivation() external {
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 0, block.timestamp + 1 days, PolkaStream.TriggerPolicy.RECEIVER_ONLY, address(0));

        vm.prank(ALICE);
        vm.expectRevert(bytes("ACTIVATION_NOT_ALLOWED"));
        polkaStream.activateStream(streamId);

        vm.prank(BOB);
        polkaStream.activateStream(streamId);

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.ACTIVE), "receiver should activate receiver-only stream");
    }

    function testAuthorizedOperatorPolicyOnlyAllowsConfiguredActivator() external {
        uint256 streamId = _createPendingStream(
            1000 * DECIMALS,
            100,
            0,
            block.timestamp + 1 days,
            PolkaStream.TriggerPolicy.AUTHORIZED_OPERATOR,
            CAROL
        );

        vm.prank(ALICE);
        vm.expectRevert(bytes("ACTIVATION_NOT_ALLOWED"));
        polkaStream.activateStream(streamId);

        vm.prank(CAROL);
        polkaStream.activateStream(streamId);

        (PolkaStream.StreamStatus status,,,,,,,,) = polkaStream.getStreamCommercialState(streamId);
        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.ACTIVE), "authorized operator should activate stream");
    }

    function testBothPartiesPolicyRequiresDualConfirmation() external {
        uint256 streamId =
            _createPendingStream(1000 * DECIMALS, 100, 0, block.timestamp + 1 days, PolkaStream.TriggerPolicy.BOTH_PARTIES, address(0));

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_NOT_CONFIRMED"));
        polkaStream.activateStream(streamId);

        vm.prank(ALICE);
        polkaStream.confirmReadyBySender(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_NOT_CONFIRMED"));
        polkaStream.activateStream(streamId);

        vm.prank(BOB);
        polkaStream.confirmReadyByReceiver(streamId);

        vm.prank(ALICE);
        polkaStream.activateStream(streamId);

        (
            PolkaStream.StreamStatus status,
            ,
            ,
            uint256 activatedAt,
            ,
            ,
            ,
            bool senderConfirmed,
            bool receiverConfirmed
        ) = polkaStream.getStreamCommercialState(streamId);

        assertEq(uint256(status), uint256(PolkaStream.StreamStatus.ACTIVE), "both-party stream should activate");
        assertGt(activatedAt, 0, "activation timestamp should be recorded");
        assertTrue(senderConfirmed, "sender confirmation should persist");
        assertTrue(receiverConfirmed, "receiver confirmation should persist");
    }

    function testWithdrawKeepsTransferWhenNotifyFailsByDefault() external {
        notifier.setMode(MockNotifier.Mode.REVERT);
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.warp(1_000_050);

        vm.prank(BOB);
        polkaStream.withdraw(streamId);

        assertEq(token.balanceOf(BOB), 500 * DECIMALS, "withdraw should not rollback by default");

        (PolkaStream.NotifyStatus status, uint32 attempts,) = polkaStream.getNotifyStatus(1);
        assertEq(uint256(status), uint256(PolkaStream.NotifyStatus.FAILED), "notify status mismatch");
        assertEq(attempts, 1, "attempt count mismatch");
    }

    function testWithdrawRevertsWhenStrictXcmEnabledAndNotifyFails() external {
        notifier.setMode(MockNotifier.Mode.RETURN_FALSE);
        polkaStream.setStrictXcm(true);

        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);
        vm.warp(1_000_050);

        vm.prank(BOB);
        vm.expectRevert(bytes("XCM_NOTIFY_FAILED"));
        polkaStream.withdraw(streamId);

        assertEq(token.balanceOf(BOB), 0, "receiver balance must stay unchanged");
        assertEq(polkaStream.getOwed(streamId), 500 * DECIMALS, "owed should remain claimable");
    }

    function testRetryNotifyIsIdempotent() external {
        notifier.setMode(MockNotifier.Mode.RETURN_FALSE);
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);
        vm.warp(1_000_050);

        vm.prank(BOB);
        polkaStream.withdraw(streamId);

        (PolkaStream.NotifyStatus statusBefore, uint32 attemptsBefore,) = polkaStream.getNotifyStatus(1);
        assertEq(uint256(statusBefore), uint256(PolkaStream.NotifyStatus.FAILED), "initial notify status");
        assertEq(attemptsBefore, 1, "initial attempts");

        notifier.setMode(MockNotifier.Mode.SUCCESS);
        polkaStream.retryNotify(streamId, 1);

        (PolkaStream.NotifyStatus statusAfter, uint32 attemptsAfter,) = polkaStream.getNotifyStatus(1);
        assertEq(uint256(statusAfter), uint256(PolkaStream.NotifyStatus.SUCCESS), "retry should succeed");
        assertEq(attemptsAfter, 2, "attempts should increase after retry");

        // idempotent: success 后重复调用不会改变 attempts
        polkaStream.retryNotify(streamId, 1);
        (, uint32 attemptsFinal,) = polkaStream.getNotifyStatus(1);
        assertEq(attemptsFinal, 2, "attempts must stay unchanged after successful status");
    }

    function testPauseResumeStopsAccrual() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.warp(1_000_040);
        assertEq(polkaStream.getOwed(streamId), 400 * DECIMALS, "owed before pause incorrect");

        vm.prank(ALICE);
        polkaStream.pauseStream(streamId);

        vm.warp(1_000_080);
        assertEq(polkaStream.getOwed(streamId), 400 * DECIMALS, "owed should not change while paused");

        vm.prank(ALICE);
        polkaStream.resumeStream(streamId);

        vm.warp(1_000_100);
        assertEq(polkaStream.getOwed(streamId), 600 * DECIMALS, "owed after resume incorrect");
    }

    function testCancelStreamSplitsPayoutAndRefund() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.warp(1_000_030);

        uint256 aliceBefore = token.balanceOf(ALICE);
        uint256 bobBefore = token.balanceOf(BOB);

        vm.prank(ALICE);
        polkaStream.cancelStream(streamId);

        uint256 aliceAfter = token.balanceOf(ALICE);
        uint256 bobAfter = token.balanceOf(BOB);

        assertEq(bobAfter - bobBefore, 300 * DECIMALS, "receiver payout mismatch");
        assertEq(aliceAfter - aliceBefore, 700 * DECIMALS, "sender refund mismatch");
        assertEq(polkaStream.getOwed(streamId), 0, "owed should be 0 after cancel settlement");
    }

    function testCreateStreamRequiresTokenAllowlist() external {
        MockERC20 anotherToken = new MockERC20();
        anotherToken.mint(ALICE, 1_000 * DECIMALS);

        vm.prank(ALICE);
        anotherToken.approve(address(polkaStream), type(uint256).max);

        vm.prank(ALICE);
        vm.expectRevert(bytes("TOKEN_NOT_ALLOWED"));
        polkaStream.createStream(BOB, 100 * DECIMALS, 100, 0, address(anotherToken));
    }

    function testCreateStreamRespectsMaxDurationAndMaxDeposit() external {
        polkaStream.setMaxDuration(100);
        polkaStream.setMaxDepositPerStream(500 * DECIMALS);

        vm.prank(ALICE);
        vm.expectRevert(bytes("DURATION_TOO_LONG"));
        polkaStream.createStream(BOB, 100 * DECIMALS, 101, 0, address(token));

        vm.prank(ALICE);
        vm.expectRevert(bytes("DEPOSIT_TOO_LARGE"));
        polkaStream.createStream(BOB, 501 * DECIMALS, 100, 0, address(token));
    }

    function testOnlyOwnerCanSetSensitiveParams() external {
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        polkaStream.setStrictXcm(true);

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        polkaStream.setNotifier(address(0x1234));

        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", ALICE));
        polkaStream.setTokenAllowlist(address(token), false);
    }

    function testNotifierHealthReflectsAdapter() external {
        assertTrue(polkaStream.isNotifierHealthy(), "healthy notifier expected");
        notifier.setHealthy(false);
        assertFalse(polkaStream.isNotifierHealthy(), "unhealthy notifier expected");
    }

    function testSetNotifierAffectsWithdrawBehavior() external {
        MockNotifier badNotifier = new MockNotifier();
        badNotifier.setMode(MockNotifier.Mode.RETURN_FALSE);

        polkaStream.setNotifier(address(badNotifier));
        polkaStream.setStrictXcm(false);

        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);
        vm.warp(1_000_050);

        vm.prank(BOB);
        polkaStream.withdraw(streamId);

        (PolkaStream.NotifyStatus status,,) = polkaStream.getNotifyStatus(1);
        assertEq(uint256(status), uint256(PolkaStream.NotifyStatus.FAILED), "status should be failed");
    }

    function testRealtimeStopsIncreasingAfterDurationEnds() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.warp(1_000_100);
        assertEq(polkaStream.getOwed(streamId), 1000 * DECIMALS, "owed at end mismatch");

        vm.warp(1_000_500);
        assertEq(polkaStream.getOwed(streamId), 1000 * DECIMALS, "owed should cap at deposit");
    }

    function testConstructorValidationReverts() external {
        vm.expectRevert(bytes("INVALID_NOTIFIER"));
        new PolkaStream(address(0), MAX_DURATION, MAX_DEPOSIT);

        vm.expectRevert(bytes("INVALID_MAX_DURATION"));
        new PolkaStream(address(notifier), 0, MAX_DEPOSIT);

        vm.expectRevert(bytes("INVALID_MAX_DEPOSIT"));
        new PolkaStream(address(notifier), MAX_DURATION, 0);
    }

    function testCreateStreamValidationReverts() external {
        vm.prank(ALICE);
        vm.expectRevert(bytes("INVALID_RECEIVER"));
        polkaStream.createStream(address(0), 100 * DECIMALS, 100, 0, address(token));

        token.mint(BOB, 1_000 * DECIMALS);
        vm.prank(BOB);
        token.approve(address(polkaStream), type(uint256).max);
        vm.prank(BOB);
        vm.expectRevert(bytes("SENDER_EQ_RECEIVER"));
        polkaStream.createStream(BOB, 100 * DECIMALS, 100, 0, address(token));

        vm.prank(ALICE);
        vm.expectRevert(bytes("INVALID_TOKEN"));
        polkaStream.createStream(BOB, 100 * DECIMALS, 100, 0, address(0));

        vm.prank(ALICE);
        vm.expectRevert(bytes("ZERO_DEPOSIT"));
        polkaStream.createStream(BOB, 0, 100, 0, address(token));

        vm.prank(ALICE);
        vm.expectRevert(bytes("ZERO_DURATION"));
        polkaStream.createStream(BOB, 100 * DECIMALS, 0, 0, address(token));
    }

    function testWithdrawValidationReverts() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.prank(ALICE);
        vm.expectRevert(bytes("ONLY_RECEIVER"));
        polkaStream.withdraw(streamId);

        vm.prank(BOB);
        vm.expectRevert(bytes("NOTHING_TO_WITHDRAW"));
        polkaStream.withdraw(streamId);

        vm.warp(1_000_020);
        vm.prank(ALICE);
        polkaStream.cancelStream(streamId);

        vm.prank(BOB);
        vm.expectRevert(bytes("STREAM_CANCELED"));
        polkaStream.withdraw(streamId);
    }

    function testRetryNotifyUnknownRecordReverts() external {
        vm.expectRevert(bytes("NOTIFY_NOT_FOUND"));
        polkaStream.retryNotify(1, 9999);
    }

    function testPauseResumeCancelValidationReverts() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 100, 0);

        vm.prank(BOB);
        vm.expectRevert(bytes("ONLY_SENDER"));
        polkaStream.pauseStream(streamId);

        vm.prank(ALICE);
        polkaStream.pauseStream(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_ALREADY_PAUSED"));
        polkaStream.pauseStream(streamId);

        vm.prank(ALICE);
        polkaStream.resumeStream(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_NOT_PAUSED"));
        polkaStream.resumeStream(streamId);

        vm.prank(BOB);
        vm.expectRevert(bytes("ONLY_SENDER"));
        polkaStream.cancelStream(streamId);

        vm.prank(ALICE);
        polkaStream.cancelStream(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_ALREADY_CANCELED"));
        polkaStream.cancelStream(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_CANCELED"));
        polkaStream.pauseStream(streamId);
    }

    function testPauseRevertsWhenStreamCompleted() external {
        uint256 streamId = _createStream(1000 * DECIMALS, 10, 0);
        vm.warp(1_000_100);

        vm.prank(BOB);
        polkaStream.withdraw(streamId);

        vm.prank(ALICE);
        vm.expectRevert(bytes("STREAM_COMPLETED"));
        polkaStream.pauseStream(streamId);
    }

    function testSettersRejectInvalidValues() external {
        vm.expectRevert(bytes("INVALID_NOTIFIER"));
        polkaStream.setNotifier(address(0));

        vm.expectRevert(bytes("INVALID_TOKEN"));
        polkaStream.setTokenAllowlist(address(0), true);

        vm.expectRevert(bytes("INVALID_MAX_DURATION"));
        polkaStream.setMaxDuration(0);

        vm.expectRevert(bytes("INVALID_MAX_DEPOSIT"));
        polkaStream.setMaxDepositPerStream(0);
    }

    function testIsNotifierHealthyReturnsFalseOnBadInterface() external {
        polkaStream.setNotifier(address(token));
        assertFalse(polkaStream.isNotifierHealthy(), "non-notifier contract should be unhealthy");
    }

    function testGetStreamAndOwedRevertWhenStreamMissing() external {
        vm.expectRevert(bytes("STREAM_NOT_FOUND"));
        polkaStream.getStream(999);

        vm.expectRevert(bytes("STREAM_NOT_FOUND"));
        polkaStream.getOwed(999);
    }

    function _createStream(uint256 deposit, uint256 durationInSeconds, uint256 cliffInSeconds)
        internal
        returns (uint256 streamId)
    {
        vm.prank(ALICE);
        streamId = polkaStream.createStream(BOB, deposit, durationInSeconds, cliffInSeconds, address(token));
    }

    function _createPendingStream(
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        uint256 activationDeadline,
        PolkaStream.TriggerPolicy triggerPolicy,
        address authorizedActivator
    ) internal returns (uint256 streamId) {
        vm.prank(ALICE);
        streamId = polkaStream.createPendingStream(
            BOB,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            address(token),
            activationDeadline,
            triggerPolicy,
            authorizedActivator,
            keccak256("service")
        );
    }
}
