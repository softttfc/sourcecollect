// ================== 影视·小鸡看看 · TVBox QuickJS ==================
// 源：小鸡看看 App(com.xmoebr.bdx v1.0.5) / TV版(com.kankan.tv)  https://xjggg.top/api.php/app
// 全接口强制五头签名(x-aid/x-ave/x-time/x-nonc/x-sign)，签名 = SHA256(finger&id&nonce&sk&time&v)
// 播放：http:// 播放令牌(加密) → /app/decode/url 换真直链；设备号池轮转抗每日解析配额
// =================================================================

const APP_ID = "com.kankan.tv";
const APP_VER = "105";
const SK = "SK-sk_13oXDZ7u9j2Tk1c0cawWVFfO";
const FINGER = "SF-F5F11CB15897115AE6BCFE063C288F730CA865588F572C780A3E8477D0DD3776";
const APP_UA = "okhttp/4.12.0";
const PLAY_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

// 主域名 + 逆出的备用端点
let HOSTS = [
    { host: "xjggg.top", port: 443 },
    { host: "50.118.186.185", port: 8090 },
    { host: "179.255.99.4", port: 8090 }
];
let goodHost = null;

const ENDPOINT_SOURCES = [
    "https://res.cloudinary.com/wygbngdd/raw/upload/1.txt",
    "https://anotepad.com/notes/wcqhmtf9"
];
const EP_AES_KEY = "3EoMYcMw9X1igBsCb7CLCTKGTqWv9OpAAJr2xGa3co0=";

// ---------------- 字节/编码工具 ----------------
function utf8enc(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) bytes.push(c);
        else if (c < 0x800) bytes.push((c >> 6) | 192, (c & 63) | 128);
        else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
            const c2 = str.charCodeAt(++i);
            c = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
            bytes.push((c >> 18) | 240, ((c >> 12) & 63) | 128, ((c >> 6) & 63) | 128, (c & 63) | 128);
        } else bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    }
    return bytes;
}
function utf8dec(bytes) {
    let out = "", i = 0;
    while (i < bytes.length) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xE0) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xF0) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        else {
            const c2 = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            let v = c2 - 0x10000;
            out += String.fromCharCode(0xD800 + ((v >> 10) & 0x3FF), 0xDC00 + (v & 0x3FF));
        }
    }
    return out;
}
function hexenc(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return s;
}
const B64CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64Bytes(s) {
    s = String(s || "");
    try { s = decodeURIComponent(s); } catch (e) { s = s.replace(/%3D/gi, "="); }
    s = s.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
    const pad = s.indexOf("=");
    if (pad >= 0) s = s.substring(0, pad);
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
        acc = (acc << 6) | B64CHARS.indexOf(s.charAt(i));
        bits += 6;
        if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
    }
    return out;
}

// ---------------- SHA-256（纯JS，大端长度） ----------------
const SHA256K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function rotr32(x, n) { return (x >>> n) | (x << (32 - n)); }
function sha256Bytes(bytes) {
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const lenLo = (bytes.length * 8) >>> 0;
    const lenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    const msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 3; i >= 0; i--) msg.push((lenHi >>> (8 * i)) & 255);
    for (let i = 3; i >= 0; i--) msg.push((lenLo >>> (8 * i)) & 255);
    const w = new Array(64);
    for (let off = 0; off < msg.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = ((msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3]) | 0;
        for (let i = 16; i < 64; i++) {
            const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + SHA256K[i] + w[i]) | 0;
            const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = [];
    const hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < hs.length; i++) {
        const u = hs[i] >>> 0;
        out.push((u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255);
    }
    return out;
}
function sha256Hex(str) { return hexenc(sha256Bytes(utf8enc(str))); }

