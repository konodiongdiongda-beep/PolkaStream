// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

/// @title UsageSettlementHub
/// @notice AI usage sidecar settlement hub:
/// - payer 先充值 escrow
/// - daemon 按窗口批结算 usage（单请求不上链）
/// - provider 从 claimable 领取
contract UsageSettlementHub is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    struct SettlementItem {
        address payer;
        address provider;
        address token;
        uint256 amount;
        uint32 requestCount;
    }

    /// @notice token allowlist，避免意外资产进入结算路径
    mapping(address => bool) public tokenAllowlist;

    /// @notice payer 在 hub 的 escrow 余额：payer => token => amount
    mapping(address => mapping(address => uint256)) public payerEscrow;

    /// @notice provider 可领取余额：provider => token => amount
    mapping(address => mapping(address => uint256)) public providerClaimable;

    /// @notice windowId 是否已完成结算，防重放
    mapping(bytes32 => bool) public settledWindows;

    event TokenAllowlistUpdated(address indexed token, bool indexed allowed);
    event EscrowDeposited(address indexed payer, address indexed token, uint256 amount, uint256 newBalance);
    event EscrowWithdrawn(address indexed payer, address indexed token, uint256 amount, uint256 newBalance);
    event UsageSettled(
        bytes32 indexed windowId,
        address indexed payer,
        address indexed provider,
        address token,
        uint256 amount,
        uint32 requestCount
    );
    event WindowSettled(
        bytes32 indexed windowId,
        uint256 itemCount,
        uint256 totalAmount,
        uint256 totalRequests,
        address indexed settler
    );
    event ProviderClaimed(
        address indexed provider,
        address indexed token,
        address indexed receiver,
        uint256 amount
    );

    constructor() Ownable(msg.sender) {}

    function setTokenAllowlist(address token, bool allowed) external onlyOwner {
        require(token != address(0), "INVALID_TOKEN");
        tokenAllowlist[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    function depositEscrow(address token, uint256 amount) external nonReentrant {
        require(tokenAllowlist[token], "TOKEN_NOT_ALLOWED");
        require(amount > 0, "ZERO_AMOUNT");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 nextBalance = payerEscrow[msg.sender][token] + amount;
        payerEscrow[msg.sender][token] = nextBalance;

        emit EscrowDeposited(msg.sender, token, amount, nextBalance);
    }

    function withdrawEscrow(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "ZERO_AMOUNT");
        uint256 balance = payerEscrow[msg.sender][token];
        require(balance >= amount, "INSUFFICIENT_ESCROW");

        uint256 nextBalance = balance - amount;
        payerEscrow[msg.sender][token] = nextBalance;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit EscrowWithdrawn(msg.sender, token, amount, nextBalance);
    }

    /// @notice 批结算一个窗口（通常 30s），窗口 id 由 daemon 生成
    /// @dev 若任意 item 不满足余额条件会整体 revert，因此可在补充 escrow 后重试同一 windowId
    function settleWindow(bytes32 windowId, SettlementItem[] calldata items)
        external
        onlyOwner
        nonReentrant
        returns (uint256 totalAmount, uint256 totalRequests)
    {
        require(windowId != bytes32(0), "INVALID_WINDOW");
        require(!settledWindows[windowId], "WINDOW_SETTLED");
        require(items.length > 0, "EMPTY_BATCH");

        uint256 itemCount = items.length;
        for (uint256 i = 0; i < itemCount; i++) {
            SettlementItem calldata item = items[i];
            require(item.payer != address(0), "INVALID_PAYER");
            require(item.provider != address(0), "INVALID_PROVIDER");
            require(item.token != address(0), "INVALID_TOKEN");
            require(tokenAllowlist[item.token], "TOKEN_NOT_ALLOWED");
            require(item.amount > 0, "ZERO_AMOUNT");
            require(item.requestCount > 0, "ZERO_REQUEST_COUNT");

            uint256 payerBalance = payerEscrow[item.payer][item.token];
            require(payerBalance >= item.amount, "INSUFFICIENT_ESCROW");

            payerEscrow[item.payer][item.token] = payerBalance - item.amount;
            providerClaimable[item.provider][item.token] += item.amount;

            totalAmount += item.amount;
            totalRequests += item.requestCount;

            emit UsageSettled(
                windowId,
                item.payer,
                item.provider,
                item.token,
                item.amount,
                item.requestCount
            );
        }

        settledWindows[windowId] = true;
        emit WindowSettled(windowId, itemCount, totalAmount, totalRequests, msg.sender);
    }

    function claim(address token, uint256 amount, address receiver) external nonReentrant {
        require(amount > 0, "ZERO_AMOUNT");
        address to = receiver == address(0) ? msg.sender : receiver;

        uint256 claimable = providerClaimable[msg.sender][token];
        require(claimable >= amount, "INSUFFICIENT_CLAIMABLE");

        providerClaimable[msg.sender][token] = claimable - amount;
        IERC20(token).safeTransfer(to, amount);

        emit ProviderClaimed(msg.sender, token, to, amount);
    }
}
