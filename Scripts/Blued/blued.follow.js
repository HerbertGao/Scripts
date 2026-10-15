const url = ($request && $request.url) || '';
const KEY = 'blued_following';
const HOME_RE = /^https:\/\/social\.irisgw\.cn\/users\/(\d+)$/;
const MAX_PAGES = 20; // shortcut: 超过 20 页就放弃，避免把主页响应拖太久

function header(name) {
  const headers = ($request && $request.headers) || {};
  const want = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) return headers[key];
  }
  return '';
}

function readKey() {
  if (typeof $persistentStore !== 'undefined') return $persistentStore.read(KEY);
  if (typeof $prefs !== 'undefined') return $prefs.valueForKey(KEY);
  return null;
}

function writeKey(val) {
  if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, KEY);
  if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, KEY);
  return false;
}

function notify(title, sub, body, opts) {
  const openUrl = opts && opts.url;
  const mediaUrl = opts && opts['media-url'];
  if (typeof $notification !== 'undefined') {
    const o = {};
    if (openUrl) Object.assign(o, { action: 'open-url', url: openUrl });
    if (mediaUrl) o['media-url'] = mediaUrl;
    $notification.post(title, sub, body || '', Object.keys(o).length ? o : undefined);
  } else if (typeof $notify !== 'undefined') {
    const o = {};
    if (openUrl) o['open-url'] = openUrl;
    if (mediaUrl) o['media-url'] = mediaUrl;
    $notify(title, sub, body || '', Object.keys(o).length ? o : undefined);
  }
}

function load() {
  try {
    const value = JSON.parse(readKey() || '');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function rowOf(user) {
  const uid = user && user.uid != null ? String(user.uid) : '';
  if (!/^\d+$/.test(uid)) return null;
  const row = { name: typeof user.name === 'string' ? user.name : '' };
  if (typeof user.note === 'string' && user.note) row.note = user.note;
  if (typeof user.avatar === 'string' && /^https?:\/\//i.test(user.avatar)) row.avatar = user.avatar;
  return [uid, row];
}

const REQUEST_MS = 8000;
function request(method, target, headers, body) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(data);
    };
    timer = setTimeout(() => finish(new Error('timeout')), REQUEST_MS);
    const done = (err, resp, data) => {
      if (err) return finish(err);
      const status = resp && (resp.status ?? resp.statusCode);
      if (typeof status === 'number' && (!Number.isInteger(status) || status < 200 || status >= 300))
        return finish(new Error('HTTP ' + status));
      finish(null, data);
    };
    if (typeof $httpClient !== 'undefined') {
      const req = { url: target, headers };
      if (body != null) req.body = body;
      $httpClient[method](req, done);
    } else if (typeof $task !== 'undefined') {
      const req = { url: target, method: method.toUpperCase(), headers };
      if (body != null) req.body = body;
      $task.fetch(req).then(resp => done(null, resp, resp && resp.body), err => finish(err));
    } else finish(new Error('no http'));
  });
}
function post(target, headers, body) { return request('post', target, headers, body); }

const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(bytes) {
  let out = '', buf = 0, bits = 0;
  for (const b of bytes) {
    buf = (buf << 8) | b; bits += 8;
    while (bits >= 6) { bits -= 6; out += B64C[(buf >> bits) & 63]; }
  }
  if (bits) out += B64C[(buf << (6 - bits)) & 63];
  while (out.length % 4) out += '=';
  return out;
}
function utf8Encode(s) {
  return Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
}

