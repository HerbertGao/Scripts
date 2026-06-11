/**
 * 山姆真实单价·众包采集/上报（双模式，单文件）
 *
 * 采集（http-response）：拦截山姆 App 商品列表接口 grouping/list 的响应，
 *   解析每个商品的标题与价格，按 spuId 去重入队到本地持久化队列后立即放行——
 *   不联网、不阻塞 App。
 * 上报（cron）：后台从队列取一批 POST 到「真实单价比价」API 的 authed
 *   /ingest（Bearer = 用户手填 ApiKey），成功出队并标记已报，失败保留重试。
 *
 * /ingest 落 raw 后秒返 202，tier2 解析与单价计算在服务端后台异步完成。
 *
 * 设计：
 *  - 采集只读不改写山姆响应，立即 $.done({}) 透传放行（不影响 App）。
 *  - 静默运行：只输出日志、不发任何通知。
 *  - 本地按 spuId+价格(分) 去重，仅入队/上报新出现或变价的商品。
 *  - 鉴权 Key 不内置，由用户在模块参数里手填；留空则不入队/不上报。
 *  - Reset=true：下一次 cron 清空本地 seen+queue 并暂停采集/上报（一次性，
 *    用于服务端数据整体重录后让本机重新采集）；清空后改回 false 恢复。
 *  - cron 每 5 分钟一次；队列为空时静默（不打印「无需上报」日志）。
 */
const $ = new Env("sam-unit-price.js");

const SEEN_KEY = "sam_unit_price_seen"; // 持久化 { [spuId]: cents } 已成功上报
const QUEUE_KEY = "sam_unit_price_queue"; // 持久化 { [spuId]: {title, cents} } 待上报(按 spuId 去重)
const QUEUE_MAX = 800; // 队列上限,防未配置时无限增长
const BATCH = 30; // 每次 cron 最多上报条数
const POOL = 5; // 并发上限
const REQ_TIMEOUT = 8000; // 单请求超时 ms

const cfg = parseArgs(typeof $argument === "string" ? $argument : "");
$.logLevel = (cfg.LogLevel || "info").toLowerCase();

if (typeof $response !== "undefined" && $response) {
  // 采集模式(http-response):解析 + 入队 + 立即放行,不联网、不阻塞 App
  try {
    if (isTruthy(cfg.Reset)) $.debug("Reset 开启,暂停采集");
    else capture(cfg);
  } catch (e) {
    $.error("采集异常: " + (e && (e.stack || e.message || e)));
  }
  $.done({}); // 透传放行(瞬间)
} else if (isTruthy(cfg.Reset)) {
  // 重置模式(cron):清空本地 seen + queue,暂停采集与上报。
  // 用于服务端数据整体重录后,让本机忘掉「已上报」记录、从零重新采集。
  $.setjson({}, SEEN_KEY);
  $.setjson({}, QUEUE_KEY);
  $.info("🧹 已重置:本地 seen + queue 已清空。请把模块参数 Reset 改回 false 以恢复采集与上报。");
  $.done();
} else {
  // 上报模式(cron):后台异步把队列 POST 到 /ingest
  drain(cfg)
    .catch((e) => $.error("上报异常: " + (e && (e.stack || e.message || e))))
    .finally(() => $.done());
}

// 采集:解析 dataList → 按 spuId+价格去重(对照 seen 与现有 queue)→ 入队
function capture(cfg) {
  const apiBase = (cfg.ApiBase || "").replace(/\/+$/, "");
  const apiKey = cfg.ApiKey || "";
  if (!apiBase || !apiKey) {
    $.warn("未配置 ApiBase / ApiKey,不入队(防队列堆积)");
    return;
  }
  const body = $response && $response.body;
  if (!body) {
    $.warn("响应无 body,跳过");
    return;
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    $.warn("响应非 JSON,跳过: " + (e.message || e));
    return;
  }
  const list = json && json.data && Array.isArray(json.data.dataList) ? json.data.dataList : [];
  if (!list.length) {
    $.info("dataList 为空,跳过");
    return;
  }
  const seen = $.getjson(SEEN_KEY, {}) || {};
  const queue = $.getjson(QUEUE_KEY, {}) || {};
  let added = 0;
  for (const it of list) {
    const spuId = it && it.spuId != null ? String(it.spuId) : "";
    const title = it && typeof it.title === "string" ? it.title.trim() : "";
    const cents = pickPriceCents(it);
    if (!spuId || !title || cents == null) continue;
    if (seen[spuId] === cents) continue; // 已成功上报且未变价
    if (queue[spuId] && queue[spuId].cents === cents) continue; // 已在队列且未变价
    queue[spuId] = { title, cents };
    added++;
  }
  // 队列上限:超出按插入序丢最早
  const keys = Object.keys(queue);
  if (keys.length > QUEUE_MAX) for (const k of keys.slice(0, keys.length - QUEUE_MAX)) delete queue[k];
  $.setjson(queue, QUEUE_KEY);
  $.info(`采集:接口返回 ${list.length}、新入队 ${added}、队列共 ${Object.keys(queue).length}`);
}

