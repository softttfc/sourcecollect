// 花生短剧 (www.gsfangkeji.com, stui模板) - QuickJS 同步版
// 列表: /hssw/{cid}-{area}-{by}-{plot}-{lang}-{letter}---{page}---{year}.html
// 播放: 播放页 player_*** JSON -> encrypt 0/1/2 -> 直链 parse:0 / 兜底 parse:1

const XURL = 'https://www.gsfangkeji.com';
const UA = 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Mobile Safari/537.36';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const HEADERS = { 'User-Agent': UA };

const CLASSES = [
    ['短剧库', '5'], ['女频恋爱', '5@女频恋爱'], ['反转爽', '5@反转爽'],
    ['脑洞悬疑', '5@脑洞悬疑'], ['古装仙侠', '5@古装仙侠'], ['现代都市', '5@现代都市']
];

function buildFilters() {
    const years = [{ n: '全部', v: '' }];
    for (let y = 2026; y >= 2022; y--) years.push({ n: String(y), v: String(y) });
    const letters = [{ n: '全部', v: '' }];
    for (let i = 65; i <= 90; i++) letters.push({ n: String.fromCharCode(i), v: String.fromCharCode(i) });
    letters.push({ n: '0-9', v: '0' });
    return [
        { key: '地区', name: '地区', value: [{ n: '全部', v: '' }, { n: '大陆', v: '大陆' }] },
        { key: '年份', name: '年份', value: years },
        { key: '语言', name: '语言', value: [{ n: '全部', v: '' }, { n: '国语', v: '国语' }] },
        { key: '字母', name: '字母', value: letters },
        { key: '排序', name: '排序', value: [{ n: '时间', v: 'time' }, { n: '人气', v: 'hits' }, { n: '评分', v: 'score' }] }
    ];
}

function fetchText(url) {
    try {
        const r = req(url, { headers: HEADERS, timeout: 20000 });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function stripTags(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseList(html, useDataOriginal) {
    const vods = [], seen = {};
    if (!html) return vods;
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let block;
    while ((block = liRe.exec(html)) !== null) {
        const b = block[1];
        const m = /<a[^>]*class="[^"]*stui-vodlist__thumb[^"]*"[^>]*href="([^"]*)"[^>]*title="([^"]*)"([^>]*)>/.exec(b);
        if (!m) continue;
        const href = m[1], name = m[2], attrs = m[3] || '';
        if (!href || seen[href]) continue;
        let pic = '';
        if (useDataOriginal) {
            const pm = /data-original="([^"]*)"/.exec(attrs) || /data-original="([^"]*)"/.exec(b);
            if (pm) pic = pm[1];
        } else {
            const sm = /style="[^"]*url\(([^)]*)\)/.exec(attrs) || /url\(([^)]*)\)/.exec(b);
            if (sm) pic = sm[1].replace(/['"]/g, '');
        }
        let remark = '';
        const rm = /class="pic-text[^"]*"[^>]*>([\s\S]*?)<\//.exec(b);
        if (rm) remark = stripTags(rm[1]);
        seen[href] = 1;
        vods.push({ vod_id: href, vod_name: name, vod_pic: pic, vod_remarks: remark });
    }
    return vods;
}

function jsUnescape(s) {
    s = String(s).replace(/%u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16)));
    try { return decodeURIComponent(s); } catch (e) { return s; }
}

