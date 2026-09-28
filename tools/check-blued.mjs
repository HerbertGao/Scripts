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
async function replay(url) {
  const messages = [];
  const writes = [];
  await new Promise(resolve => {
    vm.runInNewContext(source, {
      $request: { url },
      $response: { body: JSON.stringify({ data: [{ uid: '123', name: 'fixture', tags: {} }] }) },
      $environment: { 'surge-version': 'test' },
      $notification: { post: (...args) => messages.push(args) },
      $persistentStore: { read: () => null, write: (...args) => { writes.push(args[1]); return true; } },
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
process.stdout.write(`Blued checks passed: ${files.length} configurations, legacy/new hosts, path boundaries, profile notifications/cache.\n`);
