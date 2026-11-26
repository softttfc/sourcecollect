// 看剧AI TVBox QuickJS 爬虫
// HMAC-SHA256 请求签名 + 多站点回退 + 匿名会话 + 多线路播放

const DEFAULT_HOST = 'https://kanju18.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36  Edg/158.0.0.0';
const SECRET = '557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0';
const TIMEOUT = 20000;
const CLASSES = [
    { type_id: 'series', type_name: '剧集' },
    { type_id: 'movie', type_name: '电影' },
    { type_id: 'short_drama', type_name: '短剧' },
    { type_id: 'anime', type_name: '动漫' },
    { type_id: 'variety', type_name: '综艺' },
    { type_id: 'documentary', type_name: '纪录片' },
    { type_id: 'sports', type_name: '体育' }
];

let HOST = DEFAULT_HOST;
let SOURCE_NAME = '看剧AI';
let SITES = [];
let BLOCKED_FROMS = [];
let COOKIE = '';

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

function addSite(value) {
    const site = text(value).trim().replace(/\/+$/, '');
    if (site.indexOf('http') === 0 && SITES.indexOf(site) < 0) SITES.push(site);
}

function setBlockedFroms(value) {
    BLOCKED_FROMS = [];
    const values = Array.isArray(value) ? value : text(value).split(/[,，]/);
    for (const item of values) {
        const name = text(item).trim();
        if (name) BLOCKED_FROMS.push(name);
    }
}

function isBlocked(name) {
    const lower = text(name).toLowerCase();
    if (!lower) return false;
    for (const item of BLOCKED_FROMS) {
        if (item && lower.indexOf(item.toLowerCase()) >= 0) return true;
    }
    return false;
}

function utf8Bytes(str) {
    const bin = unescape(encodeURIComponent(str));
    const out = [];
    for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i) & 255);
    return out;
}

const SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256Bytes(bytes) {
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = bytes.length;
    const lenLo = (len * 8) >>> 0;
    const lenHi = Math.floor(len / 0x20000000) >>> 0;
    bytes = bytes.slice();
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 3; i >= 0; i--) bytes.push((lenHi >>> (8 * i)) & 255);
    for (let i = 3; i >= 0; i--) bytes.push((lenLo >>> (8 * i)) & 255);

    function rr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
    const W = new Array(64);
    for (let off = 0; off < bytes.length; off += 64) {
        for (let t = 0; t < 16; t++) {
            W[t] = (bytes[off + t * 4] << 24 | bytes[off + t * 4 + 1] << 16 |
                bytes[off + t * 4 + 2] << 8 | bytes[off + t * 4 + 3]) >>> 0;
        }
        for (let t = 16; t < 64; t++) {
            const s0 = rr(W[t - 15], 7) ^ rr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
            const s1 = rr(W[t - 2], 17) ^ rr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
        }
        let a = H[0], b = H[1], c = H[2], d = H[3];
        let e = H[4], f = H[5], g = H[6], hh = H[7];
        for (let t = 0; t < 64; t++) {
            const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
            const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
        H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
        H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + hh) >>> 0;
    }
    const out = [];
    for (let i = 0; i < 8; i++) {
        out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    }
    return out;
}

function hmacSha256Hex(key, message) {
    let kb = utf8Bytes(key);
    if (kb.length > 64) kb = sha256Bytes(kb);
    while (kb.length < 64) kb.push(0);
    const ipad = [], opad = [];
    for (let i = 0; i < 64; i++) {
        ipad.push(kb[i] ^ 0x36);
        opad.push(kb[i] ^ 0x5c);
    }
    const bytes = sha256Bytes(opad.concat(sha256Bytes(ipad.concat(utf8Bytes(message)))));
    let hex = '';
    for (const b of bytes) hex += ('0' + b.toString(16)).slice(-2);
    return hex;
}

function signedHeaders(method, path) {
    const timestamp = String(Date.now());
    let nonce = '';
    for (let i = 0; i < 16; i++) nonce += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const message = method.toUpperCase() + '\n' + path + '\n' + timestamp + '\n' + nonce;
    const headers = {
        'User-Agent': UA,
        'x-ai-movie-timestamp': timestamp,
        'x-ai-movie-nonce': nonce,
        'x-ai-movie-signature': hmacSha256Hex(SECRET, message),
        'x-ai-movie-client-name': 'movie-search-frontend',
        'x-ai-movie-client-version': '1.0.0',
        'x-ai-movie-protocol-version': '2026-07-05.library-v2.playback-v1'
    };
    if (COOKIE) headers.Cookie = COOKIE;
    return headers;
}

