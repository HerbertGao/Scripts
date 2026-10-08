import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createECDH, hkdfSync } from "node:crypto";

const privateKey = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const notifications = [];
const geo = { lat: 39.91234567, lng: 116.41234567 };
const stored = { dw_priv: privateKey, dw_blued_auth: "test-only", dw_blued_geo: JSON.stringify({ lat: 22.5, lng: 114 }) };
const sandbox = {
  console: { log() {} },
  $environment: { "surge-version": "5.11" },
  $httpClient: {},
  $persistentStore: { read: key => stored[key] ?? null, write: () => true },
  $notification: { post: (...args) => notifications.push(args) },
};
vm.createContext(sandbox);
const source = fs.readFileSync(new URL("../Scripts/Daoway/daoway-blued.js", import.meta.url), "utf8");
const entry = source.indexOf("\ntry {\nif (typeof $request");
assert.ok(entry > 0, "定位脚本入口，避免执行网络请求和 worker");
vm.runInContext(source.slice(0, entry).replace("\nfunction main() {\n", "\n"), sandbox);
const ecdh = createECDH("prime256v1");
ecdh.setPrivateKey(Buffer.from(privateKey, "hex"));
const serverPoint = Buffer.from(vm.runInContext("DW.serverPubB64", sandbox), "base64").subarray(-65);
const expectedKey = hkdfSync("sha256", ecdh.computeSecret(serverPoint), Buffer.alloc(16), Buffer.alloc(0), 32);
assert.deepEqual(Buffer.from(sandbox.dwAesKey()), Buffer.from(expectedKey), "ECDH/HKDF 派生保持不变");
const tech = { age: 24, ht: 183, wt: 88, distance: 10 };
const user = { uid: "123", name: "测试用户", age: 24, height: 183, weight: 88, distance: 10.1 };
const nearby = sandbox.bluedNearby;
let query;
sandbox.$httpClient.get = (request, callback) => {
  query = new URLSearchParams(request.url.split("?")[1]);
  callback(null, { status: 200 }, '{"data":[]}');
};
await nearby({}, geo);
assert.equal(query.get("latitude"), String(geo.lat));
assert.equal(query.get("longitude"), String(geo.lng));
for (const invalid of [undefined, { lat: NaN, lng: geo.lng }, { lat: 91, lng: geo.lng }])
  await assert.rejects(nearby({}, invalid), /到位查询坐标/);
let candidates = [], lastFilters;
sandbox.bluedNearby = async (filters, point) => {
  assert.deepEqual({ ...point }, geo, "评分查询使用本次到位原始坐标");
  lastFilters = filters; return candidates;
};
const ratingCases = [
  ["资料与距离吻合", {}, {}, 3],
  ["累计资料误差降二星", {}, { age: 25, height: 185, weight: 91, distance: 10.5 }, 2, 48],
  ["年龄差2已放宽", {}, { age: 26 }, 3, 90],
  ["身高差3已放宽", {}, { height: 186 }, 3, 68],
  ["单项超出二星范围", {}, { height: 187 }, 0],
  ["旧0.5km上限已放宽", {}, { distance: 10.500001 }, 3],
  ["三项各差1及0.5km", {}, { age: 25, height: 184, weight: 89, distance: 10.5 }, 3, 70],
  ["仅年龄差3", {}, { age: 27, distance: 10.2 }, 3, 84],
  ["各差3且距离1km降二星", {}, { age: 27, height: 186, weight: 91, distance: 11 }, 2, 20],
  ["三星60分及1km边界", {}, { age: 25, height: 184, weight: 89, distance: 11 }, 3, 60],
  ["年龄3及1km外边界", {}, { age: 27, distance: 11 }, 3, 68],
  ["高分不能抵消距离超1km", {}, { distance: 11.000001 }, 2],
  ["高分不能抵消资料差超3", {}, { age: 28 }, 0],
  ["缺项重新归一权重", {}, { age: null, height: 185, weight: 91 }, 2, 50.5],
  ["二星距离边界", {}, { distance: 12 }, 2],
  ["超过二星距离边界", {}, { distance: 12.000001 }, 0],
  ["距离差5不再三星", {}, { distance: 15 }, 0],
  ["候选缺一项", {}, { height: null }, 2],
  ["只有一项可比", {}, { height: null, weight: null }, 0],
  ["零值不算可比资料", {}, { height: 0, weight: 0 }, 0],
  ["无效值不算可比资料", {}, { height: "未知" }, 2],
  ["技师缺一项", { wt: null }, {}, 2],
  ["技师只有一项", { ht: null, wt: null }, {}, 0],
  ["技师没有可比资料", { age: null, ht: null, wt: null }, {}, 0],
  ["技师距离未知", { distance: null }, {}, 2],
  ["技师负距离", { distance: -1 }, { distance: 1 }, 2],
  ["技师空距离不是零", { distance: " " }, { distance: 0 }, 2],
  ["技师隐藏距离", { distance: 9999 }, {}, 2],
  ["候选距离未知", {}, { distance: null }, 2],
  ["空距离不是零", {}, { distance: " " }, 2],
  ["无效距离", {}, { distance: "未知" }, 2],
  ["非有限距离", {}, { distance: Infinity }, 2],
  ["负距离", {}, { distance: -1 }, 2],
  ["隐藏距离", {}, { distance: 9999 }, 2],
  ["零距离有效", { distance: 0 }, { distance: 0 }, 3],
  ["浮点边界", { distance: 1.9 }, { distance: 2.4 }, 3],
  ["数字字符串", {}, { age: "24", height: "183", weight: "88", distance: "10.1" }, 3],
];
for (const [label, t, u, stars, score] of ratingCases) {
  candidates = [{ ...user, ...u }];
  const { top } = await sandbox.matchTech({ ...tech, ...t }, geo);
  assert.equal(top[0]?.stars ?? 0, stars, label);
  if (score != null) assert.equal(top[0]?.score, score, `${label}：加权综合分`);
}
assert.equal(lastFilters.age, "21-27");
assert.equal(lastFilters.height, "180-186");
assert.equal(lastFilters.weight, "85-91");

