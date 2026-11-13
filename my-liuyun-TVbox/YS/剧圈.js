// 剧圈圈 (app99族) - QuickJS 独立版
// 由原 app99.py 通用引擎同步化重写, 配置已固化, 接口无需 ext
// 协议: AES-CBC(uuid为密钥, 随机IV前置) 加密通信, SHA-256 签名, 响应可选 zlib 压缩

// ==================== 固化配置 (剧圈圈) ====================
const CFG = {
    host: "http://124.221.3.182:19987/app/bn",
    appkey: "d1f0c269eab74d93821fffc9befdbbba",
    versionName: "1.2.0",
    name: "剧圈圈",
    package: "com.qingtangxiaozhuan.xyz",
    buildNumber: "2002",
    buildSignature: "054FA8DDA4319C6B6A9B954CA5777541C993F00B1B0BD4394F7EDE48184C4594",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    apiVersion: "0b4328287a5d953e",
    loginPaths: ["/app/log", "/app/userInfo"]
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
        else { i += 3; out += " "; }
    }
    return out;
}
function hexenc(bytes) { let s = ""; for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16); return s; }
function randBytes(n) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); return a; }
function genUuid() {
    const h = "0123456789abcdef";
    let s = "";
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
        else if (i === 14) s += "4";
        else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
        else s += h[Math.floor(Math.random() * 16)];
    }
    return s;
}

// ==================== AES (纯JS, CBC, 支持128/192/256) ====================
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

// ==================== SHA-256 (纯JS, 大端长度编码) ====================
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
    for (const x of hs) { const u = x >>> 0; out.push((u >>> 24) & 255, (u >>> 16) & 255, (u >>> 8) & 255, u & 255); }
    return out;
}
function sha256Hex(str) { return hexenc(sha256Bytes(utf8enc(str))); }

// ==================== zlib 解压 (纯JS inflate, 0x78头) ====================
const LEN_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LEN_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const CLC_ORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
let FIX_LIT_HUFF = null, FIX_DIST_HUFF = null;
function huffBuild(lengths) {
    const count = new Array(16).fill(0);
    for (let i = 0; i < lengths.length; i++) {
        if (lengths[i] > 15) throw new Error("bad huffman len");
        count[lengths[i]]++;
    }
    if (count[0] === lengths.length) throw new Error("no huffman codes");
    const offs = new Array(17).fill(0);
    for (let l = 1; l <= 15; l++) offs[l + 1] = offs[l] + count[l];
    const syms = new Array(lengths.length);
    for (let s = 0; s < lengths.length; s++) if (lengths[s]) syms[offs[lengths[s]]++] = s;
    return { count: count, syms: syms };
}
function inflateRaw(data, off) {
    let pos = off, bitbuf = 0, bitcnt = 0;
    const out = [];
    function bits(n) {
        while (bitcnt < n) {
            if (pos >= data.length) throw new Error("inflate eof");
            bitbuf |= data[pos++] << bitcnt;
            bitcnt += 8;
        }
        const v = bitbuf & ((1 << n) - 1);
        bitbuf = bitbuf >>> n;
        bitcnt -= n;
        return v;
    }
    function huffDecode(h) {
        let code = 0, first = 0, index = 0;
        for (let len = 1; len <= 15; len++) {
            code |= bits(1);
            const cnt = h.count[len];
            if (code - first < cnt) return h.syms[index + code - first];
            index += cnt;
            first = (first + cnt) << 1;
            code <<= 1;
        }
        throw new Error("bad huffman code");
    }
    function stored() {
        bitbuf = 0;
        const drop = bitcnt % 8;
        bitcnt -= drop;
        while (bitcnt >= 8) { pos--; bitcnt -= 8; }
        if (pos + 4 > data.length) throw new Error("stored eof");
        const len = data[pos] | (data[pos + 1] << 8);
        pos += 4;
        if (pos + len > data.length) throw new Error("stored data eof");
        for (let i = 0; i < len; i++) out.push(data[pos++]);
    }
    function decodeBlock(litHuff, distHuff) {
        while (true) {
            const sym = huffDecode(litHuff);
            if (sym < 256) { out.push(sym); continue; }
            if (sym === 256) return;
            const li = sym - 257;
            if (li >= 29) throw new Error("bad len sym");
            const len = LEN_BASE[li] + bits(LEN_EXTRA[li]);
            const dsym = huffDecode(distHuff);
            if (dsym >= 30) throw new Error("bad dist sym");
            const dist = DIST_BASE[dsym] + bits(DIST_EXTRA[dsym]);
            if (dist > out.length) throw new Error("dist too far");
            for (let i = 0; i < len; i++) out.push(out[out.length - dist]);
        }
    }
    let last = 0;
    do {
        last = bits(1);
        const type = bits(2);
        if (type === 0) stored();
        else if (type === 1) {
            if (!FIX_LIT_HUFF) {
                const ll = [];
                for (let i = 0; i < 288; i++) ll.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
                FIX_LIT_HUFF = huffBuild(ll);
                FIX_DIST_HUFF = huffBuild(new Array(30).fill(5));
            }
            decodeBlock(FIX_LIT_HUFF, FIX_DIST_HUFF);
        } else if (type === 2) {
            const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
            const clLen = new Array(19).fill(0);
            for (let i = 0; i < hclen; i++) clLen[CLC_ORDER[i]] = bits(3);
            const clHuff = huffBuild(clLen);
            const lens = [];
            while (lens.length < hlit + hdist) {
                const s = huffDecode(clHuff);
                if (s < 16) lens.push(s);
                else if (s === 16) {
                    if (!lens.length) throw new Error("repeat with no prev");
                    const prev = lens[lens.length - 1], rep = 3 + bits(2);
                    for (let i = 0; i < rep; i++) lens.push(prev);
                } else if (s === 17) {
                    const z = 3 + bits(3);
                    for (let i = 0; i < z; i++) lens.push(0);
                } else {
                    const z = 11 + bits(7);
                    for (let i = 0; i < z; i++) lens.push(0);
                }
            }
            if (lens.length !== hlit + hdist) throw new Error("lens overrun");
            decodeBlock(huffBuild(lens.slice(0, hlit)), huffBuild(lens.slice(hlit)));
        } else throw new Error("bad block type");
    } while (!last);
    return out;
}
function zlibInflate(data) {
    if (data.length < 2 || data[0] !== 0x78) throw new Error("not zlib");
    return inflateRaw(data, 2);
}

