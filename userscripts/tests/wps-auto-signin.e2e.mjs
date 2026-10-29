// 端到端演练：用真实抓到的接口响应驱动脚本的任务函数，验证解析与分支判断
// 覆盖「已签 / 未签成功 / 打卡已签 / 打卡新建序列 / 抽奖0次 / 抽奖成功 / 换期缺失」等分支
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// 相对本文件定位被测脚本，换机器 / clone 到任意路径都能直接跑
const SRC = fileURLToPath(new URL('../wps-auto-signin.user.js', import.meta.url));
const src = fs.readFileSync(SRC, 'utf8');

function extractFn(name) {
    let start = src.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('未找到 ' + name);
    const a = src.lastIndexOf('async function ' + name + '(', start);
    if (a >= 0) start = a;
    let d = 0;
    const i = src.indexOf('{', start);
    for (let j = i; j < src.length; j++) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') { d--; if (d === 0) return src.slice(start, j + 1); }
    }
}
function extractConst(name) {
    const start = src.indexOf('const ' + name + ' = {');
    if (start < 0) throw new Error('未找到常量 ' + name);
    let d = 0;
    for (let j = src.indexOf('{', start); j < src.length; j++) {
        if (src[j] === '{') d++;
        else if (src[j] === '}') { d--; if (d === 0) return src.slice(start, j + 1); }
    }
}

const parts = [
    extractConst('API'), extractConst('FLZX'), extractConst('COMPONENTS'),
    "const UA_DESKTOP='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';",
    'const CONFIG={gapMin:0,gapMax:0,debug:true,tasks:{}};',
    'const results=[];',
    'const log=(m)=>console.error(m);',
    extractFn('debugDump'), extractFn('safeJson'), extractFn('classify'),
    extractFn('genAesKey'), extractFn('utf8Bytes'), extractFn('modpow'),
    extractFn('rsaEncryptB64'), extractFn('b64dec'), extractFn('b64enc'),
    extractFn('aesEncrypt'), extractFn('beijingDate'), extractFn('httpReq'),
    extractFn('fetchPageInfo'), extractFn('findComp'),
    extractFn('taskSignIn'), extractFn('taskFragment'), extractFn('taskLottery'),
    'return {taskSignIn,taskFragment,taskLottery,results,API,COMPONENTS};',
].filter(Boolean);

const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;

// 用假 httpReq 注入预设响应

const chunk = parts.join('\n\n');
// 用一个 ctx 参数把 httpReq 注入闭包，避免脆弱的字符串替换
const body = chunk.replace(
    'return {taskSignIn,taskFragment,taskLottery,results,API,COMPONENTS};',
    'return {taskSignIn,taskFragment,taskLottery,results,API,COMPONENTS};'
);

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; console.log('✅', n, e); } else { fail++; console.log('❌', n, e); } };

// 工厂：注入依赖。脚本内的 httpReq 保持原样（它内部调 GM_xmlhttpRequest），
// 我们替换 GM_xmlhttpRequest 为可编排的假实现，这样跑的是真实 httpReq 封装逻辑。
const AF = Object.getPrototypeOf(async function () { }).constructor;
const factory = new AF(
    'crypto', 'B64', 'GM_xmlhttpRequest', 'TextEncoder', 'unescape', 'encodeURIComponent', 'console',
    body
);
const REAL_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

async function run(name, responses, ...args) {
    const calls = [];
    const fakeGM = (opts) => {
        calls.push({ method: opts.method, url: opts.url.split('?')[0], headers: opts.headers, body: opts.data });
        const finish = (status, body) => opts.onload({ status, responseText: body });
        for (const [key, val] of Object.entries(responses)) {
            if (opts.url.includes(key)) {
                if (typeof val === 'function') {
                    try { return val(opts); } catch (e) { return opts.onerror({ error: e.message }); }
                }
                return finish(200, JSON.stringify(val));
            }
        }
        return finish(200, '{"result":"ok"}');
    };
    const api = await factory(crypto, REAL_B64, fakeGM, TextEncoder, unescape, encodeURIComponent, console);
    api.results.length = 0;
    await api[name](...args);
    return { results: api.results.slice(), calls };
}

console.log('—— 场景 1：每日签到（今日已签）——');
let r = await run('taskSignIn', {
    day_info: { result: 'ok', data: { info: { has_sign: true, continuous: 12 } } },
});
t('识别为已签到', r.results[0].includes('已签到'), r.results[0]);
t('未发起签到 POST', !r.calls.some((c) => c.url.includes('sign_in/v1/sign_in')));

console.log('\n—— 场景 2：每日签到（未签 → 成功）——');
r = await run('taskSignIn', {
    day_info: { result: 'ok', data: { info: { has_sign: false, reward_name: ['1天会员', '积分+1'], continuous: 0 } } },
    'encrypt/key': { result: 'ok', data: 'LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0tLS0tCk1FZ0NRUURIakJPNzJpSnlhdlhJK0tZd1hCbGZLTnFKYU5saUkyQkJrcVl5cTArS2VWazBnZEk4RTl5SVh6RloKNGFhanpKMjZpOHdWbENsQzVOYSs0aEMzNE9iMUFnTUJBQUU9Ci0tLS0tRU5EIFJTQSBQVUJMSUMgS0VZLS0tLS0=' },
    'sign_in/v1/sign_in': { result: 'ok', data: { rewards: [{ reward_name: '1天会员' }, { reward_name: '积分+1' }] } },
}, '1234567890');
t('签到成功', r.results[0].includes('成功'), r.results[0]);
t('携带 token 头', r.calls.some((c) => c.headers && c.headers.token && c.headers.token.length === 88));
const signCall = r.calls.find((c) => c.url.includes('v1/sign_in') && c.body);
t('请求体 encrypt=true', signCall && JSON.parse(signCall.body).encrypt === true);
t('extra 为 64 字符 base64（10 位 uid → 明文 38B → AES 密文 48B）', signCall && JSON.parse(signCall.body).extra.length === 64);