candidates = [
  { ...user, uid: "far", distance: 11 },
  { ...user, uid: "near", age: 25 },
  { ...user, uid: "two-stars", distance: 11.5 },
];
assert.equal((await sandbox.matchTech(tech, geo)).top.map(c => c.uid).join(","), "near,far", "同星综合排序，三星优先");
candidates = [
  { ...user, uid: "height", height: 186 },
  { ...user, uid: "weight", weight: 91 },
  { ...user, uid: "age", age: 27 },
];
assert.equal((await sandbox.matchTech(tech, geo)).top.map(c => c.uid).join(","), "age,weight,height", "相同平均差按字段权重排序");
candidates = [
  { ...user, uid: "partial", height: null },
  { ...user, uid: "unknown", distance: null },
  { ...user, uid: "complete", age: 26, distance: 12 },
];
assert.equal((await sandbox.matchTech(tech, geo)).top.map(c => c.uid).join(","), "complete,unknown,partial", "二星优先完整资料及已知距离");
candidates = [1, 2, 3, 4].map(i => ({ ...user, uid: String(i) }));
assert.equal((await sandbox.matchTech(tech, geo)).top.length, 3, "最多三人，不凑一星");
sandbox.bluedNearby = nearby;

let detailDistance;
sandbox.dwGet = async (_path, point) => {
  assert.deepEqual({ ...point }, geo, "到位查询使用原始坐标");
  return { data: { name: "测试技师", age: 24, height: 183, weight: 88, distance: detailDistance } };
};
sandbox.matchTech = async (_tech, point) => {
  assert.equal(_tech.distance, null, "到位缺失/负距离不被解析为有效正数");
  assert.deepEqual({ ...point }, geo, "两端查询坐标一致");
  return { top: [{ ...user, stars: 3, online: 1, avatar: "https://example.com/avatar.jpg" }] };
};

const prefix = "https://nk5oy5.oplinking.com/ulink/c/";
for (const enc of ["PWWzq1", "Abc1234", "Abc12345"]) {
  sandbox.bluedEncUid = async () => enc;
  await sandbox.runMatch("456", geo.lat, geo.lng);
  const opts = notifications.at(-1)[3];
  assert.equal(opts.action, "open-url");
  const payload = { d: { tr_param1: `https://common.blued.cn/?action=profile-enc=1-uid=${enc}` } };
  const expected = Buffer.from(JSON.stringify(payload)).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_");
  assert.equal(opts.url, prefix + expected);
  assert.equal(opts["media-url"], "https://example.com/avatar.jpg");
  assert.equal(notifications.at(-1)[0], "测试技师（到位 距离未知）");
  assert.equal(notifications.at(-1)[1], "24岁·183cm·88kg");
  assert.equal(notifications.at(-1)[2], "测试用户（uid 123） ⭐⭐⭐\n    24岁 183cm 88kg 离你10.1km 在线");
}

