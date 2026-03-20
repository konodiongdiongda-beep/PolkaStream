// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IXcmNotifier {
    /// @notice 在提款成功后触发通知，返回 true 表示通知成功，false 表示通知失败但未 revert
    function notifyWithdraw(
        uint256 streamId,
        uint256 withdrawId,
        address receiver,
        address token,
        uint256 amount,
        bytes32 reason
    ) external returns (bool);

    /// @notice notifier 的健康探针，用于部署前检查与前端预检查
    function isHealthy() external view returns (bool);
}
