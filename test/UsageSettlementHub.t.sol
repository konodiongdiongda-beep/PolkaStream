// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {UsageSettlementHub} from "contracts/UsageSettlementHub.sol";

contract MockUsdForSettlement is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract UsageSettlementHubTest is Test {
    address internal constant PAYER = address(0xA11CE);
    address internal constant PROVIDER = address(0xB0B);
    address internal constant STRANGER = address(0xCA12);

    UsageSettlementHub internal hub;
    MockUsdForSettlement internal token;

    function setUp() external {
        hub = new UsageSettlementHub();
        token = new MockUsdForSettlement();
        hub.setTokenAllowlist(address(token), true);

        token.mint(PAYER, 1_000_000 ether);

        vm.prank(PAYER);
        token.approve(address(hub), type(uint256).max);
    }

    function testE2E_BatchSettleThenProviderClaim() external {
        vm.prank(PAYER);
        hub.depositEscrow(address(token), 1_000 ether);
        assertEq(hub.payerEscrow(PAYER, address(token)), 1_000 ether, "escrow mismatch after deposit");

        UsageSettlementHub.SettlementItem[] memory items =
            new UsageSettlementHub.SettlementItem[](1);
        items[0] = UsageSettlementHub.SettlementItem({
            payer: PAYER,
            provider: PROVIDER,
            token: address(token),
            amount: 210 ether,
            requestCount: 7
        });

        bytes32 windowId = keccak256("window-2026-03-09-08:00:00Z");
        (uint256 totalAmount, uint256 totalRequests) = hub.settleWindow(windowId, items);

        assertEq(totalAmount, 210 ether, "settle total amount mismatch");
        assertEq(totalRequests, 7, "settle total requests mismatch");
        assertTrue(hub.settledWindows(windowId), "window should be marked settled");
        assertEq(hub.payerEscrow(PAYER, address(token)), 790 ether, "payer escrow should decrease");
        assertEq(
            hub.providerClaimable(PROVIDER, address(token)),
            210 ether,
            "provider claimable should increase"
        );

        uint256 providerBefore = token.balanceOf(PROVIDER);
        vm.prank(PROVIDER);
        hub.claim(address(token), 210 ether, PROVIDER);
        uint256 providerAfter = token.balanceOf(PROVIDER);

        assertEq(providerAfter - providerBefore, 210 ether, "provider claim transfer mismatch");
        assertEq(hub.providerClaimable(PROVIDER, address(token)), 0, "claimable should be cleared");
    }

    function testSingleRequestNotOnchainUntilBatch() external {
        // 模拟 adapter 已写入 usage_event，但 daemon 还未触发 settleWindow
        vm.prank(PAYER);
        hub.depositEscrow(address(token), 100 ether);

        assertEq(hub.providerClaimable(PROVIDER, address(token)), 0, "claimable must stay zero");
        assertEq(hub.payerEscrow(PAYER, address(token)), 100 ether, "escrow should remain untouched");
    }

    function testSettleFailureCanRetryAfterTopUp() external {
        vm.prank(PAYER);
        hub.depositEscrow(address(token), 10 ether);

        UsageSettlementHub.SettlementItem[] memory items =
            new UsageSettlementHub.SettlementItem[](1);
        items[0] = UsageSettlementHub.SettlementItem({
            payer: PAYER,
            provider: PROVIDER,
            token: address(token),
            amount: 25 ether,
            requestCount: 3
        });

        bytes32 windowId = keccak256("window-retriable");

        vm.expectRevert(bytes("INSUFFICIENT_ESCROW"));
        hub.settleWindow(windowId, items);

        assertFalse(hub.settledWindows(windowId), "failed window should remain unsettled");
        assertEq(hub.providerClaimable(PROVIDER, address(token)), 0, "claimable must remain zero");

        vm.prank(PAYER);
        hub.depositEscrow(address(token), 20 ether);

        hub.settleWindow(windowId, items);
        assertTrue(hub.settledWindows(windowId), "window should settle after retry");
        assertEq(hub.providerClaimable(PROVIDER, address(token)), 25 ether, "claimable after retry");
    }

    function testSettleWindowCannotReplay() external {
        vm.prank(PAYER);
        hub.depositEscrow(address(token), 100 ether);

        UsageSettlementHub.SettlementItem[] memory items =
            new UsageSettlementHub.SettlementItem[](1);
        items[0] = UsageSettlementHub.SettlementItem({
            payer: PAYER,
            provider: PROVIDER,
            token: address(token),
            amount: 15 ether,
            requestCount: 1
        });

        bytes32 windowId = keccak256("window-no-replay");
        hub.settleWindow(windowId, items);

        vm.expectRevert(bytes("WINDOW_SETTLED"));
        hub.settleWindow(windowId, items);
    }

    function testOnlyOwnerCanSettleWindow() external {
        vm.prank(PAYER);
        hub.depositEscrow(address(token), 100 ether);

        UsageSettlementHub.SettlementItem[] memory items =
            new UsageSettlementHub.SettlementItem[](1);
        items[0] = UsageSettlementHub.SettlementItem({
            payer: PAYER,
            provider: PROVIDER,
            token: address(token),
            amount: 5 ether,
            requestCount: 1
        });

        bytes32 windowId = keccak256("window-owner-check");
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", STRANGER));
        hub.settleWindow(windowId, items);
    }
}
