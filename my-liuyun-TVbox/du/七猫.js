// 七猫短剧 (api-store.qmplaylet.com) - QuickJS 同步版
// 认证: qm-params (base64 JSON 字符映射) + sign = md5(参数按key排序拼接 + keys)
// 播放: play_list 自带直链 parse:0

const XURL = 'https://api-store.qmplaylet.com';
const XURL1 = 'https://api-read.qmplaylet.com';
const KEYS = 'd3dGiJc651gSQ8w1';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

// ==================== MD5 (硬编码常量, QuickJS 兼容) ====================
const MD5_K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
const MD5_S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
function md5(str) {
    const msg = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) msg.push(c);
        else if (c < 0x800) { msg.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
        else msg.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    const bitLen = msg.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    const lenLo = bitLen >>> 0, lenHi = Math.floor(bitLen / 4294967296);
    msg.push(lenLo & 255, (lenLo >>> 8) & 255, (lenLo >>> 16) & 255, (lenLo >>> 24) & 255);
    msg.push(lenHi & 255, (lenHi >>> 8) & 255, (lenHi >>> 16) & 255, (lenHi >>> 24) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const rot = (x, n) => ((x << n) | (x >>> (32 - n))) | 0;
    for (let off = 0; off < msg.length; off += 64) {
        const M = [];
        for (let i = 0; i < 16; i++) M.push(msg[off + 4 * i] | (msg[off + 4 * i + 1] << 8) | (msg[off + 4 * i + 2] << 16) | (msg[off + 4 * i + 3] << 24));
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            const tmp = D;
            D = C; C = B;
            B = (B + rot((A + F + MD5_K[i] + M[g]) | 0, MD5_S[i])) | 0;
            A = tmp;
        }
        a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const hex = (n) => { let s = ''; for (let i = 0; i < 4; i++) { const b = (n >>> (i * 8)) & 255; s += (b < 16 ? '0' : '') + b.toString(16); } return s; };
    return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

// ==================== 认证头 ====================
const CHAR_MAP = {};
(function () {
    const pairs = '+:P /:X 0:M 1:U 2:l 3:E 4:r 5:Y 6:W 7:b 8:d 9:J A:9 B:s C:a D:I E:0 F:o G:y H:_ I:H J:G K:i L:t M:g N:N O:A P:8 Q:F R:k S:3 T:h U:f V:R W:q X:C Y:4 Z:p a:m b:B c:O d:u e:c f:6 g:K h:x i:5 j:T k:- l:2 m:z n:S o:Z p:1 q:V r:v s:j t:Q u:7 v:D w:w x:n y:L z:e'.split(' ');
    pairs.forEach(p => { const kv = p.split(':'); CHAR_MAP[kv[0]] = kv[1]; });
})();

function b64encodeUtf8(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        else bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + C[(n >> 6) & 63] + C[n & 63];
    }
    const rem = bytes.length % 3;
    if (rem === 1) { const n = bytes[bytes.length - 1] << 16; out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + '=='; }
    else if (rem === 2) { const n = (bytes[bytes.length - 2] << 16) | (bytes[bytes.length - 1] << 8); out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + C[(n >> 6) & 63] + '='; }
    return out;
}

function getHeaderx() {
    const data = {
        "static_score": "0.8", "uuid": "00000000-7fc7-08dc-0000-000000000000",
        "device-id": "20250220125449b9b8cac84c2dd3d035c9052a2572f7dd0122edde3cc42a70",
        "mac": "", "sourceuid": "aa7de295aad621a6", "refresh-type": "0",
        "model": "22021211RC", "wlb-imei": "", "client-id": "aa7de295aad621a6",
        "brand": "Redmi", "oaid": "", "oaid-no-cache": "", "sys-ver": "12",
        "trusted-id": "", "phone-level": "H", "imei": "", "wlb-uid": "aa7de295aad621a6",
        "session-id": String(Date.now())
    };
    const keys = Object.keys(data);
    const parts = [];
    for (let i = 0; i < keys.length; i++) parts.push(JSON.stringify(keys[i]) + ':' + JSON.stringify(data[keys[i]]));
    const encoded = b64encodeUtf8('{' + parts.join(',') + '}');
    let qmParams = '';
    for (let i = 0; i < encoded.length; i++) qmParams += CHAR_MAP[encoded[i]] || encoded[i];
    const paramsStr = 'AUTHORIZATION=app-version=10001application-id=com.duoduo.readchannel=unknownis-white=net-env=5platform=androidqm-params=' + qmParams + 'reg=' + KEYS;
    return {
        'net-env': '5', 'reg': '', 'channel': 'unknown', 'is-white': '',
        'platform': 'android', 'application-id': 'com.duoduo.read', 'authorization': '',
        'app-version': '10001', 'user-agent': 'webviewversion/0',
        'qm-params': qmParams, 'sign': md5(paramsStr)
    };
}

function getJson(url) {
    try {
        const r = req(url, { headers: getHeaderx(), timeout: 20000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

function mapVod(v) {
    return {
        vod_id: String(v.playlet_id || v.id || ''),
        vod_name: v.title || '',
        vod_pic: v.image_link || '',
        vod_remarks: String(v.total_episode_num || v.total_num || '')
    };
}

function indexPage(cid, page) {
    let qs, signStr;
    if (page <= 1) {
        signStr = 'operation=1playlet_privacy=1tag_id=' + cid + KEYS;
        qs = 'tag_id=' + cid + '&playlet_privacy=1&operation=1';
    } else {
        signStr = 'next_id=' + page + 'operation=1playlet_privacy=1tag_id=' + cid + KEYS;
        qs = 'tag_id=' + cid + '&next_id=' + page + '&playlet_privacy=1&operation=1';
    }
    return getJson(XURL + '/api/v1/playlet/index?' + qs + '&sign=' + md5(signStr));
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    const classes = [];
    const d = indexPage(0, 1);
    const tags = (((d && d.data) || {}).tag_categories) || [];
    for (let i = 0; i < Math.min(5, tags.length); i++) {
        const list = tags[i].tags || [];
        for (let j = 0; j < list.length; j++) {
            const name = list[j].tag_name || '';
            if (name.indexOf('推荐') >= 0) continue;
            classes.push({ type_id: String(list[j].tag_id), type_name: name });
        }
    }
    return JSON.stringify({ 'class': classes, filters: {} });
}

function homeVod() {
    const d = indexPage(0, 1);
    const list = ((((d && d.data) || {}).list) || []).map(mapVod);
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const d = indexPage(tid, page);
    const list = ((((d && d.data) || {}).list) || []).map(mapVod);
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const sign = md5('playlet_id=' + did + KEYS);
    const d = getJson(XURL1 + '/player/api/v1/playlet/info?playlet_id=' + encodeURIComponent(did) + '&sign=' + sign);
    const data = (d && d.data) || null;
    if (!data) return JSON.stringify({ list: [] });

    let content = String(data.intro || '未知');
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
    const remarks = String(data.tags || '未知') + ' ' + String(data.total_episode_num || '未知') + '全集';

    const eps = [];
    const playList = data.play_list || [];
    for (let i = 0; i < playList.length; i++) {
        const url = playList[i].video_url || '';
        const sort = String(playList[i].sort || '').split('#').join('＃').split('$').join('＄');
        if (url) eps.push(sort + '$' + url);
    }
    if (!eps.length) return JSON.stringify({ list: [] });

    return JSON.stringify({
        list: [{
            vod_id: did, vod_remarks: remarks, vod_content: content,
            vod_play_from: '七猫短剧', vod_play_url: eps.join('#')
        }]
    });
}

function play(flag, id, vipFlags) {
    return JSON.stringify({
        parse: 0, playUrl: '', url: String(id || ''),
        header: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' }
    });
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const wd = String(key || '');
    const trackId = 'ec1280db127955061754851657967';
    const signStr = 'extend=page=' + page + 'read_preference=0track_id=' + trackId + 'wd=' + wd + KEYS;
    const d = getJson(XURL + '/api/v1/playlet/search?extend=&page=' + page + '&wd=' + encodeURIComponent(wd) + '&read_preference=0&track_id=' + trackId + '&sign=' + md5(signStr));
    const rows = ((((d || {}).data) || {}).list) || [];
    const list = rows.map(v => {
        const item = mapVod(v);
        item.vod_name = String(v.title || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return item;
    });
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

export default { init, home, homeVod, category, detail, search, play };