// ==================== 全局状态 ====================
let UUID = genUuid();
let TOKEN = "";
let PLAYER_CFG = {};
let PARSERS = [];
let CATEGORIES = [];
let INITED = false;

// ==================== 加解密与签名 ====================
function aesKeyBytes() {
    const kb = utf8enc(String(UUID).replace(/-/g, ""));
    if (kb.length === 16 || kb.length === 24 || kb.length === 32) return kb;
    const zero = utf8enc("00000000000000000000000000000000");
    return kb.concat(zero).slice(0, 32);
}
function aesEncStr(text) {
    const iv = randBytes(16);
    const ct = aesCbcEnc(aesKeyBytes(), iv, utf8enc(text));
    return b64enc(iv.concat(ct));
}
function aesDecStr(b64) {
    try {
        const raw = b64dec(b64);
        if (raw.length < 32) return "";
        const dec = aesCbcDec(aesKeyBytes(), raw.slice(0, 16), raw.slice(16));
        try { return utf8dec(zlibInflate(dec)); } catch (e) {}
        return utf8dec(dec);
    } catch (e) { return ""; }
}
function makeSign(body, ts, nonce) {
    return sha256Hex(body + ":" + ts + ":" + nonce + ":" + TOKEN + ":" + CFG.appkey);
}

