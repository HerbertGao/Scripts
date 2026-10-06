// Run: node tools/check-blued.mjs (synthetic data only; no network requests).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = [
  'Surge/blued.module', 'Surge/blued.save.module',
  'Shadowrocket/blued.module', 'Shadowrocket/blued.save.module',
  'QuantumultX/blued.conf', 'QuantumultX/blued.save.conf',
  'Stash/Blued.stoverride', 'Stash/Blued.save.stoverride',
];
const profileHosts = ['argo.blued.cn', 'social.irisgw.cn'];
const profiles = profileHosts.flatMap(host => [
  `https://${host}/users/123`, `https://${host}/users/123?from=profile`,
]);
const blocked = [
  ...['argo.blued.cn', 'moments.irisgw.cn'].flatMap(host => [
    'promote', 'adms/test', 'splash', 'launch/adms',
    'promotion/banners', 'floats', 'api/ad/distribution',
  ].map(path => `https://${host}/blued/${path}?test=1`)),
  ...['social.blued.cn', 'social.irisgw.cn'].flatMap(host => [
    `https://${host}/users/123/joy?filter=all`,
    `https://${host}/users/recommend`,
  ]),
  'https://voice.irisgw.cn/users/chatroom',
  'https://social.irisgw.cn/voice-chat/api/config',
  'https://social.irisgw.cn/voice-chat/api/quick/match/info',
];
const other = [
  ...profileHosts.flatMap(host => ['paid/goods', 'apnsbadge', 'setting', 'flash', 'more/ios']
    .map(path => `https://${host}/users/123/${path}`)),
  'https://social.irisgw.cn/users/call/state',
  'https://social.irisgw.cn/users/recommendation',
  'https://moments.irisgw.cn/blued/config',
  'https://moments.irisgw.cn/blued/promotion/banners-extra',
  'https://moments.irisgw.cn/blued/api/ad/distribution-extra',
  'https://social.irisgw.cn.example.org/users/123',
];

for (const file of files) {
  const text = read(file);
  const line = text.split('\n').find(line => line.includes('\\/users\\/\\d+'));
  assert.ok(line, `${file}: missing profile rule`);
  const profile = new RegExp(line.match(/\^https:[^\s,]+/)[0]);
  const rejects = [...text.matchAll(/(?:^URL-REGEX,|^\s*- |^)(\^https:[^\s,]+)(?:,REJECT| url reject| - reject)$/gm)]
    .map(match => new RegExp(match[1]));
  const mitm = file.startsWith('Stash/')
    ? text.match(/  mitm:\n([\s\S]*?)(?=  \w)/)[1]
    : text.match(/^hostname = (.+)$/m)[1];
  const hosts = mitm.match(/(?:[a-z*][-a-z0-9*]*\.)+[a-z]+/g);
  for (const url of profiles) assert.ok(profile.test(url), `${file}: missed ${url}`);
  for (const url of [...blocked, ...other]) assert.ok(!profile.test(url), `${file}: profile overmatched ${url}`);
  for (const url of blocked) assert.ok(rejects.some(rule => rule.test(url)), `${file}: did not reject ${url}`);
  for (const url of [...profiles, ...other]) assert.ok(!rejects.some(rule => rule.test(url)), `${file}: overblocked ${url}`);
  for (const url of [...profiles, ...blocked]) {
    const host = url.split('://')[1].split('/')[0];
    assert.ok(hosts.includes(host), `${file}: missing MITM host`);
  }
}