// ---------------- AES（纯JS，仅加密块 + CTR，用于端点自愈） ----------------
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
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
function aesSub(s) { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function aesShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c + r) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesMix(s) {
    for (let c = 0; c < 4; c++) {
        const a = [s[4 * c], s[1 + 4 * c], s[2 + 4 * c], s[3 + 4 * c]];
        s[4 * c] = xtime(a[0]) ^ (xtime(a[1]) ^ a[1]) ^ a[2] ^ a[3];
        s[1 + 4 * c] = a[0] ^ xtime(a[1]) ^ (xtime(a[2]) ^ a[2]) ^ a[3];
        s[2 + 4 * c] = a[0] ^ a[1] ^ xtime(a[2]) ^ (xtime(a[3]) ^ a[3]);
        s[3 + 4 * c] = (xtime(a[0]) ^ a[0]) ^ a[1] ^ a[2] ^ xtime(a[3]);
    }
}
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.Nr; r++) { aesSub(s); aesShift(s); aesMix(s); aesAddRK(s, ek.w, r); }
    aesSub(s); aesShift(s); aesAddRK(s, ek.w, ek.Nr);
    return s;
}
function aesCtrDecrypt(key, nonce, data) {
    const ek = aesKeyExp(key);
    const ctr = nonce.slice();
    ctr.push(0, 0, 0, 2);
    const out = [];
    for (let off = 0; off < data.length; off += 16) {
        const ks = aesEncBlock(ek, ctr);
        const chunk = data.slice(off, off + 16);
        for (let i = 0; i < chunk.length; i++) out.push(chunk[i] ^ ks[i]);
        for (let i = 15; i >= 0; i--) { ctr[i] = (ctr[i] + 1) & 255; if (ctr[i]) break; }
    }
    return out;
}

// ---------------- 设备号池（轮转 + 429 换号） ----------------
const POOL_SIZE = 12;
let DEV_POOL = [];
let DEV_BAD = {};
let DEV_IDX = 0;
let DEV_DAY = "";

function genUuid() {
    const h = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
        else if (i === 14) s += "4";
        else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
        else s += h[Math.floor(Math.random() * 16)];
    }
    return "uuid-" + s;
}
function devNewDay() {
    const d = new Date();
    const day = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    if (day !== DEV_DAY) { DEV_DAY = day; DEV_BAD = {}; }
}
function devFill() {
    while (DEV_POOL.length < POOL_SIZE) {
        const n = genUuid();
        if (DEV_BAD[n] || DEV_POOL.indexOf(n) >= 0) continue;
        DEV_POOL.push(n);
    }
}
function devGet() {
    devNewDay();
    devFill();
    DEV_IDX = (DEV_IDX + 1) % DEV_POOL.length;
    return DEV_POOL[DEV_IDX];
}
function devFail(dev) {
    devNewDay();
    if (dev) {
        DEV_BAD[dev] = DEV_DAY;
        const i = DEV_POOL.indexOf(dev);
        if (i >= 0) DEV_POOL.splice(i, 1);
    }
    devFill();
    return DEV_POOL[0];
}
function devOk(dev) {
    if (dev && DEV_POOL.indexOf(dev) < 0 && !DEV_BAD[dev]) DEV_POOL.push(dev);
}

function sigHeaders(dev) {
    const ts = Date.now();
    let nonce = sha256Hex(dev).substring(0, 8);
    for (let i = 0; i < 8; i++) nonce += String(Math.floor(Math.random() * 10));
    const raw = "finger=" + FINGER + "&id=" + APP_ID + "&nonce=" + nonce + "&sk=" + SK + "&time=" + ts + "&v=" + APP_VER;
    return {
        "x-aid": APP_ID,
        "x-ave": APP_VER,
        "x-time": String(ts),
        "x-nonc": nonce,
        "x-sign": sha256Hex(raw).toUpperCase(),
        "x-device-id": dev,
        "x-device-brand": "Xiaomi",
        "x-device-model": "M2012K11AC",
        "x-client-type": "tv",
        "x-update-id": "embedded",
        "Accept": "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": APP_UA
    };
}

