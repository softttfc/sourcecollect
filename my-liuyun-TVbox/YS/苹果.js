// ================== 影视·小苹果APP · TVBox QuickJS ==================
// 小苹果 (苹果.py v1.0.0.3) 
// 原生App协议: protobuf + AES-128/256 + RSA(BigInt), 纯JS实现
// host 从腾讯云COS配置动态获取; 加密核心与已验证的人人.js一致(同密钥同服务端)
// 二进制POST: body传Latin-1字符串, Content-Type带charset=ISO-8859-1; buffer:2收base64

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
function hexenc(bytes) { let s = ""; for (const b of bytes) s += (b < 16 ? "0" : "") + b.toString(16); return s; }

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
function pkcs7pad(bytes) {
    const n = 16 - (bytes.length % 16), out = bytes.slice();
    for (let i = 0; i < n; i++) out.push(n);
    return out;
}
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
function aesEcbEnc(key, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    for (let i = 0; i < data.length; i += 16) { const b = aesEncBlock(ek, data.slice(i, i + 16)); for (const x of b) out.push(x); }
    return out;
}
function aesEcbDec(key, bytes) {
    const ek = aesKeyExp(key), out = [];
    for (let i = 0; i + 16 <= bytes.length; i += 16) { const b = aesDecBlock(ek, bytes.slice(i, i + 16)); for (const x of b) out.push(x); }
    return pkcs7unpad(out);
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

// ==================== RSA (纯JS大数模幂, PKCS1 v1.5) ====================
// 16位字小端大数运算，兼容低版本QuickJS（无BigInt）
function bnFromHex(hex) {
    if (hex.indexOf("0x") === 0) hex = hex.substring(2);
    const a = [];
    let i = hex.length;
    while (i > 0) {
        const j = i > 4 ? i - 4 : 0;
        a.push(parseInt(hex.substring(j, i), 16));
        i = j;
    }
    return a;
}
const RSA_N = bnFromHex("0x9db8d1277f119a2ee411939001cd71e13d5e37ce2d34b021e32e8f0161cf968bac579b66f8bf48b6f12ab85a53422a1b1e7edf5fcfc90efea2ebebfd36da8d5172e394edee0614bdd4f569cd383c1105849859df8af27aa923fb405039991011915aa8eb73bc7a68c97703ec699d690b6cf08bb2e85bbae504dedbf4f6878ea7");
function bnCmp(a, b) {
    let i = a.length > b.length ? a.length : b.length;
    while (i-- > 0) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x > y ? 1 : -1;
    }
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
            out[i + j] = t & 0xFFFF;
            carry = Math.floor(t / 65536);
        }
        let k = i + b.length;
        while (carry > 0) {
            const t = out[k] + carry;
            out[k] = t & 0xFFFF;
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
    while (w) { bits++; w = w >> 1; }
    return bits;
}
function bnMod(x, m) {
    let rem = [0];
    const bits = bnBitLen(x);
    for (let i = bits - 1; i >= 0; i--) {
        let carry = 0;
        for (let j = 0; j < rem.length; j++) {
            const v = (rem[j] << 1) | carry;
            rem[j] = v & 0xFFFF;
            carry = v >> 16;
        }
        if (carry) rem.push(carry);
        if (((x[i >> 4] || 0) >> (i & 15)) & 1) rem[0] = rem[0] | 1;
        if (bnCmp(rem, m) >= 0) rem = bnSub(rem, m);
    }
    return rem;
}
function rsaEncrypt(msgBytes) {
    const k = 128;
    const ps = [];
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    const em = [0, 2].concat(ps).concat([0]).concat(msgBytes);
    let m = [], cur = 0, bits = 0;
    for (let i = em.length - 1; i >= 0; i--) {
        cur = cur | (em[i] << bits);
        bits += 8;
        if (bits >= 16) { m.push(cur & 0xFFFF); cur = cur >> 16; bits -= 16; }
    }
    if (bits > 0) m.push(cur);
    if (!m.length) m = [0];
    // 65537 = 2^16 + 1：连续平方16次再乘一次m
    let r = m.slice();
    for (let i = 0; i < 16; i++) r = bnMod(bnMul(r, r), RSA_N);
    r = bnMod(bnMul(r, m), RSA_N);
    const out = [];
    cur = 0; bits = 0;
    let idx = 0;
    while (out.length < 128) {
        while (bits < 8 && idx < r.length) { cur = cur | (r[idx++] << bits); bits += 16; }
        out.unshift(cur & 0xFF);
        cur = cur >> 8;
        bits -= 8;
    }
    return out;
}

