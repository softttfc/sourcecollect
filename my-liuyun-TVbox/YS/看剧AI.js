const DEFAULT_HOST = 'https://kanju18.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const SECRET = '557d0e4ae929f438da6bd84412374e6086b8af09b3fed54bf22601d5bf8c54a0';

let host = DEFAULT_HOST;
let siteName = '看剧AI';
let sites = [];
let cookie = '';
let blockedFroms = [];

function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            const d = str.charCodeAt(++i);
            const cp = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
            out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

const SHA_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function sha256(bytes) {
    const data = bytes.slice();
    const bitLen = data.length * 8;
    data.push(0x80);
    while (data.length % 64 !== 56) data.push(0);
    for (let i = 7; i >= 0; i--) data.push(Math.floor(bitLen / Math.pow(256, i)) & 255);
    let h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const rr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
    for (let off = 0; off < data.length; off += 64) {
        const w = [];
        for (let i = 0; i < 16; i++) w.push(((data[off + 4 * i] << 24) | (data[off + 4 * i + 1] << 16) | (data[off + 4 * i + 2] << 8) | data[off + 4 * i + 3]) >>> 0);
        for (let i = 16; i < 64; i++) {
            const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w.push((w[i - 16] + s0 + w[i - 7] + s1) >>> 0);
        }
        let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
        for (let i = 0; i < 64; i++) {
            const s1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + s1 + ch + SHA_K[i] + w[i]) >>> 0;
            const s0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
            const mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + mj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h = h.map((x, i) => (x + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    const out = [];
    for (const x of h) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
    return out;
}

function hmacSha256(key, message) {
    key = key.length > 64 ? sha256(key) : key.slice();
    while (key.length < 64) key.push(0);
    const ipad = key.map(b => b ^ 0x36);
    const opad = key.map(b => b ^ 0x5c);
    return sha256(opad.concat(sha256(ipad.concat(message))));
}

function signedHeaders(method, path) {
    const timestamp = String(Date.now());
    let nonce = '';
    for (let i = 0; i < 16; i++) nonce += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const text = method.toUpperCase() + '\n' + path + '\n' + timestamp + '\n' + nonce;
    const signature = hmacSha256(utf8enc(SECRET), utf8enc(text)).map(b => b.toString(16).padStart(2, '0')).join('');
    const headers = {
        'User-Agent': UA,
        'x-ai-movie-timestamp': timestamp,
        'x-ai-movie-nonce': nonce,
        'x-ai-movie-signature': signature,
        'x-ai-movie-client-name': 'movie-search-frontend',
        'x-ai-movie-client-version': '1.0.0',
        'x-ai-movie-protocol-version': '2026-07-05.library-v2.playback-v1'
    };
    if (cookie) headers.Cookie = cookie;
    return headers;
}

async function requestAt(base, method, path, body) {
    try {
        const headers = signedHeaders(method, path);
        const options = { method, headers, timeout: 20000 };
        if (method === 'POST') {
            headers['Content-Type'] = 'application/json';
            options.data = body || '{}';
        }
        const r = await req(base + path, options);
        const text = r && r.content ? String(r.content).trim() : '';
        if (!text.startsWith('{')) return null;
        const data = JSON.parse(text);
        if (data.error !== undefined || data.errorCode !== undefined) return null;
        return data;
      } catch (e) {
        return null;
    }
}

async function getJson(path) {
    let data = await requestAt(host, 'GET', path, null);
    if (data) return data;
    for (const site of sites) {
        if (site === host) continue;
        data = await requestAt(site, 'GET', path, null);
        if (data) {
            host = site;
            return data;
        }
    }
    return null;
}

async function postJson(path, body) {
    let data = await requestAt(host, 'POST', path, body);
    if (data) return data;
    for (const site of sites) {
        if (site === host) continue;
        data = await requestAt(site, 'POST', path, body);
        if (data) {
            host = site;
            return data;
        }
    }
    return null;
}

function addSite(value) {
    if (!value) return;
    const site = String(value).trim().replace(/\/+$/, '');
    if (site.startsWith('http') && !sites.includes(site)) sites.push(site);
}

function setBlocked(value) {
    if (Array.isArray(value)) blockedFroms = value.map(v => String(v).trim()).filter(Boolean);
    else if (typeof value === 'string') blockedFroms = value.split(/[,，]/).map(v => v.trim()).filter(Boolean);
}

function blocked(name) {
    name = String(name || '').toLowerCase();
    return blockedFroms.some(v => name.includes(v.toLowerCase()));
}

function vod(item) {
    return {
        vod_id: String(item.id || ''),
        vod_name: String(item.title || ''),
        vod_pic: String(item.poster_url || ''),
        vod_remarks: String(item.remarks || '')
    };
}

function lineName(line) {
    return String(line.label || line.id || '');
}

function sortedLines(lines) {
    return (lines || []).filter(Boolean).slice().sort((a, b) => (Number(b.preference_weight) || 0) - (Number(a.preference_weight) || 0));
}

async function init(ext) {
    sites = [];
    host = DEFAULT_HOST;
    siteName = '看剧AI';
    cookie = '';
    blockedFroms = [];
    if (ext) {
        try {
            const cfg = typeof ext === 'string' && ext.trim().startsWith('{') ? JSON.parse(ext) : ext;
            if (cfg && typeof cfg === 'object') {
                if (Array.isArray(cfg.site)) cfg.site.forEach(addSite);
                else String(cfg.site || '').split(/[,;]/).forEach(addSite);
                if (cfg.name) siteName = String(cfg.name);
                setBlocked(cfg.blockedFroms);
            } else {
                String(ext).split(/[,;]/).forEach(addSite);
            }
        } catch (e) {}
    }
    addSite(DEFAULT_HOST);
    host = sites[0];
}

async function homeVod() {
    const list = [];
    const seen = {};
    try {
        const data = await getJson('/v1/feed/home?scope=public&mode=preview&sections=8&cards=12');
        for (const section of (data && data.sections) || []) {
            for (const card of (section && section.cards) || []) {
                const id = String(card.id || '');
                if (id && !seen[id]) {
                    seen[id] = true;
                    list.push(vod(card));
                }
            }
        }
    } catch (e) {}
    return JSON.stringify({ list });
}

async function home(filter) {
    const ids = ['series', 'movie', 'short_drama', 'anime', 'variety', 'documentary', 'sports'];
    const names = ['剧集', '电影', '短剧', '动漫', '综艺', '纪录片', '体育'];
    const data = JSON.parse(await homeVod());
    data.class = ids.map((id, i) => ({ type_id: id, type_name: names[i] }));
    data.filters = {};
    return JSON.stringify(data);
}

async function category(tid, pg, filter, extend = {}) {
    const page = parseInt(pg, 10) || 1;
    try {
        const path = '/v1/browse/catalog?sort=trending&window=week&kind=' + encodeURIComponent(tid) + '&page=' + page + '&limit=24';
        const data = await getJson(path);
        const list = ((data && data.cards) || []).map(vod);
        const total = Number(data && data.pagination && data.pagination.total) || 0;
        return JSON.stringify({ list, page, pagecount: total > 0 ? Math.ceil(total / 24) : 1, limit: 24, total });
    } catch (e) {
        return JSON.stringify({ list: [], page, pagecount: 1, limit: 24, total: 0 });
    }
}

async function detail(id) {
    const data = await getJson('/v1/catalog/' + id + '/detail');
    if (!data) return JSON.stringify({ list: [] });
    let episodes = data.episodes || [];
    if (!episodes.length) {
        const more = await getJson('/v1/catalog/' + id + '/episodes?limit=500&offset=0');
        episodes = more && more.episodes ? more.episodes : [];
    }
    const items = [];
    episodes.forEach((ep, i) => {
        if (!ep || !ep.token) return;
        const title = String(ep.title || '第' + (Number(ep.number) || i + 1) + '集');
        items.push(title + '$' + ep.token);
    });
    if (!items.length) return JSON.stringify({ list: [] });
    let lines = [];
    if (items.length) {
        const token = items[0].substring(items[0].lastIndexOf('$') + 1);
        const resolved = await getJson('/v1/playback/resolve/' + token + '?view=compact');
        for (const line of sortedLines(resolved && resolved.line_options)) {
            const name = lineName(line);
            if (name && !lines.includes(name) && !blocked(name)) lines.push(name);
        }
        if (!lines.length && blockedFroms.length) {
            for (const line of sortedLines(resolved && resolved.line_options)) {
                const name = lineName(line);
                if (name) {
                    lines.push(name);
                    break;
                }
            }
        }
    }
    const names = lines.length ? lines : [siteName];
    const joined = items.join('#');
    const firstSix = value => (value || []).slice(0, 6).filter(Boolean).join('/');
    return JSON.stringify({ list: [{
        vod_id: String(id),
        vod_name: String(data.title || ''),
        vod_pic: String(data.poster_url || ''),
        vod_remarks: String(data.remarks || ''),
        vod_content: String(data.description || ''),
        vod_year: data.year ? String(data.year) : '',
        vod_area: String(data.area || ''),
        vod_actor: firstSix(data.actors),
        vod_director: firstSix(data.directors),
        vod_play_from: names.join('$$$'),
        vod_play_url: names.map(() => joined).join('$$$')
    }] });
}

function sessionFromHeaders(headers) {
    if (!headers) return '';
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() !== 'set-cookie') continue;
        const values = typeof headers[key] === 'string' ? [headers[key]] : headers[key];
        for (const value of values || []) {
            const match = String(value).match(/ai_movie_session=[^;]+/);
            if (match && match[0] !== 'ai_movie_session=') return match[0];
        }
    }
    return '';
}

async function ensureSession() {
    if (cookie) return;
    try {
        const path = '/v1/users/anonymous';
        const r = await req(host + path, {
            method: 'POST',
            headers: Object.assign(signedHeaders('POST', path), { 'Content-Type': 'application/json' }),
            data: '{}',
            timeout: 20000
        });
        cookie = sessionFromHeaders(r && r.headers);
    } catch (e) {}
}

async function play(flag, id, flags) {
    await ensureSession();
    const data = await getJson('/v1/playback/resolve/' + id + '?view=compact');
    const lines = sortedLines(data && data.line_options);
    const selected = lines.findIndex(line => String(line.label || '') === String(flag || ''));
    if (selected > 0) lines.unshift(lines.splice(selected, 1)[0]);
    let tried = 0;
    for (let line of lines) {
        if (blocked(String(line.label || ''))) continue;
        if (++tried > 6) break;
        let url = String(line.url || '');
        let kind = String(line.url_kind || '');
        if (url.startsWith('resolve://')) {
            const resolved = await postJson('/v1/playback/resolve-line?view=compact', JSON.stringify({ ticket: url.substring(10) }));
            line = resolved && resolved.line;
            if (!line) continue;
            url = String(line.url || '');
            kind = String(line.url_kind || '');
        }
        if (url.startsWith('http') && !url.includes('.jpg') && !url.includes('.png')) {
            return JSON.stringify({ parse: 0, url, type: url.includes('.m3u8') || kind === 'm3u8' ? 'm3u8' : undefined });
        }
    }
    return JSON.stringify({ parse: 0, url: '' });
}

async function search(wd, quick, pg = 1) {
    try {
        const data = await getJson('/v1/suggest?q=' + encodeURIComponent(wd) + '&limit=20&mode=home&scope=public');
        const list = [];
        for (const suggestion of (data && data.suggestions) || []) {
            const target = suggestion && suggestion.target;
            if (target && target.variant_id) list.push({
                vod_id: String(target.variant_id),
                vod_name: String(suggestion.label || ''),
                vod_pic: String(target.poster_url || ''),
                vod_remarks: String(suggestion.subtitle || '')
            });
        }
        return JSON.stringify({ list, page: Number(pg) || 1 });
    } catch (e) {
        return JSON.stringify({ list: [], page: Number(pg) || 1 });
    }
}

export default { init, home, homeVod, category, detail, play, search };
