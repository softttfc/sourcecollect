// 星芽短剧 (app.whjzjx.cn) - QuickJS 琉芸版
// 登录: AES-128-ECB 加密设备信息换 token (raw body 走 body 字段)
// 播放: 详情直接返回 mp4 直链, parse:0

const XURL = 'https://app.whjzjx.cn';
const AES_KEY = 'B@ecf920Od8A4df7';
const MOBILE_UA = 'Linux; Android 12; Pixel 3 XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36';
const LOGIN_UA = 'Mozilla/5.0 (Linux; Android 9; V1938T Build/PQ3A.190705.08211809; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

let AUTH = '';

// ==================== AES-128-ECB (纯JS, 硬编码表) ====================
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];
const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function xtime(x) { x <<= 1; return x & 256 ? (x ^ 0x11b) & 255 : x; }
function aesKeyExp(key) {
    const Nk = key.length / 4, Nr = Nk + 6, w = [];
    for (let i = 0; i < Nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % Nk === 0) { t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]]; t[0] ^= RCON[i / Nk]; }
        else if (Nk > 6 && i % Nk === 4) { t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]]; }
        w.push([w[i - Nk][0] ^ t[0], w[i - Nk][1] ^ t[1], w[i - Nk][2] ^ t[2], w[i - Nk][3] ^ t[3]]);
    }
    return { w: w, Nr: Nr };
}
function aesAddRK(s, w, r) { for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) s[i + 4 * c] ^= w[4 * r + c][i]; }
function aesShiftRows(s) {
    for (let rr = 1; rr < 4; rr++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[rr + 4 * ((c + rr) % 4)]);
        for (let c = 0; c < 4; c++) s[rr + 4 * c] = t[c];
    }
}
function aesMixColumns(s) {
    for (let c = 0; c < 4; c++) {
        const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
        s[4 * c] = xtime(a[0]) ^ xtime(a[1]) ^ a[1] ^ a[2] ^ a[3];
        s[1 + 4 * c] = a[0] ^ xtime(a[1]) ^ xtime(a[2]) ^ a[2] ^ a[3];
        s[2 + 4 * c] = a[0] ^ a[1] ^ xtime(a[2]) ^ xtime(a[3]) ^ a[3];
        s[3 + 4 * c] = xtime(a[0]) ^ a[0] ^ a[1] ^ a[2] ^ xtime(a[3]);
    }
}
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.Nr; r++) {
        for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
        aesShiftRows(s);
        aesMixColumns(s);
        aesAddRK(s, ek.w, r);
    }
    for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    aesShiftRows(s);
    aesAddRK(s, ek.w, ek.Nr);
    return s;
}
function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xC0 | (c >> 6)); out.push(0x80 | (c & 63)); }
        else { out.push(0xE0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 63)); out.push(0x80 | (c & 63)); }
    }
    return out;
}
function b64enc(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = (i + 1 < bytes.length) ? bytes[i + 1] : null, b2 = (i + 2 < bytes.length) ? bytes[i + 2] : null;
        out += B64C[b0 >> 2];
        out += B64C[((b0 & 3) << 4) | (b1 === null ? 0 : b1 >> 4)];
        out += (b1 === null) ? '=' : B64C[((b1 & 15) << 2) | (b2 === null ? 0 : b2 >> 6)];
        out += (b2 === null) ? '=' : B64C[b2 & 63];
    }
    return out;
}
function aesEcbEncryptB64(plain, keyStr) {
    const key = [];
    for (let i = 0; i < keyStr.length; i++) key.push(keyStr.charCodeAt(i) & 255);
    const ek = aesKeyExp(key);
    const bytes = utf8enc(plain);
    const padN = 16 - (bytes.length % 16);
    for (let i = 0; i < padN; i++) bytes.push(padN);
    const out = [];
    for (let i = 0; i < bytes.length; i += 16) {
        const b = aesEncBlock(ek, bytes.slice(i, i + 16));
        for (let j = 0; j < 16; j++) out.push(b[j]);
    }
    return b64enc(out);
}