function requestOnHost(host, method, path, body) {
    try {
        const headers = signedHeaders(method, path);
        const options = { method: method, headers: headers, timeout: TIMEOUT };
        if (method === 'POST') {
            headers['Content-Type'] = 'application/json';
            options.data = body ? JSON.parse(body) : {};
            options.postType = 'json';
        }
        const res = req(host + path, options);
        const content = res && res.content ? res.content.trim() : '';
        if (!content || content.charAt(0) !== '{') return null;
        const json = JSON.parse(content);
        if (Object.prototype.hasOwnProperty.call(json, 'error') ||
            Object.prototype.hasOwnProperty.call(json, 'errorCode')) return null;
        return json;
    } catch (e) {
        return null;
    }
}

function apiRequest(method, path, body) {
    let result = requestOnHost(HOST, method, path, body || null);
    if (result) return result;
    for (const site of SITES) {
        if (site === HOST) continue;
        result = requestOnHost(site, method, path, body || null);
        if (result) {
            HOST = site;
            return result;
        }
    }
    return null;
}

function findSession(headers) {
    if (!headers) return '';
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== 'set-cookie') continue;
        const value = headers[key];
        const values = typeof value === 'string' ? [value] : value;
        for (const item of values || []) {
            const match = /ai_movie_session=[^;]+/.exec(item);
            if (match && match[0] !== 'ai_movie_session=') return match[0];
        }
    }
    return '';
}

function ensureSession() {
    if (COOKIE) return;
    const path = '/v1/users/anonymous';
    try {
        const headers = signedHeaders('POST', path);
        headers['Content-Type'] = 'application/json';
        const res = req(HOST + path, {
            method: 'POST',
            headers: headers,
            data: {},
            postType: 'json',
            timeout: TIMEOUT
        });
        COOKIE = findSession(res && res.headers);
    } catch (e) {
        COOKIE = '';
    }
}

function cardToVod(card) {
    return {
        vod_id: text(card.id),
        vod_name: text(card.title),
        vod_pic: text(card.poster_url),
        vod_remarks: text(card.remarks)
    };
}

function failure(message) {
    return JSON.stringify({ list: [], parse: 0, url: '', msg: message });
}

function isImageUrl(url) {
    return /\.(?:jpe?g|png|gif|webp|svg|image)(?:[?~]|$)/i.test(url);
}

function init(ext) {
    HOST = DEFAULT_HOST;
    SOURCE_NAME = '看剧AI';
    SITES = [];
    BLOCKED_FROMS = [];
    COOKIE = '';
    ext = text(ext).trim();

    if (ext) {
        try {
            if (ext.charAt(0) === '{') {
                const config = JSON.parse(ext);
                if (Array.isArray(config.site)) {
                    for (const site of config.site) addSite(site);
                } else {
                    const sites = text(config.site).split(/[,;]/);
                    for (const site of sites) addSite(site);
                }
                if (text(config.name)) SOURCE_NAME = text(config.name);
                setBlockedFroms(config.blockedFroms);
            } else {
                const sites = ext.split(/[,;]/);
                for (const site of sites) addSite(site);
            }
        } catch (e) {}
    }
    addSite(DEFAULT_HOST);
    HOST = SITES[0];
}

function fetchHomeList() {
    const list = [];
    const seen = Object.create(null);
    const res = apiRequest('GET', '/v1/feed/home?scope=public&mode=preview&sections=8&cards=12');
    const sections = res && Array.isArray(res.sections) ? res.sections : [];
    for (const section of sections) {
        const cards = section && Array.isArray(section.cards) ? section.cards : [];
        for (const card of cards) {
            if (!card || !text(card.id) || seen[text(card.id)]) continue;
            seen[text(card.id)] = true;
            list.push(cardToVod(card));
        }
    }
    return list;
}

function home(filter) {
    return JSON.stringify({ 'class': CLASSES, list: fetchHomeList() });
}

function homeVod() {
    return JSON.stringify({ list: fetchHomeList() });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(text(pg).trim(), 10) || 1;
    const path = '/v1/browse/catalog?sort=trending&window=week&kind=' +
        encodeURIComponent(text(tid)) + '&page=' + page + '&limit=24';
    const res = apiRequest('GET', path);
    const cards = res && Array.isArray(res.cards) ? res.cards : [];
    const list = cards.filter(card => !!card).map(cardToVod);

    let pageTotal = 1;
    const pagination = res && res.pagination;
    if (pagination && parseInt(pagination.total, 10) > 0) {
        pageTotal = Math.ceil(parseInt(pagination.total, 10) / 24);
    }
    return JSON.stringify({
        list: list,
        page: page,
        pagecount: page + 1,
        limit: 24,
        total: pageTotal
    });
}

function firstSixNames(values) {
    const out = [];
    if (!Array.isArray(values)) return out;
    for (let i = 0; i < values.length && i < 6; i++) {
        const value = text(values[i]);
        if (value) out.push(value);
    }
    return out;
}

function sortedLines(res) {
    const lines = res && Array.isArray(res.line_options) ? res.line_options : [];
    return lines.filter(line => !!line).sort((a, b) =>
        (parseInt(b.preference_weight, 10) || 0) - (parseInt(a.preference_weight, 10) || 0)
    );
}

