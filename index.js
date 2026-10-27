
require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

app.get("/", (req, res) => {
  res.send("LINE Bot is running");
});


app.post("/webhook", line.middleware(config), async (req, res) => {

  res.sendStatus(200);

  for (const event of req.body.events || []) {
    if (
      event.type !== "message" ||
      event.message.type !== "text"
    ) {
      continue;
    }

    try {
      const answer = await askOpenClaw(
        event.source?.userId || event.replyToken,
        event.message.text
      );
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: answer.slice(0, 4500),
          },
        ],
      });
    } catch (err) {
      console.error("LINE 回覆失敗：", err.message);
    }
  }
});



async function askOpenClaw(userId, message) {
  const sessionKey =
    `${process.env.OPENCLAW_SESSION_PREFIX || "line"}-${userId}`;

  const path = require("node:path");
  const fs = require("node:fs");


 const packageDir = require("node:path").join(
  process.cwd(),
  "node_modules",
  "openclaw"
);
  const packageJsonPath = path.join(packageDir, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(
      `執行環境找不到 OpenClaw 套件：${packageDir}`
    );
  }

  const pkg = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf8")
  );

  const entry = pkg.bin?.openclaw;

  if (!entry) {
    throw new Error(
      "OpenClaw package.json 中找不到 CLI 入口"
    );
  }

  const openclawScript = path.resolve(packageDir, entry);

  if (!fs.existsSync(openclawScript)) {
    throw new Error(
      `找不到 OpenClaw CLI 檔案：${openclawScript}`
    );
  }

  console.log("OpenClaw CLI:", openclawScript);

const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

if (!gatewayToken) {
  throw new Error("尚未設定 OPENCLAW_GATEWAY_TOKEN");
}

const { stdout, stderr } = await execFileAsync(
  process.execPath,
  [
  openclawScript,
  "agent",
  "--agent", "main",
  "--session-key", sessionKey,
  "--message", message,
  ],
  {
    timeout: 90000,
    maxBuffer: 1024 * 1024,
  }
);

  if (stderr) console.error("OpenClaw stderr:", stderr);

  return stdout.trim() || "目前無法產生回覆，請稍後再試。";
}



async function checkOpenClawGateway() {
  try {
    const path = require("node:path");

    const openclawScript = path.join(
      process.cwd(),
      "node_modules",
      "openclaw",
      "openclaw.mjs"
    );

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [openclawScript, "gateway", "status"],
      {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      }
    );

    console.log("Gateway status:", stdout);
    if (stderr) console.error("Gateway status stderr:", stderr);
  } catch (err) {
  console.error("Gateway 狀態檢查失敗");
  console.error("錯誤訊息：", err.message);
  console.error("退出代碼：", err.code);
  console.error("stdout：", err.stdout || "");
  console.error("stderr：", err.stderr || "");
  }
}

checkOpenClawGateway();


app.listen(process.env.PORT || 3000, () => {
  console.log("LINE Bot started");
});