// ==================== 协议请求 ====================
async function apiReq(endpoint, data) {
    const nonce = b64enc(randBytes(16));
    const ts = String(Date.now());
    const payload = {};
    for (const k in data) payload[k] = data[k];
    if (payload.token === undefined) payload.token = TOKEN;
    if (payload.timestamp === undefined) payload.timestamp = ts;
    if (payload.nonce === undefined) payload.nonce = nonce;
    const body = aesEncStr(JSON.stringify(payload));
    const headers = {
        "User-Agent": CFG.ua,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "client_type": "android",
        "uuid": UUID,
        "timestamp": ts,
        "sign": makeSign(body, ts, nonce),
        "nonce": nonce,
        "appkey": CFG.appkey,
        "version": CFG.apiVersion,
        "api_version": "v1"
    };
    try {
        const r = await req(CFG.host + endpoint, { method: "POST", headers: headers, body: body, timeout: 15000 });
        return aesDecStr((r && r.content) || "");
    } catch (e) { return ""; }
}
function updateParsers(v) {
    let arr = null;
    if (Array.isArray(v)) arr = v;
    else if (v && typeof v === "object") {
        const keys = ["data", "list", "items", "result"];
        for (const k of keys) if (Array.isArray(v[k])) { arr = v[k]; break; }
    }
    if (arr) PARSERS = arr;
}
async function systemInit() {
    const r = JSON.parse((await apiReq("/app/systemInit", {
        v: CFG.versionName, n: CFG.name, s: CFG.buildSignature,
        pl: "1", apiVersion: "v2", token: ""
    })) || "{}");
    if (r.player && typeof r.player === "object") PLAYER_CFG = r.player;
    updateParsers(r.parser_api);
    updateParsers(r.parserapi);
    updateParsers(r.parses);
    if (r.categorys !== undefined) {
        const cd = r.categorys;
        if (cd && typeof cd === "object" && Array.isArray(cd.data)) CATEGORIES = cd.data;
        else if (Array.isArray(cd)) CATEGORIES = cd;
    } else if (Array.isArray(r.categories)) CATEGORIES = r.categories;
}
async function login() {
    if (TOKEN) return;
    for (const path of CFG.loginPaths) {
        try {
            const r = JSON.parse((await apiReq(path, {
                appName: CFG.name, appkey: CFG.appkey, package: CFG.package,
                buildNumber: CFG.buildNumber, buildSignature: CFG.buildSignature,
                uuid: UUID, version: CFG.versionName
            })) || "{}");
            if (r.data && typeof r.data === "object") {
                const info = r.data;
                TOKEN = String(info.token || info.usertoken || TOKEN);
                if (info.uuid) UUID = String(info.uuid);
                if (info.player && typeof info.player === "object") PLAYER_CFG = info.player;
                updateParsers(info.parser_api);
                updateParsers(info.parserapi);
            }
            if (r.userInfo && r.userInfo.user_token) TOKEN = String(r.userInfo.user_token);
            if (TOKEN) return;
        } catch (e) {}
    }
}
async function doInit() {
    try { await systemInit(); } catch (e) {}
    try { await login(); } catch (e) {}
}
async function ensureInit() {
    if (INITED) return;
    INITED = true;
    await doInit();
}