function detail(ids) {
    const vodId = text(Array.isArray(ids) ? ids[0] : ids);
    const res = apiRequest('GET', '/v1/catalog/' + vodId + '/detail');
    if (!res) return failure('详情获取失败');

    let episodes = Array.isArray(res.episodes) ? res.episodes : [];
    if (!episodes.length) {
        const episodeRes = apiRequest('GET', '/v1/catalog/' + vodId + '/episodes?limit=500&offset=0');
        episodes = episodeRes && Array.isArray(episodeRes.episodes) ? episodeRes.episodes : [];
    }

    const playEpisodes = [];
    for (let i = 0; i < episodes.length; i++) {
        const episode = episodes[i];
        if (!episode || !text(episode.token)) continue;
        let title = text(episode.title);
        if (!title) title = '第' + (parseInt(episode.number, 10) || i + 1) + '集';
        playEpisodes.push(title + '$' + text(episode.token));
    }
    if (!playEpisodes.length) return failure('该影片暂无可播放集数');

    const firstToken = playEpisodes[0].substring(playEpisodes[0].lastIndexOf('$') + 1);
    const playback = apiRequest('GET', '/v1/playback/resolve/' + firstToken + '?view=compact');
    const lines = sortedLines(playback);
    const lineNames = [];
    for (const line of lines) {
        const name = text(line.label) || text(line.id);
        if (name && lineNames.indexOf(name) < 0 && !isBlocked(name)) lineNames.push(name);
    }
    if (!lineNames.length && BLOCKED_FROMS.length && lines.length) {
        const name = text(lines[0].label) || text(lines[0].id);
        if (name) lineNames.push(name);
    }

    let playFrom, playUrl;
    if (lineNames.length > 1) {
        playFrom = lineNames.join('$$$');
        playUrl = lineNames.map(() => playEpisodes.join('#')).join('$$$');
    } else {
        playFrom = lineNames.length ? lineNames[0] : SOURCE_NAME;
        playUrl = playEpisodes.join('#');
    }

    const vod = {
        vod_id: vodId,
        vod_name: text(res.title),
        vod_pic: text(res.poster_url),
        vod_remarks: text(res.remarks),
        vod_content:'【琉🔹璃❤广告勿信👉剧情】📢'+ text(res.description),
        vod_year: String(parseInt(res.year, 10) || 0),
        vod_area: text(res.area),
        vod_actor: firstSixNames(res.actors).join('/'),
        vod_director: firstSixNames(res.directors).join('/'),
        vod_play_from: playFrom,
        vod_play_url: playUrl
    };
    return JSON.stringify({ list: [vod] });
}

function play(flag, id, vipFlags) {
    ensureSession();
    const res = apiRequest('GET', '/v1/playback/resolve/' + text(id) + '?view=compact');
    const lines = sortedLines(res);
    if (!lines.length) return failure('播放解析失败：无可用线路');

    if (flag) {
        for (let i = 0; i < lines.length; i++) {
            if (text(flag) === text(lines[i].label)) {
                const selected = lines.splice(i, 1)[0];
                lines.unshift(selected);
                break;
            }
        }
    }

    let attempts = 0;
    for (const line of lines) {
        if (isBlocked(line.label)) continue;
        attempts++;
        if (attempts > 6) break;

        let url = text(line.url);
        let urlKind = text(line.url_kind);
        if (url.indexOf('resolve://') === 0) {
            const ticket = url.substring(10);
            const resolved = apiRequest(
                'POST',
                '/v1/playback/resolve-line?view=compact',
                JSON.stringify({ ticket: ticket })
            );
            if (!resolved || !resolved.line) continue;
            url = text(resolved.line.url);
            urlKind = text(resolved.line.url_kind);
        }
        if (!url || url.indexOf('http') !== 0 || isImageUrl(url)) continue;

        const result = { parse: 0, url: url };
        if (url.indexOf('.m3u8') >= 0 || urlKind === 'm3u8') result.format = 'application/x-mpegURL';
        return JSON.stringify(result);
    }
    return failure('播放地址获取失败');
}

function search(wd, quick, pg) {
    const path = '/v1/suggest?q=' + encodeURIComponent(text(wd)) + '&limit=20&mode=home&scope=public';
    const res = apiRequest('GET', path);
    const suggestions = res && Array.isArray(res.suggestions) ? res.suggestions : [];
    const list = [];
    for (const item of suggestions) {
        if (!item || !item.target || !text(item.target.variant_id)) continue;
        list.push({
            vod_id: text(item.target.variant_id),
            vod_name: text(item.label),
            vod_remarks: text(item.subtitle),
            vod_pic: ''
        });
    }
    return JSON.stringify({ list: list });
}

export default { init, home, homeVod, category, detail, play, search };
