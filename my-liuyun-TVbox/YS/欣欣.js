// 欣欣影视 (原 XinJie.py) - TVBox QuickJS 版
// 全链路 AES-256-CBC 解密; host 密文解密后再经 app.json 解析真实站点
// 注意: TVBox req 的 timeout 单位是毫秒

// ==================== 基础编码 ====================
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
function utf8enc(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
        else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) {
            c = 0x10000 + ((c & 0x3FF) << 10) + (str.charCodeAt(++i) & 0x3FF);
            out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        } else out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
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
        else {
            const cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            const v = cp - 0x10000;
            out += String.fromCharCode(0xD800 + (v >> 10), 0xDC00 + (v & 1023));
        }
    }
    return out;
}

// ==================== AES (纯 JS, AES-256-CBC 解密) ====================
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
function aesInvSub(s) { for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
function aesInvShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c - r + 4) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesInvMix(s) {
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
function pkcs7unpad(bytes) {
    if (!bytes.length) return bytes;
    const n = bytes[bytes.length - 1];
    if (n < 1 || n > 16 || n > bytes.length) return bytes;
    return bytes.slice(0, bytes.length - n);
}
function aesDecBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, ek.Nr);
    for (let r = ek.Nr - 1; r >= 1; r--) { aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, r); aesInvMix(s); }
    aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, 0);
    return s;
}
function aesCbcDecBytes(key, iv, bytes) {
    const ek = aesKeyExp(key), out = [];
    let prev = iv.slice();
    for (let i = 0; i + 16 <= bytes.length; i += 16) {
        const block = bytes.slice(i, i + 16);
        const dec = aesDecBlock(ek, block);
        for (let j = 0; j < 16; j++) out.push(dec[j] ^ prev[j]);
        prev = block;
    }
    return pkcs7unpad(out);
}

// ==================== 配置 (全部内置) ====================
const HOST_ENC = "usv46c9uRCE/PugcvJY1Pc/BM6KQv8vKYzpgVFmTPv8wdb18jQRMx9ElUPtnlHCd";
const APP_KEY = "505cab36b1111416";
const APP_IV = "0e832063ac451b27";
const HOST_KEY = "Kkebx6vFqWMCNKwmaaeGOmnZBNzbQ1Bj";
const HOST_IV = "cBqqjFQUqBeAJ61z";
const PLAY_UA = "Dalvik/2.1.0 (Linux; U; Android 15; Xiaomi 15 Pro Build/AP2A.240905.003)";
const PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const UA = "okhttp/4.12.0";

let host = "";
let filtersCache = null;
let homeCache = null, homeTime = 0;
let jiexiSeen = false;

function pad32(s) { s = String(s || ""); while (s.length < 32) s += "0"; return s; }

function decryptPure(b64, key, iv) {
    return utf8dec(aesCbcDecBytes(utf8enc(pad32(key)), utf8enc(String(iv).slice(0, 16)), b64dec(b64)));
}

// 原生 aesX 优先, 失败或结果非法则回退纯 JS
function decryptData(b64) {
    const key = pad32(APP_KEY), iv = String(APP_IV).slice(0, 16);
    try {
        if (typeof aesX === "function") {
            const modes = ["AES/CBC/PKCS7Padding", "AES/CBC/PKCS5Padding", "AES/CBC/PKCS7", "AES/CBC/PKCS5", "CBC"];
            for (let i = 0; i < modes.length; i++) {
                try {
                    const r = aesX(modes[i], false, String(b64), true, key, iv, false);
                    if (r && typeof r === "string" && r.trim().charAt(0) === "{") {
                        JSON.parse(r);
                        return r;
                    }
                } catch (e) { }
            }
        }
    } catch (e) { }
    return decryptPure(b64, key, iv);
}

function isEncrypted(j) {
    const v = j && j.encrypted;
    return v === true || v === 1 || v === "1" || v === "true";
}
function unwrap(j) {
    if (!j) return {};
    if (!isEncrypted(j)) return j;
    return JSON.parse(decryptData(j.data));
}

