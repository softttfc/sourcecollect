const appConfig = {
    siteName: "千千音乐",
    siteUrl: "https://music.91q.com",
    appid: "16073360",
    secret: "0b50b02fd0d73a9c4c8c3a781c30845f"
};
const UA = "Mozilla/5.0 (Linux; Android 10; TVBox) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 50;

const classList = [
    { type_id: "search_新歌", type_name: "新歌推荐" },
    { type_id: "search_经典", type_name: "经典金曲" },
    { type_id: "search_老歌", type_name: "怀旧老歌" },
    { type_id: "search_英文", type_name: "英文歌曲" },
    { type_id: "search_说唱", type_name: "说唱" },
    { type_id: "search_古风", type_name: "古风" },
    { type_id: "search_民谣", type_name: "民谣" },
    { type_id: "search_摇滚", type_name: "摇滚" },
    { type_id: "search_电子", type_name: "电子音乐" },
    { type_id: "search_影视", type_name: "影视原声" },
    { type_id: "search_轻音乐", type_name: "轻音乐" },
    { type_id: "search_歌手", type_name: "热门歌手" }
];

// 音质档位 (码率从高到低)
const RATES = [
    ["3000", "无损FLAC"],
    ["320", "极高320K"],
    ["128", "标准128K"],
    ["64", "省流64K"]
];

// ================= MD5 (硬编码常量, QuickJS兼容) =================
function md5(input) {
    function utf8Bytes(s) {
        const b = unescape(encodeURIComponent(s));
        const out = [];
        for (let i = 0; i < b.length; i++) out.push(b.charCodeAt(i) & 255);
        return out;
    }
    const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
    const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    const bytes = utf8Bytes(input);
    // 长度拆高低32位 (避免 >>>32 移位陷阱)
    const lenLo = (bytes.length * 8) >>> 0;
    const lenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 0; i < 4; i++) bytes.push((lenLo >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i++) bytes.push((lenHi >>> (8 * i)) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    function rol(x, n) { return (((x << n) | (x >>> (32 - n))) >>> 0); }
    for (let off = 0; off < bytes.length; off += 64) {
        const M = [];
        for (let j = 0; j < 16; j++) M[j] = (bytes[off + j * 4] | (bytes[off + j * 4 + 1] << 8) | (bytes[off + j * 4 + 2] << 16) | (bytes[off + j * 4 + 3] << 24));
        let A = a0, B = b0, C = c0, D = d0;
        for (let j = 0; j < 64; j++) {
            let F, g;
            if (j < 16) { F = (B & C) | (~B & D); g = j; }
            else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
            else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * j) % 16; }
            const tmp = D; D = C; C = B;
            B = (B + rol((A + F + K[j] + M[g]) >>> 0, S[j])) >>> 0;
            A = tmp;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    function leHex(w) {
        let s = '';
        for (let i = 0; i < 4; i++) s += ('0' + ((w >>> (8 * i)) & 255).toString(16)).slice(-2);
        return s;
    }
    return leHex(a0) + leHex(b0) + leHex(c0) + leHex(d0);
}

// ================= base64url (pack/unpack) =================
const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function utf8ToBytes(s) {
    const b = unescape(encodeURIComponent(s));
    const out = [];
    for (let i = 0; i < b.length; i++) out.push(b.charCodeAt(i) & 255);
    return out;
}
function bytesToUtf8(bytes) {
    let out = '', k = 0;
    while (k < bytes.length) {
        const b = bytes[k++];
        if (b < 128) out += String.fromCharCode(b);
        else if (b < 224) out += String.fromCharCode(((b & 31) << 6) | (bytes[k++] & 63));
        else if (b < 240) out += String.fromCharCode(((b & 15) << 12) | ((bytes[k++] & 63) << 6) | (bytes[k++] & 63));
        else { let cp = ((b & 7) << 18) | ((bytes[k++] & 63) << 12) | ((bytes[k++] & 63) << 6) | (bytes[k++] & 63); cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 1023)); }
    }
    return out;
}
function b64EncodeUrl(str) {
    const bytes = utf8ToBytes(str);
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
        const n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8) | (i + 2 < bytes.length ? bytes[i + 2] : 0);
        out += B64C.charAt((n >> 18) & 63) + B64C.charAt((n >> 12) & 63);
        out += (i + 1 < bytes.length) ? B64C.charAt((n >> 6) & 63) : '=';
        out += (i + 2 < bytes.length) ? B64C.charAt(n & 63) : '=';
    }
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64DecodeUrl(str) {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bytes = [];
    let i = 0;
    while (i < s.length) {
        const e1 = B64C.indexOf(s.charAt(i++));
        const e2 = B64C.indexOf(s.charAt(i++));
        const c3 = s.charAt(i++), c4 = s.charAt(i++);
        const e3 = c3 === '=' ? 64 : B64C.indexOf(c3);
        const e4 = c4 === '=' ? 64 : B64C.indexOf(c4);
        if (e1 < 0 || e2 < 0) return '';
        const n = (e1 << 18) | (e2 << 12) | ((e3 & 63) << 6) | (e4 & 63);
        bytes.push((n >> 16) & 255);
        if (e3 !== 64) bytes.push((n >> 8) & 255);
        if (e4 !== 64) bytes.push(n & 255);
    }
    return bytesToUtf8(bytes);
}

