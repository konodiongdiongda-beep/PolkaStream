// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IXcmNotifier} from "./interfaces/IXcmNotifier.sol";

/// @notice IXcmNotifier 适配器：把 PolkaStream 的通知调用转发给 Polkadot Hub EVM XCM precompile。
contract XcmPrecompileNotifier is IXcmNotifier {
    bytes4 private constant XCM_TRANSFER_SELECTOR =
        bytes4(keccak256("xcmTransfer(address,uint256,bytes32)"));

    /// @notice Polkadot Hub EVM XCM precompile 地址
    address public immutable xcmPrecompile;

    event PrecompileNotifyForwarded(
        uint256 indexed streamId,
        uint256 indexed withdrawId,
        address indexed receiver,
        uint256 amount,
        bool success
    );

    constructor(address precompile) {
        require(precompile != address(0), "INVALID_PRECOMPILE");
        xcmPrecompile = precompile;
    }

    function notifyWithdraw(
        uint256 streamId,
        uint256 withdrawId,
        address receiver,
        address, /* token */
        uint256 amount,
        bytes32 reason
    ) external returns (bool) {
        (bool lowLevelOk, bytes memory returnData) =
            xcmPrecompile.call(abi.encodeWithSelector(XCM_TRANSFER_SELECTOR, receiver, amount, reason));
        bool success = _decodeNotifyResult(lowLevelOk, returnData);

        emit PrecompileNotifyForwarded(streamId, withdrawId, receiver, amount, success);
        return success;
    }

    function isHealthy() external view returns (bool) {
        (bool lowLevelOk, bytes memory returnData) = xcmPrecompile.staticcall(
            abi.encodeWithSelector(
                XCM_TRANSFER_SELECTOR,
                address(this),
                0,
                keccak256("POLKASTREAM_HEALTHCHECK")
            )
        );

        // 不可用地址（如 EOA）通常表现为 call 成功但返回空数据。
        // 对于 precompile，某些链实现可能直接 revert（含/不含 reason），仍可视为“可达”。
        if (!lowLevelOk) {
            return true;
        }

        if (returnData.length < 32) {
            return false;
        }

        // 只要返回值可按 bool 解码，即认为 precompile 语义可用。
        uint256 raw = abi.decode(returnData, (uint256));
        return raw <= 1;
    }

    function _decodeNotifyResult(bool lowLevelOk, bytes memory returnData) internal pure returns (bool) {
        if (!lowLevelOk || returnData.length < 32) {
            return false;
        }

        uint256 raw = abi.decode(returnData, (uint256));
        if (raw > 1) {
            return false;
        }

        return raw == 1;
    }
}
