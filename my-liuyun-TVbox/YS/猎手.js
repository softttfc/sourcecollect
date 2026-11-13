 // 电影猎手  - QuickJS（琉芸JS版）
// 签名: RSA-2048(JSON参数)->pack + HMAC-MD5(pack)->signature
// 首页配置: AES-128-CBC 解密; host 从 domain_v5.json 动态获取
// MD5 使用硬编码常量表(Math.sin 在不同 QuickJS 版本结果不一致)

// ==================== 基础编码 ====================
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64enc(bytes) {
    let out = "", i = 0;
    for (; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63] + B64C[(n >> 6) & 63] + B64C[n & 63];
    }
    if (i < bytes.length) {
        const n = (bytes[i] << 16) | (i + 1 < bytes.length ? bytes[i + 1] << 8 : 0);
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64C[(n >> 6) & 63] : "=";
        out += "=";
    }
    return out;
}
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
            c = 0x10000 + ((c & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
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
        else { i += 3; out += ""; }
    }
    return out;
}

// ==================== AES ====================
const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const INV_SBOX = [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];
function xtime(x) { x <<= 1; return x & 256 ? (x ^ 0x11b) & 255 : x; }
function aesKeyExp(key) {
    const Nk = key.length / 4, Nr = Nk + 6, w = [];
    for (let i = 0; i < Nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % Nk === 0) {
            t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
            t[0] ^= RCON[i / Nk];
        } else if (Nk > 6 && i % Nk === 4) {
            t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
        }
        w.push([w[i - Nk][0] ^ t[0], w[i - Nk][1] ^ t[1], w[i - Nk][2] ^ t[2], w[i - Nk][3] ^ t[3]]);
    }
    return { w: w, Nr: Nr };
}
function aesAddRK(s, w, r) { for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) s[i + 4 * c] ^= w[4 * r + c][i]; }
function aesSub(s) { for (let i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
function aesInvSub(s) { for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
function aesShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c + r) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
    }
}
function aesInvShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c - r + 4) % 4)]);
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
function aesCbcDec(key, iv, bytes) {
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

// ==================== MD5 (硬编码常量) ====================
const MD5_K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
const MD5_S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
function md5bytes(bytes) {
    const data = bytes.slice();
    const bitLen = bytes.length * 8;
    data.push(0x80);
    while (data.length % 64 !== 56) data.push(0);
    const lo = bitLen >>> 0, hi = Math.floor(bitLen / 0x100000000);
    for (let i = 0; i < 4; i++) data.push((lo >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i++) data.push((hi >>> (8 * i)) & 255);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let off = 0; off < data.length; off += 64) {
        const M = [];
        for (let i = 0; i < 16; i++) M.push((data[off + 4 * i] | (data[off + 4 * i + 1] << 8) | (data[off + 4 * i + 2] << 16) | (data[off + 4 * i + 3] << 24)) >>> 0);
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * i) % 16; }
            const tmp = D; D = C; C = B;
            const sum = (A + F + MD5_K[i] + M[g]) >>> 0;
            const s = MD5_S[i];
            const rot = ((sum << s) | (sum >>> (32 - s))) >>> 0;
            B = (B + rot) >>> 0; A = tmp;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = [];
    for (const x of [a0, b0, c0, d0]) out.push(x & 255, (x >>> 8) & 255, (x >>> 16) & 255, (x >>> 24) & 255);
    return out;
}
function hexOf(bytes) { let s = ""; for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16); return s; }
function hmacMd5Hex(keyStr, msgStr) {
    let key = utf8enc(keyStr);
    if (key.length > 64) key = md5bytes(key);
    while (key.length < 64) key.push(0);
    const ipad = key.map(b => b ^ 0x36), opad = key.map(b => b ^ 0x5c);
    return hexOf(md5bytes(opad.concat(md5bytes(ipad.concat(utf8enc(msgStr))))));
}

// ==================== RSA (BigInt modpow, PKCS1 v1.5, 2048) ====================
const RSA_N = BigInt("0xd3617f90f839036357e2a6792529ecf9b8e154c082e896d38932a96e036089753e2a4a2b83a0e3efa812ebc801f259616d42825e321dca09c73ebc551d67f39b38acabd3fd6b09970640a4ef84a4825c762ca1dafe6373f62be0e98cd0e69405504592d037e898605756daaf065397302471a7af6859a32c9df8e7055fb427bbc76d7cd4224a812dd5d235f33d020e6a7510eb242dc2a81eb9109dc04565736534dc5d274c5bd8b7ab31193dac0f34f7b9c8f61b3192285cb72baaf1199d12b5a1a93aeff8a17fb8b03c9a9d73eebc65812699dab0ba73af45d8eaf3d7d03157a59aa7110fd4587b4f2ffb10f11bd0a8f73ee1717193b14aae331921dbdb8d6b");
function rsaEncrypt(msgBytes) {
    const k = 256;
    const ps = [];
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    let m = 0n;
    const em = [0, 2].concat(ps).concat([0]).concat(msgBytes);
    for (const b of em) m = (m << 8n) | BigInt(b);
    let r = 1n, base = m % RSA_N, e = 65537n;
    while (e > 0n) { if (e & 1n) r = r * base % RSA_N; base = base * base % RSA_N; e >>= 1n; }
    let hex = r.toString(16);
    while (hex.length < 512) hex = "0" + hex;
    const out = [];
    for (let i = 0; i < 512; i += 2) out.push(parseInt(hex.substring(i, i + 2), 16));
    return out;
}