async function ensureHost() {
    if (host) return true;
    let h = HOST_ENC;
    if (!/^https?:\/\//.test(h)) {
        try { h = decryptPure(h, HOST_KEY, HOST_IV); } catch (e) { return false; }
    }
    if (!/^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+)?\/?$/.test(h)) {
        try {
            const r = await req(h, {
                headers: { "User-Agent": "XinJieApp/1.0", "Accept-Encoding": "identity", "cache-control": "no-cache" },
                timeout: 15000
            });
            const o = JSON.parse((r && r.content) || "{}");
            if (o && o.server && o.server.url) h = o.server.url;
        } catch (e) { }
        // 兜底: 从 app.json 地址截取站点根
        if (!/^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+)?\/?$/.test(h)) {
            const m = String(h).match(/^(https?:\/\/[^\/]+)/);
            if (m) h = m[1];
        }
    }
    h = String(h || "").replace(/\/+$/, "");
    if (!/^https?:\/\//.test(h)) return false;
    host = h;
    return true;
}

async function apiGet(path, ua) {
    const r = await req(host + path, {
        headers: { "User-Agent": ua || UA, "Accept-Encoding": "identity", "Connection": "Keep-Alive" },
        timeout: 20000
    });
    const c = (r && r.content) || "";
    if (!c) return {};
    return JSON.parse(c);
}

function mapVideo(i) {
    return {
        vod_id: String(i.vod_id || ""),
        vod_name: i.vod_name || "",
        vod_pic: i.vod_pic || "",
        vod_remarks: i.vod_remarks || "",
        vod_year: i.vod_year || "",
        vod_content: i.vod_blurb || ""
    };
}