const source = read('Scripts/Blued/blued.profile.js');
async function replay(url, profile = {}, selfTags = null) {
  const messages = [];
  const writes = [];
  await new Promise(resolve => {
    vm.runInNewContext(source, {
      $request: { url },
      $response: { body: JSON.stringify({ data: [{ uid: '123', name: 'fixture', tags: {}, ...profile }] }) },
      $environment: { 'surge-version': 'test' },
      $notification: { post: (...args) => messages.push(args) },
      $persistentStore: {
        read: key => key === 'blued_self_tags' && selfTags !== null ? JSON.stringify(selfTags) : null,
        write: (...args) => { writes.push(args[1]); return true; },
      },
      $done: resolve,
      console: { log() {} },
    }, { timeout: 1000 });
  });
  return { messages, writes };
}
for (const url of profiles) {
  const { messages, writes } = await replay(url);
  assert.equal(messages.length, url.includes('?') ? 1 : 0, `${url}: wrong notification count`);
  assert.deepEqual(writes, url.includes('?') ? [] : ['blued_self_uid', 'blued_self_tags']);
}
for (const url of [...blocked, ...other]) {
  assert.deepEqual(await replay(url), { messages: [], writes: [] }, `${url}: script overmatched`);
}
const bmiCases = [
  [180, 75, '23.1'],
  ['180', '75', '23.1'],
  [180, 30, '9.3'], // No height, weight or BMI range filtering.
  [180, 200, '61.7'],
  [100, 30, '30.0'],
  [250, 300, '48.0'],
  [undefined, 75, null],
  [180, undefined, null],
  [null, 75, null],
  [0, 75, null],
  [180, 0, null],
  [-180, 75, null],
  [180, -75, null],
  ['Infinity', 75, null],
  [180, 'Infinity', null],
  [1e-200, 75, null], // Finite inputs, but the BMI calculation overflows.
  ['invalid', 75, null],
  [180, 'invalid', null],
  [[180], 75, null],
  [180, [75], null],
];
for (const [height, weight, bmi] of bmiCases) {
  const { messages, writes } = await replay(profiles[1], { height, weight });
  const bmiSuffix = bmi === null ? '' : ` / BMI ${bmi}`;
  const subtitle = [
    height ? `${height}cm` : null,
    weight ? `${weight}kg${bmiSuffix}` : null,
    '其它',
  ].filter(Boolean).join(' / ');
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].slice(0, 3), ['Blued fixture (uid 123)', subtitle, '']);
  assert.deepEqual(writes, []);
}
const tag = (name, id = 'fixture') => ({ name, id });
const matchCases = [
  {
    name: 'shared preferences, body types, jobs and MBTI are not highlights',
    self: { love_type: [tag('肌肉')], type: [tag('匀称')], work: [tag('IT')], mbti: [tag('F')] },
    tags: { love_type: [tag('肌肉')], type: [tag('匀称')], work: [tag('IT')], mbti: [tag('F')] },
    expected: ['我喜欢：肌肉'],
  },
  {
    name: 'modern fields, both directions, distinct preference/trait IDs',
    self: { love_physical: [tag('短发', 'p1')], personality: [tag('阳光', 't2')] },
    tags: { physical: [tag('短发', 't1')], love_personality: [tag('阳光', 'p2')] },
    expected: ['对方符合我的偏好：短发', '我符合对方的偏好：阳光', '我喜欢：阳光'],
  },
  {
    name: 'legacy fields and one-way match',
    self: { love_type: [tag('肌肉')], love_character: [tag('阳光')] },
    tags: { type: [tag('肌肉')], character: [tag('阳光')] },
    expected: ['对方符合我的偏好：肌肉、阳光'],
  },
  {
    name: 'merge rather than replace legacy fields, deduplicate and normalize known alias',
    self: { love_type: [tag('肌肉')], love_physical: [tag('肌肉'), tag('肉壯')] },
    tags: { type: [tag('肌肉')], physical: [tag('肉壮')], love_type: [tag('肌肉')], love_physical: [tag('肌肉'), tag('肉壯')] },
    expected: ['对方符合我的偏好：肌肉、肉壮', '我喜欢：肌肉、肉壮'],
  },
  {
    name: 'shared interests and goals remain distinct',
    self: { hobbies: [tag('电影')], recreation: [tag('电影'), tag('旅行')], i_want: [tag('交朋友')] },
    tags: { hobbies: [tag('电影')], recreation: [tag('电影'), tag('旅行')], i_want: [tag('交朋友')] },
    expected: ['共同兴趣：电影、旅行', '共同目的：交朋友', '我想找：交朋友'],
  },
  {
    name: 'no self cache, modern preference display still deduplicates',
    self: null,
    tags: { physical: [tag('肌肉')], love_physical: [tag('短发')], love_type: [tag('短发')] },
    expected: ['我喜欢：短发'],
  },
  {
    name: 'no matching across unrelated categories; ignore invalid entries',
    self: { love_physical: [tag('阳光'), null, { name: 1 }], love_personality: null, hobbies: [tag('电影')] },
    tags: { personality: [tag('阳光')], physical: {}, recreation: [tag('电影')] },
    expected: [],
  },
];
for (const { name, self, tags, expected } of matchCases) {
  const { messages, writes } = await replay(profiles[1], { tags }, self);
  assert.equal(messages.length, 1, name);
  assert.equal(messages[0][2], expected.join('\n'), name);
  assert.deepEqual(writes, [], name);
}
process.stdout.write(`Blued checks passed: ${files.length} configurations, legacy/new hosts, path boundaries, profile notifications/cache, ${bmiCases.length} BMI cases, ${matchCases.length} tag matching cases.\n`);
