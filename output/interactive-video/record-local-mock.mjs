import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {decodeFunctionData, encodeFunctionResult, toHex} from 'viem';

const ROOT = '/Users/dongbu/Public/Data/Myproject/PolkaStream/output/interactive-video';
const RAW_DIR = path.join(ROOT, 'raw-local-mock');
const WEBM_OUT = path.join(ROOT, 'polkastream-local-mock.webm');
const MP4_OUT = path.join(ROOT, 'polkastream-local-mock.mp4');
const APP_URL = 'http://127.0.0.1:3000';
const MOCK_RPC_URL = 'https://mock.rpc.local/';

const CHAIN_ID = 420420417n;
const ACCOUNT = '0xa11ce00000000000000000000000000000000001';
const SENDER_OTHER = '0xb0b0000000000000000000000000000000000002';
const RECEIVER = '0xcafe000000000000000000000000000000000003';
const CONTRACT = '0x0ae8b341f31194dd34f11e075e34e3c266ef4d8d';
const TOKEN = '0xee470d349633715a77a93b61e43ef0c881e8410b';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowSec = () => BigInt(Math.floor(Date.now() / 1000));

const pad64 = (value) => value.toString(16).padStart(64, '0');
const hashFromNum = (n) => `0x${pad64(BigInt(n))}`;

const polkaStreamAbi = [
  {
    type: 'function',
    name: 'createStream',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'receiver', type: 'address'},
      {name: 'deposit', type: 'uint256'},
      {name: 'durationInSeconds', type: 'uint256'},
      {name: 'cliffInSeconds', type: 'uint256'},
      {name: 'token', type: 'address'},
    ],
    outputs: [{name: 'streamId', type: 'uint256'}],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelStream',
    stateMutability: 'nonpayable',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [],
  },
  {
    type: 'function',
    name: 'pauseStream',
    stateMutability: 'nonpayable',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [],
  },
  {
    type: 'function',
    name: 'resumeStream',
    stateMutability: 'nonpayable',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getOwed',
    stateMutability: 'view',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [{name: 'owed', type: 'uint256'}],
  },
  {
    type: 'function',
    name: 'getStream',
    stateMutability: 'view',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [
      {name: 'token', type: 'address'},
      {
        name: 'stream',
        type: 'tuple',
        components: [
          {name: 'sender', type: 'address'},
          {name: 'receiver', type: 'address'},
          {name: 'deposit', type: 'uint256'},
          {name: 'withdrawnAmount', type: 'uint256'},
          {name: 'durationInSeconds', type: 'uint256'},
          {name: 'startTime', type: 'uint256'},
          {name: 'cliffEndsAt', type: 'uint256'},
          {name: 'canceledAt', type: 'uint256'},
          {name: 'pausedAt', type: 'uint256'},
          {name: 'totalPausedDuration', type: 'uint256'},
          {name: 'isPaused', type: 'bool'},
          {name: 'isCanceled', type: 'bool'},
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getSenderStreams',
    stateMutability: 'view',
    inputs: [{name: 'sender', type: 'address'}],
    outputs: [{name: 'streamIds', type: 'uint256[]'}],
  },
  {
    type: 'function',
    name: 'getReceiverStreams',
    stateMutability: 'view',
    inputs: [{name: 'receiver', type: 'address'}],
    outputs: [{name: 'streamIds', type: 'uint256[]'}],
  },
  {
    type: 'function',
    name: 'tokenAllowlist',
    stateMutability: 'view',
    inputs: [{name: 'token', type: 'address'}],
    outputs: [{name: '', type: 'bool'}],
  },
  {
    type: 'function',
    name: 'isNotifierHealthy',
    stateMutability: 'view',
    inputs: [],
    outputs: [{name: '', type: 'bool'}],
  },
  {
    type: 'function',
    name: 'retryNotify',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'streamId', type: 'uint256'},
      {name: 'withdrawId', type: 'uint256'},
    ],
    outputs: [{name: 'status', type: 'uint8'}],
  },
  {
    type: 'function',
    name: 'getStreamWithdrawIds',
    stateMutability: 'view',
    inputs: [{name: 'streamId', type: 'uint256'}],
    outputs: [{name: 'withdrawIds', type: 'uint256[]'}],
  },
  {
    type: 'function',
    name: 'getNotifyStatus',
    stateMutability: 'view',
    inputs: [{name: 'withdrawId', type: 'uint256'}],
    outputs: [
      {name: 'status', type: 'uint8'},
      {name: 'attempts', type: 'uint32'},
      {name: 'lastAttemptAt', type: 'uint64'},
    ],
  },
] ;

