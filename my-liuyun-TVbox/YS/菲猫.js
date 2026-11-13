// 加菲猫影视 (菲猫.py v2.1) - maccms + 海螺模板(Conch v3.5) HTML 解析（琉芸JS版）
// 播放: player_aaaa/player_data JSON; encrypt:1 unquote, encrypt:2 AES-128-ECB
// 剧集ID格式: {vid}___{sid}___{nid} -> /vplay/{vid}-{sid}-{nid}.html

const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const TIMEOUT = 10000;

let HOST = 'http://www.cixilyjt.com';

const CATE = [['电影', '1'], ['连续剧', '2'], ['综艺', '3'], ['动漫', '4'], ['短剧', '36']];
const SUB_CATE = {
    '1': [['全部', ''], ['动作片', '6'], ['喜剧片', '7'], ['爱情片', '8'], ['科幻片', '9'], ['恐怖片', '10'], ['战争片', '12']],
    '2': [['全部', ''], ['国产剧', '13'], ['港台剧', '14'], ['韩剧', '15'], ['美剧', '16'], ['日剧', '26'], ['海外剧', '27']],
    '3': [['全部', ''], ['大陆综艺', '23'], ['港台综艺', '24'], ['国外综艺', '25']],
    '4': [['全部', ''], ['国产动漫', '20'], ['日本动漫', '21'], ['欧美动漫', '22']],
    '36': [['全部', '']]
};


// ==================== AES (encrypt:2 解密用, 仅 ECB 解密) ====================
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const INV_SBOX = [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];
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
function aesDecBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, ek.Nr);
    for (let r = ek.Nr - 1; r >= 1; r--) {
        for (let rr = 1; rr < 4; rr++) {
            const t = [];
            for (let c = 0; c < 4; c++) t.push(s[rr + 4 * ((c - rr + 4) % 4)]);
            for (let c = 0; c < 4; c++) s[rr + 4 * c] = t[c];
        }
        for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
        aesAddRK(s, ek.w, r);
        for (let c = 0; c < 4; c++) {
            const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
            const m9 = (x) => xtime(xtime(xtime(x))) ^ x;
            const m11 = (x) => xtime(xtime(xtime(x))) ^ xtime(x) ^ x;
            const m13 = (x) => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ x;
            const m14 = (x) => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ xtime(x);
            s[4 * c] = m14(a[0]) ^ m11(a[1]) ^ m13(a[2]) ^ m9(a[3]);
            s[1 + 4 * c] = m9(a[0]) ^ m14(a[1]) ^ m11(a[2]) ^ m13(a[3]);
            s[2 + 4 * c] = m13(a[0]) ^ m9(a[1]) ^ m14(a[2]) ^ m11(a[3]);
            s[3 + 4 * c] = m11(a[0]) ^ m13(a[1]) ^ m9(a[2]) ^ m14(a[3]);
        }
    }
    for (let rr = 1; rr < 4; rr++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[rr + 4 * ((c - rr + 4) % 4)]);
        for (let c = 0; c < 4; c++) s[rr + 4 * c] = t[c];
    }
    for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    aesAddRK(s, ek.w, 0);
    return s;
}
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64dec(s) {
    const rev = {};
    for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
    s = String(s).replace(/[^A-Za-z0-9+/]/g, "");
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
        acc = (acc << 6) | rev[s[i]];
        bits += 6;
        if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return out;
}
function utf8dec(bytes) {
    let out = "", i = 0;
    while (i < bytes.length) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xE0) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xF0) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        else { i += 3; out += ""; }
    }
    return out;
}
function aesEcbDecryptB64(encrypted, keyStr) {
    try {
        const key = [];
        for (let i = 0; i < keyStr.length; i++) key.push(keyStr.charCodeAt(i) & 255);
        const ek = aesKeyExp(key);
        const bytes = b64dec(encrypted);
        const out = [];
        for (let i = 0; i + 16 <= bytes.length; i += 16) {
            const b = aesDecBlock(ek, bytes.slice(i, i + 16));
            for (const x of b) out.push(x);
        }
        // pkcs7 unpad
        if (out.length) {
            const n = out[out.length - 1];
            if (n >= 1 && n <= 16 && n <= out.length) out.length = out.length - n;
        }
        return utf8dec(out);
    } catch (e) { return encrypted; }
}