// 上报:从队列取一批 POST /ingest;2xx→出队+标记 seen;invalid-request→丢弃(坏数据);其余→保留重试
async function drain(cfg) {
  const apiBase = (cfg.ApiBase || "").replace(/\/+$/, "");
  const apiKey = cfg.ApiKey || "";
  if (!apiBase || !apiKey) {
    $.warn("未配置 ApiBase / ApiKey,跳过上报");
    return;
  }
  const queue = $.getjson(QUEUE_KEY, {}) || {};
  const seen = $.getjson(SEEN_KEY, {}) || {};
  const ids = Object.keys(queue).slice(0, BATCH);
  if (!ids.length) {
    $.debug("队列为空,跳过"); // 静默:default(info) 级不打印,仅 debug 可见
    return;
  }
  $.info(`上报开始:队列 ${Object.keys(queue).length}、本次处理 ${ids.length}`);
  let ok = 0,
    drop = 0,
    keep = 0;
  const work = async (spuId) => {
    const x = queue[spuId];
    try {
      const resp = await $.http.post({
        url: apiBase + "/ingest",
        timeout: REQ_TIMEOUT,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({ title: x.title, price: x.cents / 100, store: "sam", storeSku: spuId }),
      });
      const code = Number(resp && (resp.status || resp.statusCode)) || 0;
      const err = errCode(resp && resp.body);
      if (code >= 200 && code < 300) {
        // /ingest 对一切上报(含不可解析标题)都返 202,服务端后台解析——故 2xx 即出队、不再重试
        seen[spuId] = x.cents;
        delete queue[spuId];
        ok++;
        $.debug(`✓ ${spuId} ¥${x.cents / 100} ${x.title}`);
      } else if (err === "invalid-request") {
        // 坏数据(理论上不该来自山姆):移出队列,避免反复重试
        seen[spuId] = x.cents;
        delete queue[spuId];
        drop++;
        $.info(`⊘ ${spuId} 丢弃(invalid-request):${x.title}`);
      } else {
        // 401/403/429/persistence-error/网络:保留下次 cron 重试
        keep++;
        $.warn(`✗ ${spuId} HTTP ${code} ${err || ""} 保留重试`);
      }
    } catch (e) {
      keep++;
      $.warn(`✗ ${spuId} 请求异常,保留重试: ${e && (e.message || e)}`);
    }
  };
  await runPool(ids, POOL, work);
  $.setjson(queue, QUEUE_KEY);
  $.setjson(seen, SEEN_KEY);
  $.info(`上报完成:成功 ${ok}、丢弃 ${drop}、保留 ${keep}、队列剩 ${Object.keys(queue).length}`);
}

// ── helpers ────────────────────────────────────────────────────────────────
/** 解析 Surge $argument（`K="v"&K2="v2"` 形态）为对象。 */
function parseArgs(s) {
  const o = {};
  String(s || "")
    .split("&")
    .forEach((kv) => {
      if (!kv) return;
      const i = kv.indexOf("=");
      if (i < 0) return;
      const k = kv.slice(0, i);
      let v = kv.slice(i + 1).replace(/^"|"$/g, "");
      try {
        v = decodeURIComponent(v);
      } catch (_) {}
      o[k] = v;
    });
  return o;
}

/** 宽松真值判断（Surge 参数为字符串）：true/1/yes/on/是 视为真，其余（含空、false）为假。 */
function isTruthy(v) {
  return /^(true|1|yes|on|是)$/i.test(String(v == null ? "" : v).trim());
}