const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {name: 'spender', type: 'address'},
      {name: 'amount', type: 'uint256'},
    ],
    outputs: [{name: '', type: 'bool'}],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
    ],
    outputs: [{name: '', type: 'uint256'}],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{name: '', type: 'uint8'}],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{name: '', type: 'string'}],
  },
];

const state = {
  blockNumber: 880000n,
  nextTx: 1n,
  nextStreamId: 3n,
  nextWithdrawId: 4n,
  streams: new Map(),
  senderStreams: new Map(),
  receiverStreams: new Map(),
  streamWithdrawIds: new Map(),
  notifyStatus: new Map(),
  allowances: new Map(),
  receipts: new Map(),
};

function setAllowance(owner, spender, amount) {
  const key = `${owner.toLowerCase()}-${spender.toLowerCase()}`;
  state.allowances.set(key, amount);
}

function getAllowance(owner, spender) {
  const key = `${owner.toLowerCase()}-${spender.toLowerCase()}`;
  return state.allowances.get(key) ?? 0n;
}

function addStream(streamId, stream, owed) {
  state.streams.set(streamId, {...stream, owed});
  const senderKey = stream.sender.toLowerCase();
  const receiverKey = stream.receiver.toLowerCase();
  const senderList = state.senderStreams.get(senderKey) ?? [];
  senderList.push(streamId);
  state.senderStreams.set(senderKey, senderList);

  const receiverList = state.receiverStreams.get(receiverKey) ?? [];
  receiverList.push(streamId);
  state.receiverStreams.set(receiverKey, receiverList);

  state.streamWithdrawIds.set(streamId, []);
}

function initMockData() {
  const now = nowSec();
  addStream(
    1n,
    {
      sender: ACCOUNT,
      receiver: RECEIVER,
      token: TOKEN,
      deposit: 1000n * 10n ** 18n,
      withdrawnAmount: 220n * 10n ** 18n,
      durationInSeconds: 2592000n,
      startTime: now - 72000n,
      cliffEndsAt: now - 36000n,
      canceledAt: 0n,
      pausedAt: 0n,
      totalPausedDuration: 0n,
      isPaused: false,
      isCanceled: false,
    },
    55n * 10n ** 18n
  );

  addStream(
    2n,
    {
      sender: SENDER_OTHER,
      receiver: ACCOUNT,
      token: TOKEN,
      deposit: 500n * 10n ** 18n,
      withdrawnAmount: 80n * 10n ** 18n,
      durationInSeconds: 604800n,
      startTime: now - 36000n,
      cliffEndsAt: now - 30000n,
      canceledAt: 0n,
      pausedAt: 0n,
      totalPausedDuration: 0n,
      isPaused: false,
      isCanceled: false,
    },
    42n * 10n ** 18n
  );

  state.streamWithdrawIds.set(2n, [1n, 2n]);
  state.notifyStatus.set(1n, {status: 1n, attempts: 1n, lastAttemptAt: now - 1000n});
  state.notifyStatus.set(2n, {status: 3n, attempts: 2n, lastAttemptAt: now - 300n});
}

initMockData();

function makeReceipt(hash, to) {
  const blockHash = hashFromNum(state.blockNumber);
  return {
    blockHash,
    blockNumber: toHex(state.blockNumber),
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    effectiveGasPrice: '0x3b9aca00',
    from: ACCOUNT,
    gasUsed: '0x5208',
    logs: [],
    logsBloom: `0x${'0'.repeat(512)}`,
    status: '0x1',
    to,
    transactionHash: hash,
    transactionIndex: '0x0',
    type: '0x2',
  };
}

function makeBlock(number) {
  const n = BigInt(number);
  return {
    number: toHex(n),
    hash: hashFromNum(n),
    parentHash: hashFromNum(n - 1n),
    nonce: '0x0000000000000000',
    sha3Uncles: hashFromNum(0n),
    logsBloom: `0x${'0'.repeat(512)}`,
    transactionsRoot: hashFromNum(1n),
    stateRoot: hashFromNum(2n),
    receiptsRoot: hashFromNum(3n),
    miner: ACCOUNT,
    difficulty: '0x0',
    totalDifficulty: '0x0',
    extraData: '0x',
    size: '0x1',
    gasLimit: '0x1c9c380',
    gasUsed: '0x0',
    timestamp: toHex(nowSec()),
    transactions: [],
    uncles: [],
    baseFeePerGas: '0x3b9aca00',
    mixHash: hashFromNum(4n),
  };
}

