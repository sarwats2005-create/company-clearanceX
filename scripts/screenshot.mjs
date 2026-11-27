// Usage: node scripts/screenshot.mjs <url> <out.png> [width=1440] [height=900] [cookie=name=value]
// Uses the pre-installed Playwright Chromium.
import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/");
const { chromium } = require("playwright");

const [url, out, w = "1440", h = "900", cookie] = process.argv.slice(2);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, locale: "ar-IQ" });
if (cookie) {
    const [name, ...rest] = cookie.split("=");
    await context.addCookies([{ name, value: rest.join("="), url }]);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
if (errors.length) console.log("page errors:\n" + errors.join("\n"));
await browser.close();