// ==================== 业务 ====================
function fetchHtml(url) {
    try {
        const r = req(url, {
            headers: {
                'User-Agent': UA, 'Referer': HOST + '/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: TIMEOUT
        });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function stripTags(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseListHtml(html) {
    const videos = [], seen = {};
    const re = /<a[^>]*class="hl-item-thumb[^"]*"[^>]*href="\/varticle\/(\d+)\.html"[^>]*title="([^"]*)"[^>]*(?:data-original|src)="([^"]*)"[^>]*>([\s\S]{0,1200}?)(?=<a[^>]*class="hl-item-thumb|<\/li>)/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const vid = m[1];
        if (seen[vid]) continue;
        const name = (m[2] || '').trim();
        if (!name) continue;
        seen[vid] = 1;
        let remarks = '';
        const rm = /<span[^>]*class="[^"]*remarks[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(m[4] || '');
        if (rm) remarks = stripTags(rm[1]);
        videos.push({ vod_id: vid, vod_name: name, vod_pic: (m[3] || '').trim(), vod_remarks: remarks });
    }
    if (!videos.length) {
        const re2 = /<a[^>]*class="hl-item-thumb[^"]*"[^>]*href="\/varticle\/(\d+)\.html"[^>]*title="([^"]*)"[^>]*(?:data-original|src)="([^"]*)"[^>]*>/g;
        while ((m = re2.exec(html)) !== null) {
            const vid = m[1];
            if (seen[vid]) continue;
            const name = (m[2] || '').trim();
            if (!name) continue;
            seen[vid] = 1;
            videos.push({ vod_id: vid, vod_name: name, vod_pic: (m[3] || '').trim(), vod_remarks: '' });
        }
    }
    return videos;
}

function parsePagecount(html) {
    let mx = 0;
    const re1 = /href="\/vodshow\/\d+[-]+(\d+)\.html"/g;
    let m;
    while ((m = re1.exec(html)) !== null) {
        const n = parseInt(m[1], 10);
        if (n > mx) mx = n;
    }
    if (mx) return mx;
    const re2 = /page=(\d+)/g;
    while ((m = re2.exec(html)) !== null) {
        const n = parseInt(m[1], 10);
        if (n > mx) mx = n;
    }
    return mx;
}

function extractInfoByLabel(html, keyword) {
    let idx = html.indexOf('>' + keyword + '：');
    if (idx < 0) idx = html.indexOf('>' + keyword + ':');
    if (idx < 0) return '';
    const start = html.lastIndexOf('<li', idx);
    let end = html.indexOf('</li>', idx);
    if (end < 0) end = idx + 500;
    const block = html.substring(start < 0 ? 0 : start, end);
    let names = [];
    let m;
    const re1 = />([^<]+)<\/a>/g;
    while ((m = re1.exec(block)) !== null) names.push(m[1]);
    if (!names.length) {
        const re2 = />([^<]+)<\/span>/g;
        while ((m = re2.exec(block)) !== null) names.push(m[1]);
    }
    return names.map(n => n.trim()).filter(n => n && n !== '/' && n !== '：' && n !== ':').join(' ');
}

function epName(nid, raw) {
    let name = stripTags(raw);
    if (!name) {
        const n = parseInt(nid, 10);
        name = '第' + (n < 10 ? '0' + n : '' + n) + '集';
    }
    return name;
}

