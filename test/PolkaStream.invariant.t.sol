// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

import {IXcmNotifier} from "contracts/interfaces/IXcmNotifier.sol";
import {PolkaStream} from "contracts/PolkaStream.sol";

contract InvariantMockERC20 is ERC20 {
    constructor() ERC20("Invariant USD", "iUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract InvariantMockNotifier is IXcmNotifier {
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

contract StreamHandler is Test {
    PolkaStream internal immutable polkaStream;
    address internal immutable sender;
    address internal immutable receiver;
    uint256 internal immutable streamId;

    constructor(PolkaStream _polkaStream, address _sender, address _receiver, uint256 _streamId) {
        polkaStream = _polkaStream;
        sender = _sender;
        receiver = _receiver;
        streamId = _streamId;
    }

    function warpTime(uint256 delta) external {
        delta = bound(delta, 1, 3 days);
        vm.warp(block.timestamp + delta);
    }

    function withdraw() external {
        vm.prank(receiver);
        try polkaStream.withdraw(streamId) {} catch {}
    }

    function pause() external {
        vm.prank(sender);
        try polkaStream.pauseStream(streamId) {} catch {}
    }

    function resume() external {
        vm.prank(sender);
        try polkaStream.resumeStream(streamId) {} catch {}
    }

    function cancel() external {
        vm.prank(sender);
        try polkaStream.cancelStream(streamId) {} catch {}
    }
}

contract PolkaStreamInvariantTest is StdInvariant, Test {
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    uint256 internal constant DEPOSIT = 5_000 ether;

    PolkaStream internal polkaStream;
    InvariantMockERC20 internal token;
    uint256 internal streamId;

    function setUp() external {
        vm.warp(1_700_000_000);

        InvariantMockNotifier notifier = new InvariantMockNotifier();
        polkaStream = new PolkaStream(address(notifier), 365 days, 10_000_000 ether);
        token = new InvariantMockERC20();

        polkaStream.setTokenAllowlist(address(token), true);

        token.mint(ALICE, DEPOSIT);
        vm.prank(ALICE);
        token.approve(address(polkaStream), type(uint256).max);

        vm.prank(ALICE);
        streamId = polkaStream.createStream(BOB, DEPOSIT, 90 days, 0, address(token));

        StreamHandler handler = new StreamHandler(polkaStream, ALICE, BOB, streamId);
        targetContract(address(handler));
    }

    /// @notice 资金守恒：withdrawn + refunded + contractBalance == deposit
    function invariant_fundsConservation() external view {
        (, PolkaStream.Stream memory stream) = polkaStream.getStream(streamId);
        uint256 withdrawn = stream.withdrawnAmount;
        uint256 refunded = token.balanceOf(ALICE);
        uint256 contractBalance = token.balanceOf(address(polkaStream));

        assertEq(withdrawn + refunded + contractBalance, DEPOSIT, "funds must be conserved");
        assertEq(withdrawn, token.balanceOf(BOB), "receiver balance should match withdrawn");
    }
}