// ================= 签名 & 请求 =================
function sign(params) {
    params = Object.assign({}, params);
    params.appid = appConfig.appid;
    params.timestamp = String(Math.floor(Date.now() / 1000));
    const keys = Object.keys(params).sort();
    const raw = keys.map(k => k + '=' + params[k]).join('&');
    params.sign = md5(raw + appConfig.secret);
    return params;
}

async function api(path, params) {
    const signed = sign(params || {});
    const qs = Object.keys(signed).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(signed[k])).join('&');
    const r = await req(appConfig.siteUrl + path + '?' + qs, {
        method: 'GET',
        headers: {
            'User-Agent': UA,
            'Accept': 'application/json, text/plain, */*',
            'Referer': appConfig.siteUrl + '/',
            'from': 'web'
        },
        timeout: 18000
    });
    return JSON.parse((r && r.content) || '{}');
}

async function fetchText(url) {
    const r = await req(url, { method: 'GET', headers: { 'User-Agent': UA }, timeout: 18000 });
    return (r && r.content) || '';
}

// ================= 辅助 =================
function pack(kind, value) {
    return kind + ':' + b64EncodeUrl(JSON.stringify(value));
}

function unpack(value, kind) {
    const text = String(value || ''), prefix = kind + ':';
    if (text.indexOf(prefix) !== 0) return null;
    try { return JSON.parse(b64DecodeUrl(text.substring(prefix.length))); } catch (e) { return null; }
}

function makeResult(items, page, more, size) {
    page = Math.max(1, parseInt(page, 10) || 1);
    size = size || 20;
    return {
        list: items,
        page: page,
        pagecount: more ? page + 1 : page,
        limit: size,
        total: (page - 1) * size + items.length + (more ? size : 0)
    };
}

function safeName(name) {
    return String(name || '播放').replace(/\$/g, ' ').replace(/#/g, ' ');
}

function artists(track) {
    const list = (track && track.artist) || [];
    const names = [];
    for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].name) names.push(String(list[i].name));
    }
    return names.join(' / ');
}

function trackCard(track, prefix) {
    if (!track || typeof track !== 'object' || !track.TSID) return null;
    const tsid = String(track.TSID);
    const name = String(track.title || '未知歌曲');
    const arts = artists(track);
    const album = String(track.albumTitle || '');
    let remark = (prefix || '') + (prefix && arts ? ' · ' + arts : (arts || album));
    return {
        vod_id: pack('song', { tsid: tsid, name: name }),
        vod_name: name,
        vod_pic: String(track.pic || ''),
        vod_remarks: remark
    };
}

function availableRates(track) {
    let allRate = (track && track.allRate) || [];
    if (!Array.isArray(allRate)) allRate = [];
    const rateStrs = allRate.map(String);
    const out = [];
    for (let i = 0; i < RATES.length; i++) {
        if (rateStrs.indexOf(RATES[i][0]) !== -1) out.push(RATES[i]);
    }
    return out.length ? out : RATES;
}

// 搜索并过滤VIP歌曲, 返回 [免费曲目, 是否还有更多]
async function searchTracks(keyword, page, size) {
    const data = await api('/v1/search', { word: keyword, type: 1, pageNo: page, pageSize: size || SEARCH_PAGE_SIZE });
    const d = data.data || {};
    const rawTracks = d.typeTrack || [];
    const apiMore = !!(parseInt(d.haveMore, 10) || 0);
    const free = [];
    for (let i = 0; i < rawTracks.length; i++) {
        const t = rawTracks[i];
        if (t && typeof t === 'object' && (parseInt(t.isVip, 10) || 0) === 0) free.push(t);
    }
    return [free, apiMore];
}

async function tracklink(tsid, rate) {
    const params = { TSID: String(tsid) };
    if (rate) params.rate = String(rate);
    try {
        const j = await api('/v1/song/tracklink', params);
        return j.data || {};
    } catch (e) {
        return {};
    }
}

// ================= 接口 =================
async function init(ext) {
    console.log("初始化爬虫:", appConfig.siteName);
}

async function home(filter) {
    return JSON.stringify({ 'class': classList, filters: {} });
}

async function homeVod() {
    try {
        const rs = await searchTracks('新歌', 1);
        const cards = [];
        const tracks = rs[0].slice(0, PAGE_SIZE);
        for (let i = 0; i < tracks.length; i++) {
            const c = trackCard(tracks[i], '新歌');
            if (c) cards.push(c);
        }
        return JSON.stringify(makeResult(cards, 1, false, Math.max(1, cards.length)));
    } catch (e) {
        return JSON.stringify(makeResult([], 1));
    }
}

