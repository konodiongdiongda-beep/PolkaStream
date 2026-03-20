import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const ROOT = '/Users/dongbu/Public/Data/Myproject/PolkaStream/output/interactive-video';
const RAW_DIR = path.join(ROOT, 'raw');
const WEBM_OUT = path.join(ROOT, 'polkastream-interaction-en.webm');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDir(dir) {
  await fs.mkdir(dir, {recursive: true});
}

async function clickByRole(page, name) {
  const el = page.getByRole('button', {name});
  await el.first().click({timeout: 15000});
  await sleep(900);
}

async function main() {
  await ensureDir(RAW_DIR);

  let browser;
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
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

  const page = await context.newPage();
  const video = page.video();

  await page.goto('https://polkastream-console.vercel.app/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await sleep(2000);
  await clickByRole(page, 'Dashboard');
  await clickByRole(page, 'Streams');
  await clickByRole(page, 'Create Stream');

  const receiverInput = page.getByPlaceholder(/0x/i).first();
  if (await receiverInput.isVisible().catch(() => false)) {
    await receiverInput.fill('0x0000000000000000000000000000000000000001');
    await sleep(600);
  }

  const amountInput = page.getByPlaceholder(/1000|amount/i).first();
  if (await amountInput.isVisible().catch(() => false)) {
    await amountInput.fill('100');
    await sleep(500);
  }

  await clickByRole(page, 'Settlements');
  await clickByRole(page, 'Settings');

  const languageSelect = page.locator('select').first();
  if (await languageSelect.isVisible().catch(() => false)) {
    await languageSelect.selectOption('en').catch(() => null);
    await sleep(900);
  }

  await clickByRole(page, 'Dashboard');
  await sleep(2000);

  await page.close();
  await context.close();
  await browser.close();

  const recordedPath = await video?.path();
  if (!recordedPath) {
    throw new Error('Failed to locate recorded video path.');
  }

  await fs.copyFile(recordedPath, WEBM_OUT);
  console.log(WEBM_OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
