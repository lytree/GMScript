import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 相对本文件定位被测脚本，换机器 / clone 到任意路径都能直接跑
const SRC = fileURLToPath(new URL('../wps-auto-signin.user.js', import.meta.url));
const src = fs.readFileSync(SRC, 'utf8');

// 从真实脚本里抽取函数体做测试（不是手抄，确保测的是真正会跑的代码）
function extract(name) {
    // 注意：async function 的 "function" 前面有前缀，定位要从 async 处开始，否则会截掉 async 关键字
    let start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('未找到函数 ' + name);
    const asyncStart = src.lastIndexOf('async ', start);
    if (asyncStart >= 0 && src.slice(asyncStart, start).trim() === 'async') start = asyncStart;
    let d = 0;
    const i = src.indexOf('{', start);
    for (let j = i; j < src.length; j++) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') { d--; if (d === 0) return src.slice(start, j + 1); }
    }
}
const need = ['b64enc', 'b64dec', 'utf8Bytes', 'modpow', 'rsaEncryptB64', 'aesEncrypt',
    'genAesKey', 'beijingDate', 'classify', 'safeJson', 'findComp'];
const code = need.map(extract).join('\n\n');
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
const mod = new AsyncFunction('crypto', 'B64', code + '\nreturn {rsaEncryptB64,aesEncrypt,genAesKey,beijingDate,classify,findComp,b64enc,b64dec,safeJson};');
const M = await mod(crypto, B64);

let pass = 0, fail = 0;
const t = (name, cond, extra = '') => {
    if (cond) { pass++; console.log('✅', name, extra); }
    else { fail++; console.log('❌', name, extra); }
};

// 1. base64 往返
t('b64enc/b64dec 往返', M.b64enc(M.b64dec('aGVsbG8gd29ybGQh')) === 'aGVsbG8gd29ybGQh');
t('b64 长度正确(3字节→4)', M.b64enc([1, 2, 3]).length === 4, M.b64enc([1, 2, 3]));

// 2. genAesKey 长度恒为 32（RSA-512 明文上限 53）
const lens = new Set();
for (let i = 0; i < 300; i++) lens.add(M.genAesKey().length);
t('genAesKey 恒为 32 字符', lens.size === 1 && lens.has(32), [...lens].join(','));

// 3. RSA 真实往返 —— 脚本实现加密 → Node 原生私钥解密
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa',
    { modulusLength: 512, publicExponent: 65537 });
const pemB64 = Buffer.from(publicKey.export({ type: 'pkcs1', format: 'pem' }).toString()).toString('base64');
let ok = true;
for (let i = 0; i < 50; i++) {
    const key = M.genAesKey();
    const ct = Buffer.from(M.rsaEncryptB64(key, pemB64), 'base64');
    if (ct.length !== 64) { ok = false; break; }
    if (crypto.privateDecrypt({ key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING }, ct).toString() !== key) {
        ok = false; break;
    }
}
t('RSA 50 次往返全部一致（含 64 字节长度校验）', ok);

// 4. RSA 密文 base64 恒为 88 字符
const ctLen = M.rsaEncryptB64(M.genAesKey(), pemB64).length;
t('RSA 密文 base64 = 88 字符', ctLen === 88, '实际 ' + ctLen);

// 5. WPS 真实公钥可解析加密
const wpsPemB64 = 'LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1FZ0NRUURIakJPNzJpSnlhdlhJK0tZd1hCbGZLTnFKYU5saUkyQkJrcVl5cTArS2VWazBnZEk4RTl5SVh6RloKNGFhanpKMjZpOHdWbENsQzVOYSs0aEMzNE9iMUFnTUJBQUU9Ci0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZLS0tLS0=';
t('WPS 真实公钥可加密', M.rsaEncryptB64(M.genAesKey(), wpsPemB64).length === 88);

// 6. AES-CBC 往返
const ak = M.genAesKey();
const plain = JSON.stringify({ user_id: '1234567890', platform: 32 });
const extra = await M.aesEncrypt(plain, ak, ak.slice(0, 16));
t('AES extra 长度 64', extra.length === 64, '实际 ' + extra.length);
const dk = await crypto.webcrypto.subtle.importKey('raw', Buffer.from(ak, 'utf8'), 'AES-CBC', false, ['decrypt']);
const dec = Buffer.from(await crypto.webcrypto.subtle.decrypt(
    { name: 'AES-CBC', iv: Buffer.from(ak.slice(0, 16), 'utf8') }, dk, Buffer.from(extra, 'base64'))).toString();
t('AES 往返明文一致', dec === plain, dec);

// 7. beijingDate 与东八区独立计算对拍
const d = new Date(Date.now() + 8 * 3600e3);
const expect = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
t('beijingDate 正确', M.beijingDate() === expect, M.beijingDate());
t('beijingDate 格式 YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(M.beijingDate()));

// 8. classify 归类
const cs = [
    ['已签到', '✅', '已签到'],
    ['Duplicate entry', '✅', '已打卡'],
    ['已达到上限', '✅', '已达上限'],
    ['无抽奖次数', '✅', '已达上限'],
    ['已领完', '⚠️', '已领完'],
    ['您没有资格', '⚠️', '没资格'],
    ['', '⚠️', '未成功'],
];
cs.forEach(([inp, e, tp]) => {
    const r = M.classify(inp, '已打卡');
    t('classify("' + (inp || '(空)') + '")', r.e === e && r.t === tp, '→ ' + r.e + ' ' + r.t);
});

// 9. findComp 精确定位
const list = [{ number: 'A', component_node_id: 'N1' }, { number: 'B', component_node_id: 'N2' }, { number: 'A', component_node_id: 'N2' }];
t('findComp 精确匹配 number+nodeId', M.findComp(list, 'A', 'N2').component_node_id === 'N2');
t('findComp 找不到返回 null', M.findComp(list, 'Z', 'N9') === null);
t('findComp 忽略 nodeId 兜底', !!M.findComp(list, 'A'));

// 10. safeJson 容错
t('safeJson 正常解析', M.safeJson('{"a":1}').a === 1);
t('safeJson 脏数据不抛异常', M.safeJson('<html>') === null);

// 11. 元数据自检
const meta = src.slice(0, src.indexOf('==/UserScript=='));
t('@version 已声明', /@version\s+1\.0\.0/.test(meta));
t('@match 覆盖 account/personal-act', meta.includes('account.wps.cn') && meta.includes('personal-act.wps.cn'));
t('@connect 覆盖三个域', ['account.wps.cn', 'personal-bus.wps.cn', 'personal-act.wps.cn']
    .every((d) => meta.includes('@connect      ' + d)));
t('updateURL = downloadURL', (meta.match(/https:\/\/raw\.githubusercontent\.com[^\s]*/g) || []).length === 2);
t('文件名与 downloadURL 一致', meta.includes('userscripts/wps-auto-signin.user.js'));

console.log('\n' + '='.repeat(48) + '\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '   ❌ 失败 ' + fail : '   🎉 全部通过'));
process.exit(fail ? 1 : 0);
