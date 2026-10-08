import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const notifications = [];
const sandbox = {
  console: { log() {} },
  $httpClient: {},
  $persistentStore: { read: () => null, write: () => true },
  $notification: { post: (...args) => notifications.push(args) },
};
vm.createContext(sandbox);
const source = fs.readFileSync(new URL("../Scripts/Daoway/daoway-blued.js", import.meta.url), "utf8");
const entry = source.indexOf("\ntry {\nif (typeof $request");
assert.ok(entry > 0, "定位脚本入口，避免执行网络请求和 worker");
vm.runInContext(source.slice(0, entry), sandbox);
sandbox.dwGet = async () => ({ data: { name: "测试技师", age: 24, height: 183, weight: 88 } });
sandbox.matchTech = async () => ({ top: [{ uid: "123", name: "测试用户", stars: 3 }] });

const prefix = "https://nk5oy5.oplinking.com/ulink/c/";
for (const enc of ["PWWzq1", "Abc1234", "Abc12345"]) {
  sandbox.bluedEncUid = async () => enc;
  await sandbox.runMatch("456", 39.9, 116.4);
  const opts = notifications.at(-1)[3];
  assert.equal(opts.action, "open-url");
  const payload = { d: { tr_param1: "https://common.blued.cn/?action=profile-enc=1-uid=" + enc } };
  const expected = Buffer.from(JSON.stringify(payload)).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_");
  assert.equal(opts.url, prefix + expected);
}

sandbox.bluedEncUid = async () => { throw new Error("换发失败"); };
await sandbox.runMatch("456", 39.9, 116.4);
assert.equal(notifications.length, 4);
assert.equal(notifications.at(-1)[3].url, undefined);
console.log("ok: Blued X 通知链接编码、Surge open-url 适配与换发失败处理");