// ==================== 线路排序 ====================
const PLAY_ORDER = [
    "咕噜4K", "菲乐4K", "JD4K", "NB蓝光", "YY蓝光", "YD蓝光", "JD蓝光", "4K", "蓝光",
    "高清", "蚂蚁", "咖啡", "量子", "非凡", "暴风", "小熊"
];
const MANUAL_MAP = {
    "baofeng": ["暴风"], "liangzi": ["量子"], "kafei": ["咖啡"], "xiaoxiong": ["小熊"],
    "mayi": ["蚂蚁"], "feifan": ["非凡"], "haiwai": ["海外"],
    "gulu4k": ["咕噜4K", "4K"], "feile4k": ["菲乐4K", "4K"], "zhenying4k": ["臻影4K", "4K"],
    "jingbao4k": ["鲸宝4K", "4K"], "jingbao2k": ["鲸宝2K", "2K"], "jingpin2k": ["精品2K", "2K"],
    "qihuan4k": ["候补4K", "4K"], "houbu4k": ["候补4K", "4K"],
    "xuancai4k": ["炫彩4K", "4K"], "xuancai": ["炫彩4K", "4K"], "jd4k": ["JD4K", "4K"],
    "jdblue": ["JD蓝光", "蓝光"], "ydblue": ["YD蓝光", "蓝光"], "yyblue": ["YY蓝光", "蓝光"],
    "nbblue": ["NB蓝光", "蓝光"], "penguinblue": ["企鹅蓝光A", "蓝光"], "qiebluea": ["企鹅蓝光A", "蓝光"],
    "xunfei": ["☆讯飞☆", "讯飞"], "qiqu": ["☆奇趣☆", "奇趣"], "guozhi": ["☆果汁☆", "果汁"], "kumeng": ["☆酷萌☆", "酷萌"],
    "caiji": ["采集"], "caiji1": ["采集1", "采集"], "caiji2": ["采集2", "采集"], "caiji3": ["采集3", "采集"],
    "zx1": ["专线1"], "zx2": ["专线2"], "zx3": ["专线3"], "zx4": ["专线4"],
    "by1": ["备用1"], "by2": ["备用2"], "by3": ["备用3"], "by4": ["备用4"]
};
function normSrc(s) {
    s = String(s || "").trim();
    if (!s) return "";
    s = s.split("线路").join("").split("频道").join("").split("资源").join("");
    s = s.split("（").join("(").split("）").join(")");
    s = s.split("☆").join("");
    s = s.split(" ").join("").split("-").join("").split("_").join("");
    s = s.split("蓝盤").join("蓝光").split("藍光").join("蓝光");
    return s.toLowerCase();
}
function srcAliases(srcCode) {
    srcCode = String(srcCode || "").trim();
    const aliases = {};
    if (!srcCode) return aliases;
    const add = (v) => { if (v) { aliases[v] = 1; const n = normSrc(v); if (n) aliases[n] = 1; } };
    add(srcCode);
    const cfg = PLAYER_CFG[srcCode];
    if (cfg && typeof cfg === "object") {
        const keys = ["code", "name", "show", "title"];
        for (const k of keys) add(String(cfg[k] || "").trim());
    }
    const codeKey = normSrc(srcCode);
    for (const k in MANUAL_MAP) {
        if (codeKey === normSrc(k)) {
            const vals = MANUAL_MAP[k];
            for (const v of vals) add(v);
        }
    }
    return aliases;
}
function kwScore(srcCode) {
    const aliases = srcAliases(srcCode);
    const parts = [];
    for (const a in aliases) parts.push(a);
    const text = parts.join("|");
    const nt = normSrc(text);
    let score = 0;
    if (nt.indexOf("4k") >= 0 || nt.indexOf("2160") >= 0 || nt.indexOf("uhd") >= 0) score += 1200;
    if (text.indexOf("蓝光") >= 0 || nt.indexOf("bluray") >= 0 || nt.indexOf("blu") >= 0 || nt.indexOf("remux") >= 0 || nt.indexOf("原盘") >= 0) score += 900;
    if (nt.indexOf("2k") >= 0 || nt.indexOf("1440") >= 0) score += 500;
    if (nt.indexOf("1080") >= 0 || nt.indexOf("超清") >= 0 || nt.indexOf("高清") >= 0 || nt.indexOf("h265") >= 0 || nt.indexOf("hevc") >= 0) score += 300;
    if (text.indexOf("专线") >= 0) score += 80;
    if (text.indexOf("采集") >= 0 || nt.indexOf("caiji") >= 0) score -= 180;
    if (text.indexOf("备用") >= 0) score -= 120;
    if (text.indexOf("海外") >= 0) score -= 60;
    return score;
}
let ORDER_INDEX = null;
function prioIdx(srcCode) {
    if (!ORDER_INDEX) {
        ORDER_INDEX = {};
        for (let i = 0; i < PLAY_ORDER.length; i++) {
            const n = normSrc(PLAY_ORDER[i]);
            if (n && ORDER_INDEX[n] === undefined) ORDER_INDEX[n] = i;
        }
    }
    let best = PLAY_ORDER.length + 999;
    const aliases = srcAliases(srcCode);
    for (const a in aliases) {
        const idx = ORDER_INDEX[normSrc(a)];
        if (idx !== undefined && idx < best) best = idx;
    }
    return best;
}
function sortPlaySources(playFroms, playUrls) {
    if (!playFroms.length || !playUrls.length) return [playFroms, playUrls];
    const n = Math.min(playFroms.length, playUrls.length);
    const paired = [];
    for (let i = 0; i < n; i++) {
        const src = String(playFroms[i]).trim();
        paired.push({ from: src, url: playUrls[i], prio: prioIdx(src), score: kwScore(src), idx: i });
    }
    paired.sort((a, b) => {
        if (a.prio !== b.prio) return a.prio - b.prio;
        if (a.score !== b.score) return b.score - a.score;
        return a.idx - b.idx;
    });
    const froms = [], urls = [];
    for (const p of paired) { froms.push(p.from); urls.push(p.url); }
    return [froms, urls];
}