detailDistance = "-1";
sandbox.bluedEncUid = async () => { throw new Error("换发失败"); };
await sandbox.runMatch("456", geo.lat, geo.lng);
assert.equal(notifications.length, 4);
assert.equal(notifications.at(-1)[3].url, undefined);
sandbox.matchTech = async () => ({ top: [] });
await sandbox.runMatch("456", geo.lat, geo.lng);
assert.equal(notifications.at(-1)[2], "没找到匹配的人");
// 回归: HTTP API 必填、按需代码可独立运行, 快速完成后再次点击不会被节流漏唤醒。
const state = { ...stored, dw_dw_geo: JSON.stringify(geo) };
const apiRequests = [], backgroundNotifications = [];
function execute(code, request, argument) {
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  let completed = false;
  vm.runInNewContext(code, {
    console: { log() {} },
    $environment: { "surge-version": "5.11" },
    $request: request, $argument: argument,
    $persistentStore: { read: key => state[key] ?? null, write(value, key) { state[key] = value; return true; } },
    $notification: { post: (...args) => backgroundNotifications.push(args) },
    $httpClient: {
      get({ url }, callback) {
        let data;
        if (url.startsWith("https://api.daoway.cn/daoway/rest/technician/v2/"))
          data = JSON.stringify({ data: { name: "测试技师", age: 24, height: 183, weight: 88, distance: 10 } });
        else if (url.startsWith("https://social.irisgw.cn/users?")) data = JSON.stringify({ data: [user] });
        else if (url.startsWith("https://live.irisgw.cn/live/interact/api/token/query?")) data = "uid=Abc123";
        else assert.fail(`不应额外下载 worker: ${url}`);
        callback(null, { status: 200 }, data);
      },
      post(req, callback) {
        if (req.url.startsWith("http://127.0.0.1:")) apiRequests.push(req); // 不回调: 点击仍须立即放行。
        else {
          assert.equal(req.url, "https://live.irisgw.cn/live/interact/api/token/create");
          callback(null, { status: 200 }, "##testCode##");
        }
      },
    },
    $done() { completed = true; finish(); },
  });
  return { done, get completed() { return completed; } };
}
const click = id => ({ url: `https://api.daoway.cn/daoway/rest/technician/${id}/click`, headers: {} });
await execute(source, click("999"), 'HTTP_API=""').done;
assert.match(backgroundNotifications.pop()[2], /必填参数 HTTP_API/);
assert.equal(apiRequests.length, 0, "缺必填参数不提交任务");
assert.equal(state.dw_click_queue, undefined, "缺必填参数不积压待办");
for (const id of ["456", "457"]) {
  const hook = execute(source, click(id), 'HTTP_API="test-only"');
  assert.equal(hook.completed, true, "不等待后台匹配或 HTTP API 回调");
  assert.equal(apiRequests.length, Number(id) - 455, "每次点击都唤醒, 无3秒节流");
  const req = apiRequests.at(-1);
  assert.equal(req.url, "http://127.0.0.1:6171/v1/scripting/evaluate");
  assert.equal(req.headers["X-Key"], "test-only");
  let payload;
  try { payload = JSON.parse(req.body); }
  catch (err) { assert.fail(`HTTP API 请求体不是 JSON: ${err.message}`); }
  assert.equal(payload.mock_type, "cron");
  assert.equal(payload.timeout, 300);
  assert.equal(payload.script_text.includes("test-only"), false, "提交的代码不夹带 API 密码");
  await execute(payload.script_text).done;
  assert.equal(state.dw_click_queue, "");
  assert.equal(state.dw_blued_running, "");
}
assert.equal(backgroundNotifications.length, 2, "两个点击各完成一次独立后台匹配");
execute(source, click("458"), 'HTTP_API="test-only@127.0.0.1:6170"');
assert.equal(apiRequests.at(-1).url, "http://127.0.0.1:6170/v1/scripting/evaluate");
assert.equal(state.dw_kick_ts, undefined, "不再写入唤醒节流状态");
const module = fs.readFileSync(new URL("../Surge/daoway-blued.module", import.meta.url), "utf8");
assert.doesNotMatch(module, /type=cron|cronexp=/, "模块不注册定时任务");
console.log(`ok: ${ratingCases.length}个评星用例、综合排序、统一查询坐标、ECDH/HKDF 派生、通知和跳转、HTTP API 按需后台执行与必填校验、快速点击不漏唤醒、无 Cron`);