function cleanText(s) {
    return String(s || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function optList(list) {
    const out = [{ n: "全部", v: "" }], seen = {};
    for (let i = 0; i < (list || []).length; i++) {
        const v = list[i];
        if (!v || seen[v]) continue;
        seen[v] = 1;
        out.push({ n: v, v: v });
    }
    return out;
}

async function buildFilters(tid) {
    if (filtersCache) return filtersCache;
    try {
        const j = unwrap(await apiGet("/admin/duanjusy.php?limit=20&page=1&type_id=" + tid));
        const types = (j.filters && j.filters.types) || [];
        const map = {};
        for (let i = 0; i < types.length; i++) {
            const t = types[i];
            const arr = [];
            if (t.class && t.class.length) arr.push({ key: "class", name: "类型", value: optList(t.class) });
            if (t.area && t.area.length) arr.push({ key: "area", name: "地区", value: optList(t.area) });
            if (t.lang && t.lang.length) arr.push({ key: "lang", name: "语言", value: optList(t.lang) });
            if (t.year && t.year.length) arr.push({ key: "year", name: "年份", value: optList(t.year) });
            if (arr.length) map[String(t.type_id)] = arr;
        }
        if (Object.keys(map).length) filtersCache = map;
    } catch (e) { }
    return filtersCache || {};
}

async function init(ext) {
    // 所有参数已内置, 保留 ext 兼容但不依赖
    host = "";
    filtersCache = null;
    homeCache = null;
    homeTime = 0;
    jiexiSeen = false;
}

async function home(filter) {
    const out = { class: [], list: [], filters: {} };
    if (!(await ensureHost())) return JSON.stringify(out);
    try {
        const j = unwrap(await apiGet("/admin/duanjuc.php?page=1&limit=30"));
        const data = j.data || [];
        const classes = [], videos = [];
        for (let i = 0; i < data.length; i++) {
            const c = data[i];
            if (Number(c.type_id) !== 0) classes.push({ type_id: String(c.type_id), type_name: c.type_name || "" });
            const vids = c.videos || [];
            for (let k = 0; k < vids.length; k++) videos.push(mapVideo(vids[k]));
        }
        out.class = classes;
        out.list = videos;
        homeCache = out;
        homeTime = Date.now();
        if (classes.length) out.filters = await buildFilters(classes[0].type_id);
    } catch (e) { }
    return JSON.stringify(out);
}

async function homeVod() {
    if (homeCache && Date.now() - homeTime < 180000) return JSON.stringify({ list: homeCache.list, filters: homeCache.filters });
    const h = JSON.parse(await home(false));
    return JSON.stringify({ list: h.list || [], filters: h.filters || {} });
}

async function category(tid, pg, filter, extend) {
    const out = { list: [], pagecount: 0 };
    if (!(await ensureHost())) return JSON.stringify(out);
    try {
        let u = "/admin/duanjusy.php?limit=20&page=" + (pg || 1) + "&type_id=" + tid;
        if (extend) {
            const keys = ["class", "area", "lang", "year"];
            for (let i = 0; i < keys.length; i++) {
                const v = extend[keys[i]];
                if (v && v !== "全部") u += "&" + keys[i] + "=" + encodeURIComponent(v);
            }
        }
        const j = unwrap(await apiGet(u));
        const data = j.data || [];
        for (let i = 0; i < data.length; i++) out.list.push(mapVideo(data[i]));
        out.pagecount = (j.pagination && j.pagination.total_pages) || 1;
    } catch (e) { }
    return JSON.stringify(out);
}

async function search(key, quick, pg) {
    const out = { list: [], pagecount: 0 };
    if (!(await ensureHost())) return JSON.stringify(out);
    try {
        const u = "/admin/duanjusy.php?suggest=" + encodeURIComponent(key) + "&limit=20&page=" + (pg || 1);
        const j = unwrap(await apiGet(u));
        const data = j.data || [];
        for (let i = 0; i < data.length; i++) out.list.push(mapVideo(data[i]));
        out.pagecount = (j.pagination && j.pagination.total_pages) || 1;
    } catch (e) { }
    return JSON.stringify(out);
}

async function detail(ids) {
    const out = { list: [] };
    if (!(await ensureHost())) return JSON.stringify(out);
    try {
        const id = String(ids || "").split(",")[0];
        const j = unwrap(await apiGet("/admin/duanju.php?vod_id=" + encodeURIComponent(id)));
        const d = (j.data && (j.data.vod_id || j.data.play_sources)) ? j.data : j;
        if (!d || !d.vod_id) return JSON.stringify(out);
        if (/^https?:/i.test(String(d.jiexi || ""))) jiexiSeen = true;

        const from = [], urls = [];
        const sources = d.play_sources || [];
        for (let s = 0; s < sources.length; s++) {
            const src = sources[s];
            const key = String(src.source_key || "");
            from.push(String(src.name || "") + "\u2005(" + key + ")");
            const eps = String(src.url || "").split("#");
            const items = [];
            for (let e = 0; e < eps.length; e++) {
                const ep = eps[e];
                if (!ep) continue;
                const idx = ep.indexOf("$");
                let name, url;
                if (idx >= 0) { name = ep.substring(0, idx); url = ep.substring(idx + 1); }
                else { name = "第" + (e + 1) + "集"; url = ep; }
                url = url.replace(/#/g, "%23").replace(/\$/g, "%24");
                items.push(name + "$" + key + "@" + url);
            }
            if (items.length) urls.push(items.join("#"));
        }

        let content = cleanText(d.vod_content);
        if (content.length < 3) content = cleanText(d.vod_blurb);
        if (content.indexOf(PREFIX) !== 0) content = PREFIX + content;

        const v = {
            vod_id: String(d.vod_id),
            vod_name: d.vod_name || "",
            vod_pic: d.vod_pic || "",
            vod_remarks: d.vod_remarks || "",
            vod_year: d.vod_year || "",
            vod_area: d.vod_area || "",
            vod_actor: d.vod_actor || "",
            vod_director: d.vod_director || "",
            vod_content: content,
            type_name: d.vod_class || "",
            vod_play_from: from.join("$$$"),
            vod_play_url: urls.join("$$$")
        };
        out.list.push(v);
    } catch (e) { }
    return JSON.stringify(out);
}

async function play(flag, id, vipFlags) {
    let srcKey = "", raw = String(id || "");
    const at = raw.indexOf("@");
    if (at > 0) { srcKey = raw.substring(0, at); raw = raw.substring(at + 1); }
    let url = raw, ua = PLAY_UA;
    if (jiexiSeen && host && srcKey) {
        try {
            const r = await req(host + "/admin/jiexi.php?url=" + encodeURIComponent(raw) + "&source=" + encodeURIComponent(srcKey), {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept-Encoding": "identity", "Connection": "Keep-Alive"
                },
                timeout: 12000
            });
            const j = JSON.parse((r && r.content) || "{}");
            const d = unwrap(j);
            if (d && d.url && /^https?:/i.test(String(d.url))) url = d.url;
            if (j.UA) ua = j.UA; else if (j.ua) ua = j.ua;
        } catch (e) { }
    }
    // 直链返回 parse:0, 网页地址交 TVBox 嗅探解析
    const direct = /\.(m3u8|mp4|flv|mkv|avi|ts|mov|mpd|m4a|wmv)(\?.*)?$/i.test(url);
    return JSON.stringify({ jx: "0", parse: direct ? "0" : "1", url: url, header: { "User-Agent": ua } });
}

export default { init, home, homeVod, category, detail, play, search };
