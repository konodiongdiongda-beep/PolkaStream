// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Ownable2Step} from "openzeppelin-contracts/contracts/access/Ownable2Step.sol";

import {IXcmNotifier} from "./interfaces/IXcmNotifier.sol";
import {IPolkaStreamServicePlanRegistry} from "./interfaces/IPolkaStreamServicePlanRegistry.sol";

/// @title PolkaStream - Polkadot Hub EVM 原生稳定币流支付协议
/// @notice 支持 Cliff、实时提取、暂停/恢复、取消、Multi-Token，以及可重试的跨链通知。
contract PolkaStream is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    /// @notice 跨链通知标签，供目标链/索引器识别 PolkaStream Withdraw 事件
    bytes32 public constant WITHDRAW_REASON = keccak256("POLKASTREAM_WITHDRAW");

    /// @notice 自增 streamId（从 1 开始，0 保留为无效）
    uint256 public nextStreamId = 1;

    /// @notice 自增 withdrawId（从 1 开始，0 保留为无效）
    uint256 public nextWithdrawId = 1;

    /// @notice 通知适配器地址（实现 IXcmNotifier）
    address public notifier;

    /// @notice 是否开启强一致模式：true 时通知失败回滚提款；false 时仅记录失败并允许后续重试
    bool public strictXcm;

    /// @notice 允许的最大流时长（秒）
    uint256 public maxDuration;

    /// @notice 单条流允许的最大存款
    uint256 public maxDepositPerStream;

    /// @notice token 白名单，只有白名单 token 才允许创建 stream
    mapping(address => bool) public tokenAllowlist;

    enum StreamStatus {
        NONE,
        PENDING,
        ACTIVE,
        PAUSED,
        COMPLETED,
        CANCELED,
        EXPIRED
    }

    enum TriggerPolicy {
        NONE,
        SENDER_ONLY,
        RECEIVER_ONLY,
        EITHER_PARTY,
        BOTH_PARTIES,
        AUTHORIZED_OPERATOR
    }

    /// @notice 单个流的完整状态
    /// @dev The first 12 fields intentionally preserve the legacy getStream tuple order for frontend compatibility.
    struct Stream {
        // 资金发起方
        address sender;
        // 资金接收方
        address receiver;
        // 总锁仓金额（创建时一次性打入）
        uint256 deposit;
        // 已经提取/结算给 receiver 的金额
        uint256 withdrawnAmount;
        // 实际线性释放时长（单位秒，不含 cliff 延迟）
        uint256 durationInSeconds;
        // 线性释放开始时间（= activatedAt + cliffInSeconds）
        uint256 startTime;
        // cliff 结束时间（语义上等于 startTime，便于前端展示）
        uint256 cliffEndsAt;
        // 若已取消/过期，记录关闭时间；未关闭为 0
        uint256 canceledAt;
        // 若当前暂停，记录暂停开始时间；未暂停为 0
        uint256 pausedAt;
        // 已累计的暂停总时长（仅统计已完成的暂停区间）
        uint256 totalPausedDuration;
        // 当前是否处于暂停态
        bool isPaused;
        // 是否已取消/关闭
        bool isCanceled;
        // 触发策略为 AUTHORIZED_OPERATOR 时的可激活地址
        address authorizedActivator;
        // 激活后生效的 cliff 时长（秒）
        uint256 cliffInSeconds;
        // 流创建时间
        uint256 createdAt;
        // 流激活时间；未激活为 0
        uint256 activatedAt;
        // 待激活阶段超时时间；0 表示不设置 deadline
        uint256 activationDeadline;
        // 外部服务引用或条款哈希
        bytes32 serviceRef;
        // 商业化生命周期状态
        StreamStatus status;
        // 激活策略
        TriggerPolicy triggerPolicy;
        // 双边确认模式下 sender 是否已确认准备就绪
        bool senderConfirmed;
        // 双边确认模式下 receiver 是否已确认准备就绪
        bool receiverConfirmed;
    }

    enum NotifyStatus {
        NONE,
        PENDING,
        SUCCESS,
        FAILED
    }

    struct NotifyRecord {
        uint256 streamId;
        address receiver;
        address token;
        uint256 amount;
        NotifyStatus status;
        uint32 attempts;
        uint64 lastAttemptAt;
    }

    /// @notice Multi-token 核心存储：token => (streamId => Stream)
    mapping(address => mapping(uint256 => Stream)) public streams;

    /// @notice 通过 streamId 反查 token，便于以 streamId 为主键调用
    mapping(uint256 => address) public streamToken;

    /// @notice 提款通知状态：withdrawId => NotifyRecord
    mapping(uint256 => NotifyRecord) public notifyRecords;

    /// @notice 便于前端 dashboard 快速枚举 sender 侧 stream
    mapping(address => uint256[]) private senderStreamIds;

    /// @notice 便于前端 dashboard 快速枚举 receiver 侧 stream
    mapping(address => uint256[]) private receiverStreamIds;

    /// @notice streamId => withdrawId 列表，支持按流追踪通知状态
    mapping(uint256 => uint256[]) private streamWithdrawIds;

    /// @notice 可选的 provider-owned service plan registry
    address public servicePlanRegistry;

    /// @notice streamId => provider plan id
    mapping(uint256 => uint256) public streamPlanId;

    /// @notice streamId => bound plan terms hash
    mapping(uint256 => bytes32) public streamPlanTermsHash;

    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        uint256 startTime
    );

    event PendingStreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        uint256 activationDeadline,
        TriggerPolicy triggerPolicy,
        address authorizedActivator,
        bytes32 serviceRef
    );

    event StreamActivationConfirmed(
        uint256 indexed streamId,
        address indexed actor,
        bool senderConfirmed,
        bool receiverConfirmed
    );

    event StreamActivated(
        uint256 indexed streamId,
        address indexed activator,
        uint256 activatedAt,
        uint256 startTime
    );

    event PendingStreamCreatedFromPlan(
        uint256 indexed streamId,
        uint256 indexed planId,
        address indexed provider,
        bytes32 termsHash
    );

    event Withdrawn(
        uint256 indexed streamId,
        uint256 indexed withdrawId,
        address indexed receiver,
        address token,
        uint256 amount,
        uint256 totalWithdrawn
    );

    event StreamPaused(uint256 indexed streamId, uint256 pausedAt);
    event StreamResumed(uint256 indexed streamId, uint256 resumedAt, uint256 pauseDuration);

    event StreamCanceled(
        uint256 indexed streamId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 receiverPayout,
        uint256 senderRefund
    );

    event StreamExpired(
        uint256 indexed streamId,
        address indexed sender,
        address indexed receiver,
        address token,
        uint256 senderRefund
    );

    event StreamCompleted(uint256 indexed streamId);

    event NotifyStatusUpdated(
        uint256 indexed streamId,
        uint256 indexed withdrawId,
        NotifyStatus status,
        uint32 attempts
    );

    event NotifyFailure(
        uint256 indexed streamId,
        uint256 indexed withdrawId,
        address indexed notifier,
        bytes reason
    );

    event NotifierUpdated(address indexed previousNotifier, address indexed newNotifier);
    event ServicePlanRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);
    event StrictXcmUpdated(bool indexed enabled);
    event TokenAllowlistUpdated(address indexed token, bool indexed allowed);
    event MaxDurationUpdated(uint256 previousMaxDuration, uint256 newMaxDuration);
    event MaxDepositPerStreamUpdated(uint256 previousMaxDeposit, uint256 newMaxDeposit);

    constructor(
        address initialNotifier,
        uint256 initialMaxDuration,
        uint256 initialMaxDepositPerStream
    ) Ownable(msg.sender) {
        require(initialNotifier != address(0), "INVALID_NOTIFIER");
        require(initialMaxDuration > 0, "INVALID_MAX_DURATION");
        require(initialMaxDepositPerStream > 0, "INVALID_MAX_DEPOSIT");

        notifier = initialNotifier;
        maxDuration = initialMaxDuration;
        maxDepositPerStream = initialMaxDepositPerStream;
        strictXcm = false;
    }

    /// @notice 创建立即生效的流支付：sender 预存 token，receiver 按秒释放。
    /// @dev 该接口保留现有 demo 语义，等价于“创建后立即激活”。
    function createStream(
        address receiver,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        address token
    ) external returns (uint256 streamId) {
        streamId = _createBaseStream(receiver, deposit, durationInSeconds, cliffInSeconds, token);

        Stream storage stream = streams[token][streamId];
        stream.createdAt = block.timestamp;
        stream.activatedAt = block.timestamp;
        stream.startTime = block.timestamp + cliffInSeconds;
        stream.cliffEndsAt = stream.startTime;
        stream.status = StreamStatus.ACTIVE;
        stream.triggerPolicy = TriggerPolicy.NONE;

        emit StreamCreated(
            streamId,
            msg.sender,
            receiver,
            token,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            stream.startTime
        );
    }

    /// @notice 创建待激活流：先锁资，不开始累计 owed。
    function createPendingStream(
        address receiver,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        address token,
        uint256 activationDeadline,
        TriggerPolicy triggerPolicy,
        address authorizedActivator,
        bytes32 serviceRef
    ) external returns (uint256 streamId) {
        require(triggerPolicy != TriggerPolicy.NONE, "INVALID_TRIGGER_POLICY");
        if (activationDeadline != 0) {
            require(activationDeadline > block.timestamp, "INVALID_ACTIVATION_DEADLINE");
        }

        if (triggerPolicy == TriggerPolicy.AUTHORIZED_OPERATOR) {
            require(authorizedActivator != address(0), "INVALID_ACTIVATOR");
        } else {
            require(authorizedActivator == address(0), "UNEXPECTED_ACTIVATOR");
        }

        streamId = _createPendingStream(
            receiver,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            token,
            activationDeadline,
            triggerPolicy,
            authorizedActivator,
            serviceRef
        );
    }

    /// @notice 基于 provider 预先发布的 plan 创建待激活流。
    function createPendingStreamFromPlan(
        uint256 planId,
        uint256 deposit,
        uint256 durationInSeconds,
        bytes32 serviceRef
    ) external returns (uint256 streamId) {
        require(servicePlanRegistry != address(0), "PLAN_REGISTRY_NOT_SET");

        (
            address provider,
            address token,
            uint256 minDeposit,
            uint256 maxDeposit,
            uint256 minDuration,
            uint256 planMaxDuration,
            uint256 cliffInSeconds,
            uint256 activationWindow,
            uint8 triggerPolicyCode,
            address authorizedActivator,
            bytes32 termsHash,
            bool isActive
        ) = IPolkaStreamServicePlanRegistry(servicePlanRegistry).getPlan(planId);

        require(provider != address(0), "PLAN_NOT_FOUND");
        require(isActive, "PLAN_INACTIVE");
        require(deposit >= minDeposit && deposit <= maxDeposit, "PLAN_DEPOSIT_OUT_OF_RANGE");
        require(
            durationInSeconds >= minDuration && durationInSeconds <= planMaxDuration, "PLAN_DURATION_OUT_OF_RANGE"
        );
        require(
            triggerPolicyCode >= uint8(TriggerPolicy.SENDER_ONLY)
                && triggerPolicyCode <= uint8(TriggerPolicy.AUTHORIZED_OPERATOR),
            "INVALID_PLAN_TRIGGER_POLICY"
        );

        uint256 activationDeadline = activationWindow == 0 ? 0 : block.timestamp + activationWindow;
        TriggerPolicy triggerPolicy = TriggerPolicy(triggerPolicyCode);

        streamId = _createPendingStream(
            provider,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            token,
            activationDeadline,
            triggerPolicy,
            authorizedActivator,
            serviceRef
        );

        streamPlanId[streamId] = planId;
        streamPlanTermsHash[streamId] = termsHash;

        emit PendingStreamCreatedFromPlan(streamId, planId, provider, termsHash);
    }

    /// @notice 双边确认模式下，sender 确认准备就绪。
    function confirmReadyBySender(uint256 streamId) external {
        (Stream storage stream, ) = _requireStream(streamId);

        require(stream.status == StreamStatus.PENDING, "STREAM_NOT_PENDING");
        require(stream.triggerPolicy == TriggerPolicy.BOTH_PARTIES, "TRIGGER_POLICY_NOT_BOTH");
        require(msg.sender == stream.sender, "ONLY_SENDER");
        _requireActivationWindowOpen(stream);

        if (!stream.senderConfirmed) {
            stream.senderConfirmed = true;
            emit StreamActivationConfirmed(streamId, msg.sender, true, stream.receiverConfirmed);
        }
    }

    /// @notice 双边确认模式下，receiver 确认准备就绪。
    function confirmReadyByReceiver(uint256 streamId) external {
        (Stream storage stream, ) = _requireStream(streamId);

        require(stream.status == StreamStatus.PENDING, "STREAM_NOT_PENDING");
        require(stream.triggerPolicy == TriggerPolicy.BOTH_PARTIES, "TRIGGER_POLICY_NOT_BOTH");
        require(msg.sender == stream.receiver, "ONLY_RECEIVER");
        _requireActivationWindowOpen(stream);

        if (!stream.receiverConfirmed) {
            stream.receiverConfirmed = true;
            emit StreamActivationConfirmed(streamId, msg.sender, stream.senderConfirmed, true);
        }
    }

    /// @notice 触发待激活流进入 ACTIVE。
    function activateStream(uint256 streamId) external {
        (Stream storage stream, ) = _requireStream(streamId);

        require(stream.status == StreamStatus.PENDING, "STREAM_NOT_PENDING");
        _requireActivationWindowOpen(stream);
        _validateActivationTrigger(stream, msg.sender);
        _activateStream(streamId, stream, msg.sender);
    }

    /// @notice sender 在服务开始前取消订单并拿回全部 escrow。
    function cancelBeforeActivation(uint256 streamId) external nonReentrant {
        (Stream storage stream, address token) = _requireStream(streamId);

        require(msg.sender == stream.sender, "ONLY_SENDER");
        require(stream.status == StreamStatus.PENDING, "STREAM_NOT_PENDING");

        stream.status = StreamStatus.CANCELED;
        stream.isCanceled = true;
        stream.canceledAt = block.timestamp;

        IERC20(token).safeTransfer(stream.sender, stream.deposit);

        emit StreamCanceled(streamId, stream.sender, stream.receiver, token, 0, stream.deposit);
    }

    /// @notice pending stream 过期后，任何人都可触发退款。
    function expirePendingStream(uint256 streamId) external nonReentrant {
        (Stream storage stream, address token) = _requireStream(streamId);

        require(stream.status == StreamStatus.PENDING, "STREAM_NOT_PENDING");
        require(stream.activationDeadline != 0, "NO_ACTIVATION_DEADLINE");
        require(block.timestamp > stream.activationDeadline, "ACTIVATION_DEADLINE_NOT_PASSED");

        stream.status = StreamStatus.EXPIRED;
        stream.isCanceled = true;
        stream.canceledAt = block.timestamp;

        IERC20(token).safeTransfer(stream.sender, stream.deposit);

        emit StreamExpired(streamId, stream.sender, stream.receiver, token, stream.deposit);
    }

    /// @notice receiver 提取当前可提取金额；通知失败默认不回滚（strictXcm=false）
    function withdraw(uint256 streamId) external nonReentrant {
        (Stream storage stream, address token) = _requireStream(streamId);

        require(msg.sender == stream.receiver, "ONLY_RECEIVER");
        require(stream.status != StreamStatus.PENDING, "STREAM_NOT_ACTIVE");
        require(stream.status != StreamStatus.EXPIRED, "STREAM_EXPIRED");
        require(!stream.isCanceled, "STREAM_CANCELED");

        uint256 owedAmount = _calculateOwed(stream, block.timestamp);
        require(owedAmount > 0, "NOTHING_TO_WITHDRAW");

        // 先更新状态，避免重入窗口
        stream.withdrawnAmount += owedAmount;
        IERC20(token).safeTransfer(stream.receiver, owedAmount);

        uint256 withdrawId = nextWithdrawId;
        nextWithdrawId = withdrawId + 1;
        streamWithdrawIds[streamId].push(withdrawId);

        NotifyRecord storage record = notifyRecords[withdrawId];
        record.streamId = streamId;
        record.receiver = stream.receiver;
        record.token = token;
        record.amount = owedAmount;
        record.status = NotifyStatus.PENDING;

        emit Withdrawn(streamId, withdrawId, stream.receiver, token, owedAmount, stream.withdrawnAmount);

        bool notifyOk = _attemptNotify(withdrawId);
        if (!notifyOk && strictXcm) {
            revert("XCM_NOTIFY_FAILED");
        }

        if (stream.withdrawnAmount == stream.deposit) {
            stream.status = StreamStatus.COMPLETED;
            emit StreamCompleted(streamId);
        }
    }

    /// @notice 补偿重试失败通知。幂等：已成功状态重复调用直接返回 true。
    function retryNotify(uint256 streamId, uint256 withdrawId)
        external
        nonReentrant
        returns (NotifyStatus status)
    {
        NotifyRecord storage record = notifyRecords[withdrawId];
        require(record.streamId == streamId && streamId != 0, "NOTIFY_NOT_FOUND");

        if (record.status == NotifyStatus.SUCCESS) {
            return NotifyStatus.SUCCESS;
        }

        _attemptNotify(withdrawId);
        return record.status;
    }

    /// @notice sender 取消已激活流：结算已归属给 receiver 的金额，剩余退回 sender。
    function cancelStream(uint256 streamId) external nonReentrant {
        (Stream storage stream, address token) = _requireStream(streamId);

        require(msg.sender == stream.sender, "ONLY_SENDER");
        require(!stream.isCanceled, "STREAM_ALREADY_CANCELED");
        require(stream.status != StreamStatus.PENDING, "STREAM_PENDING");
        require(stream.status != StreamStatus.COMPLETED, "STREAM_COMPLETED");

        uint256 owedToReceiver = _calculateOwed(stream, block.timestamp);
        uint256 senderRefund = stream.deposit - stream.withdrawnAmount - owedToReceiver;

        stream.isCanceled = true;
        stream.status = StreamStatus.CANCELED;
        stream.canceledAt = block.timestamp;

        // 若在暂停中直接取消，补记暂停时长，确保历史状态一致
        if (stream.isPaused) {
            stream.totalPausedDuration += block.timestamp - stream.pausedAt;
            stream.pausedAt = 0;
            stream.isPaused = false;
        }

        if (owedToReceiver > 0) {
            stream.withdrawnAmount += owedToReceiver;
            IERC20(token).safeTransfer(stream.receiver, owedToReceiver);
        }

        if (senderRefund > 0) {
            IERC20(token).safeTransfer(stream.sender, senderRefund);
        }

        emit StreamCanceled(
            streamId,
            stream.sender,
            stream.receiver,
            token,
            owedToReceiver,
            senderRefund
        );
    }

    /// @notice sender 暂停流；暂停期间不再累计 owed
    function pauseStream(uint256 streamId) external {
        (Stream storage stream, ) = _requireStream(streamId);

        require(msg.sender == stream.sender, "ONLY_SENDER");
        require(!stream.isCanceled, "STREAM_CANCELED");
        require(!stream.isPaused, "STREAM_ALREADY_PAUSED");
        require(stream.withdrawnAmount < stream.deposit, "STREAM_COMPLETED");
        require(stream.status == StreamStatus.ACTIVE, "STREAM_NOT_ACTIVE");

        stream.isPaused = true;
        stream.pausedAt = block.timestamp;
        stream.status = StreamStatus.PAUSED;

        emit StreamPaused(streamId, block.timestamp);
    }

    /// @notice sender 恢复流；恢复后继续按秒释放
    function resumeStream(uint256 streamId) external {
        (Stream storage stream, ) = _requireStream(streamId);

        require(msg.sender == stream.sender, "ONLY_SENDER");
        require(!stream.isCanceled, "STREAM_CANCELED");
        require(stream.status == StreamStatus.PAUSED, "STREAM_NOT_PAUSED");

        uint256 pauseDuration = block.timestamp - stream.pausedAt;
        stream.totalPausedDuration += pauseDuration;
        stream.pausedAt = 0;
        stream.isPaused = false;
        stream.status = StreamStatus.ACTIVE;

        emit StreamResumed(streamId, block.timestamp, pauseDuration);
    }

    /// @notice 设置通知器地址
    function setNotifier(address newNotifier) external onlyOwner {
        require(newNotifier != address(0), "INVALID_NOTIFIER");
        address oldNotifier = notifier;
        notifier = newNotifier;
        emit NotifierUpdated(oldNotifier, newNotifier);
    }

    /// @notice 配置 provider-owned service plan registry。
    function setServicePlanRegistry(address newRegistry) external onlyOwner {
        address oldRegistry = servicePlanRegistry;
        servicePlanRegistry = newRegistry;
        emit ServicePlanRegistryUpdated(oldRegistry, newRegistry);
    }

    /// @notice 配置强一致模式（true=通知失败回滚提款）
    function setStrictXcm(bool enabled) external onlyOwner {
        strictXcm = enabled;
        emit StrictXcmUpdated(enabled);
    }

    /// @notice 配置 token 是否加入 allowlist
    function setTokenAllowlist(address token, bool allowed) external onlyOwner {
        require(token != address(0), "INVALID_TOKEN");
        tokenAllowlist[token] = allowed;
        emit TokenAllowlistUpdated(token, allowed);
    }

    /// @notice 配置最大 duration（秒）
    function setMaxDuration(uint256 newMaxDuration) external onlyOwner {
        require(newMaxDuration > 0, "INVALID_MAX_DURATION");
        uint256 oldMaxDuration = maxDuration;
        maxDuration = newMaxDuration;
        emit MaxDurationUpdated(oldMaxDuration, newMaxDuration);
    }

    /// @notice 配置单流最大存款
    function setMaxDepositPerStream(uint256 newMaxDeposit) external onlyOwner {
        require(newMaxDeposit > 0, "INVALID_MAX_DEPOSIT");
        uint256 oldMaxDeposit = maxDepositPerStream;
        maxDepositPerStream = newMaxDeposit;
        emit MaxDepositPerStreamUpdated(oldMaxDeposit, newMaxDeposit);
    }

    /// @notice notifier 健康状态（仅用于前端/脚本快速探测）
    function isNotifierHealthy() external view returns (bool) {
        return _isNotifierHealthy();
    }

    /// @notice 查询某个 stream 当前可提取金额（实时）
    function getOwed(uint256 streamId) external view returns (uint256) {
        (Stream storage stream, ) = _requireStream(streamId);
        return _calculateOwed(stream, block.timestamp);
    }

    /// @notice 前端读取流详情（包含 token 和 Stream 全字段）
    function getStream(uint256 streamId) external view returns (address token, Stream memory stream) {
        (Stream storage s, address t) = _requireStream(streamId);
        token = t;
        stream = s;
    }

    /// @notice 商业化生命周期读取接口。
    function getStreamCommercialState(uint256 streamId)
        external
        view
        returns (
            StreamStatus status,
            TriggerPolicy triggerPolicy,
            uint256 createdAt,
            uint256 activatedAt,
            uint256 activationDeadline,
            address authorizedActivator,
            bytes32 serviceRef,
            bool senderConfirmed,
            bool receiverConfirmed
        )
    {
        (Stream storage stream, ) = _requireStream(streamId);
        return (
            stream.status,
            stream.triggerPolicy,
            stream.createdAt,
            stream.activatedAt,
            stream.activationDeadline,
            stream.authorizedActivator,
            stream.serviceRef,
            stream.senderConfirmed,
            stream.receiverConfirmed
        );
    }

    /// @notice 获取某个 sender 创建的全部 streamId
    function getSenderStreams(address sender) external view returns (uint256[] memory) {
        return senderStreamIds[sender];
    }

    /// @notice 获取某个 receiver 关联的全部 streamId
    function getReceiverStreams(address receiver) external view returns (uint256[] memory) {
        return receiverStreamIds[receiver];
    }

    /// @notice 获取单条流的提款 id 列表
    function getStreamWithdrawIds(uint256 streamId) external view returns (uint256[] memory) {
        return streamWithdrawIds[streamId];
    }

    /// @notice 查询通知状态聚合信息
    function getNotifyStatus(uint256 withdrawId)
        external
        view
        returns (NotifyStatus status, uint32 attempts, uint64 lastAttemptAt)
    {
        NotifyRecord storage record = notifyRecords[withdrawId];
        return (record.status, record.attempts, record.lastAttemptAt);
    }

    /// @notice 查询 stream 与 provider plan 的绑定关系。
    function getStreamPlanBinding(uint256 streamId) external view returns (uint256 planId, bytes32 termsHash) {
        _requireStream(streamId);
        return (streamPlanId[streamId], streamPlanTermsHash[streamId]);
    }

    /// @dev 真正执行通知调用。失败时只更新状态并发事件，不主动 revert。
    function _attemptNotify(uint256 withdrawId) internal returns (bool) {
        NotifyRecord storage record = notifyRecords[withdrawId];
        require(record.streamId != 0, "NOTIFY_NOT_FOUND");
        require(notifier != address(0), "INVALID_NOTIFIER");

        bytes memory failureReason;
        bool ok = false;

        record.attempts += 1;
        record.lastAttemptAt = uint64(block.timestamp);

        try
            IXcmNotifier(notifier).notifyWithdraw(
                record.streamId,
                withdrawId,
                record.receiver,
                record.token,
                record.amount,
                WITHDRAW_REASON
            )
        returns (bool success) {
            ok = success;
        } catch (bytes memory reason) {
            failureReason = reason;
            ok = false;
        }

        if (ok) {
            record.status = NotifyStatus.SUCCESS;
            emit NotifyStatusUpdated(record.streamId, withdrawId, NotifyStatus.SUCCESS, record.attempts);
            return true;
        }

        record.status = NotifyStatus.FAILED;
        emit NotifyStatusUpdated(record.streamId, withdrawId, NotifyStatus.FAILED, record.attempts);
        emit NotifyFailure(record.streamId, withdrawId, notifier, failureReason);
        return false;
    }

    /// @dev 计算当前时刻已归属但尚未提取的金额
    function _calculateOwed(Stream storage stream, uint256 timestamp) internal view returns (uint256) {
        uint256 accrued = _accruedAmount(stream, timestamp);

        if (accrued <= stream.withdrawnAmount) {
            return 0;
        }

        return accrued - stream.withdrawnAmount;
    }

    /// @dev 计算截至 timestamp 的累计归属金额（包含已提取部分）
    function _accruedAmount(Stream storage stream, uint256 timestamp) internal view returns (uint256) {
        if (stream.status == StreamStatus.PENDING || stream.status == StreamStatus.EXPIRED) {
            return 0;
        }

        if (stream.startTime == 0 || timestamp <= stream.startTime) {
            return 0;
        }

        uint256 effectiveTimestamp = timestamp;

        // 取消后停止累计
        if (stream.isCanceled && stream.canceledAt < effectiveTimestamp) {
            effectiveTimestamp = stream.canceledAt;
        }

        // 暂停中时，只累计到暂停瞬间
        if (stream.isPaused && stream.pausedAt < effectiveTimestamp) {
            effectiveTimestamp = stream.pausedAt;
        }

        if (effectiveTimestamp <= stream.startTime) {
            return 0;
        }

        uint256 elapsedSinceStart = effectiveTimestamp - stream.startTime;

        // 释放有效时长 = 总经过时长 - 已完成暂停时长
        if (elapsedSinceStart <= stream.totalPausedDuration) {
            return 0;
        }

        uint256 activeElapsed = elapsedSinceStart - stream.totalPausedDuration;

        // 线性释放上限：durationInSeconds
        if (activeElapsed > stream.durationInSeconds) {
            activeElapsed = stream.durationInSeconds;
        }

        return (stream.deposit * activeElapsed) / stream.durationInSeconds;
    }

    function _isNotifierHealthy() internal view returns (bool) {
        if (notifier == address(0)) {
            return false;
        }

        try IXcmNotifier(notifier).isHealthy() returns (bool healthy) {
            return healthy;
        } catch {
            return false;
        }
    }

    function _createBaseStream(
        address receiver,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        address token
    ) internal returns (uint256 streamId) {
        require(receiver != address(0), "INVALID_RECEIVER");
        require(receiver != msg.sender, "SENDER_EQ_RECEIVER");
        require(token != address(0), "INVALID_TOKEN");
        require(tokenAllowlist[token], "TOKEN_NOT_ALLOWED");
        require(deposit > 0, "ZERO_DEPOSIT");
        require(deposit <= maxDepositPerStream, "DEPOSIT_TOO_LARGE");
        require(durationInSeconds > 0, "ZERO_DURATION");
        require(durationInSeconds <= maxDuration, "DURATION_TOO_LONG");

        streamId = nextStreamId;
        nextStreamId = streamId + 1;

        Stream storage stream = streams[token][streamId];
        stream.sender = msg.sender;
        stream.receiver = receiver;
        stream.deposit = deposit;
        stream.durationInSeconds = durationInSeconds;
        stream.cliffInSeconds = cliffInSeconds;

        streamToken[streamId] = token;
        senderStreamIds[msg.sender].push(streamId);
        receiverStreamIds[receiver].push(streamId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), deposit);
    }

    function _createPendingStream(
        address receiver,
        uint256 deposit,
        uint256 durationInSeconds,
        uint256 cliffInSeconds,
        address token,
        uint256 activationDeadline,
        TriggerPolicy triggerPolicy,
        address authorizedActivator,
        bytes32 serviceRef
    ) internal returns (uint256 streamId) {
        streamId = _createBaseStream(receiver, deposit, durationInSeconds, cliffInSeconds, token);

        Stream storage stream = streams[token][streamId];
        stream.createdAt = block.timestamp;
        stream.activationDeadline = activationDeadline;
        stream.status = StreamStatus.PENDING;
        stream.triggerPolicy = triggerPolicy;
        stream.authorizedActivator = authorizedActivator;
        stream.serviceRef = serviceRef;

        emit StreamCreated(
            streamId,
            msg.sender,
            receiver,
            token,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            0
        );

        emit PendingStreamCreated(
            streamId,
            msg.sender,
            receiver,
            token,
            deposit,
            durationInSeconds,
            cliffInSeconds,
            activationDeadline,
            triggerPolicy,
            authorizedActivator,
            serviceRef
        );
    }

    function _activateStream(uint256 streamId, Stream storage stream, address activator) internal {
        stream.activatedAt = block.timestamp;
        stream.startTime = block.timestamp + stream.cliffInSeconds;
        stream.cliffEndsAt = stream.startTime;
        stream.status = StreamStatus.ACTIVE;

        emit StreamActivated(streamId, activator, stream.activatedAt, stream.startTime);
    }

    function _requireActivationWindowOpen(Stream storage stream) internal view {
        if (stream.activationDeadline != 0) {
            require(block.timestamp <= stream.activationDeadline, "ACTIVATION_DEADLINE_PASSED");
        }
    }

    function _validateActivationTrigger(Stream storage stream, address actor) internal view {
        if (stream.triggerPolicy == TriggerPolicy.SENDER_ONLY) {
            require(actor == stream.sender, "ACTIVATION_NOT_ALLOWED");
            return;
        }

        if (stream.triggerPolicy == TriggerPolicy.RECEIVER_ONLY) {
            require(actor == stream.receiver, "ACTIVATION_NOT_ALLOWED");
            return;
        }

        if (stream.triggerPolicy == TriggerPolicy.EITHER_PARTY) {
            require(actor == stream.sender || actor == stream.receiver, "ACTIVATION_NOT_ALLOWED");
            return;
        }

        if (stream.triggerPolicy == TriggerPolicy.BOTH_PARTIES) {
            require(stream.senderConfirmed && stream.receiverConfirmed, "STREAM_NOT_CONFIRMED");
            require(actor == stream.sender || actor == stream.receiver, "ACTIVATION_NOT_ALLOWED");
            return;
        }

        if (stream.triggerPolicy == TriggerPolicy.AUTHORIZED_OPERATOR) {
            require(actor == stream.authorizedActivator, "ACTIVATION_NOT_ALLOWED");
            return;
        }

        revert("INVALID_TRIGGER_POLICY");
    }

    /// @dev 校验 stream 存在并返回 storage 引用
    function _requireStream(uint256 streamId) internal view returns (Stream storage stream, address token) {
        token = streamToken[streamId];
        require(token != address(0), "STREAM_NOT_FOUND");

        stream = streams[token][streamId];
        require(stream.sender != address(0), "STREAM_NOT_FOUND");
    }
}