function normalizeAddress(addr) {
  return (addr ?? '').toLowerCase();
}

function rpcResult(id, result) {
  return {jsonrpc: '2.0', id, result};
}

function rpcError(id, message) {
  return {jsonrpc: '2.0', id, error: {code: -32000, message}};
}

function handleEthCall(tx) {
  const to = normalizeAddress(tx?.to);
  const data = tx?.data;

  if (!data) return '0x';

  if (to === CONTRACT) {
    const decoded = decodeFunctionData({abi: polkaStreamAbi, data});
    switch (decoded.functionName) {
      case 'isNotifierHealthy':
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'isNotifierHealthy', result: true});
      case 'tokenAllowlist':
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'tokenAllowlist', result: true});
      case 'getSenderStreams': {
        const sender = normalizeAddress(decoded.args[0]);
        const ids = state.senderStreams.get(sender) ?? [];
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'getSenderStreams', result: ids});
      }
      case 'getReceiverStreams': {
        const receiver = normalizeAddress(decoded.args[0]);
        const ids = state.receiverStreams.get(receiver) ?? [];
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'getReceiverStreams', result: ids});
      }
      case 'getStream': {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        if (!stream) throw new Error(`stream ${streamId} not found`);
        const tuple = {
          sender: stream.sender,
          receiver: stream.receiver,
          deposit: stream.deposit,
          withdrawnAmount: stream.withdrawnAmount,
          durationInSeconds: stream.durationInSeconds,
          startTime: stream.startTime,
          cliffEndsAt: stream.cliffEndsAt,
          canceledAt: stream.canceledAt,
          pausedAt: stream.pausedAt,
          totalPausedDuration: stream.totalPausedDuration,
          isPaused: stream.isPaused,
          isCanceled: stream.isCanceled,
        };
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'getStream', result: [stream.token, tuple]});
      }
      case 'getOwed': {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        const owed = stream?.owed ?? 0n;
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'getOwed', result: owed});
      }
      case 'getStreamWithdrawIds': {
        const streamId = decoded.args[0];
        const ids = state.streamWithdrawIds.get(streamId) ?? [];
        return encodeFunctionResult({abi: polkaStreamAbi, functionName: 'getStreamWithdrawIds', result: ids});
      }
      case 'getNotifyStatus': {
        const wid = decoded.args[0];
        const status = state.notifyStatus.get(wid) ?? {status: 0n, attempts: 0n, lastAttemptAt: nowSec()};
        return encodeFunctionResult({
          abi: polkaStreamAbi,
          functionName: 'getNotifyStatus',
          result: [status.status, status.attempts, status.lastAttemptAt],
        });
      }
      default:
        return '0x';
    }
  }

  if (to === TOKEN) {
    const decoded = decodeFunctionData({abi: erc20Abi, data});
    switch (decoded.functionName) {
      case 'decimals':
        return encodeFunctionResult({abi: erc20Abi, functionName: 'decimals', result: 18});
      case 'symbol':
        return encodeFunctionResult({abi: erc20Abi, functionName: 'symbol', result: 'mUSD'});
      case 'allowance': {
        const owner = normalizeAddress(decoded.args[0]);
        const spender = normalizeAddress(decoded.args[1]);
        return encodeFunctionResult({abi: erc20Abi, functionName: 'allowance', result: getAllowance(owner, spender)});
      }
      default:
        return '0x';
    }
  }

  return '0x';
}

