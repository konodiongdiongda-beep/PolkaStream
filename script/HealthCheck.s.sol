// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script} from "forge-std/Script.sol";

import {IXcmNotifier} from "contracts/interfaces/IXcmNotifier.sol";

abstract contract HealthCheckBase {
    bytes4 private constant XCM_TRANSFER_SELECTOR =
        bytes4(keccak256("xcmTransfer(address,uint256,bytes32)"));
    address private constant PROBE_RECEIVER = address(0x000000000000000000000000000000000000dEaD);

    function _assertNotifierHealthy(address notifierAddress, address expectedPrecompile) internal view {
        require(notifierAddress != address(0), "HEALTHCHECK: INVALID_NOTIFIER");
        require(notifierAddress.code.length > 0, "HEALTHCHECK: NOTIFIER_NO_CODE");

        bool healthy;
        try IXcmNotifier(notifierAddress).isHealthy() returns (bool healthResult) {
            healthy = healthResult;
        } catch {
            revert("HEALTHCHECK: IS_HEALTHY_CALL_FAILED");
        }
        require(healthy, "HEALTHCHECK: NOTIFIER_UNHEALTHY");

        (bool getterOk, bytes memory data) = notifierAddress.staticcall(
            abi.encodeWithSignature("xcmPrecompile()")
        );
        require(getterOk && data.length >= 32, "HEALTHCHECK: MISSING_PRECOMPILE_GETTER");

        address discoveredPrecompile = abi.decode(data, (address));
        require(discoveredPrecompile != address(0), "HEALTHCHECK: INVALID_PRECOMPILE");
        require(discoveredPrecompile == expectedPrecompile, "HEALTHCHECK: PRECOMPILE_MISMATCH");

        _assertPrecompileCallable(discoveredPrecompile);
    }

    function _assertPrecompileCallable(address precompile) internal view {
        (bool probeOk, bytes memory probeData) = precompile.staticcall(
            abi.encodeWithSelector(
                XCM_TRANSFER_SELECTOR,
                PROBE_RECEIVER,
                0,
                keccak256("POLKASTREAM_HEALTHCHECK")
            )
        );

        if (!probeOk) {
            // 某些链上 precompile 在探测参数下会直接 revert（可能无 return data），
            // 只要不是“成功且空返回”的 EOA 语义，这里视为可达。
            return;
        }

        require(probeData.length >= 32, "HEALTHCHECK: PRECOMPILE_EMPTY_RETURN");

        uint256 raw = abi.decode(probeData, (uint256));
        require(raw <= 1, "HEALTHCHECK: PRECOMPILE_INVALID_RETURN");
    }
}

/// @notice 部署前健康检查：探测 notifier 与 precompile 配置，不通过即阻断。
/// @dev 用法：
///   source .env
///   forge script script/HealthCheck.s.sol:HealthCheckScript --rpc-url $NEXT_PUBLIC_RPC_URL
contract HealthCheckScript is Script, HealthCheckBase {
    function run() external view returns (bool) {
        address notifierAddress = vm.envAddress("NOTIFIER_ADDRESS");
        address expectedPrecompile = vm.envOr("XCM_PRECOMPILE", address(0xA0000));
        _assertNotifierHealthy(notifierAddress, expectedPrecompile);
        return true;
    }
}
