// 师兄 APP TVBox Quick琉芸JS版 爬虫
// AES-128-CBC 加密请求 + Base64URL + RSA 播放响应解密

const DEFAULT_CFG = {
    host: 'http://app2.dsx.ac/ndsx.php',
    version: '4.0.6',
    version_number: '4006',
    pk_id: 'com.qdsj.zxt.hzjc',
    build_time: '1790053427039',
    sign_md5: '56a4bb80bd67422e9c5b48f003d445c8',
    apk_length: '59954699',
    platform: '',
    platform_version: 'TP1A.220624.014',
    user_agent: 'Dart/3.11 (dart:io)',
    private_key: 'MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBAO9omsi+ys7fmBH3w1d0DfvRAQlj0wLB1BI3Xsb9WSiu4lEc1Me+XubnzTxaQPCBbnuZURerRrO981n9GhsQkDcWmtW+X1mpCllOWt8bbnWwKPsHqemRFxncDWE/d0nA9yrZn6nLVy/J7DJ3cVJlIs9bNLArqEiR8KVrAf1PNSLXAgMBAAECgYBGPn3z2q8s5cP7uaOSHFYiBZ/1PlniXDa6JY7ked9YJX/35qqz9LJps6evRpf5OTDOiRyXAkUbZedqBu5K9KArSGVyxp/Vym4b0siEVeM8qq9Gbf74lHPH+L+X/NmXemydwZHR1lU9PiLJVMsh8o6aAazkB8ijZcsNMyYZUSH36QJBAPvHq511Uz45lx5BtVSZClcUnqPRFSmNnRdjATikDzFTObemnGJU3eL/7VIPWtjEj9LvGP/WyX6gyo1zKc8BRtUCQQDza9oFnSmMHPkvrll/zMxcy3FeOTW0hctBhdIMbBmjJJyhlfTmBOvxwm8I91F05ydkSZ1yLuLhAjLxbjqs2fD7AkB/KOHQvW+UTqu22ULGfiCNyFkyrSc9/EqphBQa0ijmJX1R9nCm7Ou/eLgYKK8eKW/l/WGn3IeZT4XdGJu185QdAkBthqmivQRktuSoP5qlllCdsCxiaPtxLoI2CTBpxnoCngab7g0zMiO3s/Sh5CYSo69lwHnHVrFe7M5fM2nTPHzhAkEAiJETUvYFwCVKNGTYMzUg7v3QblqYXB+IhzcU37sHZOn6a46V5eJDadavIvuEmoxJHWTybi+1ZkN7LeUUg4ylCw=='
};
const CLASSES = [
    { type_id: '1', type_name: '电影' },
    { type_id: '2', type_name: '电视剧' },
    { type_id: '3', type_name: '综艺' },
    { type_id: '4', type_name: '动漫' }
];
const VIDEO_EXT = ['.m3u8', '.mp4', '.mkv', '.mov', '.flv', '.avi', '.ts'];
const TIMEOUT = 20000;
let CFG = Object.assign({}, DEFAULT_CFG);
let AES_KEY = null;
let RSA_PARAMS = null;
let ROUTES = Object.create(null);
let HOME_CACHE = null;

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

function utf8dec(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length;) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0 && i < bytes.length) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xf0 && i + 1 < bytes.length) {
            out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        } else if (i + 2 < bytes.length) {
            const cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            const n = cp - 0x10000;
            out += String.fromCharCode(0xd800 + (n >> 10), 0xdc00 + (n & 0x3ff));
        }
    }
    return out;
}

const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64enc(bytes) {
    let out = '', i = 0;
    for (; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63] + B64C[(n >> 6) & 63] + B64C[n & 63];
    }
    if (i < bytes.length) {
        const n = (bytes[i] << 16) | (i + 1 < bytes.length ? bytes[i + 1] << 8 : 0);
        out += B64C[(n >> 18) & 63] + B64C[(n >> 12) & 63];
        out += i + 1 < bytes.length ? B64C[(n >> 6) & 63] : '=';
        out += '=';
    }
    return out;
}