function handleSendTransaction(tx) {
  const to = normalizeAddress(tx?.to);
  const data = tx?.data;
  const from = normalizeAddress(tx?.from) || ACCOUNT;

  let decoded = null;
  if (data && to === TOKEN) {
    try {
      decoded = decodeFunctionData({abi: erc20Abi, data});
      if (decoded.functionName === 'approve') {
        const spender = normalizeAddress(decoded.args[0]);
        const amount = decoded.args[1];
        setAllowance(from, spender, amount);
      }
    } catch {
      // ignore
    }
  }

  if (data && to === CONTRACT) {
    try {
      decoded = decodeFunctionData({abi: polkaStreamAbi, data});
      if (decoded.functionName === 'createStream') {
        const [receiver, deposit, durationInSeconds, cliffInSeconds, token] = decoded.args;
        const streamId = state.nextStreamId++;
        const now = nowSec();
        addStream(
          streamId,
          {
            sender: ACCOUNT,
            receiver,
            token: normalizeAddress(token),
            deposit,
            withdrawnAmount: 0n,
            durationInSeconds,
            startTime: now,
            cliffEndsAt: now + cliffInSeconds,
            canceledAt: 0n,
            pausedAt: 0n,
            totalPausedDuration: 0n,
            isPaused: false,
            isCanceled: false,
          },
          deposit / 10n
        );
      }

      if (decoded.functionName === 'pauseStream') {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        if (stream && !stream.isCanceled) {
          stream.isPaused = true;
          stream.pausedAt = nowSec();
        }
      }

      if (decoded.functionName === 'resumeStream') {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        if (stream && stream.isPaused) {
          const now = nowSec();
          if (stream.pausedAt > 0n) {
            stream.totalPausedDuration += now - stream.pausedAt;
          }
          stream.pausedAt = 0n;
          stream.isPaused = false;
        }
      }

      if (decoded.functionName === 'cancelStream') {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        if (stream) {
          stream.isCanceled = true;
          stream.canceledAt = nowSec();
          stream.owed = 0n;
        }
      }

      if (decoded.functionName === 'withdraw') {
        const streamId = decoded.args[0];
        const stream = state.streams.get(streamId);
        if (stream && !stream.isCanceled) {
          const payout = stream.owed > 0n ? stream.owed : 10n * 10n ** 18n;
          stream.withdrawnAmount += payout;
          stream.owed = 0n;
          const withdrawId = state.nextWithdrawId++;
          const ids = state.streamWithdrawIds.get(streamId) ?? [];
          ids.push(withdrawId);
          state.streamWithdrawIds.set(streamId, ids);
          state.notifyStatus.set(withdrawId, {
            status: 1n,
            attempts: 1n,
            lastAttemptAt: nowSec(),
          });
        }
      }

      if (decoded.functionName === 'retryNotify') {
        const [, withdrawId] = decoded.args;
        const status = state.notifyStatus.get(withdrawId) ?? {
          status: 3n,
          attempts: 1n,
          lastAttemptAt: nowSec(),
        };
        status.status = 1n;
        status.attempts += 1n;
        status.lastAttemptAt = nowSec();
        state.notifyStatus.set(withdrawId, status);
      }
    } catch {
      // ignore
    }
  }

  const hash = hashFromNum(state.nextTx++);
  state.blockNumber += 1n;
  state.receipts.set(hash, makeReceipt(hash, to || CONTRACT));
  return hash;
}

function handleRpcCall(body) {
  const {id, method, params = []} = body;

  try {
    switch (method) {
      case 'eth_chainId':
        return rpcResult(id, toHex(CHAIN_ID));
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return rpcResult(id, [ACCOUNT]);
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        return rpcResult(id, null);
      case 'eth_blockNumber':
        return rpcResult(id, toHex(state.blockNumber));
      case 'eth_getBlockByNumber':
        return rpcResult(id, makeBlock(state.blockNumber));
      case 'eth_getLogs':
        return rpcResult(id, []);
      case 'eth_getTransactionCount':
        return rpcResult(id, '0x1');
      case 'eth_estimateGas':
        return rpcResult(id, '0x5208');
      case 'eth_gasPrice':
        return rpcResult(id, '0x3b9aca00');
      case 'eth_maxPriorityFeePerGas':
        return rpcResult(id, '0x3b9aca00');
      case 'eth_feeHistory':
        return rpcResult(id, {
          oldestBlock: toHex(state.blockNumber - 1n),
          baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
          gasUsedRatio: [0.5],
          reward: [['0x3b9aca00']],
        });
      case 'eth_call': {
        const tx = params[0] ?? {};
        return rpcResult(id, handleEthCall(tx));
      }
      case 'eth_sendTransaction': {
        const tx = params[0] ?? {};
        return rpcResult(id, handleSendTransaction(tx));
      }
      case 'eth_getTransactionReceipt': {
        const hash = params[0];
        return rpcResult(id, state.receipts.get(hash) ?? null);
      }
      default:
        return rpcResult(id, null);
    }
  } catch (error) {
    return rpcError(id, error instanceof Error ? error.message : String(error));
  }
}

