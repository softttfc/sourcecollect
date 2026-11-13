// 蓝鹰秒播 (qijiappapi族) - Quick琉芸JS 独立版
// 由原 cat.js 通用引擎同步化重写, 配置已固化, 接口无需 ext
// 协议: AES-128-CBC(key=iv) 加密通信, initV122 初始化, vodParse 解析链, 搜索滑块/验证码OCR回退

// ==================== 固化配置 (蓝鹰秒播) ====================
const CFG = {
    host: "http://103.217.190.91:5566",
    key: "hagYExMdMkeWfemK",
    ua: "okhttp/3.10.0",
    init: "V122",
    api: "2"
};
const PREFIX = "【琉🔹璃❤广告勿信👉剧情】📢";

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
const B64REV = (function () { const t = {}; for (let i = 0; i < 64; i++) t[B64C[i]] = i; return t; })();
function b64dec(s) {
    s = String(s).replace(/[^A-Za-z0-9+/]/g, "");
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
        acc = (acc << 6) | (B64REV[s.charAt(i)] | 0);
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
        else { i += 3; out += " "; }
    }
    return out;
}
function hexenc(bytes) { let s = ""; for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16); return s; }

// ==================== AES (纯JS, CBC) ====================
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
// 预计算 GF(2^8) 乘法表, 避免每块重复计算
const MUL9 = [], MUL11 = [], MUL13 = [], MUL14 = [];
(function () {
    for (let x = 0; x < 256; x++) {
        const x2 = xtime(x), x4 = xtime(x2), x8 = xtime(x4);
        MUL9[x] = x8 ^ x; MUL11[x] = x8 ^ x2 ^ x; MUL13[x] = x8 ^ x4 ^ x; MUL14[x] = x8 ^ x4 ^ x2;
    }
})();
function aesInvMix(s) {
    for (let c = 0; c < 4; c++) {
        const i0 = 4 * c, i1 = 1 + 4 * c, i2 = 2 + 4 * c, i3 = 3 + 4 * c;
        const a0 = s[i0], a1 = s[i1], a2 = s[i2], a3 = s[i3];
        s[i0] = MUL14[a0] ^ MUL11[a1] ^ MUL13[a2] ^ MUL9[a3];
        s[i1] = MUL9[a0] ^ MUL14[a1] ^ MUL11[a2] ^ MUL13[a3];
        s[i2] = MUL13[a0] ^ MUL9[a1] ^ MUL14[a2] ^ MUL11[a3];
        s[i3] = MUL11[a0] ^ MUL13[a1] ^ MUL9[a2] ^ MUL14[a3];
    }
}
function pkcs7pad(bytes) { const n = 16 - (bytes.length % 16), out = bytes.slice(); for (let i = 0; i < n; i++) out.push(n); return out; }
function pkcs7unpad(bytes) {
    if (!bytes.length) return bytes;
    const n = bytes[bytes.length - 1];
    if (n < 1 || n > 16 || n > bytes.length) return bytes;
    return bytes.slice(0, bytes.length - n);
}
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.Nr; r++) { aesSub(s); aesShift(s); aesMix(s); aesAddRK(s, ek.w, r); }
    aesSub(s); aesShift(s); aesAddRK(s, ek.w, ek.Nr);
    return s;
}
function aesDecBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, ek.Nr);
    for (let r = ek.Nr - 1; r >= 1; r--) { aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, r); aesInvMix(s); }
    aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, 0);
    return s;
}
function aesCbcEnc(key, iv, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    let prev = iv.slice();
    for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        for (let j = 0; j < 16; j++) block[j] ^= prev[j];
        prev = aesEncBlock(ek, block);
        for (const x of prev) out.push(x);
    }
    return out;
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