/** 价格优先取 priceInfo[0].price（分，字符串）；兜底 it.price。返回整数分或 null。 */
function pickPriceCents(it) {
  const raw = it && it.priceInfo && it.priceInfo[0] ? it.priceInfo[0].price : it ? it.price : undefined;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function truncate(s, n) {
  s = String(s == null ? "" : s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/** 从 /ingest 响应体解析 error code(无则空串)。 */
function errCode(body) {
  try {
    const j = JSON.parse(body);
    return j && j.error ? String(j.error) : "";
  } catch {
    return "";
  }
}

/** 固定并发池跑 items（每个交给 worker），全部完成后 resolve。 */
async function runPool(items, size, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

// ── Env（NobyDa/chavy 跨平台垫片，内联以自包含；与本仓其它脚本一致）──────────
function Env(e,t){class s{constructor(e){this.env=e}send(e,t="GET"){e="string"==typeof e?{url:e}:e;let s=this.get;"POST"===t&&(s=this.post);const i=new Promise((t,i)=>{s.call(this,e,(e,s,o)=>{e?i(e):t(s)})});return e.timeout?((e,t=1e3)=>Promise.race([e,new Promise((e,s)=>{setTimeout(()=>{s(new Error("请求超时"))},t)})]))(i,e.timeout):i}get(e){return this.send.call(this.env,e)}post(e){return this.send.call(this.env,e,"POST")}}return new class{constructor(e,t){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=e,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,t),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof Egern?"Egern":"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}isEgern(){return"Egern"===this.getEnv()}toObj(e,t=null){try{return JSON.parse(e)}catch{return t}}toStr(e,t=null,...s){try{return JSON.stringify(e,...s)}catch{return t}}getjson(e,t){let s=t;if(this.getdata(e))try{s=JSON.parse(this.getdata(e))}catch{}return s}setjson(e,t){try{return this.setdata(JSON.stringify(e),t)}catch{return!1}}getScript(e){return new Promise(t=>{this.get({url:e},(e,s,i)=>t(i))})}runScript(e,t){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=t&&t.timeout?t.timeout:o;const[r,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:e,mock_type:"cron",timeout:o},headers:{"X-Key":r,Accept:"*/*"},policy:"DIRECT",timeout:o};this.post(n,(e,t,i)=>s(i))}).catch(e=>this.logErr(e))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t);if(!s&&!i)return{};{const i=s?e:t;try{return JSON.parse(this.fs.readFileSync(i))}catch(e){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t),o=JSON.stringify(this.data);s?this.fs.writeFileSync(e,o):i?this.fs.writeFileSync(t,o):this.fs.writeFileSync(e,o)}}lodash_get(e,t,s=void 0){const i=t.replace(/\[(\d+)\]/g,".$1").split(".");let o=e;for(const e of i)if(o=Object(o)[e],void 0===o)return s;return o}lodash_set(e,t,s){return Object(e)!==e||(Array.isArray(t)||(t=t.toString().match(/[^.[\]]+/g)||[]),t.slice(0,-1).reduce((e,s,i)=>Object(e[s])===e[s]?e[s]:e[s]=(Math.abs(t[i+1])|0)===+t[i+1]?[]:{},e)[t[t.length-1]]=s),e}getdata(e){let t=this.getval(e);if(/^@/.test(e)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(e),o=s?this.getval(s):"";if(o)try{const e=JSON.parse(o);t=e?this.lodash_get(e,i,""):t}catch(e){t=""}}return t}setdata(e,t){let s=!1;if(/^@/.test(t)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(t),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const t=JSON.parse(a);this.lodash_set(t,o,e),s=this.setval(JSON.stringify(t),i)}catch(t){const r={};this.lodash_set(r,o,e),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(e,t);return s}getval(e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":return $persistentStore.read(e);case"Quantumult X":return $prefs.valueForKey(e);case"Node.js":return this.data=this.loaddata(),this.data[e];default:return this.data&&this.data[e]||null}}setval(e,t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":return $persistentStore.write(e,t);case"Quantumult X":return $prefs.setValueForKey(e,t);case"Node.js":return this.data=this.loaddata(),this.data[t]=e,this.writedata(),!0;default:return this.data&&this.data[t]||null}}initGotEnv(e){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,e&&(e.headers=e.headers?e.headers:{},e&&(e.headers=e.headers?e.headers:{},void 0===e.headers.cookie&&void 0===e.headers.Cookie&&void 0===e.cookieJar&&(e.cookieJar=this.ckjar)))}get(e,t=()=>{}){switch(e.headers&&(delete e.headers["Content-Type"],delete e.headers["Content-Length"],delete e.headers["content-type"],delete e.headers["content-length"]),e.params&&(e.url+="?"+this.queryStr(e.params)),void 0===e.followRedirect||e.followRedirect||((this.isSurge()||this.isLoon())&&(e["auto-redirect"]=!1),this.isQuanX()&&(e.opts?e.opts.redirection=!1:e.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:this.isSurge()&&this.isNeedRewrite&&(e.headers=e.headers||{},Object.assign(e.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":this.isNeedRewrite&&(e.opts=e.opts||{},Object.assign(e.opts,{hints:!1})),$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(e),this.got(e).on("redirect",(e,t)=>{try{if(e.headers["set-cookie"]){const s=e.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),t.cookieJar=this.ckjar}}catch(e){this.logErr(e)}}).then(e=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=e,n=s.decode(a,this.encoding);t(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:i,response:o}=e;t(i,o,o&&s.decode(o.rawBody,this.encoding))})}}post(e,t=()=>{}){const s=e.method?e.method.toLocaleLowerCase():"post";switch(e.body&&e.headers&&!e.headers["Content-Type"]&&!e.headers["content-type"]&&(e.headers["content-type"]="application/x-www-form-urlencoded"),e.headers&&(delete e.headers["Content-Length"],delete e.headers["content-length"]),void 0===e.followRedirect||e.followRedirect||((this.isSurge()||this.isLoon())&&(e["auto-redirect"]=!1),this.isQuanX()&&(e.opts?e.opts.redirection=!1:e.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:this.isSurge()&&this.isNeedRewrite&&(e.headers=e.headers||{},Object.assign(e.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":e.method=s,this.isNeedRewrite&&(e.opts=e.opts||{},Object.assign(e.opts,{hints:!1})),$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(e);const{url:o,...r}=e;this.got[s](o,r).then(e=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=e,n=i.decode(a,this.encoding);t(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:s,response:o}=e;t(s,o,o&&i.decode(o.rawBody,this.encoding))})}}time(e,t=null){const s=t?new Date(t):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(e)&&(e=e.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let t in i)new RegExp("("+t+")").test(e)&&(e=e.replace(RegExp.$1,1==RegExp.$1.length?i[t]:("00"+i[t]).substr((""+i[t]).length)));return e}queryStr(e){let t="";for(const s in e){let i=e[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),t+=`${s}=${i}&`)}return t=t.substring(0,t.length-1),t}msg(t=e,s="",i="",o={}){const r=e=>{const{$open:t,$copy:s,$media:i,$mediaMime:o}=e;switch(typeof e){case void 0:return e;case"string":switch(this.getEnv()){case"Surge":case"Stash":case"Egern":default:return{url:e};case"Loon":case"Shadowrocket":return e;case"Quantumult X":return{"open-url":e};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":case"Egern":default:{const r={};let a=e.openUrl||e.url||e["open-url"]||t;a&&Object.assign(r,{action:"open-url",url:a});let n=e["update-pasteboard"]||e.updatePasteboard||s;n&&Object.assign(r,{action:"clipboard",text:n});let h=e.mediaUrl||e["media-url"]||i;if(h){let e,t;if(h.startsWith("http"));else if(h.startsWith("data:")){const[s]=h.split(";"),[,i]=h.split(",");e=i,t=s.replace("data:","")}else{e=h,t=(e=>{const t={JVBERi0:"application/pdf",R0lGODdh:"image/gif",R0lGODlh:"image/gif",iVBORw0KGgo:"image/png","/9j/":"image/jpg"};for(var s in t)if(0===e.indexOf(s))return t[s];return null})(h)}Object.assign(r,{"media-url":h,"media-base64":e,"media-base64-mime":o??t})}return Object.assign(r,{"auto-dismiss":e["auto-dismiss"],sound:e.sound}),r}case"Loon":{const s={};let o=e.openUrl||e.url||e["open-url"]||t;o&&Object.assign(s,{openUrl:o});let r=e.mediaUrl||e["media-url"]||i;return r&&Object.assign(s,{mediaUrl:r}),console.log(JSON.stringify(s)),s}case"Quantumult X":{const o={};let r=e["open-url"]||e.url||e.openUrl||t;r&&Object.assign(o,{"open-url":r});let a=e.mediaUrl||e["media-url"]||i;a&&Object.assign(o,{"media-url":a});let n=e["update-pasteboard"]||e.updatePasteboard||s;return n&&Object.assign(o,{"update-pasteboard":n}),console.log(JSON.stringify(o)),o}case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:$notification.post(t,s,i,r(o));break;case"Quantumult X":$notify(t,s,i,r(o));case"Node.js":}if(!this.isMuteLog){let e=["","==============📣系统通知📣=============="];e.push(t),s&&e.push(s),i&&e.push(i),console.log(e.join("\n")),this.logs=this.logs.concat(e)}}debug(...e){this.logLevels[this.logLevel]<=this.logLevels.debug&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.debug}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}info(...e){this.logLevels[this.logLevel]<=this.logLevels.info&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.info}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}warn(...e){this.logLevels[this.logLevel]<=this.logLevels.warn&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.warn}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}error(...e){this.logLevels[this.logLevel]<=this.logLevels.error&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.error}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}log(...e){e.length>0&&(this.logs=[...this.logs,...e]),console.log(e.map(e=>e??String(e)).join(this.logSeparator))}logErr(e,t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t,e);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t,void 0!==e.message?e.message:e,e.stack)}}wait(e){return new Promise(t=>setTimeout(t,e))}done(e={}){const t=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${t} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":case"Quantumult X":default:$done(e);break;case"Node.js":process.exit(1)}}}(e,t)}