// 与到位×Blued 相同: create 口令 → query 换 encryptId → OpenInstall 主页链接
async function encUid(auth, uid) {
  const hd = { authorization: auth, 'content-type': 'application/json', accept: '*/*' };
  const created = await post(
    'https://live.irisgw.cn/live/interact/api/token/create',
    hd,
    JSON.stringify({ uid: Number(uid), source: 'profile' })
  );
  const code = (String(created).match(/##([A-Za-z0-9]+)##/) || [])[1];
  if (!code) throw new Error('口令创建无码');
  const queried = await get('https://live.irisgw.cn/live/interact/api/token/query?code=' + code, hd);
  const enc = (String(queried).match(/uid=([A-Za-z0-9]+)/) || [])[1];
  if (!enc) throw new Error('口令查询无短码');
  return enc;
}
function profileUrl(enc) {
  const payload = JSON.stringify({ d: { tr_param1: 'https://common.blued.cn/?action=profile-enc=1-uid=' + enc } });
  return 'https://nk5oy5.oplinking.com/ulink/c/' + b64encode(utf8Encode(payload)).replace(/\+/g, '-').replace(/\//g, '_');
}

function get(target, headers) { return request('get', target, headers); }

async function fetchAll(owner, headers) {
  const people = {};
  for (let page = 1; page <= MAX_PAGES; page++) {
    let body;
    try {
      body = JSON.parse(await get(
        `https://social.irisgw.cn/users/${owner}/followed?page=${page}&sort=default`,
        headers
      ) || '');
    } catch {
      return null;
    }
    if (!body || body.code !== 200 || !Array.isArray(body.data)) return null;
    const hasmore = body.extra && body.extra.hasmore;
    if (hasmore !== 0 && hasmore !== 1) return null;
    for (const user of body.data) {
      const row = rowOf(user);
      if (!row) return null;
      people[row[0]] = row[1];
    }
    if (hasmore === 0) return people;
  }
  return null;
}

async function notifyGone(prev, next, oldCount, newCount, auth) {
  const gone = Object.keys(prev).filter(uid => !next[uid]);
  const jumps = await Promise.all(gone.map(async uid => {
    try { return profileUrl(await encUid(auth, uid)); } catch { return ''; }
  }));
  gone.forEach((uid, i) => {
    const row = prev[uid] || {};
    const lines = [`${oldCount} → ${newCount}`];
    if (row.note) lines.push(`备注：${row.note}`);
    lines.push('也可能是取关，不一定是封号或注销。');
    const opts = {};
    if (row.avatar) opts['media-url'] = row.avatar;
    if (jumps[i]) opts.url = jumps[i];
    notify('Blued 关注', `${row.name || '未命名'}（uid ${uid}）`, lines.join('\n'), opts);
  });
}

function noteFail(state, owner, count, text) {
  const fail = state.fail;
  const already = fail && fail.owner === owner && fail.count === count;
  const stored = {};
  if (state.saved) stored.saved = state.saved;
  stored.fail = { owner, count };
  if (!writeKey(JSON.stringify(stored))) {
    notify('Blued 关注', '记录失败', '持久化写入失败，这次没有保存');
    return;
  }
  if (!already) notify('Blued 关注', '名单没拉全', text);
}

async function handle() {
  const match = String(url).match(HOME_RE);
  if (!match) return;
  const owner = match[1];
  let body;
  try { body = JSON.parse(($response && $response.body) || ''); } catch { return; }
  const user = body && body.data && body.data[0];
  if (!user || String(user.uid) !== owner) return;
  const count = user.followed_count;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return;

  const state = load();
  const saved = state.saved && state.saved.owner === owner ? state.saved : null;
  if (saved && saved.count === count) return;

  const now = Date.now();
  // shortcut: 两次主页撞在一起时，30 秒内的第二次不重复拉
  const busyAt = state.busy && state.busy.owner === owner ? state.busy.at : null;
  if (typeof busyAt === 'number' && now >= busyAt && now - busyAt < 30000) return;
  const auth = header('authorization');
  if (!auth) {
    noteFail(state, owner, count, '主页请求没有 authorization，没法拉名单');
    return;
  }
  const pending = {};
  if (state.saved) pending.saved = state.saved;
  if (state.fail) pending.fail = state.fail;
  pending.busy = { owner, at: now };
  if (!writeKey(JSON.stringify(pending))) {
    notify('Blued 关注', '记录失败', '持久化写入失败，这次没有保存');
    return;
  }

  const headers = { authorization: auth, accept: '*/*' };
  const ua = header('user-agent');
  if (ua) headers['user-agent'] = ua;
  const people = await fetchAll(owner, headers);
  // shortcut: 主页人数和名单长度对不上就重试，不把残页当成消失；若接口长期对不上，每次打开主页都会再拉
  if (!people || Object.keys(people).length !== count) {
    noteFail(load(), owner, count, '关注数和完整名单对不上，这次不猜是谁');
    return;
  }
  const decreased = saved && count < saved.count;
  if (decreased) await notifyGone(saved.people || {}, people, saved.count, count, auth);
  if (!writeKey(JSON.stringify({ saved: { owner, count, people } }))) {
    notify('Blued 关注', '记录失败', '持久化写入失败，这次没有保存');
    return;
  }
}

(async () => {
  try {
    await handle();
  } catch (e) {
    notify('Blued 关注', '错误', (e && e.message) || String(e));
  }
  if (typeof $done === 'function') $done();
})();