function buildQuery(params) {
    if (!params) return "";
    const parts = [];
    for (const k in params) {
        if (!params.hasOwnProperty(k)) continue;
        const v = params[k];
        if (v === undefined || v === null || v === "") continue;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
    }
    return parts.length ? "?" + parts.join("&") : "";
}

function apiOnce(h, path, qs, dev) {
    const url = "https://" + h.host + ":" + h.port + path + qs;
    let res = null;
    try {
        res = req(url, { method: "GET", headers: sigHeaders(dev), timeout: 15000 });
    } catch (e) {
        return { err: String(e && e.message ? e.message : e) };
    }
    if (!res || res.code !== 200) return { err: "http " + (res && res.code) };
    let txt = String(res.content || "").replace(/^\uFEFF/, "").trim();
    if (txt.charAt(0) !== "{" && txt.charAt(0) !== "[") return { err: "bad body" };
    let obj = null;
    try { obj = JSON.parse(txt); } catch (e) { return { err: "bad json" }; }
    return { obj: obj };
}

function api(path, params, okCodes) {
    okCodes = okCodes || [200];
    const qs = buildQuery(params);
    let last = "";
    let rotations = 0;
    let netFail = false;
    for (let pass = 0; pass < 2; pass++) {
        const order = goodHost
            ? [goodHost].concat(HOSTS.filter(function (x) { return x.host !== goodHost.host; }))
            : HOSTS.slice();
        for (let i = 0; i < order.length; i++) {
            const h = order[i];
            let dev = devGet();
            for (let att = 0; att < 2; att++) {
                const r = apiOnce(h, path, qs, dev);
                if (r.err) { last = r.err; netFail = true; continue; }
                const obj = r.obj;
                const code = obj.code;
                if (okCodes.indexOf(code) < 0) {
                    if (code === 429 || obj.error_code === 42901) {
                        rotations++;
                        dev = devFail(dev);
                        if (rotations > 20) return null;
                        continue;
                    }
                    // 业务错误（如 401 / 未知线路）：换端点也无效，直接返回
                    console.log("[小鸡]", path, "业务失败:", obj.msg || code);
                    return null;
                }
                goodHost = h;
                devOk(dev);
                return obj.data;
            }
        }
        // 仅在网络层全挂时才做端点自愈
        if (pass === 0 && netFail) {
            const found = refreshHosts();
            if (found && found.length) HOSTS = found;
        }
    }
    if (last) console.log("[小鸡]", path, "失败:", last);
    return null;
}

// ---------------- 端点自愈 ----------------
function parseHostPort(u) {
    const m = String(u || "").match(/^https?:\/\/([^\/:]+)(?::(\d+))?/);
    if (!m) return null;
    return { host: m[1], port: m[2] ? parseInt(m[2], 10) : 443 };
}

function refreshHosts() {
    for (let s = 0; s < ENDPOINT_SOURCES.length; s++) {
        const src = ENDPOINT_SOURCES[s];
        try {
            const res = req(src, { method: "GET", headers: { "User-Agent": PLAY_UA }, timeout: 12000 });
            if (!res || res.code !== 200) continue;
            const txt = String(res.content || "");
            const m = txt.match(/TVAPP_CONFIG_V1_BEGIN([\s\S]*?)TVAPP_CONFIG_V1_END/);
            if (!m) continue;
            const raw = b64Bytes(m[1]);
            if (raw.length < 96 || raw[0] !== 1) continue;
            const plain = aesCtrDecrypt(b64Bytes(EP_AES_KEY), raw.slice(3, 15), raw.slice(15));
            let bodyBytes = plain.slice(64);
            if (bodyBytes.length > 16) bodyBytes = bodyBytes.slice(0, bodyBytes.length - 16);
            const obj = JSON.parse(utf8dec(bodyBytes));
            const found = [];
            const urls = obj.a || [];
            for (let i = 0; i < urls.length; i++) {
                const hp = parseHostPort(urls[i]);
                if (hp) found.push(hp);
            }
            if (found.length) {
                console.log("[小鸡] 端点自愈:", JSON.stringify(found));
                return found;
            }
        } catch (e) {
            console.log("[小鸡] 自愈失败:", src, String(e && e.message ? e.message : e));
        }
    }
    return [];
}