// ==================== SHA-256 + HMAC ====================
const SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sha256(bytes) {
    const data = bytes.slice();
    const bitLen = data.length * 8;
    data.push(0x80);
    while (data.length % 64 !== 56) data.push(0);
    for (let i = 7; i >= 0; i--) data.push(Math.floor(bitLen / Math.pow(256, i)) & 255);
    let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
    for (let off = 0; off < data.length; off += 64) {
        const w = [];
        for (let i = 0; i < 16; i++) w.push(((data[off + 4 * i] << 24) | (data[off + 4 * i + 1] << 16) | (data[off + 4 * i + 2] << 8) | data[off + 4 * i + 3]) >>> 0);
        for (let i = 16; i < 64; i++) {
            const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w.push((w[i - 16] + s0 + w[i - 7] + s1) >>> 0);
        }
        let [a, b, c, d, e, f, g, hh] = h;
        for (let i = 0; i < 64; i++) {
            const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + SHA_K[i] + w[i]) >>> 0;
            const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
            const mj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + mj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h = h.map((x, i) => (x + [a, b, c, d, e, f, g, hh][i]) >>> 0);
    }
    const out = [];
    for (const x of h) out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
    return out;
}
function hmacSha256(keyBytes, msgBytes) {
    let key = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes.slice();
    while (key.length < 64) key.push(0);
    const ipad = key.map(b => b ^ 0x36), opad = key.map(b => b ^ 0x5c);
    return sha256(opad.concat(sha256(ipad.concat(msgBytes))));
}

// ==================== protobuf ====================
function varintEnc(n) {
    n = Number(n) || 0;
    const out = [];
    while (true) {
        const x = n % 128;
        n = Math.floor(n / 128);
        if (n > 0) out.push(x | 0x80);
        else { out.push(x); return out; }
    }
}
function fldEnc(num, wire, payload) {
    const t = varintEnc((num << 3) | wire);
    if (wire === 2) return t.concat(varintEnc(payload.length)).concat(payload);
    return t.concat(payload);
}
function pbParse(buf) {
    const out = [];
    let i = 0;
    while (i < buf.length) {
        try {
            let tag = 0, sh = 0;
            while (true) { const b = buf[i++]; tag += (b & 0x7f) * Math.pow(2, sh); sh += 7; if (!(b & 0x80)) break; }
            const fn = Math.floor(tag / 8), wt = tag % 8;
            if (wt === 0) {
                let v = 0; sh = 0;
                while (true) { const b = buf[i++]; v += (b & 0x7f) * Math.pow(2, sh); sh += 7; if (!(b & 0x80)) break; }
                out.push([fn, wt, v]);
            } else if (wt === 2) {
                let ln = 0; sh = 0;
                while (true) { const b = buf[i++]; ln += (b & 0x7f) * Math.pow(2, sh); sh += 7; if (!(b & 0x80)) break; }
                out.push([fn, wt, buf.slice(i, i + ln)]);
                i += ln;
            } else if (wt === 5) { out.push([fn, wt, buf.slice(i, i + 4)]); i += 4; }
            else if (wt === 1) { out.push([fn, wt, buf.slice(i, i + 8)]); i += 8; }
            else break;
        } catch (e) { break; }
    }
    return out;
}