function b64dec(str) {
    const rev = Object.create(null);
    for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
    str = text(str).replace(/[^A-Za-z0-9+/]/g, '');
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

function hexdec(str) {
    const out = [];
    str = text(str).replace(/[^0-9a-fA-F]/g, '');
    for (let i = 0; i + 1 < str.length; i += 2) out.push(parseInt(str.substr(i, 2), 16));
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

function md5Raw(str) {
    if (typeof md5X === 'function') {
        try {
            const value = md5X(str);
            if (/^[0-9a-fA-F]{32}$/.test(value)) return hexdec(value);
        } catch (e) {}
    }
    return md5Bytes(utf8enc(str));
}

const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const RCON = [0,1,2,4,8,16,32,64,128,27,54];
function xtime(x) { x <<= 1; return x & 256 ? (x ^ 0x11b) & 255 : x; }
function aesKeyExp(key) {
    const Nk = key.length / 4, Nr = Nk + 6, w = [];
    for (let i = 0; i < Nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = Nk; i < 4 * (Nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % Nk === 0) {
            t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
            t[0] ^= RCON[i / Nk];
        } else if (Nk > 6 && i % Nk === 4) t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
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
function aesCbcEnc(key, iv, bytes) {
    const ek = aesKeyExp(key), out = [];
    const n = 16 - (bytes.length % 16), data = bytes.slice();
    for (let i = 0; i < n; i++) data.push(n);
    let prev = iv.slice();
    for (let off = 0; off < data.length; off += 16) {
        const block = [];
        for (let i = 0; i < 16; i++) block.push(data[off + i] ^ prev[i]);
        prev = aesEncBlock(ek, block);
        for (const b of prev) out.push(b);
    }
    return out;
}

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
function rsaPrivParams(b64der) {
    const der = b64dec(b64der), p = { i: 0 };
    const seq = derReadTLV(der, p).val, q = { i: 0 };
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
    const ev = derIntBytes(derReadTLV(inner, r).val);
    let e = 0;
    for (const b of ev) e = (e << 8) | b;
    const d = derIntBytes(derReadTLV(inner, r).val);
    return { n: n, d: d, e: e || 65537 };
}
function bnCmp(a, b) {
    let i = Math.max(a.length, b.length);
    while (i-- > 0) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; }
    return 0;
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
            carry = Math.floor(t / 65536);
            k++;
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
            rem[j] = v & 0xffff;
            carry = v >> 16;
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
        cur |= be[i] << bits;
        bits += 8;
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
        out.unshift(cur & 255);
        cur >>= 8;
        bits -= 8;
    }
    return out;
}
function biModPow(b, e, m) {
    b = bnMod(b, m);
    let r = [1];
    if (typeof e === 'number') {
        while (e > 0) {
            if (e & 1) r = bnMod(bnMul(r, b), m);
            b = bnMod(bnMul(b, b), m);
            e >>= 1;
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
function rsaModDecrypt(pp, cipherBytes, usePublic) {
    const n = biFromBytes(pp.n), k = pp.n.length;
    const c = biFromBytes(cipherBytes);
    if (bnCmp(c, n) >= 0) return [];
    const exponent = usePublic ? pp.e : biFromBytes(pp.d);
    const em = biToBytes(biModPow(c, exponent, n), k);
    if (em[0] !== 0 || em[1] !== (usePublic ? 1 : 2)) return [];
    let i = 2;
    while (i < em.length && em[i] !== 0) i++;
    if (i >= em.length) return [];
    return em.slice(i + 1);
}
function usefulPlain(value) {
    const s = text(value).trim();
    return s.indexOf('{') === 0 || s.indexOf('[') === 0 || s.indexOf('http') === 0;
}
function rsaDecrypt(value) {
    try {
        if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2) return '';
        if (!RSA_PARAMS) RSA_PARAMS = rsaPrivParams(CFG.private_key);
        const cipherBytes = hexdec(value);
        let fallback = '';
        for (let mode = 0; mode < 2; mode++) {
            const bytes = rsaModDecrypt(RSA_PARAMS, cipherBytes, mode === 1);
            if (!bytes.length) continue;
            const plain = utf8dec(bytes).trim();
            if (usefulPlain(plain)) return plain;
            if (!fallback) fallback = plain;
        }
        return fallback;
    } catch (e) {
        return '';
    }
}

function getAesKey() {
    if (!AES_KEY) AES_KEY = md5Raw(CFG.build_time + '^~!@#[-' + CFG.pk_id);
    return AES_KEY;
}
function requestBody(method, data) {
    const bodyData = Object.assign({}, data || {});
    bodyData.token = '';
    const payload = { method: method, data: bodyData, csrf: Date.now() };
    const iv = [];
    for (let i = 0; i < 16; i++) iv.push(Math.floor(Math.random() * 256));
    const encrypted = aesCbcEnc(getAesKey(), iv, utf8enc(JSON.stringify(payload)));
    return b64enc(iv.concat(encrypted)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function appHeaders() {
    return {
        'User-Agent': CFG.user_agent,
        'Content-Type': 'text/plain',
        'version': CFG.version,
        'version-number': CFG.version_number,
        'pk-id': CFG.pk_id,
        'build-time': CFG.build_time,
        'platform': CFG.platform,
        'platform-version': CFG.platform_version
    };
}
function api(method, data) {
    try {
        // 原始文本 POST 使用 body；data 会被部分影视仓宿主按表单处理
        const res = req(CFG.host + '/v7/logs', {
            method: 'POST',
            headers: appHeaders(),
            body: requestBody(method, data),
            timeout: TIMEOUT
        });
        let content = res && res.content !== undefined ? text(res.content).trim() : '';
        if (!content) return null;
        if (content.charAt(0) !== '{' && content.charAt(0) !== '[') content = rsaDecrypt(content).trim();
        if (!content) return null;
        const json = JSON.parse(content);
        return text(json.code) === '1' ? json : null;
    } catch (e) {
        return null;
    }
}
function searchList(wd, pg, tid) {
    const data = { text: text(wd), pg: parseInt(pg, 10) || 1 };
    if (text(tid).trim()) data.tid = text(tid).trim();
    return api('search', data);
}
function cardToVod(card) {
    const id = text(card && card.vod_id), name = text(card && card.vod_name);
    if (!id || !name) return null;
    return {
        vod_id: id,
        vod_name: name,
        vod_pic: text(card.vod_pic),
        vod_remarks: text(card.vod_remarks) || text(card.vod_year)
    };
}
function responseCards(res) {
    const cards = res && Array.isArray(res.data) ? res.data : [], list = [];
    for (const card of cards) {
        const vod = cardToVod(card);
        if (vod) list.push(vod);
    }
    return list;
}
function emptyList() {
    return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 20, total: 0 });
}
function truthy(value) {
    if (typeof value === 'boolean') return value;
    const s = text(value).trim().toLowerCase();
    return s === 'true' || s === '1';
}
function isVideoFormat(url) {
    const lower = text(url).toLowerCase();
    for (const ext of VIDEO_EXT) if (lower.indexOf(ext) >= 0) return true;
    return false;
}
function extractPlayUrl(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
        for (const item of value) { const url = extractPlayUrl(item); if (url) return url; }
        return '';
    }
    if (typeof value === 'string') return value.indexOf('http') === 0 ? value : '';
    if (typeof value !== 'object') return '';
    if (Object.prototype.hasOwnProperty.call(value, 'code')) {
        const code = parseInt(text(value.code).trim(), 10);
        if (code !== 1 && code !== 200) return '';
    }
    const url = text(value.url);
    if (url.indexOf('http') === 0) return url;
    if (Object.prototype.hasOwnProperty.call(value, 'data')) return extractPlayUrl(value.data);
    return '';
}
function parseDecryptedResponse(content) {
    let value = text(content).trim();
    if (!value) return '';
    if (value.charAt(0) === '{' || value.charAt(0) === '[') {
        try { return extractPlayUrl(JSON.parse(value)); } catch (e) { return ''; }
    }
    if (value.indexOf('http') === 0) return value;
    value = rsaDecrypt(value).trim();
    if (value.charAt(0) === '{' || value.charAt(0) === '[') {
        try { return extractPlayUrl(JSON.parse(value)); } catch (e2) { return ''; }
    }
    return value.indexOf('http') === 0 ? value : '';
}
function resolveViaParse(route, url) {
    const encoded = encodeURIComponent(url);
    const apis = [], seen = Object.create(null);
    const values = (text(route.parse_api) + '\n' + text(route.extra_parse_api)).split('\n');
    for (let item of values) {
        item = text(item).trim();
        if (!item || item.indexOf('http') !== 0 || seen[item]) continue;
        seen[item] = true;
        apis.push(item.indexOf('{url}') >= 0 ? item.split('{url}').join(encoded) : item + encoded);
        if (apis.length >= 3) break;
    }
    for (const apiUrl of apis) {
        try {
            const res = req(apiUrl, { headers: { 'User-Agent': CFG.user_agent }, timeout: 12000 });
            const content = res && res.content !== undefined ? text(res.content).trim() : '';
            const playUrl = parseDecryptedResponse(content);
            if (playUrl) return playUrl;
        } catch (e) {}
    }
    return '';
}

function init(ext) {
    CFG = Object.assign({}, DEFAULT_CFG);
    if (ext && typeof ext === 'object') CFG = Object.assign(CFG, ext);
    else if (text(ext).trim()) {
        try { CFG = Object.assign(CFG, JSON.parse(text(ext))); } catch (e) {}
    }
    CFG.host = text(CFG.host).trim().replace(/[`]/g, '').replace(/\/+$/, '');
    AES_KEY = null;
    RSA_PARAMS = null;
    ROUTES = Object.create(null);
    HOME_CACHE = null;
}
function getHomeList() {
    if (HOME_CACHE && Date.now() - HOME_CACHE.time < 300000) return HOME_CACHE.list;
    const list = responseCards(searchList(' ', '1', ''));
    HOME_CACHE = { time: Date.now(), list: list };
    return list;
}
function home(filter) {
    const result = { 'class': CLASSES, list: getHomeList() };
    if (filter) result.filters = {};
    return JSON.stringify(result);
}
function homeVod() {
    return JSON.stringify({ list: getHomeList() });
}
function category(tid, pg, filter, extend) {
    const res = searchList(' ', pg, tid);
    if (!res) return emptyList();
    return JSON.stringify({
        list: responseCards(res),
        page: parseInt(res.page, 10) || parseInt(pg, 10) || 1,
        pagecount: parseInt(res.pagecount, 10) || 1,
        limit: parseInt(res.limit, 10) || 20,
        total: parseInt(res.total, 10) || 0
    });
}
function search(wd, quick, pg) {
    const res = searchList(wd, pg || 1, '');
    return JSON.stringify({ list: responseCards(res) });
}
function detail(ids) {
    const id = text(Array.isArray(ids) ? ids[0] : ids).trim();
    if (!id) return emptyList();
    const res = api('video_detail', {
        id: id,
        sign_md5: CFG.sign_md5,
        apk_path: '',
        apk_length: CFG.apk_length
    });
    const info = res && res.data && res.data.vod_info;
    if (!info || typeof info !== 'object') return emptyList();

    ROUTES = Object.create(null);
    const from = [], urls = [], nameCounts = Object.create(null);
    const players = Array.isArray(info.vod_url_with_player) ? info.vod_url_with_player : [];
    for (const player of players) {
        if (!player || typeof player !== 'object') continue;
        const code = text(player.code) || text(player.name) || '线路';
        let name = text(player.name).replace(/[$#]/g, '').trim() || code;
        const raw = text(player.url) || text(player.urls);
        if (!raw) continue;
        const episodes = [], parts = raw.split('#');
        for (const part of parts) {
            const pos = part.indexOf('$');
            if (pos < 1) continue;
            const title = part.substring(0, pos).trim(), address = part.substring(pos + 1).trim();
            if (title && address) episodes.push(title + '$' + address);
        }
        if (!episodes.length && raw.indexOf('http') === 0) episodes.push('播放$' + raw);
        if (!episodes.length) continue;

        nameCounts[name] = (nameCounts[name] || 0) + 1;
        if (nameCounts[name] > 1) name += '_' + nameCounts[name];
        ROUTES[name] = {
            code: code,
            parse_api: text(player.parse_api),
            extra_parse_api: text(player.extra_parse_api),
            parse_secret: truthy(player.parse_secret)
        };
        from.push(name);
        urls.push(episodes.join('#'));
    }
    if (!from.length) return emptyList();
    const vod = {
        vod_id: text(info.vod_id) || id,
        vod_name: text(info.vod_name),
        vod_pic: text(info.vod_pic),
        vod_content:'【琉🔹芸❤广告勿信👉剧情】📢'+ text(info.vod_content),
        vod_remarks: text(info.vod_remarks) || text(info.vod_state),
        vod_year: text(info.vod_year),
        vod_area: text(info.vod_area),
        vod_actor: text(info.vod_actor),
        vod_director: text(info.vod_director),
        vod_play_from: from.join('$$$'),
        vod_play_url: urls.join('$$$')
    };
    return JSON.stringify({ list: [vod] });
}
function play(flag, id, vipFlags) {
    let url = text(id).trim(), resolved = '';
    const route = ROUTES[text(flag)];
    if (route && url) {
        if (route.parse_secret) {
            const res = api('secret_parse_api_url', { url: url, player_code: route.code });
            resolved = extractPlayUrl(res && res.data);
        } else resolved = resolveViaParse(route, url);
    }
    if (!resolved && isVideoFormat(url)) resolved = url;
    if (!resolved) return JSON.stringify({ parse: 0, url: '', header: '{}', msg: '播放地址获取失败' });
    const headers = { 'User-Agent': CFG.user_agent };
    const match = /^(https?):\/\/([^\/:?]+)/.exec(resolved);
    if (match) headers.Referer = match[1] + '://' + match[2] + '/';
    const result = { parse: 0, url: resolved, header: JSON.stringify(headers) };
    if (resolved.toLowerCase().indexOf('.m3u8') >= 0) result.format = 'application/x-mpegURL';
    return JSON.stringify(result);
}

export default { init, home, homeVod, category, detail, play, search };
