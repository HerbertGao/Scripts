// Run: node tools/check-blued-follow.mjs (synthetic data only; no network requests).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('Scripts/Blued/blued.follow.js');
const RULE = String.raw`^https:\/\/social\.irisgw\.cn\/users\/\d+$`;
const files = [
  'Surge/blued.follow.module',
  'Shadowrocket/blued.follow.module',
  'QuantumultX/blued.follow.conf',
  'Stash/Blued.follow.stoverride',
];
const hit = 'https://social.irisgw.cn/users/28205015';
const miss = [
  'https://social.irisgw.cn/users/28205015/followed?page=1&sort=default',
  'https://social.irisgw.cn/users/28205015/secretly_followed?page=1&sort=default',
  'https://social.irisgw.cn/users/28205015/more/ios?v=2',
  'https://social.irisgw.cn/users/28205015?from=profile',
  'https://argo.blued.cn/users/28205015',
];
for (const file of files) {
  const text = read(file);
  assert.ok(text.includes(RULE), `${file}: missing homepage rule`);
  const rule = new RegExp(RULE);
  assert.equal(rule.test(hit), true, file);
  for (const url of miss) assert.equal(rule.test(url), false, `${file}: overmatched ${url}`);
  assert.ok(text.includes('social.irisgw.cn'), `${file}: missing MITM host`);
}

const user = (uid, name, note = '', avatar) => ({ uid, name, note, avatar });
const home = (uid, count) => ({ code: 200, data: [{ uid, followed_count: count }] });
const listPage = (users, hasmore) => ({ code: 200, data: users, extra: { hasmore } });

async function replay({ url = hit, body, store = {}, headers = { authorization: 'Basic x', 'User-Agent': 'Blued' }, pages = {}, write = true, client = 'surge', token = true, status = 200 }) {
  const messages = [];
  const calls = [];
  let raw = JSON.stringify(store);
  let done = false;
  const http = (req, respond) => {
    calls.push(req);
    const u = String(req.url);
    if (u.includes('/token/create')) return respond(token ? null : new Error('token'), '##Ab12##');
    if (u.includes('/token/query')) return respond(null, 'uid=Ab12Cd');
    const page = Number((u.match(/[?&]page=(\d+)/) || [])[1]);
    const spec = pages[page];
    if (!spec) respond(new Error('missing page'));
    else respond(null, JSON.stringify(spec));
  };
  const sandbox = {
    $request: { url, headers },
    $response: { body: typeof body === 'string' ? body : JSON.stringify(body) },
    $persistentStore: {
      read: () => raw,
      write: value => {
        if (!write) return false;
        raw = value;
        return true;
      },
    },
    $notification: { post: (...args) => messages.push(args) },
    $done: () => { done = true; },
    Date: { now: () => 1000 },
    setTimeout,
    clearTimeout,
  };
  if (client === 'surge') {
    sandbox.$httpClient = {
      get: (req, cb) => http(req, (err, text) => cb(err, { status }, text)),
      post: (req, cb) => http(req, (err, text) => cb(err, { status }, text)),
    };
  } else {
    sandbox.$task = {
      fetch: req => new Promise((resolve, reject) => {
        http(req, (err, text) => err ? reject(err) : resolve({ body: text, statusCode: status }));
      }),
    };
  }
  vm.runInNewContext(source, sandbox, { timeout: 1000 });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(done, true);
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { assert.fail(`store is not JSON: ${e.message}`); }
  return { messages, store: parsed, calls };
}

const pages = {
  1: listPage([user(1, '甲', '', 'javascript:alert(1)'), user(2, '乙', '备注乙', 'https://img.example/2.jpg')], 1),
  2: listPage([user(3, '丙')], 0),
};

let r = await replay({ body: home(28205015, 3), pages });
assert.equal(r.calls.length, 2);
assert.equal(r.messages.length, 0, 'the first snapshot stays quiet');
assert.equal(r.store.saved.count, 3);
assert.equal(r.store.saved.people['2'].note, '备注乙');
assert.equal(r.store.saved.people['2'].avatar, 'https://img.example/2.jpg');
assert.equal(r.store.saved.people['1'].avatar, undefined);
assert.equal(r.calls[0].headers.authorization, 'Basic x');
assert.equal(r.calls[0].headers['user-agent'], 'Blued');

const saved = r.store;
r = await replay({ body: home(28205015, 3), store: saved, pages });
assert.equal(r.calls.length, 0, 'an unchanged count must not pull the list');
assert.equal(r.messages.length, 0);

r = await replay({
  body: home(28205015, 4),
  store: saved,
  pages: { 1: listPage([user(1, '甲'), user(3, '丙'), user(4, '丁'), user(5, '戊')], 0) },
});
assert.equal(r.messages.length, 0, 'a net increase stays quiet even if someone left');
assert.equal(r.store.saved.people['2'], undefined);
assert.ok(r.store.saved.people['4']);
assert.equal(r.store.saved.count, 4);