function parsePlayList(html, vodId) {
    const sources = [];
    let m;
    const reSrc = /<a[^>]*class="hl-tabs-btn[^"]*"[^>]*alt="([^"]*)"/g;
    while ((m = reSrc.exec(html)) !== null) sources.push(m[1]);

    const boxes = html.split('<div class="hl-tabs-box').slice(1);
    const fromNames = [], fromUrls = [];

    if (!sources.length) {
        // 无线路tab: 全页提取
        const items = [];
        const reEp = /<a[^>]*href="\/vplay\/(\d+)-(\d+)-(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = reEp.exec(html)) !== null) {
            items.push(epName(m[3], m[4]) + '$' + m[1] + '___' + m[2] + '___' + m[3]);
        }
        if (items.length) return ['默认线路', items.join('#')];
        return ['默认线路', '播放$' + vodId + '___0___0'];
    }

    for (let i = 0; i < boxes.length && i < sources.length; i++) {
        let tabName = (sources[i] || '').trim() || ('线路' + (i + 1));
        const items = [];
        const reEp = /<a[^>]*href="\/vplay\/(\d+)-(\d+)-(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = reEp.exec(boxes[i])) !== null) {
            items.push(epName(m[3], m[4]) + '$' + m[1] + '___' + m[2] + '___' + m[3]);
        }
        if (items.length) {
            fromNames.push(tabName);
            fromUrls.push(items.join('#'));
        }
    }
    if (fromNames.length) return [fromNames.join('$$$'), fromUrls.join('$$$')];
    return ['默认线路', '播放$' + vodId + '___0___0'];
}

function extractPlayerData(html) {
    let m = /player_aaaa\s*=\s*(\{[\s\S]*?\})\s*[;<]/.exec(html);
    if (!m) m = /player_data\s*=\s*(\{[\s\S]*?\})\s*[;<]/.exec(html);
    if (m) {
        try { return JSON.parse(m[1]); } catch (e) {}
    }
    m = /player_\w+\s*=\s*(\{[^}]+\})/.exec(html);
    if (m) {
        try { return JSON.parse(m[1]); } catch (e) {}
    }
    return null;
}

// ==================== TVBox 接口 ====================
function init(ext) {
    if (ext) {
        const s = String(ext).trim();
        if (s.indexOf('http') === 0) HOST = s.replace(/\/+$/, '');
    }
}

function home(filter) {
    const classes = CATE.map(c => ({ type_name: c[0], type_id: c[1] }));
    // 实站筛选仅支持类型(子类ID直接作为vodshow id), 年份/地区无服务端支持, 不下发
    const filters = {};
    for (const c of CATE) {
        const cid = c[1];
        const flist = [];
        if (SUB_CATE[cid]) flist.push({ key: 'type', name: '类型', value: SUB_CATE[cid].map(x => ({ n: x[0], v: x[1] })) });
        if (flist.length) filters[cid] = flist;
    }
    return JSON.stringify({ 'class': classes, filters: filters });
}