// ==================== 登录 ====================
function ensureAuth() {
    if (AUTH) return true;
    const data = {
        device: '2a50580e69d38388c94c93605241fb306',
        package_name: 'com.jz.xydj',
        android_id: 'ec1280db12795506',
        install_first_open: true,
        first_install_time: 1752505243345,
        last_update_time: 1752505243345,
        report_link_url: '',
        authorization: '',
        timestamp: Date.now()
    };
    const encrypted = aesEcbEncryptB64(JSON.stringify(data), AES_KEY);
    try {
        // raw body: 必须用 body 字段 + 显式 Content-Type (FongMi NetRequest.java: data+postType=json 会把字符串再加引号)
        const r = req('https://u.shytkjgs.com/user/v3/account/login', {
            method: 'post',
            body: encrypted,
            headers: {
                'platform': '1',
                'user_agent': LOGIN_UA,
                'content-type': 'application/json; charset=utf-8'
            },
            timeout: 15000
        });
        const d = JSON.parse(r.content || '{}');
        if (d && d.data && d.data.token) { AUTH = d.data.token; return true; }
    } catch (e) {}
    return false;
}

function apiGet(path) {
    if (!ensureAuth()) return null;
    try {
        const r = req(XURL + path, {
            headers: { 'authorization': AUTH, 'platform': '1', 'version_name': '3.8.3.1' },
            timeout: 15000
        });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

function apiPostJson(path, obj) {
    if (!ensureAuth()) return null;
    try {
        const r = req(XURL + path, {
            method: 'post', data: obj, postType: 'json',
            headers: { 'authorization': AUTH, 'platform': '1', 'version_name': '3.8.3.1' },
            timeout: 15000
        });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    return JSON.stringify({
        'class': [
            { type_id: '1', type_name: '剧场' },
            { type_id: '3', type_name: '新剧' },
            { type_id: '2', type_name: '热播' },
            { type_id: '7', type_name: '星选' },
            { type_id: '5', type_name: '阳光' }
        ],
        filters: {}
    });
}

function mapTheater(vod, remarkField) {
    const t = vod.theater || {};
    return {
        vod_id: String(t.id || ''),
        vod_name: t.title || '',
        vod_pic: t.cover_url || '',
        vod_remarks: String(t[remarkField] || '')
    };
}

function homeVod() {
    const d = apiGet('/v1/theater/home_page?theater_class_id=1&class2_id=4&page_num=1&page_size=24');
    const list = ((d && d.data && d.data.list) || []).map(v => mapTheater(v, 'play_amount_str'));
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const d = apiGet('/v1/theater/home_page?theater_class_id=' + tid + '&page_num=' + page + '&page_size=24');
    const list = ((d && d.data && d.data.list) || []).map(v => mapTheater(v, 'theme'));
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const d = apiGet('/v2/theater_parent/detail?theater_parent_id=' + did);
    if (!d || !d.data) return JSON.stringify({ list: [] });
    const data = d.data;

    const eps = [];
    const theaters = data.theaters || [];
    for (let i = 0; i < theaters.length; i++) {
        const url = theaters[i].son_video_url || '';
        if (!url) continue;
        eps.push(String(theaters[i].num) + '$' + url);
    }

    let content = String(data.introduction || '');
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
    const tags = data.desc_tags || [];

    return JSON.stringify({
        list: [{
            vod_id: did,
            vod_name: data.title || '',
            vod_pic: data.cover_url || '',
            vod_content: content,
            vod_remarks: data.filing || '',
            vod_area: tags.length ? String(tags[0]) : '',
            type_name: tags.slice(1).join(','),
            vod_play_from: '星芽',
            vod_play_url: eps.join('#')
        }]
    });
}

function search(key, quick, pg) {
    const d = apiPostJson('/v3/search', { text: String(key || '') });
    const arr = (d && d.data && d.data.theater && d.data.theater.search_data) || [];
    const list = arr.map(v => ({
        vod_id: String(v.id || ''),
        vod_name: v.title || '',
        vod_pic: v.cover_url || '',
        vod_remarks: String(v.score_str || '')
    }));
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: 90, total: list.length });
}

function play(flag, id, vipFlags) {
    return JSON.stringify({
        parse: 0, playUrl: '', url: String(id || ''),
        header: { 'User-Agent': MOBILE_UA }
    });
}

export default { init, home, homeVod, category, detail, search, play };