// ==================== 电影猎手业务 ====================
const DOMAIN_CFG = "https://app-site.ecoliving168.com/domain_v5.json";
const HMAC_KEY = "635a580fcb5dc6e60caa39c31a7bde48";
const CFG_AES_KEY = utf8enc("e6d5de5fcc51f53d");
const CFG_AES_IV = utf8enc("2f13eef7dfc6c613");
const INTRO_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const TIMEOUT = 20000;
// 与原版一致: 爬虫生命周期内固定的秒级时间戳
const T = String(Math.floor(Date.now() / 1000));

let _host = "";
let _device = "";

function rndDevice() {
    const c = "abcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < 32; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
}

function header() {
    return {
        "User-Agent": "Android",
        "Accept": "application/prs.55App.v2+json",
        "timestamp": T,
        "x-client-setting": '{"pure-mode":1}',
        "x-client-uuid": '{"device_id":' + _device + '}, "type":1,"brand":"Redmi", "model":"M2012K10C", "system_version":30, "sdk_version":"3.1.0.7"}',
        "x-client-version": "3096 "
    };
}

// 参数签名: RSA(JSON+timestamp) -> urlsafe pack; HMAC-MD5(pack) -> signature
function signParams(body) {
    const id = body || {};
    id.timestamp = T;
    const enc = rsaEncrypt(utf8enc(JSON.stringify(id)));
    const pack = b64enc(enc).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const sign = hmacMd5Hex(HMAC_KEY, pack);
    return [pack, sign];
}

function apiGet(path, body) {
    const bba = signParams(body);
    const url = _host + path + "?pack=" + bba[0] + "&signature=" + bba[1];
    try {
        const r = req(url, { headers: header(), timeout: TIMEOUT });
        return (r && r.content) || "";
    } catch (e) { return ""; }
}

function apiJson(path, body) {
    const txt = apiGet(path, body);
    try { return JSON.parse(txt); } catch (e) { return {}; }
}

// 首页配置解密: base64url -> AES-128-CBC -> JSON
function aesConfig(text) {
    try {
        const b64 = String(text).replace(/-/g, "+").replace(/_/g, "/") + "==";
        const pt = aesCbcDec(CFG_AES_KEY, CFG_AES_IV, b64dec(b64));
        return JSON.parse(utf8dec(pt));
    } catch (e) { return {}; }
}

function voides(item) {
    const name = item.name || item.title;
    if (!name) return null;
    return {
        vod_id: String(item.id || item.click || ""),
        vod_name: name,
        vod_pic: item.cover || item.image || "",
        vod_year: String(item.year || item.label || ""),
        vod_remarks: item["dynamic"] || item.sub_title || ""
    };
}

function playeach(data) {
    const urls = [];
    for (const it of data || []) {
        const pu = String(it.play_url || "");
        if (/mp4|m3u8/.test(pu)) urls.push((it.episode_name || "播放") + "$" + pu);
        else urls.push((it.episode_name || "播放") + "$" + (it.from_code || "") + "|||" + pu + "|||" + (it.episode_id || ""));
    }
    return urls.join("#");
}

function playlist(body) {
    try {
        const data = apiJson("/api/v1/movie_addr/list", body).data;
        return playeach(data);
    } catch (e) { return ""; }
}

// ==================== TVBox 接口 ====================
function init(ext) {
    _device = rndDevice();
    let host = "";
    try {
        if (ext && typeof ext === "object" && ext.host) host = String(ext.host);
        else if (typeof ext === "string" && ext.trim()) {
            const s = ext.trim();
            if (s.charAt(0) === "{") { const j = JSON.parse(s); if (j.host) host = String(j.host); }
            else if (s.indexOf("http") === 0) host = s;
        }
    } catch (e) {}
    if (!host) {
        try {
            const r = req(DOMAIN_CFG, { headers: { "User-Agent": "okhttp/4.9.2", "Connection": "Keep-Alive" }, timeout: 15000 });
            const obj = JSON.parse((r && r.content) || "{}");
            host = String(obj.api_service || "").replace("/api/", "");
        } catch (e) {}
    }
    _host = host.replace(/\/+$/, "");
}

