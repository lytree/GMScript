// ==UserScript==
// @name         WPS Auto Sign-in (自动签到)
// @namespace    https://github.com/lytree/GMScript
// @version      1.0.0
// @description  WPS 自动签到助手：每日签到（领会员+积分）、福利中心打卡领会员、天天抽奖。登录 WPS 后自动运行，全程零配置。
// @author       lytree
// @license      MIT
// @icon         https://www.wps.cn/favicon.ico
// @homepage     https://github.com/lytree/GMScript
// @supportURL   https://github.com/lytree/GMScript/issues
// @match        https://account.wps.cn/*
// @match        https://vip.wps.cn/*
// @match        https://personal-act.wps.cn/*
// @match        https://www.wps.cn/*
// @match        https://bbs.wps.cn/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      account.wps.cn
// @connect      personal-bus.wps.cn
// @connect      personal-act.wps.cn
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/wps-auto-signin.user.js
// @updateURL    https://raw.githubusercontent.com/lytree/GMScript/main/userscripts/wps-auto-signin.user.js
// ==/UserScript==

/* =========================================================================
 * 📜 免责声明
 * -------------------------------------------------------------------------
 * 本脚本仅供个人学习与自动化测试使用，调用的是 WPS 官方公开接口。
 * 使用者需自行承担账号风控等风险，请合理控制频率。
 *
 * 🔗 相关链接
 * -------------------------------------------------------------------------
 * - 本仓库:https://github.com/lytree/GMScript
 * ========================================================================= */

