function Env(e,t){class s{constructor(e){this.env=e}send(e,t="GET"){e="string"==typeof e?{url:e}:e;let s=this.get;"POST"===t&&(s=this.post);const i=new Promise((t,i)=>{s.call(this,e,(e,s,o)=>{e?i(e):t(s)})});return e.timeout?((e,t=1e3)=>Promise.race([e,new Promise((e,s)=>{setTimeout(()=>{s(new Error("请求超时"))},t)})]))(i,e.timeout):i}get(e){return this.send.call(this.env,e)}post(e){return this.send.call(this.env,e,"POST")}}return new class{constructor(e,t){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=e,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,t),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof Egern?"Egern":"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}isEgern(){return"Egern"===this.getEnv()}toObj(e,t=null){try{return JSON.parse(e)}catch{return t}}toStr(e,t=null,...s){try{return JSON.stringify(e,...s)}catch{return t}}getjson(e,t){let s=t;if(this.getdata(e))try{s=JSON.parse(this.getdata(e))}catch{}return s}setjson(e,t){try{return this.setdata(JSON.stringify(e),t)}catch{return!1}}getScript(e){return new Promise(t=>{this.get({url:e},(e,s,i)=>t(i))})}runScript(e,t){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=t&&t.timeout?t.timeout:o;const[r,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:e,mock_type:"cron",timeout:o},headers:{"X-Key":r,Accept:"*/*"},policy:"DIRECT",timeout:o};this.post(n,(e,t,i)=>s(i))}).catch(e=>this.logErr(e))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t);if(!s&&!i)return{};{const i=s?e:t;try{return JSON.parse(this.fs.readFileSync(i))}catch(e){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const e=this.path.resolve(this.dataFile),t=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(e),i=!s&&this.fs.existsSync(t),o=JSON.stringify(this.data);s?this.fs.writeFileSync(e,o):i?this.fs.writeFileSync(t,o):this.fs.writeFileSync(e,o)}}lodash_get(e,t,s=void 0){const i=t.replace(/\[(\d+)\]/g,".$1").split(".");let o=e;for(const e of i)if(o=Object(o)[e],void 0===o)return s;return o}lodash_set(e,t,s){return Object(e)!==e||(Array.isArray(t)||(t=t.toString().match(/[^.[\]]+/g)||[]),t.slice(0,-1).reduce((e,s,i)=>Object(e[s])===e[s]?e[s]:e[s]=(Math.abs(t[i+1])|0)===+t[i+1]?[]:{},e)[t[t.length-1]]=s),e}getdata(e){let t=this.getval(e);if(/^@/.test(e)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(e),o=s?this.getval(s):"";if(o)try{const e=JSON.parse(o);t=e?this.lodash_get(e,i,""):t}catch(e){t=""}}return t}setdata(e,t){let s=!1;if(/^@/.test(t)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(t),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const t=JSON.parse(a);this.lodash_set(t,o,e),s=this.setval(JSON.stringify(t),i)}catch(t){const r={};this.lodash_set(r,o,e),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(e,t);return s}getval(e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":return $persistentStore.read(e);case"Quantumult X":return $prefs.valueForKey(e);case"Node.js":return this.data=this.loaddata(),this.data[e];default:return this.data&&this.data[e]||null}}setval(e,t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":return $persistentStore.write(e,t);case"Quantumult X":return $prefs.setValueForKey(e,t);case"Node.js":return this.data=this.loaddata(),this.data[t]=e,this.writedata(),!0;default:return this.data&&this.data[t]||null}}initGotEnv(e){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,e&&(e.headers=e.headers?e.headers:{},e&&(e.headers=e.headers?e.headers:{},void 0===e.headers.cookie&&void 0===e.headers.Cookie&&void 0===e.cookieJar&&(e.cookieJar=this.ckjar)))}get(e,t=()=>{}){switch(e.headers&&(delete e.headers["Content-Type"],delete e.headers["Content-Length"],delete e.headers["content-type"],delete e.headers["content-length"]),e.params&&(e.url+="?"+this.queryStr(e.params)),void 0===e.followRedirect||e.followRedirect||((this.isSurge()||this.isLoon())&&(e["auto-redirect"]=!1),this.isQuanX()&&(e.opts?e.opts.redirection=!1:e.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:this.isSurge()&&this.isNeedRewrite&&(e.headers=e.headers||{},Object.assign(e.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":this.isNeedRewrite&&(e.opts=e.opts||{},Object.assign(e.opts,{hints:!1})),$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(e),this.got(e).on("redirect",(e,t)=>{try{if(e.headers["set-cookie"]){const s=e.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),t.cookieJar=this.ckjar}}catch(e){this.logErr(e)}}).then(e=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=e,n=s.decode(a,this.encoding);t(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:i,response:o}=e;t(i,o,o&&s.decode(o.rawBody,this.encoding))})}}post(e,t=()=>{}){const s=e.method?e.method.toLocaleLowerCase():"post";switch(e.body&&e.headers&&!e.headers["Content-Type"]&&!e.headers["content-type"]&&(e.headers["content-type"]="application/x-www-form-urlencoded"),e.headers&&(delete e.headers["Content-Length"],delete e.headers["content-length"]),void 0===e.followRedirect||e.followRedirect||((this.isSurge()||this.isLoon())&&(e["auto-redirect"]=!1),this.isQuanX()&&(e.opts?e.opts.redirection=!1:e.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:this.isSurge()&&this.isNeedRewrite&&(e.headers=e.headers||{},Object.assign(e.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](e,(e,s,i)=>{!e&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),t(e,s,i)});break;case"Quantumult X":e.method=s,this.isNeedRewrite&&(e.opts=e.opts||{},Object.assign(e.opts,{hints:!1})),$task.fetch(e).then(e=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=e;t(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)},e=>t(e&&e.error||"UndefinedError"));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(e);const{url:o,...r}=e;this.got[s](o,r).then(e=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=e,n=i.decode(a,this.encoding);t(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)},e=>{const{message:s,response:o}=e;t(s,o,o&&i.decode(o.rawBody,this.encoding))})}}time(e,t=null){const s=t?new Date(t):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(e)&&(e=e.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let t in i)new RegExp("("+t+")").test(e)&&(e=e.replace(RegExp.$1,1==RegExp.$1.length?i[t]:("00"+i[t]).substr((""+i[t]).length)));return e}queryStr(e){let t="";for(const s in e){let i=e[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),t+=`${s}=${i}&`)}return t=t.substring(0,t.length-1),t}msg(t=e,s="",i="",o={}){const r=e=>{const{$open:t,$copy:s,$media:i,$mediaMime:o}=e;switch(typeof e){case void 0:return e;case"string":switch(this.getEnv()){case"Surge":case"Stash":case"Egern":default:return{url:e};case"Loon":case"Shadowrocket":return e;case"Quantumult X":return{"open-url":e};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":case"Egern":default:{const r={};let a=e.openUrl||e.url||e["open-url"]||t;a&&Object.assign(r,{action:"open-url",url:a});let n=e["update-pasteboard"]||e.updatePasteboard||s;n&&Object.assign(r,{action:"clipboard",text:n});let h=e.mediaUrl||e["media-url"]||i;if(h){let e,t;if(h.startsWith("http"));else if(h.startsWith("data:")){const[s]=h.split(";"),[,i]=h.split(",");e=i,t=s.replace("data:","")}else{e=h,t=(e=>{const t={JVBERi0:"application/pdf",R0lGODdh:"image/gif",R0lGODlh:"image/gif",iVBORw0KGgo:"image/png","/9j/":"image/jpg"};for(var s in t)if(0===e.indexOf(s))return t[s];return null})(h)}Object.assign(r,{"media-url":h,"media-base64":e,"media-base64-mime":o??t})}return Object.assign(r,{"auto-dismiss":e["auto-dismiss"],sound:e.sound}),r}case"Loon":{const s={};let o=e.openUrl||e.url||e["open-url"]||t;o&&Object.assign(s,{openUrl:o});let r=e.mediaUrl||e["media-url"]||i;return r&&Object.assign(s,{mediaUrl:r}),console.log(JSON.stringify(s)),s}case"Quantumult X":{const o={};let r=e["open-url"]||e.url||e.openUrl||t;r&&Object.assign(o,{"open-url":r});let a=e.mediaUrl||e["media-url"]||i;a&&Object.assign(o,{"media-url":a});let n=e["update-pasteboard"]||e.updatePasteboard||s;return n&&Object.assign(o,{"update-pasteboard":n}),console.log(JSON.stringify(o)),o}case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":default:$notification.post(t,s,i,r(o));break;case"Quantumult X":$notify(t,s,i,r(o));case"Node.js":}if(!this.isMuteLog){let e=["","==============📣系统通知📣=============="];e.push(t),s&&e.push(s),i&&e.push(i),console.log(e.join("\n")),this.logs=this.logs.concat(e)}}debug(...e){this.logLevels[this.logLevel]<=this.logLevels.debug&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.debug}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}info(...e){this.logLevels[this.logLevel]<=this.logLevels.info&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.info}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}warn(...e){this.logLevels[this.logLevel]<=this.logLevels.warn&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.warn}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}error(...e){this.logLevels[this.logLevel]<=this.logLevels.error&&(e.length>0&&(this.logs=[...this.logs,...e]),console.log(`${this.logLevelPrefixs.error}${e.map(e=>e??String(e)).join(this.logSeparator)}`))}log(...e){e.length>0&&(this.logs=[...this.logs,...e]),console.log(e.map(e=>e??String(e)).join(this.logSeparator))}logErr(e,t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t,e);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t,void 0!==e.message?e.message:e,e.stack)}}wait(e){return new Promise(t=>setTimeout(t,e))}done(e={}){const t=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${t} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Egern":case"Quantumult X":default:$done(e);break;case"Node.js":process.exit(1)}}}(e,t)}

/* ============ Env (chavyleung) 跨平台垫片: 通知/持久化/HTTP 统一走 $.msg/$.http — Surge/Loon/QX/Shadowrocket 通用 ============ */
const $ = new Env("到位×Blued");

/**
 * 到位×Blued 匹配插件 — Surge http-request 脚本
 *
 * 打开到位技师主页(命中 /technician/v2/{dwid}/by_buyer)时:
 *   1. 自建客户端(ECDH P-256 + HKDF + AES-256-GCM)拉该技师明文档案
 *   2. Blued /users 服务端 filters(±3)预筛, 按技师现有维度打分
 *   3. $notification 推送高置信匹配(不凑数)
 */

/* ============ 配置 ============ */
const DW = {
  serverPubB64: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEd4/Jv64KEHsOmsKOresVkLGCU6pIsQ0uiWvMaWFVWRtwLJAxPb0Q0nrKSXXrhG2FIgm80AKaGlOc8WeStdZmtg==",
  api: "https://api.daoway.cn/daoway/rest",
};
const BLUED = {
  social: "https://social.irisgw.cn",
  live: "https://live.irisgw.cn",
  tags: "3_6",
};
// encryptId 是服务端生成的(定性复现): ① POST token/create 口令 → ② GET token/query 抠 cuuid=短码
// 二分试验结论: 这两个接口只需 authorization 一个头即可, 其余/签名时效均不校验(curl/bin 自证)
// 凭证/坐标不硬编码: 拦截 Blued App 自身请求时缓存
//   dw_blued_auth = authorization 头(Basic uid:token)
//   dw_blued_geo  = {lat,lng} App 请求里的定位
const AUTH_KEY = "dw_blued_auth", GEO_KEY = "dw_blued_geo";
// 可选秒级推送: 模块参数 HTTP_API 只填 Surge http-api 的密码(需先在配置 [General] 开启 http-api);
// 端口自动尝试 6171/6170, 也可 "密码@host:port" 指定; 不填则等 cron 兜底(≤1分钟)
const HTTP_API = (typeof $argument === "string" && /HTTP_API="([^"]*)"/.test($argument)) ? $argument.match(/HTTP_API="([^"]*)"/)[1].trim() : "";
const HTTP_API_ADDRS = ["127.0.0.1:6171", "127.0.0.1:6170"];
const WORKER_NAME = "到位匹配任务";

/* 日志: $console 不保证存在, 退回 console 并静默兜底 */
function log(msg) { $.log(msg); }  // Env: console 打印 + 会话日志聚合

/* ============ 工具: base64 / bytes ============ */
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64decode(str) {
  str = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = []; let buf = 0, bits = 0;
  for (const ch of str) {
    if (ch === "=") break;
    const v = B64C.indexOf(ch); if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  return Uint8Array.from(bytes);
}
function b64encode(bytes) {
  let out = "", buf = 0, bits = 0;
  for (const b of bytes) { buf = (buf << 8) | b; bits += 8;
    while (bits >= 6) { bits -= 6; out += B64C[(buf >> bits) & 63]; } }
  if (bits) out += B64C[(buf << (6 - bits)) & 63];
  while (out.length % 4) out += "=";
  return out;
}
function hexToBytes(hex) { const o = new Uint8Array(hex.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i*2, 2), 16); return o; }
function concat(...arrs) { const n = arrs.reduce((s,a)=>s+a.length,0), o = new Uint8Array(n);
  let off = 0; for (const a of arrs) { o.set(a, off); off += a.length; } return o; }
function xorBytes(a, b) { const o = new Uint8Array(a.length); for (let i=0;i<a.length;i++) o[i]=a[i]^b[i]; return o; }

/* ============ SHA-256 ============ */
const K256 = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(msg) {
  const l = msg.length;
  const padded = new Uint8Array((((l + 8) >> 6) + 1) << 6);
  padded.set(msg); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(l / 0x20000000));
  dv.setUint32(padded.length - 4, (l << 3) >>> 0);
  let h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i*4);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i-15]>>>7)|(w[i-15]<<25)) ^ ((w[i-15]>>>18)|(w[i-15]<<14)) ^ (w[i-15]>>>3);
      const s1 = ((w[i-2]>>>17)|(w[i-2]<<15)) ^ ((w[i-2]>>>19)|(w[i-2]<<13)) ^ (w[i-2]>>>10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    const [a0,b0,c0,d0,e0,f0,g0,h0] = h;
    let a=a0,b=b0,c=c0,d=d0,e=e0,f=f0,g=g0,hh=h0;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h = new Uint32Array([(a0+a)>>>0,(b0+b)>>>0,(c0+c)>>>0,(d0+d)>>>0,(e0+e)>>>0,(f0+f)>>>0,(g0+g)>>>0,(h0+hh)>>>0]);
  }
  const out = new Uint8Array(32), o = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) o.setUint32(i*4, h[i]);
  return out;
}
function hmacSha256(key, msg) {
  let k = key;
  if (k.length > 64) k = sha256(k);
  const ipad = new Uint8Array(64).fill(0x36), opad = new Uint8Array(64).fill(0x5c);
  for (let i = 0; i < k.length; i++) { ipad[i] ^= k[i]; opad[i] ^= k[i]; }
  return sha256(concat(opad, sha256(concat(ipad, msg))));
}
/* HKDF — 按到位 Java 版: extract salt=16×0x00, expand counter 从 1, 无 info */
function hkdfDaoway(ikm, length = 32) {
  const prk = hmacSha256(new Uint8Array(16), ikm);
  let t = new Uint8Array(0), out = new Uint8Array(0), i = 1;
  while (out.length < length) {
    t = hmacSha256(prk, concat(t, Uint8Array.of(i & 0xff)));
    out = concat(out, t); i++;
  }
  return out.slice(0, length);
}