function homeVod() {
    try {
        const videos = parseListHtml(fetchHtml(HOST + '/vtype/1.html'));
        return JSON.stringify({ list: videos.slice(0, 30) });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    let subType = '';
    try {
        const ex = typeof extend === 'string' && extend ? JSON.parse(extend) : (extend || {});
        subType = ex.type || '';
    } catch (e) {}
    // 实站子类筛选: 子类ID直接作为列表ID (原py的 {tid}-{area}---{sub}---{year} 格式已404失效)
    const effTid = subType || String(tid);
    const url = page <= 1
        ? HOST + '/vtype/' + effTid + '.html'
        : HOST + '/vodshow/' + effTid + '-----------' + page + '.html';
    const html = fetchHtml(url);
    const list = parseListHtml(html);
    let pc = parsePagecount(html);
    if (!pc && list.length) pc = page + 1;
    return JSON.stringify({ list: list, page: page, pagecount: pc || 1, limit: 30, total: 999999 });
}

function detail(ids) {
    const vodId = String(Array.isArray(ids) ? ids[0] : ids);
    try {
        const html = fetchHtml(HOST + '/varticle/' + vodId + '.html');
        if (!html || html.length < 200) throw new Error('详情页获取失败');

        let title = '';
        let m = /<h2[^>]*class="hl-dc-title[^"]*"[^>]*>([\s\S]*?)<\/h2>/.exec(html);
        if (m) title = stripTags(m[1]);

        let pic = '';
        m = /<meta[^>]*og:image[^>]*content="([^"]+)"/i.exec(html) || /<meta[^>]*content="([^"]+)"[^>]*og:image/i.exec(html);
        if (m) pic = m[1];
        else {
            m = /<span[^>]*class="hl-item-thumb[^"]*"[^>]*data-original="([^"]+)"/.exec(html);
            if (m) pic = m[1];
        }

        const grab = (re) => { const x = re.exec(html); return x ? x[1].trim() : ''; };
        const score = grab(/<span[^>]*class="[^"]*score[^"]*"[^>]*>(\d+\.?\d*)<\/span>/);
        const year = grab(/<em[^>]*>年份[：:]<\/em>\s*(\d{4})/);
        const area = grab(/<em[^>]*>地区[：:]<\/em>\s*([^<]+)/);
        let remarks = grab(/<em[^>]*>状态[：:]<\/em>\s*<span[^>]*>([^<]+)<\/span>/);
        if (!remarks) remarks = grab(/<em[^>]*>更新[：:]<\/em>\s*([^<]+)/);

        const director = extractInfoByLabel(html, '导演');
        const actor = extractInfoByLabel(html, '主演');
        const typeName = extractInfoByLabel(html, '类型');

        let content = '';
        m = /<em[^>]*class="hl-text-muted"[^>]*>简介[：:]<\/em>([\s\S]*?)<\/li>/.exec(html);
        if (m) {
            content = stripTags(m[1]);
            if (content.length > 500) content = content.substring(0, 500) + '...';
        }

        const pf = parsePlayList(html, vodId);
        return JSON.stringify({ list: [{
            vod_id: vodId, vod_name: title, vod_pic: pic,
            type_name: typeName, vod_year: year, vod_area: area,
            vod_remarks: remarks, vod_actor: actor, vod_director: director,
            vod_content: INTRO_PREFIX + content, vod_score: score,
            vod_play_from: pf[0], vod_play_url: pf[1]
        }] });
    } catch (e) {
        return JSON.stringify({ list: [{
            vod_id: vodId, vod_name: '解析异常', vod_pic: '',
            type_name: '', vod_year: '', vod_area: '', vod_remarks: '',
            vod_actor: '', vod_director: '', vod_content: String(e).slice(0, 200),
            vod_play_from: '默认线路', vod_play_url: '播放$' + vodId + '___0___0'
        }] });
    }
}

function play(flag, id, vipFlags) {
    const hdr = { 'User-Agent': UA, 'Referer': HOST + '/' };
    try {
        const parts = String(id).split('___');
        if (parts.length < 3) return JSON.stringify({ parse: 0, url: String(id), header: hdr });
        const vodId = parts[0], sid = parts[1], nid = parts[2];
        const playUrl = HOST + '/vplay/' + vodId + '-' + sid + '-' + nid + '.html';
        const html = fetchHtml(playUrl);

        const pj = extractPlayerData(html);
        if (pj && pj.url) {
            let realUrl = String(pj.url);
            const encrypt = parseInt(pj.encrypt, 10) || 0;
            if (encrypt === 1) {
                try { realUrl = decodeURIComponent(realUrl); } catch (e) {}
            } else if (encrypt === 2) {
                const km = /key\s*[:=]\s*["']([A-Za-z0-9]{16})["']/.exec(html);
                realUrl = aesEcbDecryptB64(realUrl, km ? km[1] : '28fd7d0f7dac4156');
            }
            return JSON.stringify({ parse: 0, playUrl: '', url: realUrl, header: hdr });
        }
        // 兜底: 页面直取媒体地址
        let m = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i.exec(html)
            || /(https?:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*)/i.exec(html)
            || /(https?:\/\/[^\s"'<>]+\.flv[^\s"'<>]*)/i.exec(html);
        if (m) return JSON.stringify({ parse: 0, url: m[1], header: hdr });
        return JSON.stringify({ parse: 1, url: playUrl, header: hdr });
    } catch (e) {
        return JSON.stringify({ parse: 1, url: String(id), header: hdr });
    }
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    try {
        const ek = encodeURIComponent(String(key));
        const url = page <= 1
            ? HOST + '/vodsearch/' + ek + '-------------.html'
            : HOST + '/vodsearch/' + ek + '------------' + page + '.html';
        return JSON.stringify({ list: parseListHtml(fetchHtml(url)) });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

export default { init, home, homeVod, category, detail, play, search };