// ---------------- 分类/筛选 ----------------
const CATS = [
    { id: "c_movie", name: "🎬电影", tname: "电影" },
    { id: "c_tv", name: "📺剧集", tname: "剧集" },
    { id: "c_anime", name: "🌸动漫", tname: "动漫" },
    { id: "c_show", name: "🎤综艺", tname: "综艺" }
];
const RANK_TID = "c_rank";
const YEAR_ALL = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018",
    "2017", "2016", "2015", "2010", "2005", "2000"];

const FILTER_DEF = {
    "电影": {
        class: ["动作", "喜剧", "爱情", "科幻", "恐怖", "悬疑", "剧情", "战争", "犯罪",
            "动画", "奇幻", "冒险", "灾难", "纪录片", "历史", "武侠", "青春", "家庭",
            "古装", "运动"],
        area: ["中国大陆", "美国", "韩国", "日本", "英国", "法国", "中国香港", "中国台湾",
            "泰国", "印度", "俄罗斯", "加拿大", "澳大利亚", "德国", "西班牙", "意大利"],
        year: YEAR_ALL.concat(["1995", "1990"])
    },
    "剧集": {
        class: ["国产剧", "欧美剧", "美剧", "英剧", "日韩剧", "韩剧", "日剧", "港台剧",
            "香港剧", "台湾剧", "电视剧", "古装", "悬疑", "都市", "爱情", "犯罪",
            "战争", "奇幻", "喜剧"],
        area: ["中国大陆", "美国", "韩国", "日本", "英国", "中国香港", "中国台湾", "泰国",
            "法国", "加拿大"],
        year: YEAR_ALL
    },
    "动漫": {
        class: ["日本动漫", "国产动漫", "欧美动漫", "国创（B站）", "动画", "热血", "奇幻",
            "冒险", "恋爱", "搞笑", "科幻", "儿童", "亲子", "魔幻", "悬疑", "武侠",
            "古装", "真人"],
        area: ["日本", "中国大陆", "美国", "英国", "韩国", "加拿大", "法国"],
        year: YEAR_ALL
    },
    "综艺": {
        class: ["大陆综艺", "日韩综艺", "欧美综艺", "港台综艺", "真人秀", "脱口秀", "选秀",
            "音乐", "竞技", "晚会", "明星", "情感", "搞笑", "文化", "戏曲"],
        area: ["中国大陆", "韩国", "日本", "美国", "英国", "中国香港", "中国台湾", "泰国"],
        year: ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018",
            "2017", "2016", "2015", "2010"]
    }
};

const SORTS = [
    { n: "默认", v: "" },
    { n: "最热", v: "hot" },
    { n: "评分", v: "score" },
    { n: "最新", v: "time" }
];

// 显示名 → 真实 vodFrom（decode 只认真实 from）
const FRM_ALIAS = {
    "ZJ4K": "zijianm3u8", "BB蓝光": "BBA", "QS蓝光": "qsvip",
    "ZY蓝光": "zy1080_01", "JD4K": "JD4K", "TM蓝光": "tmdb", "NBY": "NBY"
};
const TOK_FRM = { zijian: "zijianm3u8", qqqq: "BBA", qsvip: "qsvip", JD: "JD4K", tmdb: "tmdb", NBY: "NBY" };

function valueList(arr) {
    const out = [{ n: "全部", v: "" }];
    for (let i = 0; i < arr.length; i++) out.push({ n: arr[i], v: arr[i] });
    return out;
}