// ==================== 公共工具 ====================
function S(x) { return x === null || x === undefined ? "" : String(x); }
function addPrefix(s) {
    s = S(s);
    return s.indexOf(PREFIX) === 0 ? s : PREFIX + s;
}
function parseVideos(arr) {
    const result = [];
    if (!Array.isArray(arr)) return result;
    for (const v of arr) {
        if (!v || typeof v !== "object") continue;
        result.push({
            vod_id: S(v.id),
            vod_name: S(v.name),
            vod_pic: S(v.pic),
            vod_remarks: S(v.remarks),
            vod_year: S(v.year),
            vod_content: addPrefix(v.blurb),
            type_name: S(v.class),
            vod_area: S(v.area),
            vod_actor: S(v.actor),
            vod_director: S(v.director)
        });
    }
    return result;
}
function extractPagecount(r) {
    const keys = ["page_count", "pagecount", "pageCount"];
    for (const k of keys) {
        if (r && r[k] !== undefined && r[k] !== null && r[k] !== "") {
            const n = parseInt(r[k], 10);
            if (!isNaN(n)) return n;
        }
    }
    return 1;
}
function toStrArray(x) {
    if (typeof x === "string") return x.split(",").filter((v) => v);
    if (Array.isArray(x)) return x.map((v) => String(v)).filter((v) => v);
    return [];
}
function pyQuote(s) {
    return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

// ==================== TVBox 接口 ====================
function init(ext) {
    // 同步初始化, 网络初始化在首次请求时惰性执行
}

async function home(filter) {
    await ensureInit();
    const classes = [];
    const filters = {};
    try {
        for (const cat of CATEGORIES) {
            const cid = S(cat && cat.id), cname = S(cat && cat.name);
            if (!cid || !cname) continue;
            classes.push({ type_id: cid, type_name: cname });
            let ext = (cat && (cat.typeextend || cat.type_extend)) || {};
            if (typeof ext === "string") { try { ext = JSON.parse(ext); } catch (e) { ext = {}; } }
            const fl = [];
            if (ext && typeof ext === "object") {
                const cls = toStrArray(ext.class);
                const areas = toStrArray(ext.areas !== undefined ? ext.areas : ext.area);
                const langs = toStrArray(ext.lang);
                const years = toStrArray(ext.years !== undefined ? ext.years : ext.year);
                fl.push({ key: "class", name: "类型", value: [{ n: "全部", v: "" }].concat(cls.map((v) => ({ n: v, v: v }))) });
                fl.push({ key: "area", name: "地区", value: [{ n: "全部", v: "" }].concat(areas.map((v) => ({ n: v, v: v }))) });
                fl.push({ key: "lang", name: "语言", value: [{ n: "全部", v: "" }].concat(langs.map((v) => ({ n: v, v: v }))) });
                fl.push({ key: "year", name: "年份", value: [{ n: "全部", v: "" }].concat(years.map((v) => ({ n: v, v: v }))) });
            }
            filters[cid] = fl;
        }
    } catch (e) {}
    if (!classes.length) {
        const defs = [["1", "剧集"], ["2", "电影"], ["3", "综艺"], ["4", "动漫"], ["5", "短剧"]];
        for (const d of defs) classes.push({ type_id: d[0], type_name: d[1] });
    }
    let videos = [];
    try {
        const r = JSON.parse((await apiReq("/vod/search", { kw: "", page: "1", limit: 21, pid: "1", orderBy: "time", isCategory: 1 })) || "{}");
        if (Array.isArray(r.data)) videos = parseVideos(r.data);
    } catch (e) {}
    if (!videos.length && classes.length) {
        for (let i = 0; i < classes.length && videos.length < 20; i++) {
            try {
                const r2 = JSON.parse((await apiReq("/vod/search", { kw: "", page: "1", limit: 21, pid: classes[i].type_id, orderBy: "time", isCategory: 1 })) || "{}");
                if (Array.isArray(r2.data)) videos = videos.concat(parseVideos(r2.data));
            } catch (e) {}
        }
    }
    return JSON.stringify({ class: classes, list: videos.slice(0, 20), filters: filter ? filters : {} });
}

async function homeVod() {
    return home(false);
}

async function category(tid, pg, filter, extend) {
    await ensureInit();
    let videos = [];
    let pagecount = 1;
    const page = parseInt(pg, 10) || 1;
    try {
        extend = extend || {};
        const data = { kw: "", page: String(page), limit: 21, pid: String(tid), orderBy: "time", isCategory: 1 };
        if (extend.class) data.class = String(extend.class);
        if (extend.area) data.area = String(extend.area);
        if (extend.lang) data.lang = String(extend.lang);
        if (extend.year) data.year = String(extend.year);
        const r = JSON.parse((await apiReq("/vod/search", data)) || "{}");
        if (Array.isArray(r.data)) {
            videos = parseVideos(r.data);
            pagecount = extractPagecount(r);
        }
    } catch (e) {}
    return JSON.stringify({ page: page, pagecount: pagecount, limit: 21, total: pagecount * 21, list: videos });
}

async function detail(ids) {
    await ensureInit();
    const id = Array.isArray(ids) ? S(ids[0]) : S(ids);
    try {
        const r = JSON.parse((await apiReq("/vod/detail", { id: id, eps: "1", v: "2.0.0", pl: 1 })) || "{}");
        if (!r.data || typeof r.data !== "object") return JSON.stringify({ list: [] });
        const d = r.data;
        const vod = {
            vod_id: S(d.id),
            vod_name: S(d.name),
            vod_pic: S(d.pic),
            vod_remarks: S(d.remarks),
            vod_year: S(d.year),
            vod_content: addPrefix(d.content),
            type_name: S(d.class),
            vod_area: S(d.area),
            vod_actor: S(d.actor),
            vod_director: S(d.director),
            vod_play_from: "",
            vod_play_url: ""
        };
        const fromRaw = S(d.play_from !== undefined ? d.play_from : d.playfrom);
        const urlRaw = S(d.play_url !== undefined ? d.play_url : d.playurl);
        const playFroms = fromRaw ? fromRaw.split("$$$") : [];
        const playUrls = urlRaw ? urlRaw.split("$$$") : [];
        const sorted = sortPlaySources(playFroms, playUrls);
        const sFroms = sorted[0], sUrls = sorted[1];
        const newFroms = [];
        for (const src0 of sFroms) {
            const src = src0.trim();
            if (PLAYER_CFG[src] && PLAYER_CFG[src].name) newFroms.push(String(PLAYER_CFG[src].name));
            else newFroms.push(src);
        }
        const newUrls = [];
        for (let i = 0; i < sUrls.length; i++) {
            const srcName = i < sFroms.length ? sFroms[i] : "";
            const eps = sUrls[i] ? sUrls[i].split("#") : [];
            const epList = [];
            for (const ep of eps) {
                const di = ep.indexOf("$");
                if (di < 0) continue;
                const epName = ep.substring(0, di);
                const epUrl = ep.substring(di + 1);
                const epNum = epName.replace(/D+/g, "") || "1";
                epList.push(epName + "$" + epUrl + "@" + srcName + "@" + vod.vod_name + "@" + epNum);
            }
            if (epList.length) newUrls.push(epList.join("#"));
        }
        vod.vod_play_from = newFroms.join("$$$");
        vod.vod_play_url = newUrls.join("$$$");
        return JSON.stringify({ list: [vod] });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function search(key, quick, pg) {
    await ensureInit();
    let videos = [];
    let pagecount = 1;
    const page = parseInt(pg, 10) || 1;
    try {
        let r = JSON.parse((await apiReq("/vod/search", { kw: key, page: page, limit: 21, orderBy: "vod_hits_month", sort: "desc" })) || "{}");
        if (Array.isArray(r.data)) {
            videos = parseVideos(r.data);
            pagecount = extractPagecount(r);
        }
        if (!videos.length) {
            r = JSON.parse((await apiReq("/vod/search", { kw: key, page: page, limit: 21, orderBy: "vodhitsmonth", sort: "desc" })) || "{}");
            if (Array.isArray(r.data)) {
                videos = parseVideos(r.data);
                pagecount = extractPagecount(r);
            }
        }
    } catch (e) {}
    return JSON.stringify({ list: videos, page: page, pagecount: pagecount });
}

function parseCandidates(apiUrl, url) {
    const out = [];
    if (apiUrl.indexOf("{url}") >= 0) {
        out.push(apiUrl.split("{url}").join(pyQuote(url)));
        out.push(apiUrl.split("{url}").join(url));
    } else {
        out.push(apiUrl + url);
        out.push(apiUrl + pyQuote(url));
    }
    const uniq = [];
    for (const x of out) if (x && uniq.indexOf(x) < 0) uniq.push(x);
    return uniq;
}
function extractRealUrl(data) {
    if (data && typeof data === "object") {
        const keys = ["url", "playUrl", "play_url"];
        for (const k of keys) {
            const v = data[k];
            if (typeof v === "string" && v.trim()) return v.trim();
        }
        const nests = ["data", "result"];
        for (const k of nests) {
            const v = data[k];
            if (v && typeof v === "object") {
                for (const kk of keys) {
                    const vv = v[kk];
                    if (typeof vv === "string" && vv.trim()) return vv.trim();
                }
            }
        }
    }
    return "";
}

async function play(flag, id, vipFlags) {
    const uaHdr = { "User-Agent": CFG.ua };
    try {
        const parts = String(id).split("@");
        let url = parts[0] || "";
        const srcCode = parts.length > 1 ? parts[1] : "";
        const vodName = parts.length > 2 ? parts[2] : "";
        const vodIndex = parts.length > 3 ? parts[3] : "1";
        const danmaku = "http://127.0.0.1:9978/proxy?do=appdanmu&vodName=" + vodName + "&vodIndex=" + vodIndex + "&vodUrl=";
        const pCfg = srcCode ? PLAYER_CFG[srcCode] : null;
        if (pCfg && typeof pCfg === "object" && (parseInt(pCfg.type, 10) || 0) !== 0) {
            if (!PARSERS.length) await doInit();
            if (PARSERS.length) {
                const parseUrls = S(pCfg.parseUrl || pCfg.parseurl);
                const parseIds = parseUrls.split(",").map((x) => x.trim()).filter((x) => x);
                let selected = [];
                for (const parser of PARSERS) {
                    const pid = S(parser && parser.id).trim();
                    if (parseIds.length && parseIds.indexOf(pid) < 0) continue;
                    selected.push(parser);
                }
                if (!selected.length && parseIds.length) selected = PARSERS;
                for (const parser of selected) {
                    const apiUrl = S(parser && (parser.api_url || parser.apiurl || parser.apiUrl || parser.url)).trim();
                    if (!apiUrl) continue;
                    const candidates = parseCandidates(apiUrl, url);
                    for (const target of candidates) {
                        try {
                            const resp = await req(target, { headers: uaHdr, timeout: 10000 });
                            const r = JSON.parse((resp && resp.content) || "");
                            const realUrl = extractRealUrl(r);
                            if (realUrl) {
                                const hdr = (r.header && typeof r.header === "object") ? r.header : uaHdr;
                                return JSON.stringify({ parse: 0, url: realUrl, header: hdr, danmaku: danmaku });
                            }
                        } catch (e) {}
                    }
                }
                if (parseIds.length) {
                    return JSON.stringify({ parse: 1, url: url, header: uaHdr, danmaku: danmaku });
                }
            }
        }
        return JSON.stringify({ parse: 0, url: url, header: uaHdr, danmaku: danmaku });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: "", header: uaHdr, danmaku: "" });
    }
}

const __api = { init: init, home: home, homeVod: homeVod, category: category, detail: detail, play: play, search: search };
export function __jsEvalReturn() { return __api; }
export default __api;