/* ============ AES-256 (仅需加密方向, GCM 用) ============ */
const SBOX = new Uint8Array(256);
(function () {
  const exp = new Uint8Array(256), log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x ^= (x << 1) ^ ((x & 0x80) ? 0x1b : 0); x &= 0xff; }
  for (let i = 0; i < 256; i++) {
    const inv = i === 0 ? 0 : exp[(255 - log[i]) % 255];
    const rot = (v, n) => ((v << n) | (v >>> (8 - n))) & 0xff;
    SBOX[i] = (inv ^ rot(inv, 1) ^ rot(inv, 2) ^ rot(inv, 3) ^ rot(inv, 4) ^ 0x63) & 0xff;
  }
})();
function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff; }
function gmul(a, b) { let r = 0; while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; } return r & 0xff; }
function aesKeySchedule(key) {
  const nk = key.length / 4, nr = nk + 6, w = [];
  for (let i = 0; i < nk; i++) w.push(((key[4*i]<<24)|(key[4*i+1]<<16)|(key[4*i+2]<<8)|key[4*i+3]) >>> 0);
  let rcon = 1;
  for (let i = nk; i < 4 * (nr + 1); i++) {
    let t = w[i-1];
    if (i % nk === 0) {
      t = (((t << 8) | (t >>> 24)) >>> 0);
      t = (((SBOX[(t>>>24)&0xff]<<24) | (SBOX[(t>>>16)&0xff]<<16) | (SBOX[(t>>>8)&0xff]<<8) | SBOX[t&0xff]) >>> 0);
      t = (t ^ (rcon << 24)) >>> 0;
      rcon = xtime(rcon);
    } else if (nk > 6 && i % nk === 4) {
      t = (((SBOX[(t>>>24)&0xff]<<24) | (SBOX[(t>>>16)&0xff]<<16) | (SBOX[(t>>>8)&0xff]<<8) | SBOX[t&0xff]) >>> 0);
    }
    w.push((w[i-nk] ^ t) >>> 0);
  }
  return { w, nr };
}
/* state 按列主序: s[4c+r] = 第 r 行 c 列 */
function aesEncryptBlock(ctx, in16) {
  const { w, nr } = ctx;
  const s = new Uint8Array(in16);
  const addRK = (round) => { for (let c = 0; c < 4; c++) {
    const k = w[round*4 + c];
    s[4*c]   ^= (k>>>24)&0xff; s[4*c+1] ^= (k>>>16)&0xff;
    s[4*c+2] ^= (k>>>8)&0xff;  s[4*c+3] ^= k&0xff; } };
  addRK(0);
  for (let round = 1; round < nr; round++) {
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    const t = Uint8Array.from(s);
    for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) s[c*4+r] = t[((c + r) % 4)*4 + r];
    for (let c = 0; c < 4; c++) {
      const a0=s[4*c],a1=s[4*c+1],a2=s[4*c+2],a3=s[4*c+3];
      s[4*c]   = gmul(a0,2)^gmul(a1,3)^a2^a3;
      s[4*c+1] = a0^gmul(a1,2)^gmul(a2,3)^a3;
      s[4*c+2] = a0^a1^gmul(a2,2)^gmul(a3,3);
      s[4*c+3] = gmul(a0,3)^a1^a2^gmul(a3,2);
    }
    addRK(round);
  }
  for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
  const t = Uint8Array.from(s);
  for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) s[c*4+r] = t[((c + r) % 4)*4 + r];
  addRK(nr);
  return s;
}
function inc32(b) {
  let v = (((b[12]<<24)>>>0) + (b[13]<<16) + (b[14]<<8) + b[15]) >>> 0;
  v = (v + 1) >>> 0;
  b[12] = (v>>>24)&0xff; b[13] = (v>>>16)&0xff; b[14] = (v>>>8)&0xff; b[15] = v&0xff;
}
/* AES-256-GCM decrypt: payload = iv(12) || ct || tag(16) */
function aesGcmDecrypt(key, payload) {
  const iv = payload.slice(0, 12), tag = payload.slice(payload.length - 16),
        ct = payload.slice(12, payload.length - 16);
  const ctx = aesKeySchedule(key);
  // keystream: P = C XOR E_K(inc32(J0))...
  const j0 = concat(iv, Uint8Array.of(0,0,0,1));
  const out = new Uint8Array(ct.length);
  const ctr = j0.slice(); inc32(ctr);
  for (let i = 0; i < ct.length; i += 16) {
    const ks = aesEncryptBlock(ctx, ctr); inc32(ctr);
    const end = Math.min(i + 16, ct.length);
    for (let j = i; j < end; j++) out[j] = ct[j] ^ ks[j - i];
  }
  // tag 校验: T' = E_K(J0) XOR GHASH_H(0||C||len)
  const ekj0 = aesEncryptBlock(ctx, j0);
  const h = aesEncryptBlock(ctx, new Uint8Array(16));
  // GF(2^128) 乘法: multiply(X, H) — 迭代 X 的位, V 从 H 出发右移约减
  function gmul128(X, Hb) {
    const Z = new Uint8Array(16), V = Uint8Array.from(Hb);
    for (let i = 0; i < 128; i++) {
      if ((X[i>>3] >> (7 - (i & 7))) & 1) for (let j = 0; j < 16; j++) Z[j] ^= V[j];
      const lsb = V[15] & 1;
      for (let j = 15; j > 0; j--) V[j] = ((V[j] >> 1) | ((V[j-1] & 1) << 7)) & 0xff;
      V[0] >>= 1;
      if (lsb) V[0] ^= 0xe1;
    }
    return Z;
  }
  let y = new Uint8Array(16);
  const cPad = new Uint8Array(Math.ceil(ct.length / 16) * 16); cPad.set(ct);
  for (let i = 0; i < cPad.length; i += 16) {
    y = gmul128(xorBytes(y, cPad.slice(i, i + 16)), h);
  }
  const lenB = new Uint8Array(16);
  new DataView(lenB.buffer).setUint32(12, ct.length * 8);
  y = gmul128(xorBytes(y, lenB), h);
  const tagCalc = xorBytes(ekj0, y);
  for (let i = 0; i < 16; i++) if (tagCalc[i] !== tag[i]) throw new Error("GCM tag mismatch");
  return out;
}