async function category(tid, pg, filter, extend) {
    const page = Math.max(1, parseInt(pg, 10) || 1);
    try {
        const keyword = String(tid).indexOf('search_') === 0 ? String(tid).substring(7) : String(tid);
        const rs = await searchTracks(keyword, page);
        const tracks = rs[0], apiMore = rs[1];
        const pageTracks = tracks.slice(0, PAGE_SIZE);
        const cards = [];
        for (let i = 0; i < pageTracks.length; i++) {
            const c = trackCard(pageTracks[i], keyword);
            if (c) cards.push(c);
        }
        const haveMore = apiMore && tracks.length >= pageTracks.length;
        return JSON.stringify(makeResult(cards, page, haveMore, PAGE_SIZE));
    } catch (e) {
        return JSON.stringify(makeResult([], page));
    }
}

async function search(wd, quick, pg) {
    const page = Math.max(1, parseInt(pg, 10) || 1);
    try {
        const keyword = String(wd || '').replace(/^\s+|\s+$/g, '');
        if (!keyword) return JSON.stringify(makeResult([], 1));
        const rs = await searchTracks(keyword, page);
        const tracks = rs[0], apiMore = rs[1];
        const pageTracks = tracks.slice(0, PAGE_SIZE);
        const cards = [];
        for (let i = 0; i < pageTracks.length; i++) {
            const c = trackCard(pageTracks[i], '');
            if (c) cards.push(c);
        }
        const haveMore = apiMore && tracks.length >= pageTracks.length;
        return JSON.stringify(makeResult(cards, page, haveMore, PAGE_SIZE));
    } catch (e) {
        return JSON.stringify(makeResult([], 1));
    }
}

async function detail(ids) {
    const value = String(ids).split(',')[0];
    try {
        const info = unpack(value, 'song') || {};
        const tsid = info.tsid || value;
        const name = info.name || '千千音乐';

        let track = await tracklink(tsid);
        if (!track || !track.TSID) track = { TSID: tsid, title: name };

        const title = String(track.title || name);
        const arts = artists(track);
        const album = String(track.albumTitle || '未知专辑');
        const pic = String(track.pic || '');
        const duration = parseInt(track.duration, 10) || 0;
        const isVip = parseInt(track.isVip, 10) || 0;
        const rates = availableRates(track);

        let lyricText = '';
        const lyricUrl = String(track.lyric || '');
        if (lyricUrl) {
            try { lyricText = await fetchText(lyricUrl); } catch (e) { }
        }

        const sources = [], urls = [];
        const contentPrefix = isVip ? '[VIP歌曲，暂不支持播放]\n' : '';
        for (let i = 0; i < rates.length; i++) {
            sources.push(rates[i][1]);
            urls.push(safeName(title) + '$a:' + tsid + ':' + rates[i][0]);
        }

        return JSON.stringify({
            list: [{
                vod_id: value,
                vod_name: title + (isVip ? ' [VIP]' : ''),
                vod_pic: pic,
                type_name: '音乐',
                vod_actor: arts,
                vod_remarks: duration ? ('0' + Math.floor(duration / 60)).slice(-2) + ':' + ('0' + (duration % 60)).slice(-2) : '',
                vod_content:'【琉🔹璃❤广告勿信👉剧情】📢'+ contentPrefix + '专辑：' + album + '\n' + lyricText,
                vod_play_from: sources.length ? sources.join('$$$') : '千千音乐',
                vod_play_url: urls.length ? urls.join('$$$') : safeName(title) + '$a:' + tsid + ':128'
            }]
        });
    } catch (e) {
        const tsid = value.indexOf(':') !== -1 ? value.split(':').pop() : value;
        return JSON.stringify({
            list: [{
                vod_id: value,
                vod_name: '千千音乐',
                vod_play_from: '千千音乐',
                vod_play_url: '播放$a:' + tsid + ':128'
            }]
        });
    }
}

async function play(flag, pid, flags) {
    const value = String(pid || '');
    try {
        let tsid, rate;
        if (value.indexOf('a:') === 0) {
            const parts = value.substring(2).split(':');
            tsid = parts[0];
            rate = parts.slice(1).join(':');
        } else {
            tsid = value;
            rate = '128';
        }

        // 1. 用户选择的码率
        let data = await tracklink(tsid, rate);
        let url = String(data.path || '');

        // 2. 指定码率失败, 逐个尝试所有可用码率
        if (!url) {
            const allRate = data.allRate || [];
            for (let i = 0; i < allRate.length; i++) {
                if (String(allRate[i]) === String(rate)) continue;
                const tryData = await tracklink(tsid, allRate[i]);
                const tryUrl = String(tryData.path || '');
                if (tryUrl) { url = tryUrl; break; }
            }
        }

        // 3. 仍无URL, 不带rate参数默认调用
        if (!url) {
            data = await tracklink(tsid);
            url = String(data.path || '');
        }

        if (!url) {
            return JSON.stringify({ parse: 1, url: value, Header: {} });
        }
        return JSON.stringify({
            parse: 0,
            url: url,
            music_player: 1,
            Header: { 'User-Agent': UA, 'Referer': appConfig.siteUrl + '/' }
        });
    } catch (e) {
        return JSON.stringify({ parse: 1, url: value, Header: {} });
    }
}

export default {
    init,
    home,
    homeVod,
    category,
    detail,
    search,
    play
};
