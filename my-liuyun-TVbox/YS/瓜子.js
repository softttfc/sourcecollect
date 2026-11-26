// 瓜子视频 - 独立同步-（Quick琉芸JS版）
const DEFAULT_SITES = [
    "https://api.h27sq4f.com",
    "https://api.wbhxjjv.com",
    "https://sdapi.e2wu4ht.com",
    "https://sdapi.7wstgq6.com",
    "https://apinew.uozvr.com"
];
const PUBLIC_KEY = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUM5+/y8sPsWkd1/RQS64X259EUwxFXFE5HlA65MqrxnPs0JqoSRojSDy5QhwvROlaD6TwRQHKMY2OAZ6SnQeUJsChTEFIR9qUkwrs3/MVUMxjsv6JS6Oe/juclyJGTgVmDhB55EafXsD0SQYVj/QXXsxR6ewR5E2kL52yAAD4yQIDAQAB";
const PRIVATE_KEY = "MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGAe6hKrWLi1zQmjTT1ozbE4QdFeJGNxubxld6GrFGximxfMsMB6BpJhpcTouAqywAFppiKetUBBbXwYsYU1wNr648XVmPmCMCy4rY8vdliFnbMUj086DU6Z+/oXBdWU3/b1G0DN3E9wULRSwcKZT3wj/cCI1vsCm3gj2R5SqkA9Y0CAwEAAQKBgAJH+4CxV0/zBVcLiBCHvSANm0l7HetybTh/j2p0Y1sTXro4ALwAaCTUeqdBjWiLSo9lNwDHFyq8zX90+gNxa7c5EqcWV9FmlVXr8VhfBzcZo1nXeNdXFT7tQ2yah/odtdcx+vRMSGJd1t/5k5bDd9wAvYdIDblMAg+wiKKZ5KcdAkEA1cCakEN4NexkF5tHPRrR6XOY/XHfkqXxEhMqmNbB9U34saTJnLWIHC8IXys6Qmzz30TtzCjuOqKRRy+FMM4TdwJBAJQZFPjsGC+RqcG5UvVMiMPhnwe/bXEehShK86yJK/g/UiKrO87h3aEu5gcJqBygTq3BBBoH2md3pr/W+hUMWBsCQQChfhTIrdDinKi6lRxrdBnn0Ohjg2cwuqK5zzU9p/N+S9x7Ck8wUI53DKm8jUJE8WAG7WLj/oCOWEh+ic6NIwTdAkEAj0X8nhx6AXsgCYRql1klbqtVmL8+95KZK7PnLWG/IfjQUy3pPGoSaZ7fdquG8bq8oyf5+dzjE/oTXcByS+6XRQJAP/5ciy1bL3NhUhsaOVy55MHXnPjdcTX0FaLi+ybXZIfIQ2P4rb19mVq1feMbCXhz+L1rG8oat5lYKfpe8k83ZA==";
const SIGN_SUFFIX = "*&zvdvdvddbfikkkumtmdwqppp?|4Y!s!2br";
const HMAC_KEY = "d6fc3a4a06adbde89223bvefedc24fecde188aaa9161";
const PIC_UA = "@User-Agent=Dalvik/2.1.0 (Linux; U; Android 12; TVBox Build/UP1A)";
const AUTH = { token: "", app_user_id: "" };
const R = { host: DEFAULT_SITES[0], sites: DEFAULT_SITES.slice(), playRef: "http://WJiZxLXA2.com/" };
let RSA_PUB = null;
let RSA_PRIV = null;

function text(v) { return v === null || v === undefined ? "" : String(v); }

