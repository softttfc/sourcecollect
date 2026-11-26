// 热播 TVBox Quick琉芸JS版 爬虫
// 移植自 csp_AppRJ，默认站点及签名密钥已内置
// 详情简介统一添加指定前缀

const DEFAULT_HOST = 'http://v.rbotv.cn';
const SECRET = '7gp0bnd2sr85ydii2j32pcypscoc4w6c7g5spl';
const PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const UA = 'okhttp-okgo/jeasonlzy';
const TIMEOUT = 20000;
let HOST = DEFAULT_HOST;
let HOME_INFO = null;
let HOME_LIST = null;

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) {
            c = 0x10000 + ((c & 0x3ff) << 10) + (str.charCodeAt(++i) & 0x3ff);
            out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

function hexenc(bytes) {
    let out = '';
    for (const b of bytes) out += ('0' + b.toString(16)).slice(-2);
    return out;
}

const MD5K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
const MD5S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
function md5Bytes(bytes) {
    const msg = bytes.slice();
    const lenLo = (bytes.length * 8) >>> 0;
    const lenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 0; i < 4; i++) msg.push((lenLo >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i++) msg.push((lenHi >>> (8 * i)) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
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
            const sum = (A + F + MD5K[i] + M[g]) | 0;
            const rot = MD5S[i];
            B = (B + ((sum << rot) | (sum >>> (32 - rot)))) | 0;
            A = tmp;
        }
        a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const out = [];
    for (const v of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) out.push((v >>> (8 * i)) & 255);
    return out;
}

function md5(str) {
    if (typeof md5X === 'function') {
        try { return md5X(str).toLowerCase(); } catch (e) {}
    }
    return hexenc(md5Bytes(utf8enc(str)));
}

function signedParams() {
    const timestamp = String(Math.floor(Date.now() / 1000));
    return { timestamp: timestamp, sign: md5(SECRET + timestamp) };
}

function post(path, params) {
    try {
        const res = req(HOST + path, {
            method: 'POST',
            headers: { 'User-Agent': UA },
            data: params,
            postType: 'form',
            timeout: TIMEOUT
        });
        const content = res && res.content !== undefined ? text(res.content).trim() : '';
        if (!content) return null;
        const json = JSON.parse(content);
        return text(json.code) === '1' ? json : null;
    } catch (e) {
        return null;
    }
}

function cardToVod(card) {
    const id = text(card && card.vod_id), name = text(card && card.vod_name);
    if (!id || !name) return null;
    return {
        vod_id: id,
        vod_name: name,
        vod_pic: text(card.vod_pic) || text(card.vod_pic_thumb),
        vod_remarks: text(card.vod_remarks)
    };
}

function cardList(res) {
    const cards = res && res.data && Array.isArray(res.data.list) ? res.data.list : [];
    const list = [];
    for (const card of cards) {
        const vod = cardToVod(card);
        if (vod) list.push(vod);
    }
    return list;
}

function emptyList() {
    return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 12, total: 0 });
}

function fetchHomeInfo() {
    if (HOME_INFO && Date.now() - HOME_INFO.time < 300000) return HOME_INFO.value;
    const res = post('/v3/type/top_type', signedParams());
    const types = res && res.data && Array.isArray(res.data.list) ? res.data.list : [];
    const classes = [], filters = {};
    const names = { extend: '类型', area: '地区', year: '年份', lang: '语言' };
    for (const item of types) {
        const id = text(item.type_id), name = text(item.type_name);
        if (!id || !name) continue;
        classes.push({ type_id: id, type_name: name });
        const options = [];
        for (const key of ['extend', 'area', 'year', 'lang']) {
            const values = Array.isArray(item[key]) ? item[key] : [];
            const value = [];
            for (const option of values) {
                const v = text(option);
                if (v.length > 1) value.push({ n: v, v: v });
            }
            if (value.length > 1) options.push({ key: key === 'extend' ? 'class' : key, name: names[key], value: value });
        }
        filters[id] = options;
    }
    const value = { classes: classes, filters: filters };
    HOME_INFO = { time: Date.now(), value: value };
    return value;
}

function getHomeList() {
    if (HOME_LIST && Date.now() - HOME_LIST.time < 300000) return HOME_LIST.list;
    const info = fetchHomeInfo();
    let list = [];
    if (info.classes.length) {
        const params = signedParams();
        params.type_id = info.classes[0].type_id;
        params.limit = '12';
        params.page = '1';
        list = cardList(post('/v3/home/type_search', params));
    }
    HOME_LIST = { time: Date.now(), list: list };
    return list;
}

function init(ext) {
    HOST = DEFAULT_HOST;
    if (ext && typeof ext === 'object' && text(ext.url).trim()) HOST = text(ext.url).trim();
    else if (text(ext).trim()) {
        try {
            const config = JSON.parse(text(ext));
            if (text(config.url).trim()) HOST = text(config.url).trim();
        } catch (e) {}
    }
    HOST = HOST.replace(/\/+$/, '');
    HOME_INFO = null;
    HOME_LIST = null;
}