function buildFilters() {
    const out = {};
    for (let i = 0; i < CATS.length; i++) {
        const def = FILTER_DEF[CATS[i].tname] || {};
        const arr = [];
        if (def.class && def.class.length) arr.push({ key: "class", name: "类型", value: valueList(def.class) });
        if (def.area && def.area.length) arr.push({ key: "area", name: "地区", value: valueList(def.area) });
        if (def.year && def.year.length) arr.push({ key: "year", name: "年份", value: valueList(def.year) });
        arr.push({ key: "sort", name: "排序", value: SORTS });
        out[CATS[i].id] = arr;
    }
    return out;
}

// ---------------- 工具 --------------
function s(v, dft) {
    if (dft === undefined) dft = "";
    if (v === undefined || v === null) return dft;
    if (Array.isArray(v)) {
        const parts = [];
        for (let i = 0; i < v.length; i++) if (v[i]) parts.push(String(v[i]));
        return parts.join(",");
    }
    return String(v);
}
function isUrl(u) {
    return !!u && u.length > 10 && u.indexOf("://") > 0;
}
function picOf(v) {
    if (isUrl(v.vod_pic)) return v.vod_pic;
    if (isUrl(v.vod_douban_pic)) return v.vod_douban_pic;
    return "";
}
function cleanName(t) {
    return String(t || "").replace(/#/g, "%23").replace(/\$/g, "%24");
}
function vodOf(v) {
    return {
        vod_id: String(v.vod_id),
        vod_name: s(v.vod_name),
        vod_pic: picOf(v),
        vod_remarks: s(v.vod_remarks),
        vod_year: s(v.vod_year),
        vod_area: s(v.vod_area),
        vod_class: s(v.vod_class),
        vod_actor: s(v.vod_actor),
        vod_director: s(v.vod_director),
        vod_content: withPrefix(s(v.vod_content)),
        type_name: s(v.type_name)
    };
}

// 分集缓存：vid → 集序 → [[from, token]]，播放失败时跨线路兜底
let epsCache = {};
let epsCacheOrder = [];

function cachePut(vid, rec) {
    epsCache[vid] = rec;
    if (epsCacheOrder.indexOf(vid) < 0) epsCacheOrder.push(vid);
    while (epsCacheOrder.length > 8) {
        const old = epsCacheOrder.shift();
        delete epsCache[old];
    }
}

// ---------------- 接口 --------------
function init(ext) {
    devNewDay();
    devFill();
    console.log("小鸡看看 初始化完成，设备池:", DEV_POOL.length);
}

function home(filter) {
    const result = {
        class: CATS.map(function (c) { return { type_id: c.id, type_name: c.name }; })
            .concat([{ type_id: RANK_TID, type_name: "🔥排行榜" }]),
        filters: buildFilters(),
        list: []
    };
    const data = api("/api.php/app/index/home");
    if (data) {
        const seen = {};
        const rec = data.recommend || [];
        const cats = data.categories || [];
        for (let i = 0; i < rec.length; i++) {
            const vid = String(rec[i].vod_id);
            if (seen[vid]) continue;
            seen[vid] = true;
            result.list.push(vodOf(rec[i]));
        }
        for (let i = 0; i < cats.length; i++) {
            const videos = cats[i].videos || [];
            for (let j = 0; j < videos.length; j++) {
                const vid = String(videos[j].vod_id);
                if (seen[vid]) continue;
                seen[vid] = true;
                result.list.push(vodOf(videos[j]));
            }
        }
    }
    return JSON.stringify(result);
}

function homeVod() {
    const h = JSON.parse(home(false));
    return JSON.stringify({ list: h.list || [] });
}

function rankList() {
    const out = [];
    const data = api("/api.php/app/ranking/list");
    if (data && data.rankings) {
        for (let i = 0; i < data.rankings.length; i++) {
            const rk = data.rankings[i];
            const tname = s(rk.type_name);
            const videos = rk.videos || [];
            for (let j = 0; j < videos.length; j++) {
                const item = vodOf(videos[j]);
                if (tname && !item.vod_remarks) item.vod_remarks = tname;
                out.push(item);
            }
        }
    }
    return out;
}

function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1, 10) || 1;
    extend = extend || {};
    if (tid === RANK_TID || String(tid).indexOf("c_rank") === 0) {
        if (pg > 1) return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 30, total: 0 });
        const list = rankList();
        return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: 30, total: list.length });
    }

    let tname = "";
    for (let i = 0; i < CATS.length; i++) if (CATS[i].id === tid) { tname = CATS[i].tname; break; }
    if (!tname) tname = s(tid);

    const params = { type_name: tname, page: pg, limit: 30 };
    const c = s(extend.class).trim();
    const a = s(extend.area).trim();
    const y = s(extend.year).trim();
    const so = s(extend.sort).trim();
    if (c) params.class = c;
    if (a) params.area = a;
    if (y) params.year = y;
    if (so) params.sort = so;

    const data = api("/api.php/app/filter/vod", params);
    if (data && Array.isArray(data)) {
        const list = data.map(vodOf);
        let pagecount = Math.floor(1000 / 30);
        if (list.length < 30) pagecount = pg;
        return JSON.stringify({ list: list, page: pg, pagecount: Math.max(1, pagecount), limit: 30, total: list.length });
    }
    return JSON.stringify({ list: [], page: pg, pagecount: pg, limit: 30, total: 0 });
}