(function () {
    'use strict';

    // ================= 配置 =================
    const CONFIG = {
        // 每日自动执行时间窗（小时）。仅在浏览器打开且停留于匹配页时生效 —— 脚本没有后台常驻能力。
        // 设为 null 则每次打开页面都尝试（受"每日一次"守卫约束，实际仍每天只跑一轮）。
        runHour: null,

        // 任务间随机间隔（毫秒），模拟真人操作节奏，降低风控概率
        gapMin: 5000,
        gapMax: 10000,

        // 调试模式：true 时输出接口原始响应到控制台
        debug: false,

        // 各任务开关
        tasks: {
            sign: true,      // 每日签到（领 1 天会员 + 积分）
            fragment: true,  // 福利中心 · 打卡领会员
            lottery: true,   // 福利中心 · 天天抽奖
        },
    };

    // ================= 接口定义 =================
    const API = {
        isLogin: 'https://account.wps.cn/api/v3/islogin',
        encKey: 'https://personal-bus.wps.cn/sign_in/v1/encrypt/key',
        dayInfo: 'https://personal-bus.wps.cn/sign_in/v1/day_info',
        signIn: 'https://personal-bus.wps.cn/sign_in/v1/sign_in',
        component: 'https://personal-act.wps.cn/activity-rubik/activity/component_action',
        pageInfo: 'https://personal-act.wps.cn/activity-rubik/activity/page_info',
    };

    // 福利中心「天天领福利」活动标识。官方换期时需同步更新这里。
    const FLZX = {
        activityNumber: 'HD2025031721339450',
        pageNumber: 'YM2025060910400185',
        // position 用于让服务端返回"带用户态"的渲染结果，缺失会导致读不到连续签到序列
        position: 'ios_flzx_grzxsdjg3001',
    };

    // 福利中心组件定义（type 为 component_type）
    const COMPONENTS = {
        // 打卡领会员（连续签到累计会员时长）
        fragment: { number: 'ZJ2025061815352884', nodeId: 'FN1769668388sb3w', type: 42 },
        // 天天抽奖
        lottery: { number: 'ZJ2025092916519174', nodeId: 'FN1779447163CApn', type: 45, sessionId: 3002 },
    };

    const UA_DESKTOP =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/131.0.0.0 Safari/537.36';

    const results = [];
    let running = false;

    // ================= 入口 =================
    (function init() {
        registerMenus();
        injectPanel();

        if (shouldAutoRun()) {
            log(`[INFO] 命中自动执行条件（${beijingDate()}）`);
            runAll('auto');
        } else {
            log('[INFO] 今日已执行或不在时间窗内，静默待机。菜单可手动触发。');
        }
    })();

    function shouldAutoRun() {
        // 手动点过"忽略今日"就不自动跑
        if (GM_getValue('wps_skip_date', '') === beijingDate()) return false;

        if (CONFIG.runHour !== null) {
            const h = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours();
            if (h < CONFIG.runHour) return false;
        }
        return true;
    }

    function registerMenus() {
        GM_registerMenuCommand('🚀 立即执行全部任务', () => runAll('manual'));
        GM_registerMenuCommand('📅 查询签到状态', queryStatus);
        GM_registerMenuCommand('🔄 重置今日执行记录', () => {
            GM_setValue('wps_last_date', '');
            GM_setValue('wps_skip_date', '');
            notify('已重置', '今日可再次自动执行');
        });
        GM_registerMenuCommand('🔧 切换调试模式', () => {
            CONFIG.debug = !CONFIG.debug;
            notify('调试模式', CONFIG.debug ? '已开启，原始响应将输出到控制台' : '已关闭');
        });
    }

    // ================= 主流程 =================
    async function runAll(trigger) {
        if (running) {
            notify('正在执行', '上一轮任务尚未结束，本次忽略');
            return;
        }
        running = true;
        results.length = 0;
        updatePanel('运行中…', true);

        try {
            // 1. 校验登录态并取 user_id（签到加密必需，动态获取，不落盘）
            const uid = await resolveUserId();
            if (!uid) {
                finish(trigger, ['🚫 登录态无效：请先在浏览器登录 WPS，再重新运行']);
                return;
            }
            log(`[INFO] user_id 已获取（${String(uid).slice(0, 3)}***）`);

            // 2. 按优先级串行执行。顺序依据：
            //    签到 → 打卡（两者都无库存竞争，先把稳的拿下）
            //    抽奖放最后：它的免费次数每天 10:00 后才刷新，早跑大概率是 0 次
            const queue = [
                ['每日签到', CONFIG.tasks.sign, () => taskSignIn(uid)],
                ['打卡领会员', CONFIG.tasks.fragment, () => taskFragment()],
                ['天天抽奖', CONFIG.tasks.lottery, () => taskLottery()],
            ];

            let executed = 0;
            for (const [name, enabled, fn] of queue) {
                if (!enabled) {
                    log(`[INFO] 任务「${name}」已关闭，跳过`);
                    continue;
                }
                if (executed > 0) await sleep(randomGap());
                await safeRun(name, fn);
                executed++;
            }

            // 3. 标记今日已跑（手动执行同样计入，避免自动触发时重复）
            GM_setValue('wps_last_date', beijingDate());
            finish(trigger, results.slice());
        } catch (e) {
            log(`[ERROR] 主流程异常: ${e && e.stack ? e.stack : e}`);
            finish(trigger, ['❌ 运行异常，请开启调试模式查看控制台']);
        } finally {
            running = false;
        }
    }

    async function safeRun(name, fn) {
        try {
            await fn();
        } catch (e) {
            results.push(`❌ ${name}：异常`);
            log(`[ERROR] ${name} 异常: ${e && e.stack ? e.stack : e}`);
        }
    }

    function finish(trigger, lines) {
        const title = trigger === 'auto' ? 'WPS 自动签到' : 'WPS 签到（手动）';
        log(`==== ${title} ====`);
        lines.forEach((l) => log(l));
        notify(title, lines.join('\n'));
        updatePanel(lines.join('\n'), false);
    }

    // ================= 登录态 =================
    async function resolveUserId() {
        // 区分「网络抖动」与「服务端明确判定未登录」：
        // 前者重试即可自愈，后者才需要用户重新登录。误判会让用户白折腾。
        for (let i = 0; i < 2; i++) {
            if (i > 0) await sleep(2500);
            try {
                const r = await httpReq('GET', API.isLogin);
                const j = safeJson(r.body);
                if (j && j.result === 'ok' && j.userid) return String(j.userid);
                log(`[ERROR] islogin 返回未登录态: ${(r.body || '').slice(0, 160)}`);
                return null;
            } catch (e) {
                log(`[WARN] islogin 网络异常（第 ${i + 1}/2 次）: ${e}`);
            }
        }
        notify('网络异常', 'islogin 请求失败，这是网络问题不是登录问题，稍后重试即可');
        return null;
    }

    // ================= 任务一：每日签到 =================
    async function taskSignIn(uid) {
        const tag = '每日签到';
        try {
            // 先查是否已签，避免无谓的加密请求
            const di = await httpReq('GET', API.dayInfo);
            const info = (safeJson(di.body) || {}).data || {};
            const dayInfo = info.info || {};
            if (dayInfo.has_sign) {
                results.push(`✅ ${tag}：今日已签到`);
                log(`[INFO] ${tag}: has_sign=true，连续签到 ${dayInfo.continuous || 0} 天`);
                return;
            }
            const expect = (dayInfo.reward_name || []).join('+') || '会员/积分';
            log(`[INFO] ${tag}: 今日待签，预期奖励 ${expect}`);

            // 取服务端全局公钥（所有用户共用，每次现拉）
            const ek = await httpReq('GET', API.encKey);
            const pubKey = (safeJson(ek.body) || {}).data;
            if (!pubKey) throw new Error(`公钥获取失败: ${(ek.body || '').slice(0, 120)}`);

            // 双层加密：aesKey 用 RSA 加密放入 token 头，业务数据用 aesKey 做 AES-CBC
            const aesKey = genAesKey();
            const plain = JSON.stringify({ user_id: uid, platform: 32 }); // 32 = iOS 平台位码
            const extra = await aesEncrypt(plain, aesKey, aesKey.slice(0, 16));
            const token = rsaEncryptB64(aesKey, pubKey);

            const body = JSON.stringify({
                encrypt: true,
                extra,
                pay_origin: 'ios_ucs_rwzx sign',
                channel: '',
            });
            const r = await httpReq('POST', API.signIn, { body, token });
            const j = safeJson(r.body);
            if (j && j.result === 'ok') {
                const names = ((j.data || {}).rewards || []).map((x) => x.reward_name).filter(Boolean);
                results.push(`✅ ${tag}：成功${names.length ? '（' + names.join('/') + '）' : ''}`);
                const after = await httpReq('GET', API.dayInfo);
                const ci = ((safeJson(after.body) || {}).data || {}).info || {};
                if (ci.continuous != null) log(`[INFO] 签到后连续天数 = ${ci.continuous}`);
            } else {
                const st = classify((j && (j.ext_msg || j.msg)) || '', '已签到');
                results.push(`${st.e} ${tag}：${st.t}`);
                if (st.e !== '✅') debugDump(tag, r.body);
            }
        } catch (e) {
            results.push(`❌ ${tag}：异常`);
            log(`[ERROR] ${tag}: ${e && e.stack ? e.stack : e}`);
        }
    }

    // ================= 任务二：打卡领会员 =================
    async function taskFragment() {
        const tag = '打卡领会员';
        const comp = COMPONENTS.fragment;
        try {
            const today = beijingDate();
            const list = await fetchPageInfo();
            if (!list) {
                results.push(`❌ ${tag}：活动页无响应`);
                return;
            }
            const node = findComp(list, comp.number, comp.nodeId);
            const fc = (node && node.fragment_collect) || {};

            // 安全闸：拿不到序列状态就绝不签到。
            // 盲目签到会被服务端当作"新建序列"，把已积累的连续天数清零 —— 宁可不签。
            if (!node) {
                results.push(`⚠️ ${tag}：未取到序列状态，已跳过（避免误清零连续天数）`);
                debugDump(tag, JSON.stringify(list.map((c) => c.number)));
                return;
            }

            const seriesId = fc.sign_series_id || '';
            const records = fc.sign_records || [];
            log(`[INFO] ${tag}: series_id=${seriesId || '(空)'} 记录数=${records.length}`);

            const todayRec = records.find((r) => r && r.sign_date === today);
            if (todayRec && todayRec.sign_status === 'signed') {
                results.push(`✅ ${tag}：今日已打卡`);
                return;
            }

            // 关键：有序列就复用（is_new_sign_series=false），只有首次才新建。
            // 固定传空序列 + true 会导致永远停在第 1 天。
            const isNew = !seriesId;
            const r = await httpReq('POST', API.component, {
                body: JSON.stringify({
                    component_uniq_number: {
                        activity_number: FLZX.activityNumber,
                        page_number: FLZX.pageNumber,
                        component_number: comp.number,
                        component_node_id: comp.nodeId,
                    },
                    component_type: comp.type,
                    component_action: 'fragment_collect.sign_in',
                    fragment_collect: {
                        sign_date: today,
                        series_id: seriesId,
                        is_new_sign_series: isNew,
                    },
                }),
            });
            const j = safeJson(r.body);
            if (!j) {
                results.push(`❌ ${tag}：无响应`);
                debugDump(tag, r.body);
                return;
            }
            if (j.result !== 'ok') {
                const st = classify(j.msg || j.ext_msg, '已打卡');
                results.push(`${st.e} ${tag}：${st.t}`);
                if (st.e !== '✅') debugDump(tag, r.body);
                return;
            }
            const inner = (j.data || {}).fragment_collect || {};
            if (inner.success === true) {
                results.push(`✅ ${tag}：成功${isNew ? '（新建序列）' : ''}`);
            } else {
                const st = classify(inner.reason || j.msg, '已打卡');
                results.push(`${st.e} ${tag}：${st.t}`);
                if (st.e !== '✅') debugDump(tag, r.body);
            }
        } catch (e) {
            results.push(`❌ ${tag}：异常`);
            log(`[ERROR] ${tag}: ${e && e.stack ? e.stack : e}`);
        }
    }

    // ================= 任务三：天天抽奖 =================
    async function taskLottery() {
        const tag = '天天抽奖';
        const comp = COMPONENTS.lottery;
        try {
            const list = await fetchPageInfo();
            if (!list) {
                results.push(`❌ ${tag}：活动页无响应`);
                return;
            }
            const node = findComp(list, comp.number, comp.nodeId);
            const lv = (node && node.lottery_v2) || {};
            const sessions = lv.lottery_list || [];

            const sess =
                sessions.find((s) => s && s.session_status === 'IN_PROGRESS') || sessions[0] || null;
            const sessionId = (sess && sess.session_id) || comp.sessionId;
            const times = (sess && sess.times) || 0;

            // 免费次数每天 10:00 后才刷新。跑太早就是 0 次，属正常状态而非错误。
            if (times < 1) {
                results.push(`✅ ${tag}：今日暂无免费次数（10:00 后刷新）`);
                return;
            }

            const r = await httpReq('POST', API.component, {
                body: JSON.stringify({
                    component_uniq_number: {
                        activity_number: FLZX.activityNumber,
                        page_number: FLZX.pageNumber,
                        component_number: comp.number,
                        component_node_id: comp.nodeId,
                    },
                    component_type: comp.type,
                    component_action: 'lottery_v2.exec',
                    lottery_v2: { session_id: sessionId },
                }),
            });
            const j = safeJson(r.body);
            const inner = (j && j.data && j.data.lottery_v2) || {};
            if (j && j.result === 'ok' && inner.success === true) {
                results.push(`✅ ${tag}：抽中${inner.reward_name ? ' ' + inner.reward_name : ''}`);
            } else {
                let reason = inner.send_msg || '';
                if (!reason && inner.error_code === 10005) reason = '次数已用完';
                const st = classify(reason || (j && j.msg), '已完成');
                results.push(`${st.e} ${tag}：${st.t}`);
                if (st.e !== '✅') debugDump(tag, r.body);
            }
        } catch (e) {
            results.push(`❌ ${tag}：异常`);
            log(`[ERROR] ${tag}: ${e && e.stack ? e.stack : e}`);
        }
    }

    // ================= 状态查询 =================
    async function queryStatus() {
        const uid = await resolveUserId();
        if (!uid) {
            notify('查询失败', '登录态无效，请先登录 WPS');
            return;
        }
        try {
            const [di, list] = await Promise.all([
                httpReq('GET', API.dayInfo),
                fetchPageInfo(),
            ]);
            const info = ((safeJson(di.body) || {}).data || {}).info || {};
            const lines = [
                `每日签到：${info.has_sign ? '已签' : '未签'}`,
                `连续天数：${info.continuous != null ? info.continuous : '未知'} 天`,
            ];
            if (Array.isArray(info.reward_name) && info.reward_name.length) {
                lines.push(`今日奖励：${info.reward_name.join(' / ')}`);
            }
            const node = list ? findComp(list, COMPONENTS.fragment.number, COMPONENTS.fragment.nodeId) : null;
            if (node) {
                const fc = node.fragment_collect || {};
                const signed = (fc.sign_records || []).filter((r) => r && r.sign_status === 'signed').length;
                lines.push(`打卡记录：${signed} 天${fc.sign_series_id ? '' : '（未建序列）'}`);
            } else {
                lines.push('打卡记录：活动组件未找到（可能已换期）');
            }
            const lnode = list ? findComp(list, COMPONENTS.lottery.number, COMPONENTS.lottery.nodeId) : null;
            if (lnode) {
                const ss = ((lnode.lottery_v2 || {}).lottery_list) || [];
                const cur = ss.find((s) => s && s.session_status === 'IN_PROGRESS') || ss[0];
                lines.push(`抽奖次数：${(cur && cur.times) || 0}`);
            }
            notify('WPS 签到状态', lines.join('\n'));
        } catch (e) {
            notify('查询异常', String(e));
        }
    }

    // ================= page_info 复用 =================
    async function fetchPageInfo() {
        const filter = encodeURIComponent(
            JSON.stringify({ cs_from: '', mk_key: '', position: FLZX.position })
        );
        const url = `${API.pageInfo}?activity_number=${FLZX.activityNumber}` +
            `&page_number=${FLZX.pageNumber}&filter_params=${filter}`;
        try {
            const r = await httpReq('GET', url);
            const j = safeJson(r.body);
            if (!j || j.result !== 'ok' || !Array.isArray(j.data)) {
                debugDump('page_info', r.body);
                return null;
            }
            return j.data;
        } catch (e) {
            log(`[ERROR] page_info 请求失败: ${e}`);
            return null;
        }
    }

    function findComp(list, number, nodeId) {
        return (
            (list || []).find(
                (c) => c && c.number === number && (!nodeId || c.component_node_id === nodeId)
            ) || null
        );
    }

    // ================= HTTP =================
    function httpReq(method, url, opt) {
        const options = opt || {};
        return new Promise((resolve, reject) => {
            const headers = {
                'User-Agent': UA_DESKTOP,
                Accept: 'application/json, text/plain, */*',
                Referer: 'https://personal-act.wps.cn/',
                Origin: 'https://personal-act.wps.cn',
            };
            if (options.body) headers['Content-Type'] = 'application/json';
            if (options.token) headers['token'] = options.token;

            GM_xmlhttpRequest({
                method,
                url,
                headers,
                data: options.body || undefined,
                timeout: 20000,
                onload: (resp) => resolve({ status: resp.status, body: resp.responseText }),
                onerror: (e) => reject(new Error(e && e.error ? e.error : '网络错误')),
                ontimeout: () => reject(new Error('请求超时')),
            });
        });
    }

    // ================= 加密 =================
    // aesKey：22 位 base36 随机 + 10 位 unix 秒 = 32 字符，落在 RSA-512 明文上限(53)内
    function genAesKey() {
        const cs = '0123456789abcdefghijklmnopqrstuvwxyz';
        let s = '';
        for (let i = 0; i < 22; i++) s += cs[Math.floor(Math.random() * 36)];
        return s + Math.floor(Date.now() / 1000);
    }

    // AES-256-CBC + PKCS7，输出 base64。走浏览器原生 Web Crypto，无需自带实现。
    async function aesEncrypt(plain, keyStr, ivStr) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            enc.encode(keyStr),
            { name: 'AES-CBC' },
            false,
            ['encrypt']
        );
        const buf = await crypto.subtle.encrypt(
            { name: 'AES-CBC', iv: enc.encode(ivStr) },
            key,
            enc.encode(plain)
        );
        return b64enc(Array.from(new Uint8Array(buf)));
    }

    // RSA PKCS#1 v1.5 加密。
    // WPS 公钥仅 512 位，低于 Web Crypto 对 RSAES-PKCS1-v1_5 的下限要求，故用 BigInt 手写模幂。
    // pemB64 = encrypt/key 接口返回的 data（base64 的 PKCS#1 PEM）。
    function rsaEncryptB64(msg, pemB64) {
        const pem = String.fromCharCode.apply(null, b64dec(pemB64));
        const der = b64dec(pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, ''));
        let p = 0;
        p++; // SEQUENCE
        let sl = der[p++];
        if (sl & 0x80) p += sl & 0x7f;

        const readInt = () => {
            p++; // INTEGER
            let l = der[p++];
            if (l & 0x80) {
                const nb = l & 0x7f;
                l = 0;
                for (let i = 0; i < nb; i++) l = (l << 8) | der[p++];
            }
            let v = 0n;
            for (let i = 0; i < l; i++) v = (v << 8n) | BigInt(der[p++]);
            return v;
        };
        const n = readInt();
        const e = readInt();

        let k = 0;
        let nn = n;
        while (nn > 0n) {
            k++;
            nn >>= 8n;
        }

        const m = utf8Bytes(msg);
        const psLen = k - 3 - m.length;
        if (psLen < 8) throw new Error('RSA 明文过长');

        // PKCS#1 v1.5 type 2：00 02 || 非零随机填充 || 00 || 明文
        const block = [0x00, 0x02];
        for (let i = 0; i < psLen; i++) block.push(1 + Math.floor(Math.random() * 255));
        block.push(0x00);
        for (const b of m) block.push(b);

        let mm = 0n;
        for (const b of block) mm = (mm << 8n) | BigInt(b);

        let hex = modpow(mm, e, n).toString(16);
        while (hex.length < k * 2) hex = '0' + hex;
        const out = [];
        for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.substr(i, 2), 16));
        return b64enc(out);
    }

    function modpow(base, exp, mod) {
        let result = 1n;
        base %= mod;
        while (exp > 0n) {
            if (exp & 1n) result = (result * base) % mod;
            exp >>= 1n;
            base = (base * base) % mod;
        }
        return result;
    }

    function utf8Bytes(str) {
        return Array.from(unescape(encodeURIComponent(str)), (c) => c.charCodeAt(0));
    }

    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    function b64enc(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b0 = bytes[i];
            const b1 = bytes[i + 1];
            const b2 = bytes[i + 2];
            s += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
            s += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
            s += i + 2 < bytes.length ? B64[b2 & 63] : '=';
        }
        return s;
    }
    function b64dec(str) {
        const out = [];
        let buf = 0;
        let bits = 0;
        for (const c of str) {
            if (c === '=') break;
            const v = B64.indexOf(c);
            if (v < 0) continue;
            buf = (buf << 6) | v;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                out.push((buf >> bits) & 0xff);
            }
        }
        return out;
    }

    // ================= 工具 =================
    function safeJson(s) {
        try {
            return JSON.parse(s);
        } catch (e) {
            return null;
        }
    }

    // 把服务端各类提示归一为清晰状态。
    // ✅ 已做过 / 已达上限（正常完结）  ⚠️ 没领到或需留意  ❌ 失败
    function classify(msg, doneLabel) {
        const m = String(msg || '');
        if (!m) return { e: '⚠️', t: '未成功' };
        if (/已签|has\s*sign/i.test(m)) return { e: '✅', t: '已签到' };
        if (/Duplicate\s*entry|已领取|已申领|已参与|已参加|已报名|已完成|重复|repeat|already/i.test(m))
            return { e: '✅', t: doneLabel || '已完成' };
        if (/无.*次数|没有.*次数|次数.*(用完|不足)|达到?.*上限|已达.*上限|reach\s*limit|out\s*of\s*limit/i.test(m))
            return { e: '✅', t: '已达上限' };
        if (/售罄|领完|抢完|发完|抢光|领光|out\s*of\s*stock|no\s*stock|sold\s*out/i.test(m))
            return { e: '⚠️', t: '已领完' };
        if (/资格|不满足|未满足|不符合|无权限|没有权限|not\s*(match|qualified)|未达条件/i.test(m))
            return { e: '⚠️', t: '没资格' };
        return { e: '⚠️', t: m.length > 30 ? m.slice(0, 30) + '…' : m };
    }

    // 北京时间 YYYY-MM-DD。服务端按东八区判定签到日期，不能用本地时区。
    function beijingDate() {
        const d = new Date(Date.now() + 8 * 3600 * 1000);
        return (
            d.getUTCFullYear() +
            '-' +
            String(d.getUTCMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getUTCDate()).padStart(2, '0')
        );
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const randomGap = () => CONFIG.gapMin + Math.floor(Math.random() * (CONFIG.gapMax - CONFIG.gapMin));

    function debugDump(tag, body) {
        if (CONFIG.debug) log(`[DEBUG] ${tag}: ${String(body || '').slice(0, 400)}`);
    }

    function log(msg) {
        console.log(`[WPS签到] ${msg}`);
    }

    function notify(title, text) {
        try {
            GM_notification({ title, text, timeout: 8000 });
        } catch (e) {
            log(`通知失败: ${e}`);
        }
    }

    // ================= 结果浮层 =================
    let panelEl = null;
    function injectPanel() {
        GM_addStyle(`
            #wps-signin-panel{position:fixed;right:16px;bottom:16px;z-index:2147483647;
                max-width:340px;background:#fff;color:#1f2329;border:1px solid #e5e6eb;
                border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.14);
                font:13px/1.7 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;overflow:hidden}
            #wps-signin-panel .hd{padding:8px 12px;background:#f7f8fa;border-bottom:1px solid #e5e6eb;
                display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-weight:600}
            #wps-signin-panel .hd span:last-child{color:#8f959e;font-weight:400}
            #wps-signin-panel .bd{padding:10px 12px;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto}
            #wps-signin-panel .dot{display:inline-block;width:6px;height:6px;border-radius:50%;
                background:#c9cdd4;margin-right:6px;vertical-align:middle}
            #wps-signin-panel.run .dot{background:#ff8f1f;animation:pulse 1s infinite}
            #wps-signin-panel.ok .dot{background:#34c724}
            @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
        `);
        panelEl = document.createElement('div');
        panelEl.id = 'wps-signin-panel';
        panelEl.className = 'ok';
        panelEl.innerHTML =
            '<div class="hd"><span><i class="dot"></i>WPS 自动签到</span><span>点击折叠</span></div>' +
            '<div class="bd">待机中</div>';
        document.body.appendChild(panelEl);
        panelEl.querySelector('.hd').addEventListener('click', () => {
            const bd = panelEl.querySelector('.bd');
            bd.style.display = bd.style.display === 'none' ? 'block' : 'none';
        });
    }

    function updatePanel(text, isRunning) {
        if (!panelEl) return;
        panelEl.className = isRunning ? 'run' : 'ok';
        panelEl.querySelector('.bd').textContent = text;
    }
})();