/* ============ P-256 ECDH (BigInt) ============ */
const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
const N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const A_CURVE = (P - 3n) % P;
const GX = 0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296n;
const GY = 0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5n;
function mod(n) { const r = n % P; return r < 0n ? r + P : r; }
function modInv(n) {
  let [a, b, x0, x1] = [mod(n), P, 1n, 0n];
  while (b) { const q = a / b; [a, b] = [b, a - q * b]; [x0, x1] = [x1, x0 - q * x1]; }
  return mod(x0);
}
function ecDouble(pt) {
  if (!pt) return null;
  const l = mod(3n * pt.x * pt.x + A_CURVE) * modInv(2n * pt.y);
  const x = mod(l * l - 2n * pt.x);
  return { x, y: mod(l * (pt.x - x) - pt.y) };
}
function ecAdd(p1, p2) {
  if (!p1) return p2; if (!p2) return p1;
  if (p1.x === p2.x) return ((p1.y + p2.y) % P === 0n) ? null : ecDouble(p1);
  const l = mod(p2.y - p1.y) * modInv(p2.x - p1.x);
  const x = mod(l * l - p1.x - p2.x);
  return { x, y: mod(l * (p1.x - x) - p1.y) };
}
function ecMul(k, pt = { x: GX, y: GY }) {
  let r = null, base = pt; k %= N;
  while (k > 0n) { if (k & 1n) r = ecAdd(r, base); base = ecDouble(base); k >>= 1n; }
  return r;
}
function bytesToBig(b) { let v = 0n; for (const x of b) v = (v << 8n) | BigInt(x); return v; }
function bigTo32(v) { const o = new Uint8Array(32); for (let i = 31; i >= 0 && v > 0n; i--) { o[i] = Number(v & 0xffn); v >>= 8n; } return o; }
/* SPKI DER → point (P-256 无压缩: 头 26 字节后 04||X||Y) */
function parseServerPoint(b64) {
  const der = b64decode(b64);
  let idx = der.indexOf(0x04);
  // 从后往前找 04 起始 (X 的首字节也可能为 04 但概率极低; 用固定偏移优先)
  const fixed = 26;
  const start = der[fixed] === 0x04 ? fixed : idx;
  return { x: bytesToBig(der.slice(start + 1, start + 33)), y: bytesToBig(der.slice(start + 33, start + 65)) };
}