function b64decodeUtf8(str) {
    const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 4) {
        const n = (C.indexOf(clean[i]) << 18) | (C.indexOf(clean[i + 1]) << 12) |
            ((clean[i + 2] === '=' ? 0 : C.indexOf(clean[i + 2])) << 6) | (clean[i + 3] === '=' ? 0 : C.indexOf(clean[i + 3]));
        bytes.push((n >> 16) & 255);
        if (clean[i + 2] !== '=') bytes.push((n >> 8) & 255);
        if (clean[i + 3] !== '=') bytes.push(n & 255);
    }
    let out = '', i = 0;
    while (i < bytes.length) {
        const b = bytes[i];
        if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
        else if (b < 0xE0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
        else if (b < 0xF0) { out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
        else { i += 4; }
    }
    return out;
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    const classes = CLASSES.map(c => ({ type_id: c[1], type_name: c[0] }));
    const result = { 'class': classes };
    if (filter) {
        const f = buildFilters();
        const filters = {};
        CLASSES.forEach(c => { filters[c[1]] = f; });
        result.filters = filters;
    }
    return JSON.stringify(result);
}

function homeVod() {
    return JSON.stringify({ list: parseList(fetchText(XURL), false) });
}

function category(tid, pg, filter, extend) {
    let ext = extend || {};
    if (typeof extend === 'string') { try { ext = JSON.parse(extend); } catch (e) { ext = {}; } }
    const page = parseInt(pg, 10) || 1;

    let realCid = String(tid), defaultPlot = '';
    const at = realCid.indexOf('@');
    if (at >= 0) { defaultPlot = realCid.substring(at + 1); realCid = realCid.substring(0, at); }

    const area = ext['地区'] || '';
    const by = ext['排序'] || '';
    const plot = ext['剧情'] || defaultPlot;
    const lang = ext['语言'] || '';
    const letter = ext['字母'] || '';
    const year = ext['年份'] || '';
    const q = (s) => s ? encodeURIComponent(String(s)) : '';

    const url = XURL + '/hssw/' + q(realCid) + '-' + q(area) + '-' + q(by) + '-' + q(plot) + '-' + q(lang) + '-' + q(letter) + '---' + page + '---' + q(year) + '.html';
    const videos = parseList(fetchText(url), false);
    return JSON.stringify({ list: videos, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const url = did.indexOf('http') === 0 ? did : XURL + did;
    const html = fetchText(url);
    if (!html) return JSON.stringify({ list: [] });

    let name = '';
    const tm = /<div class="stui-content__detail[^"]*"[\s\S]*?<h1[^>]*class="title"[^>]*>([\s\S]*?)<\/h1>/.exec(html)
        || /class="title"[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (tm) name = stripTags(tm[1]);

    let pic = '';
    const pm = /<div class="stui-content__thumb[\s\S]*?data-original="([^"]*)"/.exec(html);
    if (pm) pic = pm[1];

    let content = '';
    const cm = /<div class="stui-content__detail[\s\S]*?<p class="detail[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    if (cm) content = stripTags(cm[1]);
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;

    const eps = [];
    const plRe = /<ul class="stui-content__playlist[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
    let plm;
    while ((plm = plRe.exec(html)) !== null) {
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let li;
        while ((li = liRe.exec(plm[1])) !== null) {
            if (li[1].indexOf('滈凊') >= 0) continue;
            const am = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(li[1]);
            if (!am) continue;
            let href = am[1];
            if (href.charAt(0) === '/') href = XURL + href;
            const label = stripTags(am[2]).split('#').join('＃').split('$').join('＄');
            if (label && href) eps.push(label + '$' + href);
        }
    }
    if (!eps.length) return JSON.stringify({ list: [] });

    return JSON.stringify({
        list: [{
            vod_id: did, vod_name: name, vod_pic: pic, vod_content: content,
            vod_play_from: '花生短剧', vod_play_url: eps.join('#')
        }]
    });
}

function play(flag, id, vipFlags) {
    let purl = String(id || '');
    let parse = 1;
    const url = purl.indexOf('http') === 0 ? purl : XURL + purl;
    const html = fetchText(url);
    const m = /r player_[\s\S]*?=([\s\S]*?)<\//.exec(html);
    if (m) {
        try {
            const data = JSON.parse(m[1].trim());
            let u = data.url || '';
            const enc = String(data.encrypt || '0');
            if (enc === '1') u = jsUnescape(u);
            else if (enc === '2') u = jsUnescape(b64decodeUtf8(u));
            if (/\.(m3u8|mp4|m4a|mp3)/.test(u)) { purl = u; parse = 0; }
        } catch (e) {}
    }
    return JSON.stringify({ parse: parse, playUrl: '', url: purl, header: HEADERS });
}

function search(key, quick, pg) {
    const url = XURL + '/hssc/' + encodeURIComponent(String(key || '')) + '----------1---.html';
    const videos = parseList(fetchText(url), true);
    return JSON.stringify({ list: videos, page: 1, pagecount: 1, limit: 90, total: videos.length });
}

export default { init, home, homeVod, category, detail, search, play };
