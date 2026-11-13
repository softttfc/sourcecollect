// ================== 影视·南瓜视频 · TVBox QuickJS ==================
// 南瓜视频 (lanlan族)  独立版
// 由原 min.js 通用引擎同步化重写, 配置已固化, 接口无需 ext
// 协议: OSS加密域名发现(AES-128-ECB/hex) + grayscale取token + nt-*签名头(MD5+MT19937混淆)
//       POST体 AES-256-ECB(base64) + RSA公钥签名, 响应头Sign用RSA私钥解会话密钥再AES解密

// ==================== 固化配置 (南瓜APP) ====================
const CFG = {
    appId: "10003",
    verCode: 58,
    verName: "1.0.0",
    pkg: "com.dongyu.movies",
    appKey: "00823f50736454de37cfef8b260c9e35",
    appSecret: "aca767d257733a3d97fe125bb9150feb",
    soMd5: "28922fee11cea66d7e9f2b5c02151b44",
    apkMd5: "415705b07be237654f9a760306f01c9f",
    pkgMd5: "725e9c0fda0e0925e234d8256dc08b07",
    signMd5: "d97197f84e41b05941688809857e0685",
    host: ["https://nanguasp.oss-cn-hangzhou.aliyuncs.com/nannan07124.json"],
    newHost: "http://134.175.188.60:4491",
    bizHost: "http://134.175.188.60:2025",
    publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsfgFYt5LTHeDslGbyQb836pa/f9FaJa20ZvU3rq2TaT4QxbhzMz0QlXhxyJA78VEooiFzNsOKJDFZAvAYGHid1BvTkqEmwaUD38WN/gOXWPevX20X13kbKlKctbTzqB6CsKLdxYyjB4awtF6o66cVFwLAjPmeePSxiSIoMKaO8jZakhHlPMhIgztAgd09eX+bSM6pve35k9CV5X2GSey7Dtth4DQz/NZVc8HGb79uhyrwH1h6IV3BKgOoqcpsHUcggoV1bJ3IIT0+WUMM8S9Yo2dh9T2EXc+gmIH0UAIxwKxmO1jTNzTDR7BvOCMnJQs5DIUx409BPdLdg4zg0SbmQIDAQAB",
    privateKey: "MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCN9LrnN2+FFW9oTw5ySIQxClbNZyPQyXyueQmsJw9PELWamIvyrVDhsi2862Da83nXRwjzcBsuT3fSq4BETKfRpsOrI3xprN6HyB+aALoYJbdMt5p3liUeyaw9WNxGZ2VhJ+st6ThGNikKRinFgPkOKaocZgefK7MuKI/EJKrj/FFB1WUE1I1/TT5bkIFMmjc8dszKyqxNdDaRgNTNP1Xou0s/tRCgKpmc503wf2h46F94YK6tpbHvYKouCCKps5ieUu+eWsXZmLRfiM0iZQcD0K5wcbrMvWcS/KmElkWPsCOwErpd/EDgeIbVKtsoHPewG8fOta75iCcb8/J56VbZAgMBAAECggEBAI2+8WIvWIvq+3OMfUBgaJ8PU92GP50blAQjmCTuW7r3VF8qM5P+u+ShpkoePnhi5iawJ5/tMTbs4xjZZxrL8EbH3lnk9TYQB6RNkECWuTujbYSNURBYPHihp/sZ39ntJK3+zjbpyedR7Wj05oDwZ8BcmiABQVsOp7xPhD623m0G3wSYtv1bIeCc+vP8pc1kauCPXl5ZyNCUN6XZKH1mvRkGd+VP9hCYr5LOsPVvn3JM8yF5HUJbxltzZVU/m9WcN9D3lcJ9pqpKBd99G1l5zsN+U23+4VvwX8Qhj4ZkNlMCaNndj+6PvhPGMp4+cCpt94I3xh/OqjdrUAd6jnZpioECgYEA709jQ+yFCobRPKzT/PT6KsqVIJJn0FTMXVc1VP5Sn3t5NTQ+iLzOxQRcO1aTNFVgNKhIgsVnVlGh+1Oa2Zor3vXr1eQBjHCZ2zOH+2QdZbRk4GXoOsZ0d203H189SBCTVj20Zd8mL5csBvihIsMjKZ6R62k/mEyOLD+IVuh+axMCgYEAl9sxrVbU1bvGYgHkGWV7BkqYsezOXR65F3eRq8jbNV0YdYN7rnFCStllIJsMCzJBSs2rBD3lcY6/Tk2ThlFIVHVEhgjjRAUIrLHQBJrFKCSusDMGX39Ekk5DZa+5JNak5J7Ikon6klYtDa1G8PFQTJDKTDfQLm/NgryVFS4Np+MCgYEAljLAfcg8NEAroSZkIvbq8OKXOItLRxGB9u+eVIsO9nP7vi3dNdsy96rl7IRI/ea77DDW2eTmF+JChUiS/xJpiJXXADcL1cZyeobcSScr4EKZsdGkMQeP38kXeMRA5TMqFk3CJNIq2GHMS0/Pas8JCb0xnow/UupxrUnu24UumysCgYBKjYuLDVk6gZC45zLEISVQBmmG2LrLztySH9q9msO8JDNw5hdfoi0osChM5LH6ATc68VQnpfeyU6GqYL2vsNIw3M3CfDSPXWVP25BD4nQu7CtzR+m2ErZomdHO54GfC14y+51/DAyfsX02/L4aZm7E2ETpPHGRisQ7jjgnCNAdfwKBgQDSVzfLvsDi2UqbTjyEIeVYPfgm3Owo0fh79rKvinAainQHabVkAezx+RwiJdWeor/08WiyDjFZC86hJOH8gSMLZ2yJw6EVgHqLTvJ+nkYbk0LzvS2gS2h9lDnqOkkKGZBc5l8k/ScCytcDz3WUFEC2TV2CXDj89H14699s1SjpSw=="
};
const PREFIX = "【琉🔹璃❤广告勿信👉剧情】📢";
const ENV_OK = typeof js2Proxy === "function" && typeof desX === "function" && typeof getProxy !== "function";

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
function hexdec(s) {
    const out = [];
    s = String(s).replace(/[^0-9a-fA-F]/g, "");
    for (let i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
}

// ==================== AES (纯JS, ECB) ====================
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
function md5Str(s) {
    if (typeof md5X === "function") { try { return md5X(String(s)); } catch (e) {} }
    return hexenc(md5Bytes(utf8enc(String(s))));
}

// ==================== RSA (优先原生rsaX, 兜底BigInt纯JS) ====================
function derReadLen(b, p) {
    let len = b[p.i++];
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let i = 0; i < n; i++) len = (len << 8) | b[p.i++]; }
    return len;
}
function derReadTLV(b, p) {
    const tag = b[p.i++];
    const len = derReadLen(b, p);
    const v = b.slice(p.i, p.i + len);
    p.i += len;
    return { tag: tag, val: v };
}
function derIntBytes(v) { let i = 0; while (i + 1 < v.length && v[i] === 0) i++; return v.slice(i); }
function rsaPubParams(b64der) {
    const der = b64dec(b64der);
    const p = { i: 0 };
    const seq = derReadTLV(der, p).val;
    const q = { i: 0 };
    let n = null, e = 65537;
    try {
        const t1 = derReadTLV(seq, q);
        if (t1.tag === 0x30) {
            const r = { i: 0 };
            derReadTLV(t1.val, r); derReadTLV(t1.val, r);
            const bit = derReadTLV(seq, q).val;
            const p2 = { i: 1 };
            const seq2 = derReadTLV(bit, p2).val;
            const q2 = { i: 0 };
            n = derIntBytes(derReadTLV(seq2, q2).val);
            e = 65537;
        } else {
            n = derIntBytes(t1.val);
            const ev = derIntBytes(derReadTLV(seq, q).val);
            e = 0; for (const x of ev) e = (e << 8) | x;
        }
    } catch (e2) {}
    return { n: n, e: e };
}
function rsaPrivParams(b64der) {
    const der = b64dec(b64der);
    const p = { i: 0 };
    const seq = derReadTLV(der, p).val;
    const q = { i: 0 };
    derReadTLV(seq, q);
    const t2 = derReadTLV(seq, q);
    let inner = null;
    if (t2.tag === 0x30) {
        const oct = derReadTLV(seq, q).val;
        const p2 = { i: 0 };
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
    return { n: n, d: d };
}
// ---- 纯JS 16位字小端大数运算（兼容低版本QuickJS无BigInt）----
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
function biFromBytes(be) {
    const a = [];
    let cur = 0, bits = 0;
    for (let i = be.length - 1; i >= 0; i--) {
        cur = cur | (be[i] << bits);
        bits += 8;
        if (bits >= 16) { a.push(cur & 0xFFFF); cur = cur >> 16; bits -= 16; }
    }
    if (bits > 0) a.push(cur);
    return a.length ? a : [0];
}
function biToBytes(a, k) {
    const out = [];
    let cur = 0, bits = 0, idx = 0;
    while (out.length < k) {
        while (bits < 8 && idx < a.length) { cur = cur | (a[idx++] << bits); bits += 16; }
        out.unshift(cur & 0xFF);
        cur = cur >> 8;
        bits -= 8;
    }
    return out;
}
function biModPow(b, e, m) {
    b = bnMod(b, m);
    let r = [1];
    if (typeof e === "number") {
        while (e > 0) {
            if (e & 1) r = bnMod(bnMul(r, b), m);
            b = bnMod(bnMul(b, b), m);
            e = e >> 1;
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
    const pp = rsaPubParams(b64der);
    const n = biFromBytes(pp.n), k = pp.n.length;
    const ps = [];
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    const em = [0, 2].concat(ps).concat([0]).concat(msgBytes);
    const c = biModPow(biFromBytes(em), pp.e, n);
    return biToBytes(c, k);
}
function rsaPrivDecJS(b64der, cipherBytes) {
    const pp = rsaPrivParams(b64der);
    const n = biFromBytes(pp.n), d = biFromBytes(pp.d), k = pp.n.length;
    let c = biFromBytes(cipherBytes);
    if (bnCmp(c, n) >= 0) return [];
    const em = biToBytes(biModPow(c, d, n), k);
    if (em[0] !== 0 || em[1] !== 2) return [];
    let i = 2;
    while (i < em.length && em[i] !== 0) i++;
    return em.slice(i + 1);
}
function rsaPubEnc(b64der, str) {
    if (typeof rsaX === "function") {
        try { return rsaX("RSA/PKCS1", true, true, str, false, b64der, true) || ""; } catch (e) {}
    }
    try { return b64enc(rsaPubEncJS(b64der, utf8enc(str))); } catch (e) { return ""; }
}
function rsaPrivDec(b64der, b64cipher) {
    if (typeof rsaX === "function") {
        try { return rsaX("RSA/PKCS1", false, false, b64cipher, true, b64der, false) || ""; } catch (e) {}
    }
    try { return utf8dec(rsaPrivDecJS(b64der, b64dec(b64cipher))); } catch (e) { return ""; }
}

// ==================== MT19937 (nt-c混淆用) ====================
function mtNew(seed) {
    const e = new Array(624);
    e[0] = seed >>> 0;
    for (let t = 1; t < 624; t++) { const n = e[t - 1]; e[t] = (Math.imul(1812433253, (n >>> 30) ^ n) + t) >>> 0; }
    return { mt: e, p: 0 };
}
function mtNext(t) {
    const e = t.mt, n = t.p, r = (n + 1) % 624;
    let i = (((2147483648 & e[n]) | (2147483647 & e[r])) >>> 1 ^ e[(n + 397) % 624]) >>> 0;
    if (1 & e[r]) i = (2567483615 ^ i) >>> 0;
    e[n] = i; t.p = r;
    let s = i;
    s = (s ^ (s >>> 11)) >>> 0;
    s = (s ^ ((s << 7) & 2636928640)) >>> 0;
    s = (s ^ ((s << 15) & 4022730752)) >>> 0;
    s = (s ^ (s >>> 18)) >>> 0;
    return s;
}
function mtRange(t, e, n) { return e + mtNext(t) % (n - e + 1); }

// ==================== 全局状态 ====================
const R = {
    host: [], ossKeyHex: "9330AC3D5AD5638F801A3B4E156F16BA", newHost: "", bizHost: "", pool: [],
    pkg: "", appId: "", version: "", appKey: "", appSecret: "", appName: "lanlan", apiVersion: "w2yj3m9b",
    network: "yd", ua: "okhttp/4.9.0", fp: null, ntKey: "ykdecgtfgxttabur",
    publicKey: "", privateKey: "", signHeader: "Sign", ns: "lanlan", ttlToken: 3000,
    deviceId: "", token: "", tokenTs: 0, sessionKey: "",
    classes: [], filters: {}, parses: {}, pageSize: {}, indexResp: null
};
const API = {
    index: "api.php/Tcgomtsdwz/gmsugsctlmjfdjeo",
    list: "api.php/Tcgomtsdwz/gbuvymmzcnpozcnj",
    search: "api.php/Tcgomtsdwz/fbyvgecswvxykjzy",
    detail: "api.php/Tcgomtsdwz/yfpnncbqeejpzcbr",
    cate: "api.php/schghsfdpsjswn/kuroinarflyqrhyf",
    gray: "api.php/settings/grayscale_list"
};

// ==================== 工具函数 ====================
function guid() {
    let t = "";
    for (let e = 0; e < 32; e++) t += "0123456789abcdef".charAt(Math.floor(16 * Math.random()));
    return t.slice(0, 8) + "-" + t.slice(8, 12) + "-4" + t.slice(13, 16) + "-a" + t.slice(17, 20) + "-" + t.slice(20, 32);
}
function randHex(t) { let e = ""; for (let n = 0; n < t; n++) e += "0123456789abcdef".charAt(Math.floor(16 * Math.random())); return e; }
function uniq(t) {
    const e = {}, n = [];
    for (let r = 0; r < t.length; r++) { const i = String(t[r] == null ? "" : t[r]).trim(); if (i && !e[i]) { e[i] = 1; n.push(i); } }
    return n;
}
function getYear(t) { const e = String(t == null ? "" : t).match(/(\d{4})/); return e ? parseInt(e[1], 10) : 0; }
function cleanName(t) { return String(t == null ? "" : t).replace(/[$#]/g, " ").trim(); }
function localGet(k) { try { if (typeof local !== "undefined" && local.get) return local.get(R.ns, k); } catch (e) {} return null; }
function localSet(k, v) { try { if (typeof local !== "undefined" && local.set) local.set(R.ns, k, v); } catch (e) {} }

// nt-c 混淆签名
function ntObf(obf, random, ts) {
    const payload = JSON.stringify({
        apk_md5: R.fp.apk_md5, obf: obf, package_name: R.fp.package_name, pkg_md5: R.fp.pkg_md5,
        random: random, sign_md5: R.fp.sign_md5, so_md5: R.fp.so_md5, timestamp: ts,
        version_code: R.fp.version_code, version_name: R.fp.version_name
    });
    const hex = hexenc(aesEcbEnc(utf8enc(R.ntKey), utf8enc(payload)));
    const p = md5Str(random + ts);
    const seed = ((parseInt(p.slice(0, 2), 16) << 24) | (parseInt(p.slice(2, 4), 16) << 16) | (parseInt(p.slice(4, 6), 16) << 8) | parseInt(p.slice(6, 8), 16)) >>> 0;
    const n = mtNew(seed);
    let r = hex, i = 0, s = 0;
    while (i < r.length && s < 9) {
        i += mtRange(n, 3, 10);
        if (i >= r.length) break;
        const t = mtRange(n, 2, 5);
        let e = "";
        for (let q = 0; q < t; q++) e += "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(mtNext(n) % 62);
        r = r.slice(0, i) + e + r.slice(i);
        i += t; s++;
    }
    return r;
}
// nt-* 签名头
function ntHeaders(t) {
    const e = String(Math.floor(Date.now() / 1000));
    const n = String(Math.floor(2e9 * Math.random()));
    const seedState = mtNew(parseInt(e, 10) >>> 0);
    const srcs = [e, n, R.fp.so_md5];
    const maxlen = Math.max(e.length, n.length, R.fp.so_md5.length);
    let s = "";
    for (let a = 0; a < maxlen; a++) {
        for (const src of srcs) if (a < src.length) s += src.charAt(a);
        const cnt = 1 + (1 & mtNext(seedState));
        for (let q = 0; q < cnt; q++) s += String.fromCharCode(127 & mtNext(seedState));
    }
    const i = md5Str(s);
    t["nt-c"] = ntObf(i, n, e);
    t["nt-o"] = i;
    t["nt-r"] = n;
    t["nt-t"] = e;
    return t;
}

// 响应解密: 响应头Sign -> RSA私钥解出会话密钥 -> AES-256-ECB解base64正文
function respDecrypt(resp) {
    const content = resp && resp.content;
    if (typeof content !== "string") return content;
    const headers = (resp && resp.headers) || {};
    let sign = "";
    for (const k in headers) if (String(k).toLowerCase() === String(R.signHeader).toLowerCase()) { sign = headers[k]; break; }
    if (!sign) return content;
    const key = rsaPrivDec(R.privateKey, String(sign).trim());
    if (!key) return content;
    try {
        const dec = aesEcbDec(utf8enc(key), b64dec(content.trim()));
        const txt = utf8dec(dec);
        return txt || content;
    } catch (e) { return content; }
}

// ==================== 域名发现 ====================
function fetchServersFromOss(url) {
    let resp = null;
    try { resp = req(url, { method: "get", headers: { "User-Agent": R.ua }, timeout: 8000 }); } catch (e) { return []; }
    if (!resp || String(resp.code) !== "200" || !resp.content) return [];
    const txt = String(resp.content).trim();
    const cands = [];
    try {
        const dec = utf8dec(aesEcbDec(hexdec(R.ossKeyHex), hexdec(txt)));
        if (dec) cands.push(dec);
    } catch (e) {}
    cands.push(txt);
    for (const c of cands) {
        try {
            const j = JSON.parse(c);
            const servers = (j && j.servers) || [];
            const out = [];
            for (const s of servers) {
                const u = String(s == null ? "" : s).trim().replace(/\/+$/, "");
                if (u && out.indexOf(u) < 0 && out.length < 4) out.push(u);
            }
            if (out.length) return out;
        } catch (e) {}
    }
    return [];
}
function fetchServersFromApi(host) {
    const url = /\/api\.php\/settings\/grayscale_list/i.test(host) ? String(host) : String(host).replace(/\/+$/, "") + "/" + API.gray;
    let resp = null;
    try { resp = req(url, { method: "get", headers: { "User-Agent": R.ua }, timeout: 8000 }); } catch (e) { resp = null; }
    if (resp && String(resp.code) === "200" && resp.content) {
        try {
            const j = JSON.parse(String(resp.content).trim());
            const g = (j && j.data && j.data.grayscale) || j.grayscale || null;
            const arr = g ? (g.server_url || []).concat(g.cdn_server_url || []) : [];
            const out = [];
            for (const s of arr) {
                const u = String(s == null ? "" : s).trim().replace(/\/+$/, "");
                if (u && out.indexOf(u) < 0) out.push(u);
            }
            if (out.length) return out;
        } catch (e) {}
    }
    const root = String(host).split("/").slice(0, 3).join("/").replace(/\/+$/, "");
    return /^https?:\/\//i.test(root) ? [root] : [];
}
function discoverServers(entry) {
    try {
        const path = String(entry || "").split("?")[0].replace(/^https?:\/\//i, "").replace(/^[^\/]+/, "");
        if (/\.[a-z0-9]{1,12}$/i.test(path)) return fetchServersFromOss(entry);
        return fetchServersFromApi(entry);
    } catch (e) { return []; }
}

// ==================== 业务请求 ====================
function http(method, url, headers, data, timeout) {
    const opt = { method: method, headers: headers, timeout: timeout || 15000 };
    if (data != null) opt.data = data;
    return req(url, opt);
}
// GET 业务接口 (bizHost, nt-*头 + query带appKey/appSecret)
function bizGet(path, params) {
    const q = [];
    const merged = Object.assign({ appVersion: R.version }, params || {}, { appKey: R.appKey, appSecret: R.appSecret });
    for (const k in merged) { const v = merged[k]; if (v != null) q.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)); }
    const url = R.bizHost + "/" + String(path).replace(/^\/+/, "") + "?" + q.join("&");
    try {
        const headers = {
            appId: R.appId, requestId: guid(), timestamp: String(Date.now()), version: R.version,
            package: R.pkg, deviceId: R.deviceId, AppKey: R.appKey, AppSecret: R.appSecret,
            oaid: "", imei: "", network: R.network, appName: R.appName, apiVersion: R.apiVersion
        };
        headers.Authorization = "Bearer " + (R.token || "");
        headers["User-Agent"] = "okhttp/4.9.0";
        ntHeaders(headers);
        const resp = http("get", url, headers, null, 15000);
        if (String(resp.code) !== "200") return null;
        const body = respDecrypt(resp);
        return typeof body === "string" ? JSON.parse(body) : body;
    } catch (e) { return null; }
}
// POST 业务接口 (AES-256-ECB加密body + RSA公钥Sign头)
function bizPost(host, path, payload) {
    const bodyStr = JSON.stringify(payload || {});
    if (!R.sessionKey) R.sessionKey = randHex(32);
    const headers = {
        AppID: R.appId, app_id: R.appId, version: R.version, package: R.pkg,
        AppKey: R.appKey, AppSecret: R.appSecret,
        user_id: R.deviceId, "user-id": R.deviceId, oaid: "", imei: "",
        app_name: R.appName, "app-name": R.appName
    };
    ntHeaders(headers);
    const sign = rsaPubEnc(R.publicKey, JSON.stringify({ key: R.sessionKey, sign: md5Str(bodyStr) }));
    if (!sign) return null;
    headers.Sign = sign;
    headers["Content-Type"] = "application/json; charset=utf-8;";
    let encBody = "";
    try { encBody = b64enc(aesEcbEnc(utf8enc(R.sessionKey), utf8enc(bodyStr))); } catch (e) { return null; }
    try {
        const resp = http("post", host + "/" + String(path).replace(/^\/+/, ""), headers, encBody, 15000);
        if (String(resp.code) !== "200") return null;
        const body = respDecrypt(resp);
        if (typeof body !== "string") return body;
        try { return JSON.parse(body); } catch (e) {
            try {
                const dec = utf8dec(aesEcbDec(utf8enc(R.sessionKey), b64dec(body)));
                return JSON.parse(dec);
            } catch (e2) { return null; }
        }
    } catch (e) { return null; }
}

// ==================== 初始化 ====================
function buildFilters(ext) {
    const out = [];
    const add = function (key, name, csv) {
        const items = uniq(String(csv == null ? "" : csv).split(","));
        if (!items.length) return;
        const vals = [{ n: "全部", v: "all" }];
        for (const it of items) vals.push({ n: it, v: it });
        out.push({ key: key, name: name, init: "all", value: vals });
    };
    add("type", "类型", ext.type === undefined ? ext.class : ext.type);
    add("area", "地区", ext.area);
    add("year", "年份", ext.year);
    return out;
}
function applyConfig(ext) {
    ext = ext || {};
    const g = function (k) { const v = ext[k]; return (v == null || String(v).trim() === "") ? "" : String(v).trim(); };
    R.pkg = g("pkg") || g("package") || CFG.pkg;
    R.appId = g("appId") || CFG.appId;
    R.version = g("verName") || CFG.verName;
    R.appKey = g("appKey") || CFG.appKey;
    R.appSecret = g("appSecret") || CFG.appSecret;
    R.newHost = g("newHost") || CFG.newHost;
    R.bizHost = g("bizHost") || CFG.bizHost;
    R.appName = g("appName") || "lanlan";
    R.apiVersion = g("apiVersion") || "w2yj3m9b";
    R.ntKey = g("ntKey") || "ykdecgtfgxttabur";
    R.ossKeyHex = g("ossKeyHex") || "9330AC3D5AD5638F801A3B4E156F16BA";
    R.signHeader = g("signHeader") || "Sign";
    R.ns = g("ns") || R.pkg || R.appId || "lanlan";
    let hosts = ext.host;
    if (typeof hosts === "string") hosts = hosts.split(/[,\n]/);
    if (!Array.isArray(hosts) || !hosts.length) hosts = CFG.host;
    R.host = hosts.map(function (t) { return String(t).trim().replace(/[`'"]/g, ""); }).filter(function (t) { return t; });
    const verCode = parseInt(g("verCode"), 10) || CFG.verCode || 0;
    R.fp = {
        so_md5: (g("soMd5") || CFG.soMd5).toLowerCase(),
        apk_md5: (g("apkMd5") || CFG.apkMd5).toLowerCase(),
        pkg_md5: (g("pkgMd5") || CFG.pkgMd5).toLowerCase(),
        sign_md5: (g("signMd5") || CFG.signMd5).toLowerCase(),
        version_code: verCode, version_name: R.version, package_name: R.pkg
    };
    R.publicKey = g("publicKey") || CFG.publicKey;
    R.privateKey = g("privateKey") || CFG.privateKey;
    R.classes = []; R.filters = {}; R.parses = {};
    R.token = ""; R.tokenTs = 0; R.sessionKey = ""; R.indexResp = null;
}
function ensureDeviceId(ext) {
    const n = ext && (ext.deviceId || ext.device_id);
    if (n && /^[0-9a-f]{16}$/i.test(String(n))) { R.deviceId = String(n).toLowerCase(); return; }
    const saved = localGet("deviceId_rand");
    if (saved && /^[0-9a-f]{16}$/.test(String(saved))) { R.deviceId = String(saved); return; }
    R.deviceId = randHex(16);
    localSet("deviceId_rand", R.deviceId);
}
function ensurePool() {
    try {
        const cached = localGet("oss");
        if (cached) {
            const j = JSON.parse(String(cached));
            if (j && j.t && Date.now() - j.t < 21600000 && j.h && j.h.length) { R.pool = j.h; return; }
        }
    } catch (e) {}
    for (const h of R.host) {
        const pool = discoverServers(h);
        if (pool && pool.length) { R.pool = pool; localSet("oss", JSON.stringify({ t: Date.now(), h: pool })); return; }
    }
    if (R.newHost) {
        const pool = fetchServersFromApi(R.newHost);
        if (pool && pool.length) { R.pool = pool; localSet("oss", JSON.stringify({ t: Date.now(), h: pool })); return; }
    }
}
function ensureToken() {
    if (R.token && Date.now() - R.tokenTs < R.ttlToken) return;
    const resp = bizPost(R.newHost, API.gray, {
        gr_device_imei: R.deviceId, gr_system_type: "android", gr_app_version: R.version,
        gr_rp_size: "1920x1080", gr_device_model: "Android 12", gr_app_list: "",
        requestId: guid(), timeStamp: String(Date.now()), version: R.version, package: R.pkg,
        userLoginToken: "", app_id: R.appId, appName: R.appName, device_id: R.deviceId,
        "device-id": R.deviceId, oaid: "", imei: "", referer_shop: "", access_fine_location: ""
    });
    const g = resp && resp.data && resp.data.grayscale;
    if (g && g.access_token) { R.token = String(g.access_token); R.tokenTs = Date.now(); }
    if (g) {
        const urls = [];
        const arr = (g.server_url || []).concat(g.cdn_server_url || []);
        for (const s of arr) {
            const u = String(s == null ? "" : s).trim().replace(/\/+$/, "");
            if (u && urls.indexOf(u) < 0) urls.push(u);
        }
        if (!urls.length && R.pool.length) for (const s of R.pool) if (s && urls.indexOf(s) < 0) urls.push(s);
        if (urls.length && urls.indexOf(R.bizHost) < 0 && /^https?:\/\//i.test(urls[0])) R.bizHost = urls[0];
    } else if (R.pool.length) R.bizHost = R.pool[0];
}
function ensureClasses() {
    const resp = bizPost(R.bizHost, API.cate, {});
    const data = resp && resp.data;
    if (data) {
        const vt = data.video_type || [];
        if (vt.length) {
            const list = [];
            for (const it of vt) {
                if (!it || it.type_id === undefined) continue;
                list.push({ type_id: String(it.type_id), type_name: String(it.type_name || "") });
                const f = buildFilters(it.type_extend || {});
                if (f.length) R.filters[String(it.type_id)] = f;
            }
            if (list.length) R.classes = list;
        }
        const biz = data.business || {};
        if (biz.video_lib_page_size) R.pageSize.nav = parseInt(biz.video_lib_page_size, 10);
    }
    if (!R.classes.length) {
        const r2 = bizGet(API.index, { tid: 0 });
        const d2 = r2 && r2.data;
        if (d2 && d2.sub_data && d2.sub_data.length) {
            const list = [];
            for (const s of d2.sub_data) if (s && s.type_id !== undefined) list.push({ type_id: String(s.type_id), type_name: String(s.type_name || "") });
            R.classes = list;
        }
        R.indexResp = d2 || null;
    }
}
function parseExtArg(t) {
    if (typeof t === "string") { try { t = JSON.parse(t); } catch (e) { return {}; } }
    let e = t ? t.ext : null;
    if (typeof e === "string") { try { e = JSON.parse(e); } catch (e2) { e = null; } }
    if (e && typeof e === "object" && e.ext && typeof e.ext === "object") e = e.ext;
    return (e && typeof e === "object") ? e : {};
}
function doInit(t) {
    const ext = parseExtArg(t);
    applyConfig(ext);
    ensureDeviceId(ext);
    ensurePool();
    ensureToken();
    ensureClasses();
}

// ==================== 接口实现 ====================
function vodMap(t) {
    return { vod_id: t.vod_id, vod_name: t.vod_name, vod_pic: t.vod_pic || "", vod_remarks: t.vod_remarks || "", vod_year: getYear(t.vod_year) };
}
function listData(resp) {
    const d = resp && resp.data;
    if (!d) return [];
    return Array.isArray(d) ? d : (d.data || d.list || []);
}
function nextPage(arr, key, pg) {
    const n = arr.length;
    if (!n) return pg;
    if (n > (R.pageSize[key] || 0)) { R.pageSize[key] = n; localSet("sizes", JSON.stringify(R.pageSize)); }
    return n >= R.pageSize[key] ? pg + 1 : pg;
}

function home() {
    const out = { class: R.classes.slice(0), filters: {} };
    for (const k in R.filters) out.filters[k] = R.filters[k];
    if (ENV_OK) { out.class.unshift({ type_id: "home", type_name: "首页" }); delete out.filters.home; }
    return JSON.stringify(out);
}
function homeVod() {
    let d = R.indexResp;
    R.indexResp = null;
    if (!d) { const r = bizGet(API.index, { tid: 0 }); d = r && r.data; }
    const list = [], seen = {};
    const push = function (t) {
        if (!t || t.vod_id === undefined) return;
        const id = String(t.vod_id);
        if (seen[id]) return;
        seen[id] = 1; list.push(vodMap(t));
    };
    if (d) {
        for (const t of (d.tj || [])) push(t);
        for (const s of (d.sub_data || [])) {
            const arr = (s && s.data) || [];
            for (let i = 0; i < arr.length && i < 6; i++) push(arr[i]);
        }
    }
    return JSON.stringify({ list: list });
}
function category(tid, pg, filter, ext) {
    if (tid === "home") {
        const d = JSON.parse(homeVod());
        return JSON.stringify({ list: d.list || [], page: 1, pagecount: 1 });
    }
    const page = parseInt(pg, 10) || 1;
    const params = { pg: page, orderBy: "", tid: parseInt(tid, 10) || 0 };
    if (filter) {
        for (const key of ["type", "area", "year"]) {
            const v = filter[key];
            if (v && v !== "all") params[key] = v;
        }
    }
    const arr = listData(bizGet(API.list, params));
    const list = [];
    for (const t of arr) list.push(vodMap(t));
    return JSON.stringify({ list: list, page: page, pagecount: nextPage(list, "nav", page) });
}
function search(wd, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const arr = listData(bizGet(API.search, { wd: wd, tid: 0, pg: page }));
    const list = [];
    for (const t of arr) list.push(vodMap(t));
    return JSON.stringify({ list: list, page: page, pagecount: nextPage(list, "search", page) });
}
function detail(id) {
    const resp = bizGet(API.detail, { ids: id, device_id: R.deviceId });
    const d = resp && resp.data;
    if (!d) return JSON.stringify({ list: [] });
    const plays = d.vod_play_url || [];
    const froms = [], urls = [];
    for (const line of plays) {
        if (!line) continue;
        const lid = String(line.id === undefined ? "" : line.id);
        const lname = cleanName(line.name) || lid;
        const parses = uniq(line.parse || []);
        if (lid) R.parses[lid] = parses;
        const eps = line.data || [];
        const epList = [];
        for (const ep of eps) {
            const ename = cleanName(ep.name) || "播放";
            epList.push(ename + "$" + lid + "~" + String(ep.url === undefined ? "" : ep.url));
        }
        if (epList.length && /^NBY-XMYAES/i.test(epList[0].split("~").slice(1).join("~"))) continue; // NBY-XMYAES假源剔除
        if (epList.length) { froms.push(lname); urls.push(epList.join("#")); }
    }
    let content = d.vod_content || d.vod_blurb || "";
    if (content.indexOf(PREFIX) < 0) content = PREFIX + content;
    const vod = {
        vod_id: d.vod_id, vod_name: d.vod_name || "", vod_pic: d.vod_pic || "", vod_remarks: d.vod_remarks || "",
        vod_year: getYear(d.vod_year), vod_area: d.vod_area || "", vod_actor: d.vod_actor || "",
        vod_director: d.vod_director || "", vod_score: d.vod_score || "", vod_content: content,
        type_name: d.type_name || "",
        vod_play_from: froms.join("$$$"), vod_play_url: urls.join("$$$")
    };
    localSet("parses", JSON.stringify(R.parses));
    return JSON.stringify({ list: [vod] });
}
function normHeaders(h) {
    const out = {};
    if (h && typeof h === "object") for (const k in h) { const v = h[k]; if (v != null) out[k] = String(v).trim(); }
    if (!out["User-Agent"] && !out["user-agent"]) out["User-Agent"] = R.ua;
    return out;
}
function guestName() {
    const m = md5Str(R.deviceId);
    let s = "";
    for (let i = 5; i >= 0; i--) s += m.charAt(i);
    return "游客_" + s;
}
function parseUrl(purl, target) {
    let u = String(purl || "");
    if (u.indexOf("?") < 0) u += "?url=";
    return u + encodeURIComponent(target) + "&version=" + encodeURIComponent(R.version) + "&user_name=" + encodeURIComponent(guestName());
}
function fixPlayUrl(u) { return String(u).replace(/[^\x21-\x7E]/g, function (c) { return encodeURIComponent(c); }); }
function play(flag, id, flags) {
    let url = String(id == null ? "" : id), lid = "";
    const tilde = url.indexOf("~");
    if (tilde > 0) { lid = url.slice(0, tilde); url = url.slice(tilde + 1); }
    const isHttp = /^https?:\/\//i.test(url) ? url : "";
    if (isHttp && /\.(m3u8|mp4|flv|mkv|ts)(\?|#|$)/i.test(isHttp)) {
        return JSON.stringify({ parse: 0, url: fixPlayUrl(isHttp), header: { "User-Agent": R.ua } });
    }
    if (!Object.keys(R.parses).length) {
        try { const saved = localGet("parses"); if (saved) R.parses = JSON.parse(String(saved)) || {}; } catch (e) { R.parses = {}; }
    }
    const chain = (lid && R.parses[lid]) ? R.parses[lid] : [];
    for (const p of chain) {
        const pu = parseUrl(p, url);
        let j = null;
        try {
            const resp = http("get", pu, { "User-Agent": R.ua }, null, 15000);
            if (String(resp.code) === "200") { const c = resp.content; j = typeof c === "string" ? JSON.parse(c) : c; }
        } catch (e) {}
        const d = j && j.data;
        const direct = d && d.url ? String(d.url) : "";
        if (direct && /^https?:\/\//i.test(direct)) {
            return JSON.stringify({ parse: 0, url: direct, header: normHeaders(d.header) });
        }
    }
    if (isHttp) return JSON.stringify({ parse: 0, url: isHttp, header: { "User-Agent": R.ua } });
    return JSON.stringify({ parse: 1, url: url, header: { "User-Agent": R.ua } });
}

const __api = { init: doInit, home: home, homeVod: homeVod, category: category, detail: detail, play: play, search: search };
export function __jsEvalReturn() { return __api; }
export default __api;
