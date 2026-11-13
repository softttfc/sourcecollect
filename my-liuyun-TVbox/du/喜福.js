// 喜福短剧 (minidrama-api.contentchina.com) - QuickJS 同步版
// 分类: home/categoryList; 列表: drama/list; 详情: 按 total 生成集数
// 播放: play_auth 取临时凭证 -> HMAC-SHA1 签名调阿里云 VOD GetPlayInfo -> PlayURL 直链

const XURL = 'https://minidrama-api.contentchina.com';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' };

function getJson(url) {
    try {
        const r = req(url, { headers: HEADERS, timeout: 20000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
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

// ==================== SHA1 / HMAC-SHA1 (纯JS, 字节级) ====================
function sha1BytesRaw(inputBytes) {
    const bytes = inputBytes.slice();
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const lenHi = Math.floor(bitLen / 4294967296), lenLo = bitLen >>> 0;
    bytes.push((lenHi >>> 24) & 255, (lenHi >>> 16) & 255, (lenHi >>> 8) & 255, lenHi & 255);
    bytes.push((lenLo >>> 24) & 255, (lenLo >>> 16) & 255, (lenLo >>> 8) & 255, lenLo & 255);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    const rot = (x, n) => ((x << n) | (x >>> (32 - n))) | 0;
    for (let off = 0; off < bytes.length; off += 64) {
        const w = new Array(80);
        for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
        for (let i = 16; i < 80; i++) w[i] = rot(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            let f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }
            const t = (rot(a, 5) + f + e + k + w[i]) | 0;
            e = d; d = c; c = rot(b, 30); b = a; a = t;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = [];
    [h0, h1, h2, h3, h4].forEach(h => out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255));
    return out;
}

function utf8Bytes(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        else bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return bytes;
}

function hmacSha1B64(keyStr, msg) {
    let key = utf8Bytes(keyStr);
    if (key.length > 64) key = sha1BytesRaw(key);
    while (key.length < 64) key.push(0);
    const ipad = key.map(b => b ^ 0x36), opad = key.map(b => b ^ 0x5C);
    const inner = sha1BytesRaw(ipad.concat(utf8Bytes(msg)));
    const digest = sha1BytesRaw(opad.concat(inner));
    const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    for (let i = 0; i + 3 <= digest.length; i += 3) {
        const n = (digest[i] << 16) | (digest[i + 1] << 8) | digest[i + 2];
        out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + C[(n >> 6) & 63] + C[n & 63];
    }
    const rem = digest.length % 3;
    if (rem === 1) {
        const n = digest[digest.length - 1] << 16;
        out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + '==';
    } else if (rem === 2) {
        const n = (digest[digest.length - 2] << 16) | (digest[digest.length - 1] << 8);
        out += C[(n >> 18) & 63] + C[(n >> 12) & 63] + C[(n >> 6) & 63] + '=';
    }
    return out;
}

function uuid4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
}

// RFC3986 编码 (对齐 python quote(safe=''))
function pct(s) {
    return encodeURIComponent(String(s)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    const d = getJson(XURL + '/web/v1/home/categoryList?isLeft=1');
    const cats = (((d && d.data) || {}).categories) || [];
    return JSON.stringify({
        'class': cats.map(c => ({ type_id: String(c.id), type_name: '🌷' + c.name })),
        filters: {}
    });
}

function homeVod() {
    return category('0', 1, false, {});
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const d = getJson(XURL + '/web/v1/drama/list?pageSize=24&currentPage=' + page + '&filterCategories[]=' + encodeURIComponent(tid));
    const rows = (((d && d.data) || {}).data) || [];
    const list = rows.map(v => ({
        vod_id: String(v.albumId) + '@' + (v.total || 0),
        vod_name: v.title || '',
        vod_pic: v.coverUrl || '',
        vod_remarks: '🌷共' + (v.total || 0) + '集'
    }));
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const parts = did.split('@');
    const baseId = parts[0];
    const total = parseInt(parts[1], 10) || 0;
    if (!total) return JSON.stringify({ list: [] });
    const eps = [];
    for (let i = 1; i <= total; i++) eps.push(i + '$' + baseId + '@' + i);
    return JSON.stringify({
        list: [{
            vod_id: did,
            vod_content: INTRO_PREFIX,
            vod_play_from: '喜福专线',
            vod_play_url: eps.join('#')
        }]
    });
}

function play(flag, id, vipFlags) {
    try {
        const parts = String(id || '').split('@');
        const albumId = parts[0], seq = parts[1];
        const auth = getJson(XURL + '/web/v1/drama/play_auth?albumId=' + encodeURIComponent(albumId) + '&seq=' + encodeURIComponent(seq));
        const ad = (auth && auth.data) || {};
        const cred = JSON.parse(b64decodeUtf8(ad.playAuth || ''));
        const videoId = ad.vid;

        const params = {
            'Action': 'GetPlayInfo',
            'Version': '2017-03-21',
            'Format': 'JSON',
            'AccessKeyId': cred.AccessKeyId,
            'SecurityToken': cred.SecurityToken,
            'VideoId': videoId,
            'AuthInfo': cred.AuthInfo || '',
            'Timestamp': new Date().toISOString().slice(0, 19) + 'Z',
            'SignatureMethod': 'HMAC-SHA1',
            'SignatureVersion': '1.0',
            'SignatureNonce': uuid4()
        };
        if (cred.PlayConfig !== undefined) params['PlayConfig'] = JSON.stringify(cred.PlayConfig);

        const keys = Object.keys(params).sort();
        const cqs = keys.map(k => pct(k) + '=' + pct(params[k])).join('&');
        const sts = 'GET&%2F&' + pct(cqs);
        const sig = hmacSha1B64(String(cred.AccessKeySecret) + '&', sts);

        const finalUrl = 'https://vod.' + (cred.Region || 'cn-shanghai') + '.aliyuncs.com/?' + cqs + '&Signature=' + pct(sig);
        const r = req(finalUrl, { headers: HEADERS, timeout: 20000 });
        const resp = JSON.parse((r && r.content) || '{}');
        const list = ((resp.PlayInfoList || {}).PlayInfo) || [];
        if (list.length && list[0].PlayURL) {
            return JSON.stringify({ parse: 0, playUrl: '', url: list[0].PlayURL, header: HEADERS });
        }
    } catch (e) {}
    return JSON.stringify({ parse: 0, playUrl: '', url: '', header: HEADERS });
}

function search(key, quick, pg) {
    return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 24, total: 0 });
}

export default { init, home, homeVod, category, detail, search, play };