/* ============ 到位客户端 ============ */
function dwPubB64() {
  const priv = getClientPriv();
  const pub = ecMul(priv);
  // SPKI: 30 59 30 13 06 07 2a8648ce3d0201 06 08 2a8648ce3d030107 03 42 00 04 X Y
  const head = hexToBytes("3059301306072a8648ce3d020106082a8648ce3d030107034200");
  return b64encode(concat(head, Uint8Array.of(4), bigTo32(pub.x), bigTo32(pub.y)));
}
function dwAesKey() {
  const r = ecMul(getClientPriv(), parseServerPoint(DW.serverPubB64));
  // Java keyAgreement.generateSecret() 返回 X 坐标 32 字节
  return hkdfDaoway(bigTo32(r.x));
}
function getClientPriv() {
  let hex = $.getdata("dw_priv");
  if (!hex) {
    hex = ""; for (let i = 0; i < 32; i++) hex += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
    $.setdata(hex, "dw_priv");
  }
  return BigInt("0x" + hex);
}
/* UTF-8 编解码 — Surge 的 JavaScriptCore 不保证有 TextEncoder/TextDecoder */
function utf8Encode(s) { return Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0)); }
function utf8Decode(b) {
  let out = "";
  for (let i = 0; i < b.length; i += 4096) {
    const chunk = b.slice(i, Math.min(i + 4096, b.length));
    out += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return decodeURIComponent(escape(out));
}
function dwSign(params, ts) {
  const items = Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined && params[k] !== "")
    .sort().map(k => k + "=" + params[k]);
  const qs = items.join("&") + "&timestamp=" + ts;
  return b64encode(hmacSha256(dwAesKey(), utf8Encode(qs)));
}
function dwGet(path, params) {
  return new Promise((resolve, reject) => {
    const ts = String(Date.now());
    const sig = dwSign(params, ts);
    const q = Object.keys(params).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k]))).join("&");
    $.get({
      url: DW.api + path + "?" + q,
      headers: {
        "user-agent": "DWBI/7.1.7 (iPhone; iOS 27.0.1)", accept: "*/*",
        publickey: dwPubB64(), timestamp: ts, sigin: sig,
        "x-dwblued": "1",  // 防止本脚本自身请求再次命中 http-request 拦截 pattern
      },
    }, (err, _resp, data) => {
      if (err) return reject(err);
      try {
        const j = JSON.parse(data);
        if (j && String(j.encrypt) === "1" && j.publickey) {
          const root = JSON.parse(utf8Decode(aesGcmDecrypt(dwAesKey(), b64decode(j.data))));
          // by_buyer 解密根对象只有 data, 无 status 字段; 错误响应({msg,code,status})必无 data
          if (!root || !root.data) throw new Error("到位返回异常: " + JSON.stringify(root).slice(0, 200));
          resolve(root);
        } else if (j && j.data) {  // 非加密响应: 有 data 即成功, 错误响应({msg,code,status})必无 data
          resolve(j);
        } else {
          reject(new Error("到位返回异常: " + String(data).slice(0, 200)));
        }
      } catch (e) { reject(e); }
    });
  });
}