function search(wd, quick, pg) {
    pg = parseInt(pg || 1, 10) || 1;
    const data = api("/api.php/app/search/index", { wd: wd, page: pg, limit: 30 });
    const list = data && Array.isArray(data) ? data.map(vodOf) : [];
    return JSON.stringify({ list: list, page: pg, pagecount: list.length >= 30 ? 999 : pg, limit: 30 });
}

function playbackAll(vid) {
    const data = api("/api.php/app/vod/playback_v2", { vod_id: vid });
    const out = {};
    if (!data || !data.sources) return out;
    for (let i = 0; i < data.sources.length; i++) {
        const src = data.sources[i];
        if (src.from && src.episodes && src.episodes.length) out[src.from] = src;
    }
    return out;
}

function detail(id) {
    const vid = String(Array.isArray(id) ? id[0] : id);
    const data = api("/api.php/app/vod/detail_v2", { vod_id: vid });
    if (!data) return JSON.stringify({ list: [] });

    const det = data.detail || {};
    const pb = data.playback || {};
    const vod = vodOf(det);
    vod.vod_id = vid;

    const names = {};
    const srcs = pb.sources || [];
    const selFrom = pb.selected_from || pb.selected_source && pb.selected_source.from || "";
    for (let i = 0; i < srcs.length; i++) {
        const f = srcs[i].from;
        names[f] = s(srcs[i].display_name) || f;
    }

    const got = playbackAll(vid);
    for (const f in got) if (!names[f]) names[f] = s(got[f].display_name) || f;

    const order = [];
    if (selFrom) order.push(selFrom);
    for (let i = 0; i < srcs.length; i++) {
        const f = srcs[i].from;
        if (!f || order.indexOf(f) >= 0) continue;
        if ((srcs[i].episode_count || 0) <= 0 && !(srcs[i].episodes || []).length) continue;
        order.push(f);
    }
    for (const f in got) if (order.indexOf(f) < 0) order.push(f);

    // 线路排序：qsvip（shenhua7）已知易 403，压到末尾并标注
    const lines = [];
    const normal = [], bad = [];
    for (let i = 0; i < order.length; i++) {
        const f = order[i];
        const src = got[f];
        const eps = src && src.episodes ? src.episodes : [];
        if (!eps.length) continue;
        const nm = names[f] || f;
        const rec = { name: nm, from: f, eps: eps };
        if (f === "qsvip") bad.push(rec); else normal.push(rec);
    }
    for (let i = 0; i < normal.length; i++) lines.push(normal[i]);
    for (let i = 0; i < bad.length; i++) {
        bad[i].name = bad[i].name + "(可能失效)";
        lines.push(bad[i]);
    }

    const froms = [];
    const urls = [];
    const recCache = {};
    for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const cells = [];
        for (let j = 0; j < ln.eps.length; j++) {
            const e = ln.eps[j];
            const title = cleanName(s(e.title) || ("第" + (j + 1) + "集"));
            const tok = s(e.url);
            if (!tok) continue;
            cells.push(title + "$" + tok + "@@" + ln.from);
            if (!recCache[j]) recCache[j] = [];
            recCache[j].push([ln.from, tok]);
        }
        if (cells.length) {
            froms.push(ln.name || ln.from);
            urls.push(cells.join("#"));
        }
    }
    if (froms.length) {
        vod.vod_play_from = froms.join("$$$");
        vod.vod_play_url = urls.join("$$$");
    }
    cachePut(vid, recCache);
    return JSON.stringify({ list: [vod] });
}