// ==================== 小苹果业务 ====================
const DEFAULT_HOST = "http://122.228.193.211:18008";
const CONFIG_URL = "https://xpgandroid03-1372779881.cos.ap-beijing.myqcloud.com/app_xpg_android.txt";
const NATIVE = utf8enc("ed5fdsgucxumegqa");
const DATAIV = utf8enc("OC1A06E197EF10CF3F6058CA7A803B5E");
const DATAKEY = utf8enc("S0VNDTJHOFHHCNMRAW5IV2TOS2PBPQ==");
const UA = "okhttp/3.12.1";
const UDID_BYTES = [];
for (let i = 0; i < 16; i++) UDID_BYTES.push(Math.floor(Math.random() * 256));
const UDID = hexenc(UDID_BYTES).toUpperCase();
const INTRO_PREFIX = "【琉🔹璃❤广告勿信👉剧情】📢";
const TIMEOUT = 20000;

let _host = DEFAULT_HOST;
let _site = CONFIG_URL;
let _decrypt = "1";

function rndStr(n) {
    const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let s = "";
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
}

function paramsData(ts) {
    const r16 = b64enc(utf8enc(rndStr(12)));
    const sig = b64enc(rsaEncrypt(utf8enc(String(ts) + r16 + "1003")));
    const b = b64enc(aesEcbEnc(DATAIV, utf8enc(String(ts) + r16)));
    const J = { country: "CN", vName: "1.0.0.3", cpuId: "", young: 0, facturer: "OnePlus", pkg: "com.juechufsh.android.xpg1", uuid: UDID, resolution: "1080x2256", mac: "02%3A00%3A00%3A00%3A00%3A00", sig: sig, abid: "2557", model: "PJX110", plat: "android", udid: UDID, dpi: "480", net: "1", lang: "zh", random_str: r16, brand: "OnePlus", timestamp: ts, density: "3.0", appName: "%E5%B0%8F%E8%8B%B9%E6%9E%9C%E5%BD%B1%E8%A7%86", cpu: "arm64-v8a", chid: "10000", carrier: "%E8%81%94%E9%80%9A", sig2: b.substring(0, 8), v: 1, sig3: b.substring(8), tenantId: "xpg", _vOsCode: "36", vOs: "16", vApp: "1003", device: 0, androidID: UDID.substring(0, 16).toLowerCase() };
    return hexenc(aesCbcEnc(NATIVE, NATIVE, utf8enc(JSON.stringify(J))));
}

function makeHeaders(ts, protobuf) {
    return {
        "User-Agent": UA, "Cache-Control": "no-cache",
        "Accept": protobuf ? "application/x-protobuf" : "application/json",
        "Content-Type": protobuf ? "application/x-protobuf" : "application/json; charset=utf-8",
        "publicParams": JSON.stringify({ paramsData: paramsData(ts) })
    };
}

function makeBody(kvs, ts) {
    const f8 = rndStr(8);
    const parts = [];
    for (const k in kvs) { if (String(kvs[k])) parts.push(k + "=" + kvs[k]); }
    const sb = parts.join("&");
    const aes = f8 + b64enc(aesEcbEnc(DATAKEY, utf8enc(sb + ts)));
    return fldEnc(1, 2, utf8enc(aes.substring(0, 20)))
        .concat(fldEnc(2, 2, utf8enc(aes.substring(20))))
        .concat(fldEnc(3, 2, utf8enc(rndStr(20))))
        .concat(fldEnc(4, 0, varintEnc(ts)))
        .concat(fldEnc(5, 2, utf8enc(f8)));
}

// 二进制POST: body传Latin-1字符串(每字节一字符), charset=ISO-8859-1使OkHttp逐字节发送; buffer:2收base64
function postProto(ep, kvs) {
    try {
        const ts = Date.now();
        const bodyBytes = makeBody(kvs, ts);
        let bodyStr = "";
        for (const b of bodyBytes) bodyStr += String.fromCharCode(b);
        const headers = makeHeaders(ts, true);
        headers["Content-Type"] = "application/x-protobuf; charset=ISO-8859-1";
        const r = req(_host + ep, { method: "POST", headers: headers, body: bodyStr, buffer: 2, timeout: TIMEOUT });
        const c = (r && r.content) || "";
        return c ? b64dec(c) : [];
    } catch (e) { return []; }
}