console.log('\n—— 场景 3：打卡（已有序列 → 复用，不清零）——');
const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
r = await run('taskFragment', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025061815352884', component_node_id: 'FN1769668388sb3w', fragment_collect: { sign_series_id: 'SER123', sign_records: [] } },
    ] },
    component_action: { result: 'ok', data: { fragment_collect: { success: true } } },
});
t('打卡成功', r.results[0].includes('成功'), r.results[0]);
const fb = JSON.parse(r.calls.find((c) => c.url.includes('component_action')).body);
t('复用已有 series_id', fb.fragment_collect.series_id === 'SER123', fb.fragment_collect.series_id);
t('is_new_sign_series = false', fb.fragment_collect.is_new_sign_series === false);
t('sign_date 为北京时间', fb.fragment_collect.sign_date === today, fb.fragment_collect.sign_date);

console.log('\n—— 场景 4：打卡（无序列 → 新建）——');
r = await run('taskFragment', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025061815352884', component_node_id: 'FN1769668388sb3w', fragment_collect: { sign_series_id: '', sign_records: [] } },
    ] },
    component_action: { result: 'ok', data: { fragment_collect: { success: true } } },
});
const fb2 = JSON.parse(r.calls.find((c) => c.url.includes('component_action')).body);
t('首次才置 is_new_sign_series = true', fb2.fragment_collect.is_new_sign_series === true);
t('提示新建序列', r.results[0].includes('新建序列'), r.results[0]);

console.log('\n—— 场景 5：打卡已签（当天记录）——');
r = await run('taskFragment', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025061815352884', component_node_id: 'FN1769668388sb3w',
          fragment_collect: { sign_series_id: 'S1', sign_records: [{ sign_date: today, sign_status: 'signed' }] } },
    ] },
});
t('识别为已打卡', r.results[0].includes('已打卡'), r.results[0]);
t('不发起打卡请求', !r.calls.some((c) => c.url.includes('component_action')));

console.log('\n—— 场景 6：打卡 —— 活动换期组件缺失（安全闸）——');
r = await run('taskFragment', {
    page_info: { result: 'ok', data: [{ number: 'OTHER', component_node_id: 'XX' }] },
});
t('安全闸拦截，不误清零', r.results[0].includes('避免误清零'), r.results[0]);
t('未发起任何打卡请求', !r.calls.some((c) => c.url.includes('component_action')));

console.log('\n—— 场景 7：抽奖（0 次，10点前）——');
r = await run('taskLottery', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025092916519174', component_node_id: 'FN1779447163CApn',
          lottery_v2: { lottery_list: [{ session_id: 3002, session_status: 'IN_PROGRESS', times: 0 }] } },
    ] },
});
t('0 次不当成错误', r.results[0].includes('暂无免费次数'), r.results[0]);
t('不发起抽奖请求', !r.calls.some((c) => c.url.includes('component_action')));

console.log('\n—— 场景 8：抽奖（有次数 → 中奖）——');
r = await run('taskLottery', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025092916519174', component_node_id: 'FN1779447163CApn',
          lottery_v2: { lottery_list: [{ session_id: 3005, session_status: 'IN_PROGRESS', times: 1 }] } },
        { number: 'ZJ2025092916519174', component_node_id: 'OTHER', lottery_v2: {} },
    ] },
    component_action: { result: 'ok', data: { lottery_v2: { success: true, reward_name: '1天会员' } } },
});
t('抽奖成功并回报奖品', r.results[0].includes('1天会员'), r.results[0]);
t('取进行中场次的 session_id', JSON.parse(r.calls.find((c) => c.url.includes('component_action')).body).lottery_v2.session_id === 3005);

console.log('\n—— 场景 9：抽奖次数瞬时耗尽（error_code 10005）——');
r = await run('taskLottery', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025092916519174', component_node_id: 'FN1779447163CApn',
          lottery_v2: { lottery_list: [{ session_id: 3005, session_status: 'IN_PROGRESS', times: 1 }] } },
    ] },
    component_action: { result: 'ok', data: { lottery_v2: { success: false, error_code: 10005 } } },
});
t('10005 归为次数用完（classify → ✅ 已达上限，非失败）', r.results[0].startsWith('✅') && r.results[0].includes('已达上限'), r.results[0]);

console.log('\n—— 场景 10：打卡已领完（风控/售罄语义）——');
r = await run('taskFragment', {
    page_info: { result: 'ok', data: [
        { number: 'ZJ2025061815352884', component_node_id: 'FN1769668388sb3w', fragment_collect: { sign_series_id: 'S1', sign_records: [] } },
    ] },
    component_action: { result: 'ok', data: { fragment_collect: { success: false, reason: '已领完' } } },
});
t('已领完归为 ⚠️ 而非失败', r.results[0].startsWith('⚠️') && r.results[0].includes('已领完'), r.results[0]);

console.log('\n—— 场景 11：page_info 网络异常 ——');
r = await run('taskLottery', { page_info: () => { throw new Error('timeout'); } });
t('异常不崩溃，标为 ❌', r.results[0].includes('❌') || r.results[0].includes('异常'), r.results[0]);

console.log('\n' + '='.repeat(50) + '\n通过 ' + pass + ' / ' + (pass + fail) + (fail ? '   ❌ 失败 ' + fail : '   🎉 全部通过'));
process.exit(fail ? 1 : 0);
