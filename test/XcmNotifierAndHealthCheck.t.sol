// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";

import {IXcmNotifier} from "contracts/interfaces/IXcmNotifier.sol";
import {XcmPrecompileNotifier} from "contracts/XcmPrecompileNotifier.sol";
import {HealthCheckBase} from "script/HealthCheck.s.sol";

contract MockPrecompileReturnTrue {
    function xcmTransfer(address, uint256, bytes32) external pure returns (bool) {
        return true;
    }
}

contract MockPrecompileReturnFalse {
    function xcmTransfer(address, uint256, bytes32) external pure returns (bool) {
        return false;
    }
}

contract MockPrecompileRevert {
    function xcmTransfer(address, uint256, bytes32) external pure returns (bool) {
        revert("PRECOMPILE_DOWN");
    }
}

contract MockPrecompileRevertNoData {
    function xcmTransfer(address, uint256, bytes32) external pure returns (bool) {
        assembly {
            revert(0, 0)
        }
    }
}

contract MockPrecompileInvalidReturn {
    function xcmTransfer(address, uint256, bytes32) external pure returns (uint256) {
        return 2;
    }
}

contract MockHealthNotifier is IXcmNotifier {
    address public xcmPrecompile;
    bool public healthy = true;
    bool public healthCheckRevert;

    constructor(address precompile) {
        xcmPrecompile = precompile;
    }

    function setHealthy(bool nextHealthy) external {
        healthy = nextHealthy;
    }

    function setHealthCheckRevert(bool nextValue) external {
        healthCheckRevert = nextValue;
    }

    function setPrecompile(address precompile) external {
        xcmPrecompile = precompile;
    }

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

    function isHealthy() external view returns (bool) {
        if (healthCheckRevert) {
            revert("HEALTH_REVERT");
        }
        return healthy;
    }
}

contract MockNotifierNoPrecompileGetter is IXcmNotifier {
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
}

contract HealthCheckHarness is HealthCheckBase {
    function assertNotifierHealthy(address notifierAddress, address expectedPrecompile) external view {
        _assertNotifierHealthy(notifierAddress, expectedPrecompile);
    }
}