async function run() {
  await fs.mkdir(RAW_DIR, {recursive: true});

  let browser;
  try {
    browser = await chromium.launch({headless: true, channel: 'chrome'});
  } catch {
    browser = await chromium.launch({headless: true});
  }

  const context = await browser.newContext({
    viewport: {width: 1920, height: 1080},
    recordVideo: {
      dir: RAW_DIR,
      size: {width: 1920, height: 1080},
    },
  });

  await context.route('https://mock.rpc.local/**', async (route, request) => {
    const postData = request.postData() || '{}';
    const body = JSON.parse(postData);
    const response = Array.isArray(body) ? body.map(handleRpcCall) : handleRpcCall(body);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify(response),
    });
  });

  await context.addInitScript(
    ({account, chainIdHex, rpcUrl}) => {
      localStorage.setItem('polkastream.language', 'en');

      const rpc = async (method, params = []) => {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({jsonrpc: '2.0', id: Date.now(), method, params}),
        });
        const json = await res.json();
        if (json?.error) {
          const err = new Error(json.error.message || 'mock rpc error');
          // @ts-ignore
          err.code = json.error.code;
          throw err;
        }
        return json.result;
      };

      const provider = {
        isMetaMask: true,
        request: async ({method, params}) => {
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return [account];
          }
          if (method === 'eth_chainId') {
            return chainIdHex;
          }
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
            return null;
          }
          return rpc(method, params || []);
        },
      };

      window.ethereum = provider;
    },
    {account: ACCOUNT, chainIdHex: toHex(CHAIN_ID), rpcUrl: MOCK_RPC_URL}
  );

  const page = await context.newPage();
  const video = page.video();

  await page.goto(APP_URL, {waitUntil: 'domcontentloaded', timeout: 60000});
  await sleep(2200);

  await page.getByRole('button', {name: 'Connect Wallet'}).click();
  await sleep(500);
  await page.getByRole('button', {name: /MetaMask/i}).click();
  await sleep(1800);

  await page.getByRole('button', {name: 'Streams'}).click();
  await sleep(1400);

  const pauseBtn = page.getByRole('button', {name: 'Pause'}).first();
  if (await pauseBtn.isVisible().catch(() => false)) {
    await pauseBtn.click();
    await sleep(1600);
  }

  const resumeBtn = page.getByRole('button', {name: 'Resume'}).first();
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click();
    await sleep(1600);
  }

  const withdrawBtn = page.getByRole('button', {name: 'Withdraw'}).first();
  if (await withdrawBtn.isVisible().catch(() => false)) {
    await withdrawBtn.click();
    await sleep(1600);
  }

  const retryBtn = page.getByRole('button', {name: /Retry Notify/i}).first();
  if (await retryBtn.isVisible().catch(() => false)) {
    await retryBtn.click();
    await sleep(1400);
  }

  await page.getByRole('button', {name: 'Create Stream'}).click();
  await sleep(1000);

  const hexInputs = page.locator('input[placeholder="0x..."]');
  await hexInputs.nth(0).fill(RECEIVER);
  await sleep(300);

  const tokenChip = page.getByRole('button', {name: 'mUSD'}).first();
  if (await tokenChip.isVisible().catch(() => false)) {
    await tokenChip.click();
  } else {
    await hexInputs.nth(1).fill(TOKEN);
  }
  await sleep(400);

  await page.locator('input[placeholder="1000"]').fill('120');
  await sleep(300);
  await page.locator('input[placeholder="2592000"]').fill('86400');
  await sleep(300);
  await page.locator('input[placeholder="0"]').fill('0');
  await sleep(500);

  await page.getByRole('button', {name: 'Create Payment Stream'}).click();
  await sleep(2200);

  await page.getByRole('button', {name: 'Settlements'}).click();
  await sleep(1500);
  await page.getByRole('button', {name: 'Settings'}).click();
  await sleep(1500);
  await page.getByRole('button', {name: 'Dashboard'}).click();
  await sleep(2400);

  await page.close();
  await context.close();
  await browser.close();

  const src = await video?.path();
  if (!src) throw new Error('Failed to locate recorded video path');

  await fs.copyFile(src, WEBM_OUT);
  console.log(WEBM_OUT);
  console.log(MP4_OUT);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