// UTF-8 / Base64 / Hex
const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function utf8enc(str) {
    str = text(str);
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
function utf8dec(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length;) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0 && i < bytes.length) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xf0 && i + 1 < bytes.length) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        else if (i + 2 < bytes.length) {
            const cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            const n = cp - 0x10000;
            out += String.fromCharCode(0xd800 + (n >> 10), 0xdc00 + (n & 0x3ff));
        }
    }
    return out;
}
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
function b64dec(str) {
    const rev = {};
    for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
    str = text(str).replace(/[^A-Za-z0-9+/]/g, "");
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < str.length; i++) {
        acc = (acc << 6) | rev[str[i]];
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((acc >> bits) & 255);
        }
    }
    return out;
}
function hexenc(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    return out;
}
function hexdec(str) {
    const out = [];
    str = text(str).replace(/[^0-9a-fA-F]/g, "");
    for (let i = 0; i + 1 < str.length; i += 2) out.push(parseInt(str.substr(i, 2), 16));
    return out;
}

// MD5
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
    const hs = [a0, b0, c0, d0];
    for (let j = 0; j < hs.length; j++) for (let i = 0; i < 4; i++) out.push((hs[j] >>> (8 * i)) & 255);
    return out;
}
function md5Str(str) {
    if (typeof md5X === "function") {
        try {
            const v = md5X(text(str));
            if (/^[0-9a-fA-F]{32}$/.test(v)) return v.toLowerCase();
        } catch (e) {}
    }
    return hexenc(md5Bytes(utf8enc(str)));
}

// SHA-1 / HMAC-SHA1
function sha1Bytes(bytes) {
    const msg = bytes.slice();
    const lenLo = (bytes.length * 8) >>> 0;
    const lenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 3; i >= 0; i--) msg.push((lenHi >>> (8 * i)) & 255);
    for (let i = 3; i >= 0; i--) msg.push((lenLo >>> (8 * i)) & 255);
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    const w = new Array(80);
    for (let off = 0; off < msg.length; off += 64) {
        for (let i = 0; i < 16; i++) w[i] = (msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3];
        for (let i = 16; i < 80; i++) { const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (v << 1) | (v >>> 31); }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            let f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }
            const tmp = ((((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0);
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = [], hs = [h0, h1, h2, h3, h4];
    for (let j = 0; j < hs.length; j++) for (let i = 3; i >= 0; i--) out.push((hs[j] >>> (8 * i)) & 255);
    return out;
}
function hmacSha1Bytes(keyBytes, msgBytes) {
    let k = keyBytes.length > 64 ? sha1Bytes(keyBytes) : keyBytes.slice();
    while (k.length < 64) k.push(0);
    const ipad = [], opad = [];
    for (let i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    return sha1Bytes(opad.concat(sha1Bytes(ipad.concat(msgBytes))));
}

// AES-CBC / PKCS7（128/192/256 位密钥通用）
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
        else if (Nk > 6 && i % Nk === 4) t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
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
        const m9 = function (x) { return xtime(xtime(xtime(x))) ^ x; };
        const m11 = function (x) { return xtime(xtime(xtime(x))) ^ xtime(x) ^ x; };
        const m13 = function (x) { return xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ x; };
        const m14 = function (x) { return xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ xtime(x); };
        s[4 * c] = m14(a[0]) ^ m11(a[1]) ^ m13(a[2]) ^ m9(a[3]);
        s[1 + 4 * c] = m9(a[0]) ^ m14(a[1]) ^ m11(a[2]) ^ m13(a[3]);
        s[2 + 4 * c] = m13(a[0]) ^ m9(a[1]) ^ m14(a[2]) ^ m11(a[3]);
        s[3 + 4 * c] = m11(a[0]) ^ m13(a[1]) ^ m9(a[2]) ^ m14(a[3]);
    }
}
function pkcs7pad(bytes) {
    const n = 16 - bytes.length % 16, out = bytes.slice();
    for (let i = 0; i < n; i++) out.push(n);
    return out;
}
function pkcs7unpad(bytes) {
    if (!bytes.length) return bytes;
    const n = bytes[bytes.length - 1];
    if (n < 1 || n > 16 || n > bytes.length) throw new Error("AES padding");
    for (let i = bytes.length - n; i < bytes.length; i++) if (bytes[i] !== n) throw new Error("AES padding");
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
        for (let j = 0; j < 16; j++) out.push(prev[j]);
    }
    return out;
}
function aesCbcDec(key, iv, bytes) {
    if (!bytes.length || bytes.length % 16) throw new Error("AES length");
    const ek = aesKeyExp(key), out = [];
    let prev = iv.slice();
    for (let i = 0; i < bytes.length; i += 16) {
        const block = bytes.slice(i, i + 16), dec = aesDecBlock(ek, block);
        for (let j = 0; j < 16; j++) out.push(dec[j] ^ prev[j]);
        prev = block;
    }
    return pkcs7unpad(out);
}