function home(filter) {
    const data1 = aesConfig(apiGet("/api/v1/app/config", {}));
    const dy = { "class": "类型", area: "地区", lang: "语言", year: "年份", letter: "字母", by: "排序", sort: "排序" };
    const classes = [], filters = {};
    const screen = (data1.data && data1.data.movie_screen) || {};
    const sortArr = (screen.sort || []).slice(1).map(it => ({ n: it.name, v: it.value }));
    for (const item of screen.filter || []) {
        classes.push({ type_name: item.name, type_id: String(item.id) });
        let hasNonEmpty = false;
        for (const key in dy) { if (item[key] && item[key].length) { hasNonEmpty = true; break; } }
        if (hasNonEmpty) {
            const fl = [{ key: "sort", name: "排序", value: sortArr }];
            for (const dkey in item) {
                if (dkey in dy && Array.isArray(item[dkey]) && item[dkey].length) {
                    const vals = item[dkey].slice(1).map(v => String(v).trim()).filter(v => v !== "");
                    if (vals.length) fl.push({ key: dkey, name: dy[dkey], value: vals.map(v => ({ n: v, v: v })) });
                }
            }
            filters[String(item.id)] = fl;
        }
    }
    return JSON.stringify({ "class": classes, filters: filters });
}

function homeVod() {
    const obj = apiJson("/api/v1/movie/index_recommend", {});
    const videos = [];
    for (const item of obj.data || []) {
        for (const it of item.list || []) {
            const v = voides(it);
            if (v) videos.push(v);
        }
    }
    return JSON.stringify({ list: videos });
}

function category(tid, pg, filter, extend) {
    let ex = {};
    try {
        if (extend && typeof extend === "object") ex = extend;
        else if (typeof extend === "string" && extend) ex = JSON.parse(extend);
    } catch (e) { ex = {}; }
    const body = {
        type_id: String(tid), sort: ex.sort || "by_default",
        "class": ex["class"] || "类型", area: ex.area || "地区", year: ex.year || "年份",
        page: String(pg), pageSize: "21"
    };
    const data = apiJson("/api/v1/movie/screen/list", body).data || {};
    const list = [];
    for (const item of data.list || []) {
        const v = voides(item);
        if (v) list.push(v);
    }
    return JSON.stringify({ list: list, page: parseInt(pg, 10) || 1, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const vid = String(Array.isArray(ids) ? ids[0] : ids);
    const data = apiJson("/api/v1/movie/detail", { id: vid }).data;
    if (!data) return JSON.stringify({ list: [] });
    // 按原始顺序保持 线路名<->剧集 对齐 (原版线程池实现会错位, 已修正)
    const names = [], plays = [];
    for (const itt of data.play_from || []) {
        const name = itt.name || "线路";
        let ps = "";
        if (itt.list && itt.list.length) ps = playeach(itt.list);
        else ps = playlist({ movie_id: vid, from_code: itt.code || "" }) || "";
        names.push(name);
        plays.push(ps);
    }
    let content = String(data.content || "");
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
    const video = {
        vod_id: vid,
        vod_name: data.name || "",
        type_name: data.type_name || "",
        vod_year: String(data.year || ""),
        vod_area: data.area || "",
        vod_remarks: data.dynami || "",
        vod_content: content,
        vod_play_from: names.join("$$$"),
        vod_play_url: plays.join("$$$")
    };
    return JSON.stringify({ list: [video] });
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const body = { keyword: String(key), sort: "", type_id: "0", page: String(page), pageSize: "10", res_type: "by_movie_name" };
    const data = apiJson("/api/v1/movie/search", body).data || {};
    const videos = [];
    for (const it of data.list || []) {
        const v = voides(it);
        if (v) videos.push(v);
    }
    return JSON.stringify({ list: videos, page: page });
}

function play(flag, id, vipFlags) {
    let url = String(id);
    const hdr = { "user-agent": "okhttp/4.9.2" };
    if (url.indexOf("m3u8") < 0 && url.indexOf("mp4") < 0) {
        try {
            const add = url.split("|||");
            const body = { from_code: add[0], play_url: add[1], episode_id: add[2], type: "play" };
            const data2 = apiJson("/api/v1/movie_addr/parse_url", body).data || {};
            url = data2.play_url || data2.download_url || "";
            // 尝试解析跳转后的最终地址
            try {
                const r = req(url, { headers: header(), redirect: 0, timeout: TIMEOUT });
                const loc = (r && r.headers && (r.headers.location || r.headers.Location)) || "";
                if (loc && loc.indexOf("http") >= 0) url = loc;
            } catch (e) {}
        } catch (e) {
            const parts = String(id).split("|||");
            if (parts[1] && parts[1].indexOf("http") === 0) return JSON.stringify({ parse: 1, url: parts[1], header: hdr });
        }
    }
    if (!url) return JSON.stringify({ parse: 1, url: String(id), header: hdr });
    // .jpg/.png 伪装的 m3u8: 原版走 localProxy 重写分片地址, QuickJS 无代理能力, 直接返回
    return JSON.stringify({ parse: 0, url: url, header: hdr });
}

export default { init, home, homeVod, category, detail, play, search };
