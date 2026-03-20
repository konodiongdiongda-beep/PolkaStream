// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script} from "forge-std/Script.sol";
import {PolkaStream} from "contracts/PolkaStream.sol";
import {HealthCheckBase} from "./HealthCheck.s.sol";

/// @notice 部署脚本（内置健康检查）：
///   source .env
///   forge script script/Deploy.s.sol:DeployScript \
///     --rpc-url https://services.polkadothub-rpc.com/testnet \
///     --broadcast
contract DeployScript is Script, HealthCheckBase {
    function run() external returns (PolkaStream deployed) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address notifierAddress = vm.envAddress("NOTIFIER_ADDRESS");
        address expectedPrecompile = vm.envOr("XCM_PRECOMPILE", address(0xA0000));
        uint256 configuredMaxDuration = vm.envOr("MAX_DURATION", uint256(365 days));
        uint256 configuredMaxDeposit = vm.envOr(
            "MAX_DEPOSIT_PER_STREAM",
            uint256(1_000_000_000 ether)
        );

        _assertNotifierHealthy(notifierAddress, expectedPrecompile);

        vm.startBroadcast(deployerPrivateKey);
        deployed = new PolkaStream(notifierAddress, configuredMaxDuration, configuredMaxDeposit);
        vm.stopBroadcast();
    }
}