// DER 与 16 位字纯 JS 模幂，原生 rsaX 不可用时兜底
function derReadLen(b, p) {
    let len = b[p.i++];
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | b[p.i++]; }
    return len;
}
function derReadTLV(b, p) {
    const tag = b[p.i++], len = derReadLen(b, p), val = b.slice(p.i, p.i + len);
    p.i += len;
    return { tag: tag, val: val };
}
function derIntBytes(v) { let i = 0; while (i + 1 < v.length && v[i] === 0) i++; return v.slice(i); }
function rsaPubParams(b64der) {
    const der = b64dec(b64der), p = { i: 0 }, seq = derReadTLV(der, p).val, q = { i: 0 };
    let n = null, e = 65537;
    const t1 = derReadTLV(seq, q);
    if (t1.tag === 0x30) {
        const bit = derReadTLV(seq, q).val, p2 = { i: 1 }, seq2 = derReadTLV(bit, p2).val, q2 = { i: 0 };
        n = derIntBytes(derReadTLV(seq2, q2).val);
        const ev = derIntBytes(derReadTLV(seq2, q2).val);
        e = 0; for (let i = 0; i < ev.length; i++) e = (e << 8) | ev[i];
    } else {
        n = derIntBytes(t1.val);
        const ev = derIntBytes(derReadTLV(seq, q).val);
        e = 0; for (let i = 0; i < ev.length; i++) e = (e << 8) | ev[i];
    }
    return { n: n, e: e };
}
function rsaPrivParams(b64der) {
    const der = b64dec(b64der), p = { i: 0 }, seq = derReadTLV(der, p).val, q = { i: 0 };
    derReadTLV(seq, q);
    const t2 = derReadTLV(seq, q);
    let inner;
    if (t2.tag === 0x30) {
        const oct = derReadTLV(seq, q).val, p2 = { i: 0 };
        inner = derReadTLV(oct, p2).val;
    } else if (t2.tag === 0x04) {
        const p2 = { i: 0 };
        inner = derReadTLV(t2.val, p2).val;
    } else inner = seq;
    const r = { i: 0 };
    derReadTLV(inner, r);
    const n = derIntBytes(derReadTLV(inner, r).val);
    derReadTLV(inner, r);
    const d = derIntBytes(derReadTLV(inner, r).val);
    const primeP = derIntBytes(derReadTLV(inner, r).val);
    const primeQ = derIntBytes(derReadTLV(inner, r).val);
    const dp = derIntBytes(derReadTLV(inner, r).val);
    const dq = derIntBytes(derReadTLV(inner, r).val);
    const qinv = derIntBytes(derReadTLV(inner, r).val);
    return { n: n, d: d, p: primeP, q: primeQ, dp: dp, dq: dq, qinv: qinv };
}
function bnCmp(a, b) {
    let i = a.length > b.length ? a.length : b.length;
    while (i-- > 0) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; }
    return 0;
}
function bnAdd(a, b) {
    const out = [];
    let carry = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const sum = (a[i] || 0) + (b[i] || 0) + carry;
        out.push(sum & 0xffff);
        carry = Math.floor(sum / 65536);
    }
    if (carry) out.push(carry);
    return out.length ? out : [0];
}
function bnSub(a, b) {
    const out = [];
    let borrow = 0;
    for (let i = 0; i < a.length; i++) {
        let d = (a[i] || 0) - (b[i] || 0) - borrow;
        if (d < 0) { d += 65536; borrow = 1; } else borrow = 0;
        out.push(d);
    }
    while (out.length > 1 && out[out.length - 1] === 0) out.pop();
    return out.length ? out : [0];
}
function bnMul(a, b) {
    const out = new Array(a.length + b.length + 1);
    for (let i = 0; i < out.length; i++) out[i] = 0;
    for (let i = 0; i < a.length; i++) {
        let carry = 0;
        for (let j = 0; j < b.length; j++) {
            const t = a[i] * b[j] + out[i + j] + carry;
            out[i + j] = t & 0xffff;
            carry = Math.floor(t / 65536);
        }
        let k = i + b.length;
        while (carry > 0) {
            const t = out[k] + carry;
            out[k] = t & 0xffff;
            carry = Math.floor(t / 65536); k++;
        }
    }
    while (out.length > 1 && out[out.length - 1] === 0) out.pop();
    return out;
}
function bnBitLen(a) {
    let i = a.length - 1;
    while (i > 0 && a[i] === 0) i--;
    let w = a[i], bits = i * 16;
    while (w) { bits++; w >>= 1; }
    return bits;
}
function bnMod(x, m) {
    let rem = [0];
    const bits = bnBitLen(x);
    for (let i = bits - 1; i >= 0; i--) {
        let carry = 0;
        for (let j = 0; j < rem.length; j++) {
            const v = (rem[j] << 1) | carry;
            rem[j] = v & 0xffff; carry = v >> 16;
        }
        if (carry) rem.push(carry);
        if (((x[i >> 4] || 0) >> (i & 15)) & 1) rem[0] |= 1;
        if (bnCmp(rem, m) >= 0) rem = bnSub(rem, m);
    }
    return rem;
}
function biFromBytes(be) {
    const a = [];
    let cur = 0, bits = 0;
    for (let i = be.length - 1; i >= 0; i--) {
        cur |= be[i] << bits; bits += 8;
        if (bits >= 16) { a.push(cur & 0xffff); cur >>= 16; bits -= 16; }
    }
    if (bits > 0) a.push(cur);
    return a.length ? a : [0];
}
function biToBytes(a, k) {
    const out = [];
    let cur = 0, bits = 0, idx = 0;
    while (out.length < k) {
        while (bits < 8 && idx < a.length) { cur |= a[idx++] << bits; bits += 16; }
        out.unshift(cur & 255); cur >>= 8; bits -= 8;
    }
    return out;
}
function bigFromBytes(bytes) {
    let value = BigInt(0), base = BigInt(256);
    for (let i = 0; i < bytes.length; i++) value = value * base + BigInt(bytes[i]);
    return value;
}
function bigToBytes(value, length) {
    const out = new Array(length), base = BigInt(256);
    for (let i = length - 1; i >= 0; i--) {
        out[i] = Number(value % base);
        value = value / base;
    }
    return out;
}
function bigModPow(base, exponent, modulus) {
    const zero = BigInt(0), one = BigInt(1), two = BigInt(2);
    let result = one;
    base %= modulus;
    while (exponent > zero) {
        if (exponent % two === one) result = result * base % modulus;
        base = base * base % modulus;
        exponent /= two;
    }
    return result;
}
function biModPow(b, e, m) {
    b = bnMod(b, m);
    let r = [1];
    if (typeof e === "number") {
        while (e > 0) {
            if (e & 1) r = bnMod(bnMul(r, b), m);
            b = bnMod(bnMul(b, b), m); e >>= 1;
        }
        return r;
    }
    const bits = bnBitLen(e);
    for (let i = bits - 1; i >= 0; i--) {
        r = bnMod(bnMul(r, r), m);
        if (((e[i >> 4] || 0) >> (i & 15)) & 1) r = bnMod(bnMul(r, b), m);
    }
    return r;
}
function rsaPubEncJS(b64der, msgBytes) {
    const pp = RSA_PUB || (RSA_PUB = rsaPubParams(b64der));
    const k = pp.n.length, ps = [];
    if (msgBytes.length > k - 11) throw new Error("RSA message");
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    const em = [0, 2].concat(ps).concat([0]).concat(msgBytes);
    if (typeof BigInt === "function") {
        return bigToBytes(bigModPow(bigFromBytes(em), BigInt(pp.e), bigFromBytes(pp.n)), k);
    }
    return biToBytes(biModPow(biFromBytes(em), pp.e, biFromBytes(pp.n)), k);
}
function rsaPrivDecCRT(pp, cipherBytes) {
    const n = biFromBytes(pp.n), k = pp.n.length, c = biFromBytes(cipherBytes);
    if (bnCmp(c, n) >= 0) return [];
    let value;
    if (pp.p && pp.q && pp.dp && pp.dq && pp.qinv) {
        const p = biFromBytes(pp.p), q = biFromBytes(pp.q);
        const m1 = biModPow(bnMod(c, p), biFromBytes(pp.dp), p);
        const m2 = biModPow(bnMod(c, q), biFromBytes(pp.dq), q);
        const diff = bnCmp(m1, m2) >= 0 ? bnSub(m1, m2) : bnSub(bnAdd(m1, p), m2);
        const h = bnMod(bnMul(biFromBytes(pp.qinv), diff), p);
        value = bnAdd(m2, bnMul(q, h));
    } else value = biModPow(c, biFromBytes(pp.d), n);
    return biToBytes(value, k);
}
function rsaPrivDecJS(b64der, cipherBytes) {
    const pp = RSA_PRIV || (RSA_PRIV = rsaPrivParams(b64der));
    let em;
    if (typeof BigInt === "function") {
        const n = bigFromBytes(pp.n), c = bigFromBytes(cipherBytes);
        if (c >= n) return [];
        em = bigToBytes(bigModPow(c, bigFromBytes(pp.d), n), pp.n.length);
    } else em = rsaPrivDecCRT(pp, cipherBytes);
    if (em[0] !== 0 || em[1] !== 2) return [];
    let i = 2;
    while (i < em.length && em[i] !== 0) i++;
    if (i >= em.length) return [];
    return em.slice(i + 1);
}
function rsaPubEnc(str) {
    if (typeof rsaX === "function") {
        try { const v = rsaX("RSA/PKCS1", true, true, str, false, PUBLIC_KEY, true); if (v) return v; } catch (e) {}
    }
    return b64enc(rsaPubEncJS(PUBLIC_KEY, utf8enc(str)));
}
function rsaPrivDec(b64cipher) {
    if (typeof rsaX === "function") {
        try { const v = rsaX("RSA/PKCS1", false, false, b64cipher, true, PRIVATE_KEY, false); if (v) return v; } catch (e) {}
    }
    return utf8dec(rsaPrivDecJS(PRIVATE_KEY, b64dec(b64cipher)));
}