/* ============ Blued 客户端 ============ */
function parseNum(v) { const m = String(v ?? "").match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function readJSON(key) {
  try { return JSON.parse($.getdata(key)); } catch { return null; }
}
function bluedNearby(filters) {
  const auth = $.getdata(AUTH_KEY);
  const geo = readJSON(GEO_KEY);
  if (!auth || !geo) return Promise.reject(new Error(!auth ? "还没有 Blued 凭证：先用 Blued App 打开一次附近的人（保持 Surge 开着）" : "还没有 Blued 定位：同上，打开一次附近的人即可"));
  return new Promise((resolve, reject) => {
    const q = {
      from: "list", latitude: geo.lat, longitude: geo.lng, limit: 60, start: 0,
      sort_by: "nearby", filters: JSON.stringify(filters),
      platform: "iOS", platform_version: "27.0.1", version: "7.50.3", version_code: "750030",
      wx: "1", wx_sdk: "2.0.4",
    };
    $.get({
      url: BLUED.social + "/users?" + Object.keys(q).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(q[k]))).join("&"),
      headers: { authorization: auth, accept: "*/*", "x-dwblued": "1", "user-agent": "Blued/7.50.3 (iPhone; iOS 27.0.1)" },
    }, (err, _resp, data) => {
      if (err) return reject(new Error(String(err && err.message || err)));
      try {
        const code = _resp && (_resp.status || _resp.statusCode) || 200;
        if (code >= 300) {
          const hint = code === 401 || code === 403 ? "，Basic auth 可能过期，重新抓包更新" : "";
          return reject(new Error("Blued HTTP " + code + hint + ": " + String(data).slice(0, 120)));
        }
        const j = JSON.parse(data);
        if (!j || j.data == null) return reject(new Error("Blued 响应异常: " + String(data).slice(0, 120)));
        resolve(j.data);
      } catch (e) { reject(e); }
    });
  });
}