// ==================== MD5 (硬编码常量表, 优先原生md5X) ====================
const MD5K = [0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391];
const MD5S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
function md5Bytes(bytes) {
    const msg = bytes.slice();
    const bitLenLo = (bytes.length * 8) >>> 0;
    const bitLenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 0; i < 4; i++) msg.push((bitLenLo >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i++) msg.push((bitLenHi >>> (8 * i)) & 255);
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
function md5(text) {
    if (typeof md5X === "function") { try { return md5X(String(text)); } catch (e) {} }
    return hexenc(md5Bytes(utf8enc(String(text))));
}

// ==================== 全局状态 ====================
let siteUrl = "";
let key = "";
let iv = "";
let apiPrefix = "getappapi.index";
const prefixMap = { "1": "getappapi.index", "2": "qijiappapi.index", "3": "appapi" };
let headers = {
    "User-Agent": "okhttp/3.10.0",
    "app-user-device-id": "291b226282010337c9443590d6457be15",
    "app-version-code": "112"
};
let homeVods = [];
let Searchstatus = false;
let searchApiSuffix = "";
let souParamName = "";
let souSalt = "";
let extraSearchHeaders = {};
let initSuffix = "init";
let hasCustomInit = false;
let thirdDanmuBaseUrl = "";
let customPlayUa = "";
let homeInited = false;

// ==================== 加解密封装 ====================
function aesDecode(str) {
    // 优先原生 aesX（Java 端解密，大报文比纯 JS 快很多）
    if (typeof aesX === "function") {
        const modes = ["AES/CBC/PKCS5Padding", "AES/CBC/PKCS7Padding"];
        for (let i = 0; i < modes.length; i++) {
            try {
                const r = aesX(modes[i], false, String(str), true, key, iv, false);
                if (r && typeof r === "string" && r.length) {
                    const t = r.replace(/^\s+/, "").replace(/\s+$/, "");
                    if (t.charAt(0) === "{" || t.charAt(0) === "[" || t.charAt(0) === '"') return r;
                }
            } catch (e) {}
        }
    }
    // base64密文 -> AES-CBC解密 -> utf8明文
    return utf8dec(aesCbcDec(utf8enc(key), utf8enc(iv), b64dec(str)));
}
function aesEncode(str) {
    // utf8明文 -> AES-CBC加密 -> base64密文
    return b64enc(aesCbcEnc(utf8enc(key), utf8enc(iv), utf8enc(str)));
}
function spinWait(ms) { const t = Date.now() + ms; while (Date.now() < t) {} }
function fixPlayUrl(u) { return String(u).replace(/[^\x21-\x7E]/g, function (c) { return encodeURIComponent(c); }); }
function generateUUID() {
    const chars = "0123456789abcdef";
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return chars[v];
    });
}

// ==================== 请求 ====================
function request(reqUrl, data, header, method) {
    const finalHeaders = Object.assign({}, headers, header || {});
    const opt = {
        method: method || "get",
        headers: finalHeaders,
        timeout: 10000
    };
    if (method === "post") {
        opt.data = data || {};
        opt.postType = "form";
    }
    const res = req(reqUrl, opt);
    return res.content;
}
function requestText(reqUrl, data, header, method, tobase64) {
    const finalHeaders = Object.assign({}, headers, header || {});
    const opt = {
        method: method || "get",
        headers: finalHeaders,
        timeout: 10000
    };
    if (method === "post") {
        opt.data = data || "";
        opt.postType = "raw";
    }
    if (tobase64) opt.buffer = 2;
    const res = req(reqUrl, opt);
    return res.content;
}