// JSON GET (getCategory / typeExtend / tag list)
function getJson(ep) {
    try {
        const r = req(_host + ep, { headers: makeHeaders(Date.now(), false), timeout: TIMEOUT });
        const c = (r && r.content) || "";
        return c ? JSON.parse(c) : {};
    } catch (e) { return {}; }
}

function dataOf(raw) {
    for (const t of pbParse(raw)) { if (t[0] === 3 && t[1] === 2) return t[2]; }
    return [];
}
function flatOf(g) {
    const m = {};
    for (const t of pbParse(g)) { m[t[0]] = t[1] === 2 ? utf8dec(t[2]) : t[2]; }
    return m;
}
function picsOf(s) {
    return (String(s || "").match(/https?:\/\/[^\x00-\x20"']+/g)) || [];
}
function cardOf(m) {
    const vid = String(m[3] || "");
    if (!vid || !m[5]) return null;
    const p = picsOf(m[2]);
    return { vod_id: vid, vod_name: m[5], vod_pic: p[0] || "", vod_remarks: m[13] || m[26] || "" };
}
function v5listOf(raw) {
    const out = [], seen = {};
    for (const t of pbParse(dataOf(raw))) {
        if (t[0] === 1 && t[1] === 2) {
            const c = cardOf(flatOf(t[2]));
            if (c && !seen[c.vod_id]) { seen[c.vod_id] = 1; out.push(c); }
        }
    }
    return out;
}

function isVideoFormat(url) {
    return /\.(mp4|m3u8|flv|mkv|avi|ts|mov|mpd|m4a|wmv)(\?.*)?$/i.test(String(url));
}

// ==================== TVBox 接口 ====================
function init(ext) {
    let cfg = null;
    try {
        if (ext && typeof ext === "object") cfg = ext;
        else if (typeof ext === "string" && ext.trim().charAt(0) === "{") cfg = JSON.parse(ext);
    } catch (e) { cfg = null; }
    if (cfg) {
        if (cfg.host) _host = String(cfg.host).replace(/\/+$/, "");
        if (cfg.site) _site = String(cfg.site);
        if (cfg.decrypt != null) _decrypt = String(cfg.decrypt);
    }
    if (!cfg || !cfg.host) {
        // 从COS配置获取最新域名
        try {
            const r = req(_site, { headers: { "User-Agent": UA }, timeout: 12000 });
            const obj = JSON.parse((r && r.content) || "{}");
            const domain = String(obj.domain || "").trim().replace(/\/+$/, "");
            if (domain) _host = domain;
        } catch (e) {}
    }
}

function home(filter) {
    const obj = getJson("/api/v3/drama/getCategory?orderBy=type_id");
    const data = obj.data || [];
    const classes = [], filters = {};
    for (const item of data) {
        if (!item || String(item.name || "") === "公告") continue;
        const tid = String(item.id || ""), name = String(item.name || "");
        if (!tid) continue;
        classes.push({ type_id: tid, type_name: name });

        // 优先 typeExtend 接口获取最新筛选
        let fl = [];
        try {
            const extObj = getJson("/api/ex/v3/drama/typeExtend?cate=" + tid);
            const extData = extObj.data || {};
            const mapping = [["movieClass", "class", "类型"], ["area", "area", "地区"], ["lang", "lang", "语言"], ["year", "year", "年份"], ["extendSort", "extend_sort", "排序"]];
            for (const mp of mapping) {
                const value = extData[mp[0]] || "";
                if (value) {
                    const vals = String(value).split(",").filter(x => x);
                    if (vals.length) fl.push({ key: mp[1], name: mp[2], value: vals.map(x => ({ n: x, v: x })) });
                }
            }
        } catch (e) {}

        // fallback: converUrl 解析
        if (!fl.length) {
            let ext = {};
            try {
                const rawFilter = item.converUrl || "";
                ext = typeof rawFilter === "string" ? JSON.parse(rawFilter) : rawFilter;
            } catch (e) { ext = {}; }
            for (const key of ["class", "lang", "area", "year", "extend_sort"]) {
                const value = (ext && ext[key]) || "";
                if (value) {
                    const vals = String(value).split("|").filter(x => x);
                    if (vals.length) fl.push({ key: key, name: key, value: vals.map(x => ({ n: x, v: x })) });
                }
            }
        }
        if (fl.length) filters[tid] = fl;
    }
    return JSON.stringify({ "class": classes, filters: filters });
}

function _appendVod(videos, vod) {
    if (!vod || typeof vod !== "object") return;
    let pic = "";
    const cover = vod.coverImage || vod.cover || {};
    if (cover && typeof cover === "object") pic = cover.path || cover.thumb || cover.url || "";
    videos.push({
        vod_id: String(vod.id || vod.vod_id || ""),
        vod_name: String(vod.name || vod.vod_name || ""),
        vod_pic: pic,
        vod_remarks: String(vod.remark || vod.vod_remarks || "")
    });
}

function homeVod() {
    const videos = [];
    try {
        const obj = getJson("/api/ex/v3/security/tag/list");
        let arr = null;
        const rawData = obj.data;
        if (Array.isArray(rawData)) arr = rawData;
        else if (rawData && typeof rawData === "object") arr = [rawData];
        else if (rawData && _decrypt !== "0") {
            const dataStr = String(rawData);
            try { arr = JSON.parse(utf8dec(aesEcbDec(DATAKEY, b64dec(dataStr)))); } catch (e) {}
            if (!Array.isArray(arr)) {
                try {
                    const dec1 = utf8dec(aesEcbDec(DATAKEY, b64dec(dataStr)));
                    arr = JSON.parse(utf8dec(aesEcbDec(DATAIV, b64dec(dec1))));
                } catch (e2) {}
            }
        }
        for (const block of arr || []) {
            if (!block || typeof block !== "object") continue;
            if (block.vodList) {
                for (const vod of block.vodList || []) _appendVod(videos, vod);
                continue;
            }
            for (const section of block.sections || []) {
                if (!section || typeof section !== "object") continue;
                for (const vod of section.vodList || []) _appendVod(videos, vod);
            }
        }
        if (videos.length) return JSON.stringify({ list: videos });
    } catch (e) {}
    // 降级: 第一个分类第1页
    try {
        const h = JSON.parse(home(false));
        const cls = h["class"] || [];
        if (cls.length) {
            const cat = JSON.parse(category(cls[0].type_id, "1", false, null));
            if (cat.list && cat.list.length) return JSON.stringify({ list: cat.list });
        }
    } catch (e) {}
    return JSON.stringify({ list: videos });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    let ex = {};
    try {
        if (extend && typeof extend === "object") ex = extend;
        else if (typeof extend === "string" && extend) ex = JSON.parse(extend);
    } catch (e) { ex = {}; }
    const params = {
        pagesize: "21", typeId1: String(tid), page: String(page),
        vodOrderBy: ex.extend_sort || "最新",
        vodArea: ex.area || "", vodLang: ex.lang || "",
        vodClass: ex["class"] || "", vodYear: ex.year || ""
    };
    const videos = v5listOf(postProto("/api/proto/v5/drama/list", params));
    return JSON.stringify({
        list: videos, page: page,
        pagecount: page + (videos.length >= 21 ? 1 : 0),
        limit: 21, total: 999999
    });
}

function detail(ids) {
    try {
        const vid = String(Array.isArray(ids) ? ids[0] : ids);
        const d = dataOf(postProto("/api/proto/v5/drama/getDetail", { id: vid }));
        if (!d.length) return JSON.stringify({ list: [] });
        const head = {};
        const eps = [];
        let pic = "";
        for (const t of pbParse(d)) {
            const fn = t[0], wt = t[1], v = t[2];
            if (fn === 29 && wt === 2) eps.push(flatOf(v));
            else if (fn === 2 && wt === 2) { const p = picsOf(utf8dec(v)); pic = p[0] || ""; }
            else if (wt === 2 && [1, 5, 6, 9, 12, 25, 26].indexOf(fn) >= 0) head[fn] = utf8dec(v);
            else if (wt === 0 && fn === 18) head[18] = String(v);
        }
        // 线路: 按 source_cn 分组; 非直链打包 base64 token
        const line = {}, order = [];
        for (const e of eps) {
            const path = e[4] || "";
            if (!path) continue;
            const srcCn = e[10] || "小苹果";
            const title = e[2] || e[3] || "播放";
            let token;
            if (isVideoFormat(path)) token = path;
            else token = b64enc(utf8enc(JSON.stringify({ vodPlayFrom: e[9] || "", playUrl: path })));
            if (!(srcCn in line)) { line[srcCn] = []; order.push(srcCn); }
            line[srcCn].push(title + "$" + token);
        }
        if (!order.length) return JSON.stringify({ list: [] });
        const urlParts = [];
        for (const k of order) urlParts.push(line[k].join("#"));
        let content = head[6] || "";
        if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
        return JSON.stringify({ list: [{
            vod_id: vid, vod_name: head[9] || "", vod_pic: pic,
            vod_actor: head[25] || "", vod_director: head[12] || "",
            vod_area: head[1] || "", vod_year: head[18] || "",
            vod_remarks: head[26] || "", vod_content: content,
            vod_play_from: order.join("$$$"), vod_play_url: urlParts.join("$$$")
        }] });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

// videoUsableUrl: 返回 {url, headers}
function vuuGet(params) {
    const raw = postProto("/api/proto/v5/videoUsableUrl", params);
    const d = dataOf(raw);
    if (!d.length) return null;
    let url = "";
    const headers = {};
    for (const t of pbParse(d)) {
        if (t[0] === 1 && t[1] === 2) url = utf8dec(t[2]);
        else if (t[0] === 6 && t[1] === 2) {
            const ef = flatOf(t[2]);
            if (ef[1]) headers[ef[1]] = ef[2] || "";
        }
    }
    if (!url) {
        // 兜底: 原始字节里正则提取
        let s = "";
        for (const b of d) s += String.fromCharCode(b);
        const m = s.match(/https?:\/\/[^\x00-\x20"']+/);
        if (m) url = m[0];
    }
    return url ? { url: url, headers: headers } : null;
}

function play(flag, id, vipFlags) {
    const hdr = { "User-Agent": UA };
    const sid = String(id);
    try {
        // 直链直接返回
        if (isVideoFormat(sid)) return JSON.stringify({ parse: 0, url: sid, header: hdr });
        // base64 token -> videoUsableUrl
        let b64 = sid;
        while (b64.length % 4) b64 += "=";
        const params = JSON.parse(utf8dec(b64dec(b64)));
        const pu = params.playUrl || "";
        const r = vuuGet({
            vodPlayFrom: encodeURIComponent(params.vodPlayFrom || ""),
            playUrl: encodeURIComponent(pu)
        });
        let url = r ? r.url : "";
        const head = Object.assign({}, hdr, r ? r.headers : {});
        if (!url) url = pu; // 解析失败回退原始地址
        if (url.indexOf("http") !== 0) return JSON.stringify({ parse: 1, url: pu || sid, header: hdr });
        if (/\.(m3u8|mp4|mkv|flv|ts|m4s)(\?|$)|\.mp4|response-content-disposition/.test(url)) {
            return JSON.stringify({ parse: 0, url: url, header: head });
        }
        if (/\/m3u8\/|\/hls\/|m3u8\?|\/api\/(banyun|gongyou)/.test(url)) {
            const sep = url.indexOf("?") >= 0 ? "&" : "?";
            return JSON.stringify({ parse: 0, url: url + sep + "ext=.m3u8", header: head });
        }
        return JSON.stringify({ parse: 1, url: url, header: head });
    } catch (e) {
        return JSON.stringify({ parse: 1, url: sid, header: hdr });
    }
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const vids = v5listOf(postProto("/api/proto/v5/drama/search", { searchKeys: String(key), page: String(page), pagesize: "21" }));
    return JSON.stringify({ list: vids, page: page, pagecount: page + (vids.length >= 21 ? 1 : 0), limit: 21, total: 999999 });
}

export default { init, home, homeVod, category, detail, play, search };