// uid → 6位encryptId(服务端换发, 确定性映射): create 口令 → 从口令文本抠 ##码## → query 换回 link 里的 uid=
function bluedEncUid(uid) {
  const auth = $.getdata(AUTH_KEY);
  if (!auth) return Promise.reject(new Error("还没有 Blued 凭证: 先用 Blued App 打开一次附近的人"));
  // $.post 对带 body 的请求默认补 x-www-form-urlencoded, JSON 接口须显式声明 content-type
  const hd = { authorization: auth, "content-type": "application/json", "x-dwblued": "1" };
  return new Promise((resolve, reject) => $.post({
    url: BLUED.live + "/live/interact/api/token/create",
    headers: hd, body: JSON.stringify({ uid: Number(uid), source: "profile" }),
  }, (err, _r, data) => err ? reject(new Error("口令创建失败: " + err)) : resolve(data))).then(text => {
    const code = (String(text).match(/##([A-Za-z0-9]+)##/) || [])[1];
    if (!code) throw new Error("口令创建无码: " + String(text).slice(0, 100));
    return new Promise((resolve, reject) => $.get({
      url: BLUED.live + "/live/interact/api/token/query?code=" + code,
      headers: hd,
    }, (err, _r, data) => err ? reject(new Error("口令查询失败: " + err)) : resolve(data)));
  }).then(text => {
    const m = String(text).match(/uid=([A-Za-z0-9]+)/);
    if (!m) throw new Error("口令查询无短码: " + String(text).slice(0, 100));
    return m[1];
  });
}

/* ============ 匹配 ============ */

/**
 * 有什么查什么:
 *   - 技师缺某维度 → Blued filters 不带该维度, 打分也不计
 *   - 平均差 avgΔ (按实际可比维度归一)
 *   - 距离: 以技师到位距离为基准, 候选距离差越大置信越低;
 *     技师距离未知时距离不参与判定
 *   - 3⭐ 高置信, 2⭐ 次之, 低的不推; 不凑数
 */
async function matchTech(t) {
  const filters = {
    filter_album_open: 0, condition: true, filter_new_user: 0, instant_status: 0,
    tags: BLUED.tags, filter_register_time: "0-99", filter_real_switch: 0,
    time_span: "0-max", geo_reach: "0-max", filter_already_chatted: 0, online: 0,
  };
  const dims = [];
  if (t.age) { filters.age = Math.max(18, t.age - 3) + "-" + (t.age + 3); dims.push(["age", t.age]); }
  if (t.ht)  { filters.height = Math.max(140, t.ht - 3) + "-" + (t.ht + 3); dims.push(["height", t.ht]); }
  if (t.wt)  { filters.weight = Math.max(40, t.wt - 3) + "-" + (t.wt + 3); dims.push(["weight", t.wt]); }
  if (!dims.length) return { top: [] };
  const cands = await bluedNearby(filters);
  const scored = cands.map(u => {
    let score = 0, n = 0;
    for (const [k, v] of dims) {
      const uv = k === "age" ? parseInt(u.age) : u[k];
      if (uv != null && v != null) { score += Math.abs(uv - v); n++; }
    }
    const avg = n ? score / n : 99;
    const dGap = u.distance == null ? null :
      (t.distance == null ? null : Math.abs(Number(u.distance) - Number(t.distance)));
    const stars = (avg <= 2 && (dGap == null || dGap <= 5)) ? 3 :
                  (avg <= 5 && (dGap == null || dGap <= 15)) ? 2 : 1;
    return {
      uid: u.uid, name: u.name, stars, avg: Math.round(avg * 10) / 10,
      age: u.age, height: u.height, weight: u.weight, distance: u.distance,
      online: u.online_state, avatar: u.avatar,
    };
  });
  // 只推高置信(3⭐); 一个都没有时放宽到 2⭐; 1⭐ 不推, 不凑数
  let top = scored.filter(c => c.stars === 3).sort((a, b) => a.avg - b.avg).slice(0, 3);
  if (!top.length) top = scored.filter(c => c.stars === 2).sort((a, b) => a.avg - b.avg).slice(0, 3);
  return { top };
}

/* ============ Surge 环境 ============ */
// 通过 HTTP API 立即拉起 worker (未开启 http-api 时静默跳过, cron 兜底)
function kickWorker() {
  if (!HTTP_API) return;
  const [key, addrOverride] = HTTP_API.split("@");
  const addrs = addrOverride ? [addrOverride] : HTTP_API_ADDRS;
  for (const addr of addrs) {
    $.post({
      url: "http://" + addr + "/v1/scripting/cron/evaluate",
      body: JSON.stringify({ script_name: WORKER_NAME }),
      headers: { "X-Key": key, "Content-Type": "application/json" },
      policy: "DIRECT",
    }, (err, _resp) => log("[到位×Blued] kick " + addr + " " + (err ? "失败: " + err : "已发出(" + ((_resp && _resp.status) || "?") + ")")));
  }
}
// 四个入口:
//   A) 拦到 Blued App 的 /users 请求 → 缓存 authorization + 定位 (首次使用开一次附近的人即可)
//   B) 拦到到位 by_buyer(预取/点开都会发) → 只缓存最新坐标 lat/lng 立即放行
//   C) 拦到到位 technician/{id}/click → 确定性"用户点开了谁"埋点(HAR 实证: 预取无 click,
//      点开必有 click) → 入队 + kick, 立即放行
//   D) worker(kick 或 cron): 排空队列逐个匹配推送; 推送队列按点击计, 不轰炸
const RUNNING_KEY = "dw_blued_running", PUSHED_KEY = "dw_pushed", KICK_TS_KEY = "dw_kick_ts";
const DW_GEO_KEY = "dw_dw_geo", QUEUE_KEY = "dw_click_queue";
const QUEUE_CAP = 8;

async function runMatch(dwid, lat, lng) {
  if (!lat || !lng) throw new Error("没有坐标, 无法定位匹配");
  let detail;
  try {
    detail = (await dwGet("/technician/v2/" + dwid + "/by_buyer", { lat, lng })).data;
  } catch (e) { throw new Error("到位查询失败: " + (e && e.message || e)); }
  if (!detail) throw new Error("到位返回档案为空");
  const t = { age: parseInt(detail.age), ht: parseNum(detail.height), wt: parseNum(detail.weight),
              distance: parseNum(detail.distance) };
  const sub = [t.age && t.age + "岁", t.ht && t.ht + "cm", t.wt && t.wt + "kg", detail.constellation]
    .filter(Boolean).join("·");
  const title = (detail.name || "到位技师 " + dwid) + "（到位 " + (detail.distanceView ? detail.distanceView + "km" : "距离未知") + "）";
  if (!t.age && !t.ht && !t.wt) {
    $.msg(title, sub || "", "这个技师没留年龄身高体重，Blued 上没法比，先不找了");
    return;
  }
  const r = await matchTech(t);
  if (!$.setdata(JSON.stringify({ tech: { dwid: Number(dwid), name: detail.name,
    age: t.age, height: t.ht, weight: t.wt, constellation: detail.constellation, distance: t.distance }, top: r.top }), "dw_blued_match"))
    log("dw_blued_match 写入失败");
  if (r.top.length) {
    const top = r.top[0];
    // 通知点击 → Blued App 内该人主页; 置信度最高者的头像作为附件 (Surge 5.11+ media-url)
    // encryptId 仍由 create+query 换发; 跳转改用 Blued X 的 OpenInstall Universal Link
    // 用户实测精简 payload 可经 Safari 直达主页; 网页兜底可能显示“链接已过期”
    const opts = {};
    let deepLink = "";
    try {
      const enc = await bluedEncUid(top.uid);
      // Env 语法: url 字段由 $.msg 负责按平台适配成 Surge {action:'open-url', url}/Loon openUrl/QX open-url
      const payload = JSON.stringify({ d: {
        tr_param1: "https://common.blued.cn/?action=profile-enc=1-uid=" + enc,
      } });
      opts["url"] = "https://nk5oy5.oplinking.com/ulink/c/"
        + b64encode(utf8Encode(payload)).replace(/\+/g, "-").replace(/\//g, "_");
      deepLink = "\n🔗 页面直达: app.blued.cn/user?id=" + enc + " (点通知跳 Blued)";
    } catch (e) { log("[到位×Blued] encryptId 换发失败, 通知不带跳转: " + (e && e.message || e)); }
    if (top.avatar && top.avatar.startsWith("http")) opts["media-url"] = top.avatar;
    $.msg(title, sub,
      r.top.map(c => {
        const parts = [(c.name || "Blued " + c.uid) + "（uid " + c.uid + "）", "⭐".repeat(c.stars)];
        const body = [c.age && parseInt(c.age) + "岁", c.height && c.height + "cm", c.weight && c.weight + "kg",
          c.distance != null && Number(c.distance) < 9999 && "离你" + Number(c.distance).toFixed(1) + "km",
          Number(c.online) === 1 && "在线"].filter(Boolean).join(" ");
        return parts.join(" ") + "\n    " + body;
      }).join("\n") + deepLink, opts);
  } else {
    $.msg(title, sub, "Blued 附近没找到接近的人，先不推了");
  }
}

try {
if (typeof $request !== "undefined" && $request.url) {
  const url = String($request.url);
  const headers = $request.headers || {};
  // 脚本自身发起的请求会再命中拦截 pattern → 靠标记头键名防递归
  const selfReq = Object.keys(headers).some(k => String(k).toLowerCase() === "x-dwblued");
  if (selfReq) {
    $.done({});
  } else if (/social\.irisgw\.cn\/users(?:\?|$)/.test(url)) {
    const authEntry = Object.entries(headers).find(([k]) => String(k).toLowerCase() === "authorization");
    const lat = (url.match(/latitude=(-?[\d.]+)/) || [])[1];
    const lng = (url.match(/longitude=(-?[\d.]+)/) || [])[1];
    if (authEntry && authEntry[1] && lat && lng) {
      if (!$.setdata(String(authEntry[1]), AUTH_KEY)) log("dw_blued_auth 写入失败");
      if (!$.setdata(JSON.stringify({ lat: Number(lat), lng: Number(lng) }), GEO_KEY)) log("dw_blued_geo 写入失败");
    } else if (authEntry || (lat && lng)) {
      log("Blued 凭证缓存不完整, 未写入");
    }
    $.done({});
  } else {
    // B) by_buyer(预取+点开都发): 只更新最新坐标
    if (/technician\/v2\/\d+\/by_buyer/.test(url)) {
      const lat = (url.match(/lat=(-?[\d.]+)/) || [])[1];
      const lng = (url.match(/lng=(-?[\d.]+)/) || [])[1];
      if (lat && lng && !$.setdata(JSON.stringify({ lat: Number(lat), lng: Number(lng) }), DW_GEO_KEY))
        log("dw_dw_geo 写入失败");
      return $.done({});
    }
    // C) click 埋点 = 用户点开了这位 (确定性)
    const mc = url.match(/technician\/(\d+)\/click/);
    if (mc) {
      const geo = readJSON(DW_GEO_KEY);
      if (geo && geo.lat) {
        log("[到位×Blued] 点击技师 dwid=" + mc[1]);
        const q = (readJSON(QUEUE_KEY) || []).filter(x => x.dwid !== mc[1]);
        q.push({ dwid: mc[1], lat: geo.lat, lng: geo.lng });
        if (!$.setdata(JSON.stringify(q.slice(-QUEUE_CAP)), QUEUE_KEY)) log("dw_click_queue 写入失败");
        const lastKick = Number($.getdata(KICK_TS_KEY)) || 0;
        if (Date.now() - lastKick >= 3000) {
          if (!$.setdata(String(Date.now()), KICK_TS_KEY)) log("dw_kick_ts 写入失败");
          kickWorker();
        }
      } else log("[到位×Blued] 无到位坐标(尚未被 by_buyer 缓存), 跳过");
    }
    $.done({});
  }
} else {
  // worker: 排空点击队列逐个匹配推送; 处理期间新到点击由循环尾部重读接住
  // kick 双地址双发时, 第二个 worker 见 RUNNING 新鲜即退出, 由活跃 worker 的循环兜住
  const now0 = Date.now();
  const lastRun = Number($.getdata(RUNNING_KEY)) || 0;
  if (now0 - lastRun < 10000 && lastRun > 0) return $.done({});  // 已有活跃 worker
  if (!$.setdata(String(now0), RUNNING_KEY)) log("dw_blued_running 写入失败");
  (async () => {
    for (;;) {
      const queue = readJSON(QUEUE_KEY) || [];
      if (!Array.isArray(queue) || !queue.length) break;
      if (!$.setdata("", QUEUE_KEY)) log("队列清理失败");
      for (const item of queue) {
        // 幂等: 同 dwid 10s 内已推过则跳过
        const pushed = readJSON(PUSHED_KEY);
        if (pushed && pushed.dwid === item.dwid && Date.now() - pushed.t < 10000) continue;
        if (!$.setdata(JSON.stringify({ dwid: item.dwid, t: Date.now() }), PUSHED_KEY)) log("dw_pushed 写入失败");
        try { await runMatch(item.dwid, item.lat, item.lng); }
        catch (e) {
          $.logErr(e, "FATAL");
          $.msg("到位匹配没跑成", "", String(e && e.message || e));
        }
      }
    }
    if (!$.setdata("", RUNNING_KEY)) log("dw_blued_running 清理失败");
    $.done({});
  })();
}
} catch (e) {
  $.logErr(e, "FATAL");
  try { $.msg("到位匹配没跑成", "", String(e && e.message || e)); } catch { /* .msg 失败不致命*/ }
  $.done({});
}