// 设备认证
function rand16() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let s = "";
    for (let i = 0; i < 16; i++) s += chars.charAt(Math.floor(Math.random() * 62));
    return s;
}
function uuid() {
    let s = "";
    for (let i = 0; i < 32; i++) s += "0123456789abcdef".charAt(Math.floor(Math.random() * 16));
    return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-" + "89ab".charAt(Math.floor(Math.random() * 4)) + s.slice(17, 20) + "-" + s.slice(20, 32);
}
function javaHash(str) {
    str = text(str);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
}
function int32be(n) {
    n |= 0;
    return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function makeOldKey(sec, rnd) {
    if (sec === undefined) sec = Math.floor(Date.now() / 1000);
    if (rnd === undefined) rnd = (Math.floor(Math.random() * 4294967296) >>> 0) | 0;
    const head = int32be(sec).concat(int32be(rnd));
    head.push(3, 0);
    const base = head.concat(int32be(javaHash("1a2b3c4d5e6f7g8h")));
    const digest64 = b64enc(hmacSha1Bytes(utf8enc(HMAC_KEY), base));
    return b64enc(base.concat(int32be(javaHash(digest64))));
}
function requestHeaders() {
    return {
        "lang": "zh_cn",
        "User-Agent": "okhttp/3.12.0",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "code": "GZ0313",
        "version": "2606029",
        "packagename": "com.v54f07a912.t4ee50f184.dbb1e7669f20260721",
        "ver": "3.0.4.8",
        "api-ver": "3.0.4.8",
        "referer": R.host
    };
}
function postRaw(path, params) {
    try {
        const key = rand16(), iv = rand16();
        const requestKey = hexenc(aesCbcEnc(utf8enc(key), utf8enc(iv), utf8enc(JSON.stringify(params || {})))).toUpperCase();
        const keys = rsaPubEnc(JSON.stringify({ key: key, iv: iv }));
        if (!keys) return null;
        const form = {};
        form.token_id = "";
        form.token = AUTH.token;
        form.phone_type = "1";
        form.request_key = requestKey;
        form.app_id = "1";
        form.time = text(Math.floor(Date.now() / 1000));
        form.keys = keys;
        const order = ["token_id", "token", "phone_type", "request_key", "app_id", "time", "keys"];
        const signParts = [];
        for (let i = 0; i < order.length; i++) signParts.push(order[i] + "=" + form[order[i]]);
        form.signature = md5Str(signParts.join(",") + SIGN_SUFFIX).toUpperCase();
        form.phone_model = "tvbox-tvbox";
        form.ad_version = "1";
        const res = req(R.host + path, {
            method: "post", headers: requestHeaders(), data: form, postType: "form", timeout: 20000
        });
        if (!res || res.content === undefined || res.content === null || res.content === "") return null;
        return typeof res.content === "object" ? res.content : JSON.parse(text(res.content));
    } catch (e) { return null; }
}
function decryptResponse(outer) {
    try {
        if (!outer || !outer.data) return null;
        const keyJson = rsaPrivDec(text(outer.data.keys));
        const pair = JSON.parse(keyJson);
        const plain = aesCbcDec(utf8enc(pair.key), utf8enc(pair.iv), hexdec(outer.data.response_key));
        return JSON.parse(utf8dec(plain));
    } catch (e) { return null; }
}
function api(path, params) { return decryptResponse(postRaw(path, params || {})); }
function saveAuth(data) {
    if (!data) return;
    AUTH.token = text(data.token);
    AUTH.app_user_id = text(data.app_user_id);
}
function parseInit(ext) {
    if (typeof ext === "string") { try { ext = JSON.parse(ext); } catch (e) { ext = {}; } }
    if (ext && typeof ext === "object" && ext.ext && typeof ext.ext === "object") ext = ext.ext;
    return ext && typeof ext === "object" ? ext : {};
}
function init(ext) {
    ext = parseInit(ext);
    if (text(ext.sites)) R.sites = text(ext.sites).split(",");
    else R.sites = DEFAULT_SITES.slice();
    R.host = text(R.sites[0]);
    let authData = null;
    if (AUTH.token) {
        const refreshed = postRaw("/App/Authentication/Authenticator/refresh", {});
        if (refreshed && parseInt(refreshed.code, 10) === 200) authData = decryptResponse(refreshed);
    }
    if (!authData) {
        const authParams = { new_key: hexenc(sha1Bytes(utf8enc(uuid()))).toUpperCase(), old_key: makeOldKey() };
        let outer = postRaw("/App/Authentication/Device/signIn", authParams);
        if (outer && parseInt(outer.code, 10) === 403) {
            authParams.recommend_id = "";
            outer = postRaw("/App/Authentication/Device/signUp", authParams);
        }
        if (outer && parseInt(outer.code, 10) === 200) {
            const data = decryptResponse(outer);
            if (data && Object.prototype.hasOwnProperty.call(data, "token")) authData = data;
        }
    }
    if (authData) saveAuth(authData);
    const info = api("/App/UserInfo/getUserInfo", {});
    if (info && Object.prototype.hasOwnProperty.call(info, "playRef")) R.playRef = text(info.playRef);
}

// 固定分类与原版筛选
const CLASSES = [
    { type_id: "1", type_name: "电影" }, { type_id: "2", type_name: "剧集" },
    { type_id: "3", type_name: "综艺" }, { type_id: "4", type_name: "动漫" },
    { type_id: "64", type_name: "短剧" }
];
function fv(str) {
    const a = text(str).split(","), out = [];
    for (let i = 0; i < a.length; i++) { const p = a[i].split("|"); out.push({ n: p[0], v: p[1] }); }
    return out;
}
function filter(key, name, values) { return { key: key, name: name, value: fv(values) }; }
const YEARS = "全部|0,2026|2026,2025|2025,2024|2024,2023|2023,2022|2022,2021|2021,2020|2020,2019|2019,2018|2018";
const SORT = "最新|d_id,最热|hits,评分|score";
const FILTERS = {
    "1": [
        filter("sub", "类型", "全部|0,动作片|动作,喜剧片|喜剧,爱情片|爱情,科幻片|科幻,恐怖片|恐怖,剧情片|剧情,战争片|战争,纪录片|纪录"),
        filter("area", "地区", "全部|0,大陆|大陆,香港|香港,台湾|台湾,美国|美国,日本|日本,韩国|韩国,欧洲|欧洲"),
        filter("year", "年份", YEARS), filter("sort", "排序", SORT)
    ],
    "2": [
        filter("sub", "类型", "全部|0,国产剧|国产剧,港台剧|港台剧,日韩剧|日韩剧,欧美剧|欧美剧,海外剧|海外剧"),
        filter("area", "地区", "全部|0,内地|内地,韩国|韩国,香港|香港,台湾|台湾,日本|日本,美国|美国,泰国|泰国,英国|英国"),
        filter("year", "年份", YEARS), filter("sort", "排序", SORT)
    ],
    "3": [
        filter("area", "地区", "全部|0,内地|内地,港台|港台,日韩|日韩,欧美|欧美"),
        filter("year", "年份", YEARS), filter("sort", "排序", SORT)
    ],
    "4": [
        filter("area", "地区", "全部|0,国产|国产,日本|日本,欧美|欧美"),
        filter("year", "年份", YEARS + ",2017|2017,2016|2016"), filter("sort", "排序", SORT)
    ],
    "64": [filter("sort", "排序", SORT)]
};
function home() { return JSON.stringify({ class: CLASSES, filters: FILTERS }); }
function blocked(item) {
    const tags = text(item && item.tags);
    return tags.indexOf("伦理") >= 0 || tags.indexOf("成人") >= 0 || tags.indexOf("三级") >= 0;
}
function listVods(data) {
    const src = data && Array.isArray(data.list) ? data.list : [], out = [];
    for (let i = 0; i < src.length; i++) {
        const t = src[i];
        if (!t || blocked(t)) continue;
        const cont = text(t.new_continue);
        out.push({
            vod_id: text(t.vod_id), vod_name: text(t.vod_name), vod_pic: text(t.vod_pic) + PIC_UA,
            vod_remarks: cont || "评分:" + text(t.vod_scroe)
        });
    }
    return out;
}
function homeVod() {
    const data = api("/App/IndexList/choiceList", { pid: "1" });
    const src = data && Array.isArray(data.list) ? data.list : [], out = [];
    for (let i = 0; i < src.length; i++) {
        const t = src[i];
        if (!t || blocked(t)) continue;
        const cont = text(t.new_continue);
        out.push({
            vod_id: text(t.vod_id), vod_name: text(t.c_name), vod_pic: text(t.c_pic) + PIC_UA,
            vod_remarks: cont || "评分:" + text(t.vod_douban_score)
        });
    }
    return JSON.stringify({ list: out });
}
function extValue(ext, key, def) {
    return ext && Object.prototype.hasOwnProperty.call(ext, key) && text(ext[key]) ? text(ext[key]) : def;
}
function category(tid, pg, filterFlag, ext) {
    const params = {
        area: extValue(ext, "area", "0"), year: extValue(ext, "year", "0"), pageSize: "30",
        sort: extValue(ext, "sort", "d_id"), sub: extValue(ext, "sub", "0"),
        page: text(pg || "1"), tid: text(tid)
    };
    return JSON.stringify({ list: listVods(api("/App/IndexList/indexList", params)) });
}
function search(wd, quick) {
    return JSON.stringify({ list: listVods(api("/App/Index/findMoreVod", { keywords: text(wd), order_val: "1" })) });
}
function detail(ids) {
    const id = text(Array.isArray(ids) ? ids[0] : ids);
    const playParams = {
        token_id: AUTH.app_user_id, vod_id: id, mobile_time: text(Math.floor(Date.now() / 1000)), token: AUTH.token
    };
    const playInfo = api("/App/IndexPlay/playInfo", playParams);
    const show = api("/App/Resource/Vurl/show", { vurl_cloud_id: "2", vod_d_id: id });
    const info = playInfo && playInfo.vodInfo;
    if (!info) return JSON.stringify({ list: [] });
    const src = show && Array.isArray(show.list) ? show.list : [];
    const qualities = ["3840", "2160", "1080", "720", "480", "360", "240"], episodes = [];
    for (let i = 0; i < src.length; i++) {
        const item = src[i] || {}, play = item.play || {};
        let quality = "", param = "";
        for (let j = 0; j < qualities.length; j++) {
            const q = qualities[j];
            if (play[q] !== undefined && play[q] !== null) {
                const p = text(play[q].param);
                if (p) { quality = q; param = p; break; }
            }
        }
        let title = text(item.title) || text(i + 1);
        if (quality) title += " [" + quality + "P]";
        episodes.push(title + "$" + b64enc(utf8enc(param)));
    }
    return JSON.stringify({ list: [{
        vod_id: id, vod_name: text(info.vod_name), vod_pic: text(info.vod_pic) + PIC_UA,
        vod_remarks: text(info.new_continue), vod_year: text(info.vod_addtime), vod_area: text(info.vod_area),
        vod_actor: text(info.vod_actor), vod_director: text(info.vod_director), vod_content: text(info.vod_use_content),
        vod_play_from: "瓜子视频", vod_play_url: episodes.join("#")
    }] });
}
function play(flag, id, flags) {
    const raw = utf8dec(b64dec(id)), parts = raw.split("&"), params = {};
    for (let i = 0; i < parts.length; i++) {
        const kv = parts[i].split("=");
        if (kv.length !== 2) continue;
        params[kv[0] === "vod_d_id" ? "vod_id" : kv[0]] = kv[1];
    }
    const data = api("/App/Resource/VurlDetail/showOne", params);
    return JSON.stringify({
        parse: 0, playUrl: "", url: text(data && data.url),
        header: { "User-Agent": "Lavf/57.83.100", "Referer": R.playRef }
    });
}

const __api = { init: init, home: home, homeVod: homeVod, category: category, detail: detail, play: play, search: search };
export function __jsEvalReturn() { return __api; }
export default __api;