// ==================== 接口实现 ====================
function init(cfg) {
    cfg = cfg || {};
    let extObj = {};
    if (cfg.ext) {
        if (typeof cfg.ext === "string") { try { extObj = JSON.parse(cfg.ext); } catch (e) { extObj = {}; } }
        else if (typeof cfg.ext === "object") extObj = cfg.ext;
    }
    // 固化配置打底, ext可覆盖
    extObj = Object.assign({}, CFG, extObj);
    if (extObj.init && typeof extObj.init === "string" && extObj.init.charAt(0) === "V") {
        initSuffix = "init" + extObj.init;
        hasCustomInit = true;
    }
    if (extObj.ua2 !== undefined) customPlayUa = String(extObj.ua2).trim();
    if (extObj.head && typeof extObj.head === "string") {
        const items = extObj.head.trim().split(",");
        for (const item of items) {
            const t = item.trim();
            if (!t) continue;
            const ci = t.indexOf(":");
            if (ci > 0) {
                const hk = t.substring(0, ci).trim(), hv = t.substring(ci + 1).trim();
                if (hk && hv) headers[hk] = hv;
            }
        }
    }
    let host = String(extObj.host || "").replace(/[`'"]/g, "").trim();
    if (host) {
        if (/^https?:\/\//i.test(host) && (/\.txt$|\.json$/i.test(host))) {
            try {
                const resp = request(host, null, headers, "get");
                const urls = String(resp).split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l && l.indexOf("http") === 0; });
                if (urls.length > 0) host = urls[0];
            } catch (e) {}
        }
        siteUrl = host.replace(/\/+$/, "");
        if (siteUrl.indexOf("php") < 0) siteUrl += "/api.php";
    }
    key = extObj.key || "";
    iv = extObj.iv || extObj.Iv || key;
    if (extObj.api && prefixMap[String(extObj.api)]) apiPrefix = prefixMap[String(extObj.api)];
    if (extObj.version) headers["app-version-code"] = String(extObj.version);
    if (extObj.id) headers["app-user-device-id"] = String(extObj.id);
    if (extObj.token) headers["app-user-token"] = String(extObj.token);
    if (extObj.ua) headers["User-Agent"] = String(extObj.ua);
    homeInited = false;
    homeVods = [];
}

function processSignatureValue(sig) {
    if (sig.length < 8) return sig.split("").reverse().join("");
    const rear = sig.slice(-8).split("").reverse().join("");
    const front = sig.slice(0, -8).split("").reverse().join("");
    return front + rear;
}

function home(filter) {
    const initUrl = siteUrl + "/" + apiPrefix + "/" + initSuffix;
    const rets = JSON.parse(request(initUrl)).data;
    const data = JSON.parse(aesDecode(rets));

    let rawDanmuUrl = (data.config && data.config.third_danmu_url) || "";
    if (Array.isArray(rawDanmuUrl)) {
        rawDanmuUrl = rawDanmuUrl.find(function (u) { return u && typeof u === "string" && u.trim(); }) || "";
    } else if (typeof rawDanmuUrl !== "string") rawDanmuUrl = "";
    if (rawDanmuUrl) {
        thirdDanmuBaseUrl = rawDanmuUrl.trim();
        const lower = thirdDanmuBaseUrl.toLowerCase();
        if (!/[?&]url=$/.test(lower)) thirdDanmuBaseUrl += thirdDanmuBaseUrl.indexOf("?") >= 0 ? "&url=" : "?url=";
    } else {
        thirdDanmuBaseUrl = "https://dmku.hls.one/?ac=dm&url=";
    }

    if (data.box_config) {
        const swappedKey = key.split("").reverse().join("");
        const md5Key = md5(swappedKey);
        const dynamicIv = md5Key.substring(0, 16);
        const boxJson = JSON.parse(utf8dec(aesCbcDec(utf8enc(swappedKey), utf8enc(dynamicIv), b64dec(data.box_config))));
        searchApiSuffix = boxJson.search_name || "";
        if (boxJson.signature_name && boxJson.signature_value) {
            souParamName = boxJson.signature_name;
            souSalt = processSignatureValue(boxJson.signature_value);
        }
        if (boxJson.api_header && boxJson.api_header.key && boxJson.api_header.value) {
            extraSearchHeaders[boxJson.api_header.key] = boxJson.api_header.value;
        }
    } else {
        searchApiSuffix = "searchList";
        souParamName = "";
        souSalt = "";
    }

    Searchstatus = (data.config && data.config.system_search_verify_status) || false;

    const filters = {};
    const classes = [];
    homeVods = [];
    for (const item of (data.type_list || [])) {
        if (item.type_id > 0 && Array.isArray(item.recommend_list)) homeVods = homeVods.concat(item.recommend_list);
        classes.push({ type_id: item.type_id, type_name: item.type_name });
        const filterList = [];
        for (const f of (item.filter_type_list || [])) {
            const filter = {};
            const nameMap = { "class": "分类", "area": "区域", "lang": "语言", "year": "年份", "sort": "排序" };
            if (nameMap[f.name]) {
                filter.name = nameMap[f.name];
                filter.key = f.name;
                filter.value = (f.list || []).map(function (i) { return { v: i, n: i }; });
            }
            if (Object.keys(filter).length > 0) filterList.push(filter);
        }
        if (filterList.length > 0) filters[item.type_id] = filterList;
    }
    homeInited = true;
    return JSON.stringify({ "class": classes, "filters": filters });
}

function homeVod() {
    if (!homeInited) { try { home(true); } catch (e) {} }
    return JSON.stringify({ list: homeVods });
}

function category(tid, pg, filter, extend) {
    pg = parseInt(pg, 10) || 1;
    if (pg <= 0) pg = 1;
    extend = extend || {};
    const url = siteUrl + "/" + apiPrefix + "/typeFilterVodList";
    const params = {
        "area": extend["area"] || "全部",
        "sort": extend["sort"] || "最新",
        "class": extend["class"] || "全部",
        "type_id": tid,
        "year": extend["year"] || "全部",
        "lang": extend["lang"] || "全部",
        "page": pg
    };
    const encData = JSON.parse(request(url, params, "", "post")).data;
    const videos = JSON.parse(aesDecode(encData)).recommend_list;
    return JSON.stringify({ page: pg, pagecount: 9999, list: videos });
}

function detail(id) {
    const url = siteUrl + "/" + apiPrefix + "/vodDetail";
    const resp = request(url, { vod_id: id }, "", "post");
    const encData = JSON.parse(resp).data;
    const info = JSON.parse(aesDecode(encData));
    let content = String(info.vod.vod_content || "");
    if (content.indexOf(PREFIX) < 0) content = PREFIX + content;
    const videos = {
        vod_id: info.vod.vod_id,
        vod_name: "🌹" + info.vod.vod_name,
        vod_area: info.vod.vod_area,
        vod_director: info.vod.vod_director,
        vod_actor: info.vod.vod_actor,
        vod_pic: info.vod.vod_pic,
        vod_content: content,
        type_name: info.vod.vod_class,
        vod_year: info.vod.vod_year
    };
    let playSources = (info.vod_play_list || []).map(function (item) {
        const playerInfo = item.player_info || {};
        const parse = playerInfo.parse || "";
        const ua = playerInfo.user_agent || customPlayUa || "";
        const nameUrls = (item.urls || []).map(function (it2) {
            const name = it2.name || "", u2 = it2.url || "", token = it2.token || "";
            const parse_api_url = it2.parse_api_url || "", nid = it2.nid || 1;
            return name + "$" + u2 + "@@" + parse + "@@" + token + "@@" + parse_api_url + "@@" + ua + "@@" + info.vod.vod_id + "@@" + nid;
        }).join("#");
        return { show: playerInfo.show || "Unknown", urls: nameUrls };
    });
    const showCount = {};
    playSources = playSources.map(function (source) {
        let showName = source.show;
        if (showCount[showName]) { showCount[showName]++; showName = showName + showCount[showName]; }
        else showCount[showName] = 1;
        return { show: showName, urls: source.urls };
    });
    playSources.sort(function (a, b) {
        const getPriority = function (show) {
            const s = show.toLowerCase();
            if (s.indexOf("4k") >= 0) return 1;
            if (show.indexOf("K") >= 0) return 2;
            if (show.indexOf("独家") >= 0) return 3;
            if (show.indexOf("秒播") >= 0) return 4;
            if (show.indexOf("自建") >= 0) return 5;
            if (show.indexOf("蓝光") >= 0) return 6;
            if (show.indexOf("专线") >= 0) return 7;
            return 8;
        };
        return getPriority(a.show) - getPriority(b.show);
    });
    videos.vod_play_from = playSources.map(function (s) { return s.show; }).join("$$$");
    videos.vod_play_url = playSources.map(function (s) { return s.urls; }).join("$$$");
    return JSON.stringify({ list: [videos] });
}

function play(flag, id, flags) {
    const parts = String(id).split("@@");
    const playUrl = parts[0] || "";
    const parse = parts[1] || "";
    const token = parts[2] || "";
    const parse_api_url = parts[3] || "";
    const ua = parts[4] || "";
    const vodId = parts[5] || "";
    const nidStr = parts[6] || "1";

    let danmakuUrl = "";
    if (thirdDanmuBaseUrl && vodId && typeof js2Proxy === "function") {
        try {
            let nid = parseInt(nidStr, 10);
            if (isNaN(nid) || nid < 1) nid = 1;
            const danmuRet = request(siteUrl + "/" + apiPrefix + "/danmuList", { url_position: String(nid - 1), vod_id: vodId }, "", "post");
            const danmuResponse = JSON.parse(danmuRet);
            if (danmuResponse.data) {
                const decryptedDanmu = JSON.parse(aesDecode(danmuResponse.data));
                if (decryptedDanmu && decryptedDanmu.official_url) {
                    const realDanmuUrl = thirdDanmuBaseUrl + decryptedDanmu.official_url;
                    danmakuUrl = js2Proxy(false, 3, "", encodeURIComponent(realDanmuUrl), headers);
                }
            }
        } catch (e) { danmakuUrl = ""; }
    }

    if ((playUrl.indexOf("http://") >= 0 || playUrl.indexOf("https://") >= 0) &&
        (playUrl.indexOf("m3u8") >= 0 || playUrl.indexOf("mp4") >= 0 || playUrl.indexOf("mkv") >= 0) && !parse_api_url) {
        const result = { parse: 0, url: fixPlayUrl(playUrl), danmaku: danmakuUrl };
        if (ua) result.header = { "User-Agent": ua };
        return JSON.stringify(result);
    }
    if (parse.indexOf("http") === 0) {
        let purl = parse + playUrl;
        if (token) purl += "&token=" + token;
        const reqHeaders = {};
        if (ua) reqHeaders["User-Agent"] = ua;
        const rets = request(purl, null, reqHeaders, "get");
        if (String(rets).indexOf("DOCTYPE html") > -1) {
            const result = { parse: 1, url: purl, danmaku: danmakuUrl };
            if (ua) result.header = { "User-Agent": ua };
            return JSON.stringify(result);
        }
        const parseJson = JSON.parse(rets);
        const direct = parseJson["url"] || (parseJson["data"] && parseJson["data"]["url"]) || "";
        const result = { parse: 0, url: fixPlayUrl(direct), danmaku: danmakuUrl };
        if (ua) result.header = { "User-Agent": ua };
        return JSON.stringify(result);
    }
    const params = { "parse_api": parse, "url": aesEncode(playUrl), "token": token };
    const reqHeaders = {};
    if (ua) reqHeaders["User-Agent"] = ua;
    const rets = request(siteUrl + "/" + apiPrefix + "/vodParse", params, reqHeaders, "post");
    const urlDecoded = aesDecode(JSON.parse(rets).data);
    const parsed = JSON.parse(urlDecoded);
    const finalPlayUrl = JSON.parse(parsed.json).url || "";
    const result = { parse: 0, url: fixPlayUrl(finalPlayUrl), danmaku: danmakuUrl };
    if (ua) result.header = { "User-Agent": ua };
    return JSON.stringify(result);
}

function chineseToNumber(s) {
    const m = { "零": 0, "〇": 0, "一": 1, "壹": 1, "二": 2, "贰": 2, "两": 2, "三": 3, "叁": 3, "四": 4, "肆": 4, "五": 5, "伍": 5, "六": 6, "陆": 6, "七": 7, "柒": 7, "八": 8, "捌": 8, "九": 9, "玖": 9, "十": 10, "拾": 10 };
    if (s.length === 1) return m[s] !== undefined ? m[s] : 2;
    if (s.charAt(0) === "十" && s.length === 2) { const u = m[s.charAt(1)]; return u ? 10 + u : 10; }
    if (s.charAt(s.length - 1) === "十" && s.length === 2) { const t = m[s.charAt(0)]; return t ? t * 10 : 10; }
    if (s.length === 3 && s.indexOf("十") >= 0) {
        const t = m[s.charAt(0)], u = m[s.charAt(2)];
        return (t !== undefined && u !== undefined) ? t * 10 + u : (t !== undefined ? t * 10 : 10);
    }
    return 2;
}
function extractWaitTime(message) {
    const dm = String(message).match(/(\d+)\s*秒/);
    if (dm) return parseInt(dm[1], 10);
    const cm = String(message).match(/([零一二三四五六七八九十两壹贰叁肆伍陆柒捌玖拾〇]+)\s*秒/);
    if (cm) return chineseToNumber(cm[1]);
    if (/几秒|数秒|若干秒/.test(message)) return 3;
    return 2;
}

function search(wd, quick, pg) {
    if (hasCustomInit && !homeInited) { try { home(true); } catch (e) {} }
    const searchPath = searchApiSuffix || "searchList";
    const url = siteUrl + "/" + apiPrefix + "/" + searchPath;
    let videos = [];
    let attemptedCaptcha = false;
    let attemptedSlider = false;
    let sliderVerified = false;
    const params = { "page": "1", "type_id": "0", "keywords": wd };

    if (souParamName && souSalt) {
        const ts = String(Math.floor(Date.now() / 1000));
        const md5Value = md5("/" + souParamName + "-" + ts + "-sb-0-" + souSalt);
        params[souParamName] = ts + "-sb-0-" + md5Value;
    }
    const searchHeaders = Object.assign({}, headers, extraSearchHeaders);

    let waitRetryCount = 0;
    const maxWaitRetries = 2;

    while (true) {
        const encData = request(url, params, searchHeaders, "post");
        const response = JSON.parse(encData);

        if (response.code === 1001 && response.need_slider === true && !attemptedSlider) {
            attemptedSlider = true;
            try {
                const sliderResp = request(siteUrl + "/" + apiPrefix + "/getSlider", {}, searchHeaders, "post");
                const sliderJson = JSON.parse(sliderResp);
                if (sliderJson.code === 1 && sliderJson.data) {
                    const sliderData = JSON.parse(aesDecode(sliderJson.data));
                    const sliderId = sliderData.slider_id || "";
                    const targetX = parseInt(sliderData.target_x, 10) || 0;
                    if (sliderId && targetX > 0) {
                        let posX = targetX + (Math.floor(Math.random() * 3) - 1);
                        if (posX < 1) posX = 1;
                        if (posX > (sliderData.bg_width || 280)) posX = sliderData.bg_width || 280;
                        for (let att = 0; att < 3 && !sliderVerified; att++) {
                            spinWait(1200 + att * 800); // 服务端校验滑块间隔, 太快会被拒
                            try {
                                const verifyResp = request(siteUrl + "/" + apiPrefix + "/verifySlider", {
                                    pos_x: String(posX), slider_id: sliderId, timestamp: String(Math.floor(Date.now() / 1000)) // 秒级, 毫秒恒被拒
                                }, searchHeaders, "post");
                                const verifyJson = JSON.parse(verifyResp);
                                if (verifyJson.code === 1 && verifyJson.data) {
                                    const verifyResult = JSON.parse(aesDecode(verifyJson.data));
                                    if (verifyResult.verified === true) sliderVerified = true;
                                }
                            } catch (e2) {}
                        }
                        if (sliderVerified) continue;
                    }
                }
            } catch (e) {}
            if (!sliderVerified) {
                if (Searchstatus || (response.code === 0 && response.msg && String(response.msg).indexOf("验证码") >= 0)) {
                    if (attemptedCaptcha) break;
                    attemptedCaptcha = true;
                    const uuid = generateUUID();
                    const verifyUrl = siteUrl + "/" + apiPrefix.replace(".index", "") + ".verify/create?key=" + uuid;
                    let base64Img = requestText(verifyUrl, null, headers, "get", true);
                    base64Img = String(base64Img).replace(/\n/g, "");
                    const ocrResult = requestText("https://api.nn.ci/ocr/b64/text", base64Img, { "User-Agent": headers["User-Agent"] }, "post");
                    params["code"] = String(ocrResult).trim();
                    params["key"] = uuid;
                    continue;
                } else break;
            }
        }

        if (response.code === 0 && (!response.data || response.data.length === 0) && response.msg &&
            /等.*秒|等待.*秒|等|搜|请等待|稍等|稍候/.test(String(response.msg))) {
            if (waitRetryCount >= maxWaitRetries) break;
            let waitSeconds = extractWaitTime(response.msg);
            if (waitSeconds < 1) waitSeconds = 2;
            if (waitSeconds > 30) waitSeconds = 30;
            spinWait((waitSeconds + 1) * 1000);
            waitRetryCount++;
            continue;
        }

        if (response.data && response.data.length > 0) {
            const decodedData = JSON.parse(aesDecode(response.data));
            videos = decodedData.search_list || [];
            break;
        } else if (Searchstatus || (response.code === 0 && response.msg && String(response.msg).indexOf("验证码") >= 0)) {
            if (attemptedCaptcha) break;
            attemptedCaptcha = true;
            const uuid = generateUUID();
            const verifyUrl = siteUrl + "/" + apiPrefix.replace(".index", "") + ".verify/create?key=" + uuid;
            let base64Img = requestText(verifyUrl, null, headers, "get", true);
            base64Img = String(base64Img).replace(/\n/g, "");
            const ocrResult = requestText("https://api.nn.ci/ocr/b64/text", base64Img, { "User-Agent": headers["User-Agent"] }, "post");
            params["code"] = String(ocrResult).trim();
            params["key"] = uuid;
            continue;
        } else break;
    }
    return JSON.stringify({ list: videos });
}

const __api = { init: init, home: home, homeVod: homeVod, category: category, detail: detail, play: play, search: search };
export function __jsEvalReturn() { return __api; }
export default __api;
