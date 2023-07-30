let url = $request.url;
const $ = new Env("htknow.video.js");

(async function launch() {
    $.msg("海豚知道", "点击跳转浏览器打开看视频", url, url);
})().catch(e => {
    $.msg("htknow.video.js", "", e.message || JSON.stringify(e))
}).finally(() => {
    $.done({body});
})

function Env(o,t){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((a,r)=>{s.call(this,t,(t,e,s)=>{t?r(t):a(e)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(a=>{this.get({url:t},(t,e,s)=>a(s))})}runScript(i,o){return new Promise(a=>{let t=this.getdata("@chavy_boxjs_userCfgs.httpapi");t=t&&t.replace(/\n/g,"").trim();var e=(e=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"))?+e:20,[s,r]=(e=o&&o.timeout?o.timeout:e,t.split("@"));this.post({url:`http://${r}/v1/scripting/evaluate`,body:{script_text:i,mock_type:"cron",timeout:e},headers:{"X-Key":s,Accept:"*/*"},timeout:e},(t,e,s)=>a(s))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};this.fs=this.fs||require("fs"),this.path=this.path||require("path");var t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e);if(!s&&!a)return{};a=s?t:e;try{return JSON.parse(this.fs.readFileSync(a))}catch(t){return{}}}writedata(){var t,e,s,a,r;this.isNode()&&(this.fs=this.fs||require("fs"),this.path=this.path||require("path"),t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),a=!(s=this.fs.existsSync(t))&&this.fs.existsSync(e),r=JSON.stringify(this.data),!s&&a?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r))}lodash_get(t,e,s=void 0){let a=t;for(const r of e.replace(/\[(\d+)\]/g,".$1").split("."))if(void 0===(a=Object(a)[r]))return s;return a}lodash_set(t,a,e){return Object(t)===t&&((a=Array.isArray(a)?a:a.toString().match(/[^.[\]]+/g)||[]).slice(0,-1).reduce((t,e,s)=>Object(t[e])===t[e]?t[e]:t[e]=Math.abs(a[s+1])>>0==+a[s+1]?[]:{},t)[a[a.length-1]]=e),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){var[,t,s]=/^@(.*?)\.(.*?)$/.exec(t),t=t?this.getval(t):"";if(t)try{var a=JSON.parse(t);e=a?this.lodash_get(a,s,""):e}catch(t){e=""}}return e}setdata(e,t){let s=!1;if(/^@/.test(t)){var[,a,r]=/^@(.*?)\.(.*?)$/.exec(t),i=this.getval(a),i=a?"null"===i?null:i||"{}":"{}";try{var o=JSON.parse(i);this.lodash_set(o,r,e),s=this.setval(JSON.stringify(o),a)}catch(t){i={};this.lodash_set(i,r,e),s=this.setval(JSON.stringify(i),a)}}else s=this.setval(e,t);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}initGotEnv(t){this.got=this.got||require("got"),this.cktough=this.cktough||require("tough-cookie"),this.ckjar=this.ckjar||new this.cktough.CookieJar,t&&(t.headers=t.headers||{},void 0===t.headers.Cookie)&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)}get(t,o=()=>{}){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,e,s)=>{!t&&e&&(e.body=s,e.statusCode=e.status||e.statusCode,e.status=e.statusCode),o(t,e,s)});break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{var{statusCode:t,statusCode:e,headers:s,body:a,bodyBytes:r}=t;o(null,{status:t,statusCode:e,headers:s,body:a,bodyBytes:r},a,r)},t=>o(t&&t.error||"UndefinedError"));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{var s;t.headers["set-cookie"]&&((s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString())&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar)}catch(t){this.logErr(t)}}).then(t=>{var{statusCode:t,statusCode:e,headers:s,rawBody:a}=t,r=i.decode(a,this.encoding);o(null,{status:t,statusCode:e,headers:s,rawBody:a,body:r},r)},t=>{var{message:t,response:e}=t;o(t,e,e&&i.decode(e.rawBody,this.encoding))})}}post(t,o=()=>{}){var e=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[e](t,(t,e,s)=>{!t&&e&&(e.body=s,e.statusCode=e.status||e.statusCode,e.status=e.statusCode),o(t,e,s)});break;case"Quantumult X":t.method=e,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{var{statusCode:t,statusCode:e,headers:s,body:a,bodyBytes:r}=t;o(null,{status:t,statusCode:e,headers:s,body:a,bodyBytes:r},a,r)},t=>o(t&&t.error||"UndefinedError"));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:s,...a}=t;this.got[e](s,a).then(t=>{var{statusCode:t,statusCode:e,headers:s,rawBody:a}=t,r=i.decode(a,this.encoding);o(null,{status:t,statusCode:e,headers:s,rawBody:a,body:r},r)},t=>{var{message:t,response:e}=t;o(t,e,e&&i.decode(e.rawBody,this.encoding))})}}time(t,e=null){var s,e=e?new Date(e):new Date,a={"M+":e.getMonth()+1,"d+":e.getDate(),"H+":e.getHours(),"m+":e.getMinutes(),"s+":e.getSeconds(),"q+":Math.floor((e.getMonth()+3)/3),S:e.getMilliseconds()};for(s in/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(e.getFullYear()+"").substr(4-RegExp.$1.length))),a)new RegExp("("+s+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?a[s]:("00"+a[s]).substr((""+a[s]).length)));return t}queryStr(e){let s="";for(const a in e){let t=e[a];null!=t&&""!==t&&("object"==typeof t&&(t=JSON.stringify(t)),s+=`${a}=${t}&`)}return s=s.substring(0,s.length-1)}msg(t=o,e="",s="",a){var r,i=t=>{switch(typeof t){case void 0:return t;case"string":switch(this.getEnv()){case"Surge":case"Stash":default:return{url:t};case"Loon":case"Shadowrocket":return t;case"Quantumult X":return{"open-url":t};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":default:return{url:t.url||t.openUrl||t["open-url"]};case"Loon":return{openUrl:t.openUrl||t.url||t["open-url"],mediaUrl:t.mediaUrl||t["media-url"]};case"Quantumult X":return{"open-url":t["open-url"]||t.url||t.openUrl,"media-url":t["media-url"]||t.mediaUrl,"update-pasteboard":t["update-pasteboard"]||t.updatePasteboard};case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(t,e,s,i(a));break;case"Quantumult X":$notify(t,e,s,i(a));break;case"Node.js":}this.isMuteLog||((r=["","==============📣系统通知📣=============="]).push(t),e&&r.push(e),s&&r.push(s),console.log(r.join("\n")),this.logs=this.logs.concat(r))}log(...t){0<t.length&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t.stack)}}wait(e){return new Promise(t=>setTimeout(t,e))}done(t={}){var e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":process.exit(1)}}}(o,t)}