r = await replay({
  body: home(28205015, 2),
  store: saved,
  pages: { 1: listPage([user(1, '甲'), user(3, '丙')], 0) },
});
assert.equal(r.messages.length, 1);
assert.equal(r.messages[0][1], '乙（uid 2）');
assert.match(r.messages[0][2], /3 → 2/);
assert.match(r.messages[0][2], /备注：备注乙/);
assert.equal(r.messages[0][3].action, 'open-url');
assert.equal(r.messages[0][3]['media-url'], 'https://img.example/2.jpg');
const jump = r.messages[0][3].url;
assert.match(jump, /^https:\/\/nk5oy5\.oplinking\.com\/ulink\/c\//);
let payload;
try {
  payload = JSON.parse(Buffer.from(jump.split('/c/')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
} catch (e) { assert.fail(`jump payload is not JSON: ${e.message}`); }
assert.equal(payload.d.tr_param1, 'https://common.blued.cn/?action=profile-enc=1-uid=Ab12Cd');
const create = r.calls.find(c => String(c.url).includes('/token/create'));
let created;
try { created = JSON.parse(create.body); } catch (e) { assert.fail(`token body is not JSON: ${e.message}`); }
assert.equal(created.uid, 2);
assert.equal(created.source, 'profile');
assert.deepEqual(Object.keys(r.store.saved.people), ['1', '3']);

r = await replay({
  body: home(28205015, 2),
  store: saved,
  pages: { 1: listPage([user(1, '甲'), user(3, '丙')], 0) },
  token: false,
});
assert.equal(r.messages.length, 1);
assert.equal(r.messages[0][1], '乙（uid 2）');
assert.equal(r.messages[0][3].url, undefined);
assert.equal(r.messages[0][3]['media-url'], 'https://img.example/2.jpg');

r = await replay({
  body: home(28205015, 2),
  store: saved,
  pages: { 1: listPage([user(1, '甲'), user(2, '乙', '备注乙'), user(3, '丙')], 0) },
});
assert.equal(r.messages[0][1], '名单没拉全', 'a shorter count than the list must not be saved');
assert.equal(r.store.saved.count, 3);
assert.doesNotMatch(JSON.stringify(r.messages), /乙（uid/);

r = await replay({
  body: home(8, 1),
  store: saved,
  pages: { 1: listPage([user(9, '别的号')], 0) },
  url: 'https://social.irisgw.cn/users/8',
});
assert.equal(r.messages.length, 0, 'another account is a new baseline, not a disappearance');
assert.equal(r.store.saved.owner, '8');
assert.doesNotMatch(JSON.stringify(r.messages), /甲|乙/);

r = await replay({ body: home(28205015, 1), store: saved, pages: { 1: listPage([user(1, '甲')], 1) } });
assert.equal(r.messages[0][1], '名单没拉全');
assert.deepEqual(r.store.saved, saved.saved);
r = await replay({ body: home(28205015, 1), store: r.store, pages: { 1: listPage([user(1, '甲')], 1) } });
assert.equal(r.messages.length, 0, 'the same failed count does not notify again');

r = await replay({
  body: { code: 200, data: [{ uid: 28205015, followed_count: null }] },
  store: saved,
  pages,
});
assert.equal(r.calls.length, 0, 'a null count must not pull');
assert.equal(r.messages.length, 0);
assert.deepEqual(r.store, saved);

r = await replay({
  body: home(28205015, 2),
  store: saved,
  pages: { 1: listPage([user(1, '甲'), { name: '坏行' }], 0) },
});
assert.equal(r.messages[0][1], '名单没拉全');
assert.deepEqual(r.store.saved, saved.saved);
assert.doesNotMatch(JSON.stringify(r.messages), /乙/);

for (const status of [500, 199, 0]) {
  r = await replay({
    body: home(28205015, 2),
    store: saved,
    pages: { 1: listPage([user(1, '甲'), user(3, '丙')], 0) },
    status,
  });
  assert.equal(r.messages[0][1], '名单没拉全', `status ${status}`);
  assert.deepEqual(r.store.saved, saved.saved, `status ${status}`);
  assert.doesNotMatch(JSON.stringify(r.messages), /乙/, `status ${status}`);
}

r = await replay({
  body: home(28205015, 2),
  store: saved,
  pages: { 1: listPage([user(1, '甲')], 0) },
});
assert.equal(r.messages[0][1], '名单没拉全', 'a short final page must not announce the rest as gone');
assert.deepEqual(r.store.saved, saved.saved);

r = await replay({ body: home(28205015, 3), store: {}, pages, headers: {} });
assert.equal(r.calls.length, 0);
assert.equal(r.messages[0][1], '名单没拉全');

r = await replay({ body: home(28205015, 3), store: {}, pages, write: false });
assert.equal(r.messages[0][1], '记录失败');
assert.deepEqual(r.store, {});

for (const url of miss) {
  r = await replay({ url, body: home(28205015, 0), store: saved, pages });
  assert.equal(r.calls.length, 0, url);
  assert.equal(r.messages.length, 0, url);
  assert.deepEqual(r.store, saved);
}

r = await replay({
  body: home(28205015, 2),
  store: { saved: saved.saved, busy: { owner: '28205015', at: 1000 + 60000 } },
  pages: { 1: listPage([user(1, '甲'), user(3, '丙')], 0) },
});
assert.equal(r.messages[0][1], '乙（uid 2）', 'a future busy timestamp must not stick the lock');

r = await replay({ body: home(28205015, 3), pages, client: 'qx' });
assert.equal(r.calls.length, 2);
assert.equal(r.store.saved.count, 3);

process.stdout.write('Blued follow checks passed.\n');