function frmFromToken(tok) {
    const p = String(tok || "").split("-")[0];
    if (p && p.length <= 14) return TOK_FRM[p] || "";
    return "";
}

function decode(tok, frm, retry) {
    retry = retry || 0;
    const data = api("/api.php/app/decode/url/",
        { url: tok, vodFrom: frm, _t: Date.now() }, [1, 200]);
    if (typeof data === "string" && isUrl(data)) return data;
    if (retry < 2) return decode(tok, frm, retry + 1);
    return "";
}

function altEpisode(tok) {
    for (let i = 0; i < epsCacheOrder.length; i++) {
        const vid = epsCacheOrder[i];
        const rec = epsCache[vid];
        if (!rec) continue;
        for (const pos in rec) {
            const toks = rec[pos];
            let hit = null;
            for (let j = 0; j < toks.length; j++) if (toks[j][1] === tok) hit = toks[j][0];
            if (!hit) continue;
            for (let j = 0; j < toks.length; j++) {
                if (toks[j][0] === hit) continue;
                const u = decode(toks[j][1], toks[j][0]);
                if (u) {
                    console.log("[小鸡] 兜底换线路", hit, "->", toks[j][0]);
                    return u;
                }
            }
            return "";
        }
    }
    return "";
}

function play(flag, id, flags) {
    let tok = s(id);
    let frm = "";
    const at = tok.lastIndexOf("@@");
    if (at >= 0) { frm = tok.substring(at + 2); tok = tok.substring(0, at); }
    tok = tok.trim();

    const cands = [];
    if (frm) cands.push(FRM_ALIAS[frm] || frm);
    const byTok = frmFromToken(tok);
    if (byTok) cands.push(byTok);
    const fl = s(flag);
    if (fl) cands.push(FRM_ALIAS[fl] || fl);
    cands.push("");

    let url = "";
    const seen = {};
    for (let i = 0; i < cands.length; i++) {
        const f = cands[i];
        if (seen[f]) continue;
        seen[f] = true;
        url = decode(tok, f);
        if (url) break;
    }

    if (!url) {
        const alt = altEpisode(tok);
        if (alt) {
            const header = { "User-Agent": PLAY_UA };
            if (alt.indexOf("shenhua7.vip") >= 0) header["Referer"] = "https://www.shenhua7.vip/";
            return JSON.stringify({ parse: 0, url: alt, header: header });
        }
        return JSON.stringify({ parse: 1, url: tok, header: { "User-Agent": PLAY_UA } });
    }

    const header = { "User-Agent": PLAY_UA };
    if (url.indexOf("shenhua7.vip") >= 0) header["Referer"] = "https://www.shenhua7.vip/";
    return JSON.stringify({ parse: 0, url: url, header: header });
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    search: search,
    detail: detail,
    play: play
};