contract XcmNotifierAndHealthCheckTest is Test {
    function testNotifyWithdrawReturnsTrueOnSuccessfulPrecompileCall() external {
        MockPrecompileReturnTrue precompile = new MockPrecompileReturnTrue();
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(precompile));

        bool ok = notifier.notifyWithdraw(1, 1, address(0xB0B), address(0), 123, bytes32("reason"));
        assertTrue(ok, "notify should succeed");
    }

    function testNotifyWithdrawReturnsFalseWhenPrecompileReturnsFalse() external {
        MockPrecompileReturnFalse precompile = new MockPrecompileReturnFalse();
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(precompile));

        bool ok = notifier.notifyWithdraw(1, 1, address(0xB0B), address(0), 123, bytes32("reason"));
        assertFalse(ok, "notify should fail when precompile returns false");
    }

    function testNotifyWithdrawReturnsFalseWhenPrecompileReturnsEmptyData() external {
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(0xBEEF));

        bool ok = notifier.notifyWithdraw(1, 1, address(0xB0B), address(0), 123, bytes32("reason"));
        assertFalse(ok, "empty return data must be treated as failure");
    }

    function testIsHealthyTrueWhenPrecompileReturnsDecodableBool() external {
        MockPrecompileReturnFalse precompile = new MockPrecompileReturnFalse();
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(precompile));

        assertTrue(notifier.isHealthy(), "bool-returning precompile should be considered healthy");
    }

    function testIsHealthyTrueWhenPrecompileRevertsWithReason() external {
        MockPrecompileRevert precompile = new MockPrecompileRevert();
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(precompile));

        assertTrue(notifier.isHealthy(), "revert with reason should still indicate callable precompile");
    }

    function testIsHealthyFalseWhenPrecompileReturnsEmptyData() external {
        XcmPrecompileNotifier notifier = new XcmPrecompileNotifier(address(0xBEEF));
        assertFalse(notifier.isHealthy(), "EOA-like precompile should be unhealthy");
    }

    function testHealthCheckPassesWhenNotifierAndPrecompileAreCallable() external {
        MockPrecompileReturnTrue precompile = new MockPrecompileReturnTrue();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        HealthCheckHarness harness = new HealthCheckHarness();

        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }

    function testHealthCheckRevertsWhenNotifierHasNoCode() external {
        HealthCheckHarness harness = new HealthCheckHarness();
        vm.expectRevert(bytes("HEALTHCHECK: NOTIFIER_NO_CODE"));
        harness.assertNotifierHealthy(address(0x1234), address(0xA0000));
    }

    function testHealthCheckRevertsWhenNotifierUnhealthy() external {
        MockPrecompileReturnTrue precompile = new MockPrecompileReturnTrue();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        notifier.setHealthy(false);

        HealthCheckHarness harness = new HealthCheckHarness();
        vm.expectRevert(bytes("HEALTHCHECK: NOTIFIER_UNHEALTHY"));
        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }

    function testHealthCheckRevertsWhenIsHealthyCallFails() external {
        MockPrecompileReturnTrue precompile = new MockPrecompileReturnTrue();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        notifier.setHealthCheckRevert(true);

        HealthCheckHarness harness = new HealthCheckHarness();
        vm.expectRevert(bytes("HEALTHCHECK: IS_HEALTHY_CALL_FAILED"));
        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }

    function testHealthCheckRevertsWhenNotifierLacksPrecompileGetter() external {
        MockNotifierNoPrecompileGetter notifier = new MockNotifierNoPrecompileGetter();
        HealthCheckHarness harness = new HealthCheckHarness();

        vm.expectRevert(bytes("HEALTHCHECK: MISSING_PRECOMPILE_GETTER"));
        harness.assertNotifierHealthy(address(notifier), address(0xA0000));
    }

    function testHealthCheckRevertsOnPrecompileMismatch() external {
        MockPrecompileReturnTrue precompile = new MockPrecompileReturnTrue();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        HealthCheckHarness harness = new HealthCheckHarness();

        vm.expectRevert(bytes("HEALTHCHECK: PRECOMPILE_MISMATCH"));
        harness.assertNotifierHealthy(address(notifier), address(0xA0000));
    }

    function testHealthCheckRevertsWhenPrecompileReturnsEmptyData() external {
        MockHealthNotifier notifier = new MockHealthNotifier(address(0xBEEF));
        HealthCheckHarness harness = new HealthCheckHarness();

        vm.expectRevert(bytes("HEALTHCHECK: PRECOMPILE_EMPTY_RETURN"));
        harness.assertNotifierHealthy(address(notifier), address(0xBEEF));
    }

    function testHealthCheckPassesWhenPrecompileRevertsWithReason() external {
        MockPrecompileRevert precompile = new MockPrecompileRevert();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        HealthCheckHarness harness = new HealthCheckHarness();

        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }

    function testHealthCheckPassesWhenPrecompileRevertsWithoutReason() external {
        MockPrecompileRevertNoData precompile = new MockPrecompileRevertNoData();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        HealthCheckHarness harness = new HealthCheckHarness();

        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }

    function testHealthCheckRevertsWhenPrecompileReturnEncodingInvalid() external {
        MockPrecompileInvalidReturn precompile = new MockPrecompileInvalidReturn();
        MockHealthNotifier notifier = new MockHealthNotifier(address(precompile));
        HealthCheckHarness harness = new HealthCheckHarness();

        vm.expectRevert(bytes("HEALTHCHECK: PRECOMPILE_INVALID_RETURN"));
        harness.assertNotifierHealthy(address(notifier), address(precompile));
    }
}
