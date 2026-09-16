import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5173/";
const checkOnly = process.argv.includes("--check");
const noOpen = process.argv.includes("--no-open");

async function openBrowser() {
  if (noOpen) return;
  // explorer.exe may exit successfully without dispatching the URL to a browser.
  // Launch an installed browser directly and report process-creation failures.
  const candidates = [
    [
      process.env.PROGRAMFILES,
      "Google/Chrome/Application/chrome.exe",
      "Chrome",
    ],
    [
      process.env.LOCALAPPDATA,
      "Google/Chrome/Application/chrome.exe",
      "Chrome",
    ],
    [
      process.env["PROGRAMFILES(X86)"],
      "Microsoft/Edge/Application/msedge.exe",
      "Edge",
    ],
    [process.env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe", "Edge"],
  ];
  for (const [base, suffix, name] of candidates) {
    if (!base) continue;
    const executable = path.join(base, suffix);
    try {
      await access(executable);
      await new Promise((resolve, reject) => {
        const child = spawn(executable, ["--new-window", url], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        });
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      console.log(`已请求 ${name} 打开网站。若未看到窗口，请手动打开：${url}`);
      return;
    } catch {
      /* Try the next installed browser. The server stays available. */
    }
  }
  console.log(`未能自动打开浏览器。请复制以下地址到浏览器：\n${url}`);
}

async function main() {
  let existing = false;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    existing =
      response.ok &&
      (await response.text()).includes('content="poementer-web"');
  } catch {
    /* No existing website: start the project's development server. */
  }

  if (existing) {
    console.log(`回车键网站已经运行：${url}`);
    if (!checkOnly) await openBrowser();
    return;
  }
  if (checkOnly) throw new Error("网站尚未启动。请双击「启动网站.cmd」。");

  let createServer;
  try {
    ({ createServer } = await import("vite"));
  } catch {
    throw new Error(
      "缺少网站依赖。请在项目文件夹运行 npm ci，再双击「启动网站.cmd」。",
    );
  }
  const server = await createServer({
    root,
    configFile: path.join(root, "vite.config.js"),
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  });
  await server.listen();
  console.log(
    `\n回车键网站已启动：${url}\n请保留此窗口；关闭窗口会停止服务。\n`,
  );
  await openBrowser();
  process.once("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(`启动失败：${error.message}`);
  if (error.code === "EADDRINUSE")
    console.error("5173 端口已被其他程序占用，请关闭占用程序后重试。");
  process.exitCode = 1;
});