function home(filter) {
    const info = fetchHomeInfo();
    const result = { 'class': info.classes, list: getHomeList() };
    if (filter) result.filters = info.filters;
    return JSON.stringify(result);
}

function homeVod() {
    return JSON.stringify({ list: getHomeList() });
}

function category(tid, pg, filter, extend) {
    const page = String(parseInt(pg, 10) || 1);
    const params = signedParams();
    params.type_id = text(tid);
    params.limit = '12';
    params.page = page;
    extend = extend || {};
    for (const key of ['area', 'class', 'lang', 'year']) {
        if (extend[key] !== undefined && text(extend[key]) !== '') params[key] = text(extend[key]);
    }
    const res = post('/v3/home/type_search', params);
    if (!res) return emptyList();
    const list = cardList(res);
    return JSON.stringify({ list: list, page: parseInt(page, 10), pagecount: 0, limit: 0, total: 0 });
}

function search(wd, quick, pg) {
    const params = signedParams();
    params.keyword = text(wd);
    params.limit = '12';
    params.page = String(parseInt(pg, 10) || 1);
    return JSON.stringify({ list: cardList(post('/v3/home/search', params)) });
}

function detail(ids) {
    const id = text(Array.isArray(ids) ? ids[0] : ids).trim();
    if (!id) return emptyList();
    const params = signedParams();
    params.vod_id = id;
    const res = post('/v3/home/vod_details', params);
    const info = res && res.data;
    if (!info || typeof info !== 'object') return emptyList();

    const playFrom = [], playUrl = [];
    const players = Array.isArray(info.vod_play_list) ? info.vod_play_list : [];
    for (const player of players) {
        const name = text(player && player.name) || '线路';
        const ua = text(player && player.ua);
        const urls = player && Array.isArray(player.urls) ? player.urls : [];
        const parsers = player && Array.isArray(player.parse_urls) ? player.parse_urls : [];
        let parsePrefix = '';
        for (const parser of parsers) parsePrefix += text(parser) + '@';
        const episodes = [];
        for (const episode of urls) {
            const title = text(episode && episode.name), url = text(episode && episode.url);
            if (!title || !url) continue;
            episodes.push(title + '$' + parsePrefix + '|' + url + '|' + ua + '|' + text(info.vod_name) + '|' + text(episode.nid));
        }
        if (!episodes.length) continue;
        playFrom.push(name);
        playUrl.push(episodes.join('#'));
    }
    if (!playFrom.length) return emptyList();
    const content = text(info.vod_content);
    const vod = {
        vod_id: id,
        vod_name: text(info.vod_name),
        vod_pic: text(info.vod_pic) || text(info.vod_pic_thumb),
        vod_remarks: text(info.vod_remarks),
        vod_content: content.indexOf(PREFIX) === 0 ? content : PREFIX + content,
        vod_year: text(info.vod_year),
        vod_actor: text(info.vod_actor),
        vod_director: text(info.vod_director),
        type_name: text(info.vod_class),
        vod_play_from: playFrom.join('$$$'),
        vod_play_url: playUrl.join('$$$')
    };
    return JSON.stringify({ list: [vod] });
}

function validParsedUrl(url) {
    if (!url || url.indexOf('url=http') >= 0 || url.indexOf('.js') >= 0 || url.indexOf('.css') >= 0 || url.indexOf('.html') >= 0) return false;
    return /https?:\/\/.*\.(?:m3u8|mp4|flv|avi|mkv|rm|wmv|mpg|m4a|mp3)(?:\?.*)?$/i.test(url) || /https?:\/\/.*video\/tos/i.test(url);
}

function play(flag, id, vipFlags) {
    try {
        let parts = text(id).split('|');
        if (parts.length === 5) parts = [parts[0], parts[1], parts[2], '', parts[3], parts[4]];
        if (parts.length < 6) return '';
        const parsers = parts[0] ? parts[0].split('@') : [];
        const sourceUrl = parts[1];
        let ua = parts[2], finalUrl = sourceUrl;
        for (const parser of parsers) {
            if (!parser) continue;
            const params = signedParams();
            const target = parser + sourceUrl + '&sign=' + params.sign + '&timestamp=' + params.timestamp;
            try {
                const res = req(target, { headers: { 'Referer': '' }, timeout: TIMEOUT });
                const content = res && res.content !== undefined ? text(res.content).trim() : '';
                if (!content) continue;
                const json = JSON.parse(content);
                const candidate = text(json.url);
                ua = text(json.UA) || ua;
                if (validParsedUrl(candidate)) {
                    finalUrl = candidate;
                    break;
                }
            } catch (e) {}
        }
        if (finalUrl.indexOf('http') !== 0) return '';
        const headers = {};
        if (ua) headers['User-Agent'] = ua;
        const result = { parse: 0, url: finalUrl, header: JSON.stringify(headers) };
        if (finalUrl.toLowerCase().indexOf('.m3u8') >= 0) result.format = 'application/x-mpegURL';
        return JSON.stringify(result);
    } catch (e) {
        return '';
    }
}

export default { init, home, homeVod, category, detail, play, search };
