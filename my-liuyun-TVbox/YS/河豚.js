const B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const COMMON_KEY = 'ed5fdsgucxumegqa';
const UA = 'okhttp/3.12.1';

let CFG = {
    appName: '河豚',
    configUrl: 'https://az1-1456692500.cos.ap-guangzhou.myqcloud.com/az1.txt',
    publicKey: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCr8SzZhjYy+rsya1K09t8d2K50pWFoBkgUqMpKOiW+3IEVKd4eTdvg9RSOjQ82kypL6R9BnsmrS1V8s4PVDwjQbUtYhTPPC9Hz16qY7rpD6m0d2vr09/UpWQ5uOy9PR0QTrsioveZ+DIe9jc3C+zBCu/kZSY/R8stwJoiitki3gwIDAQAB',
    dataKey: 'V04XQZNYRWN6T0JODZFIAG5CTZB3PT0=',
    dataIv: 'OC1A06E197EF10CF3F6058CA7A803B5E',
    pkg: 'com.djlxxl.xcydzkj',
    version: '7.0.0.2',
    from: '蓝光4k,蓝光',
    host: ''
};
let dynamicKey = '';
let dynamicTried = false;
let staticMod = null;
let dynamicMod = null;
let lineOrder = [];
let lineBlock = [];

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

function b64dec(s) {
    const rev = {};
    for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    const out = [];
    let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
        acc = (acc << 6) | rev[s[i]];
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((acc >> bits) & 255);
        }
    }
    return out;
}

function utf8enc(str) {
    const out = [];
    str = String(str);
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
    let out = '', i = 0;
    while (i < bytes.length) {
        const c = bytes[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
        else if (c < 0xf0) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
        else {
            const cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
            const n = cp - 0x10000;
            out += String.fromCharCode(0xd800 + (n >> 10), 0xdc00 + (n & 0x3ff));
        }
    }
    return out;
}

function hexenc(bytes) {
    let out = '';
    for (const b of bytes) out += (b < 16 ? '0' : '') + b.toString(16);
    return out;
}

const SBOX = [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22];
const INV_SBOX = [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125];
const RCON = [0,1,2,4,8,16,32,64,128,27,54,108,216,171,77,154];

function xtime(x) {
    x <<= 1;
    return x & 256 ? (x ^ 0x11b) & 255 : x;
}

function aesKeyExp(key) {
    const nk = key.length / 4, nr = nk + 6, w = [];
    for (let i = 0; i < nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    for (let i = nk; i < 4 * (nr + 1); i++) {
        let t = w[i - 1].slice();
        if (i % nk === 0) {
            t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
            t[0] ^= RCON[i / nk];
        } else if (nk > 6 && i % nk === 4) t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
        w.push([w[i - nk][0] ^ t[0], w[i - nk][1] ^ t[1], w[i - nk][2] ^ t[2], w[i - nk][3] ^ t[3]]);
    }
    return { w, nr };
}

function aesAddRK(s, w, r) {
    for (let c = 0; c < 4; c++) for (let i = 0; i < 4; i++) s[i + 4 * c] ^= w[4 * r + c][i];
}
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
        const m9 = x => xtime(xtime(xtime(x))) ^ x;
        const m11 = x => xtime(xtime(xtime(x))) ^ xtime(x) ^ x;
        const m13 = x => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ x;
        const m14 = x => xtime(xtime(xtime(x))) ^ xtime(xtime(x)) ^ xtime(x);
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
    return n < 1 || n > 16 || n > bytes.length ? bytes : bytes.slice(0, bytes.length - n);
}
function aesEncBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, 0);
    for (let r = 1; r < ek.nr; r++) { aesSub(s); aesShift(s); aesMix(s); aesAddRK(s, ek.w, r); }
    aesSub(s); aesShift(s); aesAddRK(s, ek.w, ek.nr);
    return s;
}
function aesDecBlock(ek, block) {
    const s = block.slice();
    aesAddRK(s, ek.w, ek.nr);
    for (let r = ek.nr - 1; r >= 1; r--) { aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, r); aesInvMix(s); }
    aesInvShift(s); aesInvSub(s); aesAddRK(s, ek.w, 0);
    return s;
}
function aesEcbEnc(key, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    for (let i = 0; i < data.length; i += 16) out.push(...aesEncBlock(ek, data.slice(i, i + 16)));
    return out;
}
function aesEcbDec(key, bytes) {
    const ek = aesKeyExp(key), out = [];
    for (let i = 0; i + 16 <= bytes.length; i += 16) out.push(...aesDecBlock(ek, bytes.slice(i, i + 16)));
    return pkcs7unpad(out);
}
function aesCbcEnc(key, iv, bytes) {
    const ek = aesKeyExp(key), data = pkcs7pad(bytes), out = [];
    let prev = iv.slice();
    for (let i = 0; i < data.length; i += 16) {
        const block = data.slice(i, i + 16);
        for (let j = 0; j < 16; j++) block[j] ^= prev[j];
        prev = aesEncBlock(ek, block);
        out.push(...prev);
    }
    return out;
}

function derModulus(b64pub) {
    const der = b64dec(b64pub);
    for (let i = 0; i + 4 < der.length; i++) {
        if (der[i] === 2 && der[i + 1] === 0x81 && der[i + 2] === 0x81 && der[i + 3] === 0) return der.slice(i + 4, i + 132);
    }
    return der.slice(-131, -3);
}
function bnCmp(a, b) {
    let i = Math.max(a.length, b.length);
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
    const out = new Array(a.length + b.length + 1).fill(0);
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
function bytesToBn(be) {
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
function bnToBytes(a, len) {
    const out = [];
    let cur = 0, bits = 0, idx = 0;
    while (out.length < len) {
        while (bits < 8 && idx < a.length) { cur |= a[idx++] << bits; bits += 16; }
        out.unshift(cur & 0xff);
        cur >>= 8;
        bits -= 8;
    }
    return out;
}
function rsaEncrypt(msgBytes, modBytes) {
    const n = bytesToBn(modBytes), k = modBytes.length, ps = [];
    for (let i = 0; i < k - 3 - msgBytes.length; i++) ps.push(1 + Math.floor(Math.random() * 255));
    const m = bytesToBn([0, 2].concat(ps, [0], msgBytes));
    let r = m.slice();
    for (let i = 0; i < 16; i++) r = bnMod(bnMul(r, r), n);
    r = bnMod(bnMul(r, m), n);
    return bnToBytes(r, k);
}

function varintEnc(n) {
    const out = [];
    n = Math.floor(n);
    while (n > 0x7f) { out.push(n % 128 | 0x80); n = Math.floor(n / 128); }
    out.push(n);
    return out;
}
function pbInt(field, value) { return varintEnc(field << 3).concat(varintEnc(value)); }
function pbBytes(field, value) { return varintEnc((field << 3) | 2).concat(varintEnc(value.length), value); }
function pbParse(buf) {
    const fields = {};
    let pos = 0;
    while (pos < buf.length) {
        let key = 0, shift = 1;
        while (pos < buf.length) {
            const b = buf[pos++];
            key += (b & 0x7f) * shift;
            if (!(b & 0x80)) break;
            shift *= 128;
        }
        const field = Math.floor(key / 8), wire = key % 8;
        let value;
        if (wire === 0) {
            value = 0; shift = 1;
            while (pos < buf.length) {
                const b = buf[pos++];
                value += (b & 0x7f) * shift;
                if (!(b & 0x80)) break;
                shift *= 128;
            }
        } else if (wire === 1) { value = buf.slice(pos, pos + 8); pos += 8; }
        else if (wire === 2) {
            let size = 0; shift = 1;
            while (pos < buf.length) {
                const b = buf[pos++];
                size += (b & 0x7f) * shift;
                if (!(b & 0x80)) break;
                shift *= 128;
            }
            value = buf.slice(pos, pos + size); pos += size;
        } else if (wire === 5) { value = buf.slice(pos, pos + 4); pos += 4; }
        else break;
        if (!fields[field]) fields[field] = [];
        fields[field].push(value);
    }
    return fields;
}
function pbFirst(fields, n, def) {
    const value = fields[n];
    return value && value.length ? value[0] : (def !== undefined ? def : []);
}
function pbText(fields, n) {
    const value = pbFirst(fields, n, []);
    return value && value.length ? utf8dec(value) : '';
}
function apiData(raw) { return pbFirst(pbParse(raw), 3, []); }
function isVideoFormat(url) { return /\.(mp4|m3u8|flv|mkv|avi|ts|mov|mpd|m4a|wmv)(\?.*)?$/i.test(String(url || '')); }
function trimSlash(value) { return String(value || '').trim().replace(/\/+$/, ''); }
function rndStr(n) {
    const chars = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let out = '';
    for (let i = 0; i < Math.max(0, n - 1); i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out + '=';
}
function uuidHex() {
    let out = '';
    for (let i = 0; i < 32; i++) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    return out.toUpperCase();
}
function currentMod() {
    if (dynamicKey) {
        if (!dynamicMod) {
            try { dynamicMod = derModulus(dynamicKey); } catch (e) { dynamicMod = null; }
        }
        if (dynamicMod) return dynamicMod;
    }
    return staticMod;
}

function makeHeaders(protobuf) {
    const ts = Date.now(), random = rndStr(16), uid = uuidHex();
    const vapp = String(CFG.version || '').replace(/\./g, '') || '3019';
    const device = {
        country: 'CN', vName: CFG.version, cpuId: 'MT6893Z%2FCZA', young: 0,
        facturer: 'Xiaomi', pkg: CFG.pkg, uuid: uid, resolution: '1080x2272',
        mac: '02%3A00%3A00%3A00%3A00%3A00', abid: '397', model: 'M2012K11AC',
        plat: 'android', udid: uid, dpi: '440', net: '1', lang: 'zh', brand: 'Xiaomi',
        density: '2.75', appName: CFG.appName, cpu: 'arm64-v8a', chid: '10000',
        carrier: '%E8%81%94%E9%80%9A', _vOsCode: 30, vOs: '11', v: 1, tenantId: '',
        vApp: vapp, device: 0, androidID: uid.substring(0, 16).toLowerCase()
    };
    device.sig = b64enc(rsaEncrypt(utf8enc(String(ts) + random + vapp), currentMod()));
    device.random_str = random;
    device.timestamp = ts;
    const sig23 = b64enc(aesEcbEnc(utf8enc(CFG.dataIv), utf8enc(String(ts) + random)));
    device.sig2 = sig23.substring(0, 8);
    device.sig3 = sig23.substring(8);
    const key = utf8enc(COMMON_KEY);
    const paramsData = hexenc(aesCbcEnc(key, key, utf8enc(JSON.stringify(device))));
    return {
        'User-Agent': UA,
        'Accept': protobuf ? 'application/x-protobuf' : 'application/json',
        'Content-Type': protobuf ? 'application/x-protobuf; charset=ISO-8859-1' : 'application/json; charset=utf-8',
        'publicParams': JSON.stringify({ paramsData })
    };
}

function secureBody(params) {
    const ts = Date.now(), random8 = rndStr(8), random20 = rndStr(20), parts = [];
    for (const key of Object.keys(params)) {
        const value = params[key];
        if (value !== null && value !== undefined && String(value) !== '') parts.push(key + '=' + value);
    }
    const encrypted = random8 + b64enc(aesEcbEnc(utf8enc(CFG.dataKey), utf8enc(parts.join('&') + ts)));
    return pbBytes(1, utf8enc(encrypted.substring(0, 20)))
        .concat(pbBytes(2, utf8enc(encrypted.substring(20))), pbBytes(3, utf8enc(random20)), pbInt(4, ts), pbBytes(5, utf8enc(random8)));
}

async function postRaw(path, bodyBytes) {
    if (!CFG.host) return [];
    let body = '';
    for (const b of bodyBytes) body += String.fromCharCode(b);
    for (let i = 0; i < 2; i++) {
        try {
            const r = await req(CFG.host + path, {
                method: 'POST', headers: makeHeaders(true), body,
                buffer: 2, timeout: 20000
            });
            const content = r && r.content ? r.content : '';
            if (content) return b64dec(content);
        } catch (e) {}
    }
    return [];
}
async function postProto(path, params) { return postRaw(path, secureBody(params)); }
async function getJson(path) {
    if (!CFG.host) return {};
    for (let i = 0; i < 2; i++) {
        try {
            const r = await req(CFG.host + path, { method: 'GET', headers: makeHeaders(false), timeout: 20000 });
            return JSON.parse(r && r.content ? r.content : '{}');
        } catch (e) {}
    }
    return {};
}

async function loadDynamicKey() {
    const ts = Date.now(), random = rndStr(16);
    const sign = b64enc(rsaEncrypt(utf8enc(String(ts) + random), staticMod));
    const body = pbInt(1, ts)
        .concat(pbBytes(2, utf8enc(sign)), pbBytes(3, utf8enc(rndStr(16))), pbBytes(4, utf8enc(random)), pbBytes(5, utf8enc(rndStr(16))));
    const raw = await postRaw('/api/v5/find/app/zone', body);
    if (!raw.length) return '';
    const fields = pbParse(apiData(raw));
    const key = [2, 3, 4, 5].map(n => pbText(fields, n)).join('');
    if (key.length > 50) {
        dynamicKey = key;
        dynamicMod = null;
    }
    return dynamicKey;
}

async function ensureDynamicKey() {
    if (dynamicKey || dynamicTried) return;
    dynamicTried = true;
    try { await loadDynamicKey(); } catch (e) { dynamicKey = ''; }
}

function buildLineRules() {
    lineOrder = [];
    lineBlock = [];
    let from = String(CFG.from || '').trim(), blocked = '';
    const at = from.indexOf('@');
    if (at >= 0) { blocked = from.substring(at + 1); from = from.substring(0, at); }
    lineOrder = from.split(/,|@@/).map(v => v.trim()).filter(Boolean);
    lineBlock = blocked.split(/,|@@/).map(v => v.trim()).filter(Boolean);
}
function matchLine(name, rule) {
    name = String(name || '').trim().toLowerCase();
    rule = String(rule || '').trim();
    if (!rule) return false;
    if (rule.startsWith('/') && rule.endsWith('/') && rule.length > 2) {
        try { return new RegExp(rule.slice(1, -1), 'i').test(name); } catch (e) { return false; }
    }
    return name.includes(rule.toLowerCase());
}
function sortFilterLines(lines) {
    let out = lineBlock.length ? lines.filter(line => !lineBlock.some(rule => matchLine(line, rule))) : lines.slice();
    if (!lineOrder.length) return out;
    const sorted = [];
    for (const rule of lineOrder) {
        const rest = [];
        for (const line of out) (matchLine(line, rule) ? sorted : rest).push(line);
        out = rest;
    }
    return sorted.concat(out);
}

async function init(ext) {
    let input = ext;
    let directHost = '';
    dynamicKey = '';
    dynamicMod = null;
    dynamicTried = false;
    if (typeof input === 'string' && input.trim().startsWith('{')) {
        try { input = JSON.parse(input); } catch (e) { input = {}; }
    }
    if (input && typeof input === 'object') {
        const keys = ['configUrl', 'publicKey', 'dataKey', 'dataIv', 'pkg', 'appName', 'from'];
        for (const key of keys) if (input[key] !== undefined && String(input[key]).trim()) CFG[key] = String(input[key]).trim();
        if (input.mSafeCode) CFG.dataKey = String(input.mSafeCode).trim();
        if (input.vName || input.version) CFG.version = String(input.vName || input.version).trim();
        directHost = trimSlash(input.host);
    } else if (typeof input === 'string' && input.trim().startsWith('http')) directHost = trimSlash(input);
    buildLineRules();
    staticMod = derModulus(CFG.publicKey);
    const candidates = [];
    if (directHost) {
        if (/\.(txt|json)$/i.test(directHost)) CFG.configUrl = directHost;
        else candidates.push(directHost);
    }
    try {
        const r = await req(CFG.configUrl, { method: 'GET', headers: { 'User-Agent': UA }, timeout: 12000 });
        const text = r && r.content ? r.content : '';
        let domain = '';
        try { domain = JSON.parse(text).domain || ''; } catch (e) {
            const match = text.match(/["']domain["']\s*:\s*["']([^"']+)["']/i);
            if (match) domain = match[1];
        }
        domain = trimSlash(domain);
        if (domain && !candidates.includes(domain)) candidates.push(domain);
    } catch (e) {}
    CFG.host = candidates.length ? candidates[0] : '';
    for (const candidate of candidates) {
        CFG.host = candidate;
        try { if (await loadDynamicKey()) break; } catch (e) { dynamicKey = ''; }
    }
    dynamicTried = true;
}

function parseCover(raw) {
    const fields = pbParse(raw || []);
    return { path: pbText(fields, 1), thumb: pbText(fields, 2) };
}
function pickHttp(raw) {
    if (!raw || !raw.length) return '';
    const fields = pbParse(raw);
    for (const key of Object.keys(fields)) {
        for (const value of fields[key]) {
            if (typeof value !== 'object') continue;
            const text = utf8dec(value).trim();
            const at = text.indexOf('http');
            if (at >= 0) return text.substring(at);
        }
    }
    return '';
}
function parseDrama(raw) {
    const fields = pbParse(raw);
    const coverRaw = pbFirst(fields, 2, []);
    const cover = coverRaw.length ? parseCover(coverRaw) : {};
    return {
        vod_id: String(pbFirst(fields, 3, 0) || ''),
        vod_name: pbText(fields, 5),
        vod_pic: cover.thumb || cover.path || '',
        vod_remarks: pbText(fields, 13),
        vod_year: String(pbFirst(fields, 14, '') || ''),
        vod_area: pbText(fields, 1)
    };
}
function parseDramaPage(raw) {
    const fields = pbParse(apiData(raw));
    return (fields[1] || []).map(parseDrama);
}
function appendVod(list, item) {
    const cover = item.coverImage || item.cover || {};
    list.push({
        vod_id: String(item.id !== undefined ? item.id : item.vod_id || ''),
        vod_name: String(item.name || item.vod_name || ''),
        vod_pic: String(cover.path || cover.thumb || ''),
        vod_remarks: String(item.remark || item.vod_remarks || '')
    });
}

async function home(filter) {
    try {
        const data = await getJson('/api/v3/drama/getCategory?orderBy=type_id');
        const classes = [];
        for (const item of data.data || []) {
            if (item && item.name !== '公告' && item.id !== undefined) classes.push({ type_id: String(item.id), type_name: String(item.name || '') });
        }
        return JSON.stringify({ class: classes, filters: {} });
    } catch (e) {
        return JSON.stringify({ class: [], filters: {} });
    }
}

async function homeVod() {
    try {
        await ensureDynamicKey();
        const json = await getJson('/api/ex/v3/security/tag/list');
        const raw = json.data;
        let blocks = null;
        if (Array.isArray(raw)) blocks = raw;
        else if (raw && typeof raw === 'object') blocks = [raw];
        else if (raw) {
            const text = String(raw).trim();
            try { if (text.startsWith('[')) blocks = JSON.parse(text); } catch (e) {}
            if (!blocks && text.startsWith('{')) {
                try { blocks = JSON.parse(text).list || null; } catch (e) {}
            }
            if (!blocks) {
                try { blocks = JSON.parse(utf8dec(aesEcbDec(utf8enc(CFG.dataKey), b64dec(text)))); } catch (e) {}
            }
            if (!blocks) {
                try {
                    const first = utf8dec(aesEcbDec(utf8enc(CFG.dataKey), b64dec(text)));
                    blocks = JSON.parse(utf8dec(aesEcbDec(utf8enc(CFG.dataIv), b64dec(first))));
                } catch (e) {}
            }
        }
        const list = [];
        for (const block of blocks || []) {
            for (const section of block.sections || []) for (const item of section.vodList || []) appendVod(list, item);
        }
        return JSON.stringify({ list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    const page = parseInt(pg, 10) || 1;
    const params = {
        pagesize: '21', typeId1: String(tid), page: String(page),
        vodOrderBy: extend['排序'] || '最新', vodArea: extend['地区'] || '',
        vodLang: extend['语言'] || '', vodClass: extend['类型'] || '', vodYear: extend['年份'] || ''
    };
    try {
        await ensureDynamicKey();
        const fields = pbParse(apiData(await postProto('/api/proto/v5/drama/category', params)));
        const list = (fields[1] || []).map(raw => {
            const item = pbParse(raw);
            return {
                vod_id: pbText(item, 3) || String(pbFirst(item, 3, '') || ''),
                vod_name: pbText(item, 5),
                vod_pic: pickHttp(pbFirst(item, 2, [])),
                vod_remarks: pbText(item, 13)
            };
        });
        return JSON.stringify({ list, page, pagecount: 9999, limit: 21, total: 9999 });
    } catch (e) {
        return JSON.stringify({ list: [], page, pagecount: 0, limit: 21, total: 0 });
    }
}

async function detail(ids) {
    try {
        await ensureDynamicKey();
        const id = String(Array.isArray(ids) ? ids[0] : ids);
        const fields = pbParse(apiData(await postProto('/api/proto/v5/drama/getDetail', { id })));
        const coverRaw = pbFirst(fields, 2, []);
        const cover = coverRaw.length ? parseCover(coverRaw) : {};
        const groups = {}, order = [];
        for (const raw of fields[29] || []) {
            const item = pbParse(raw);
            const title = pbText(item, 2) || '播放';
            let url = pbText(item, 4);
            const source = pbText(item, 9);
            let name = pbText(item, 10) || source || '未知';
            if (source && name !== source) name += ' (' + source + ')';
            if (!isVideoFormat(url)) url = b64enc(utf8enc(JSON.stringify({ vodPlayFrom: source, playUrl: url })));
            if (!groups[name]) { groups[name] = []; order.push(name); }
            groups[name].push(title + '$' + url);
        }
        const lines = sortFilterLines(order);
        return JSON.stringify({ list: [{
            vod_id: id,
            vod_name: pbText(fields, 9),
            vod_pic: cover.path || cover.thumb || '',
            vod_actor: pbText(fields, 25),
            vod_director: pbText(fields, 12),
            vod_area: pbText(fields, 1),
            vod_year: String(pbFirst(fields, 18, '') || ''),
            vod_remarks: pbText(fields, 26),
            vod_content: pbText(fields, 6),
            vod_play_from: lines.join('$$$'),
            vod_play_url: lines.map(line => groups[line].join('#')).join('$$$')
        }] });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        await ensureDynamicKey();
        if (isVideoFormat(id)) return JSON.stringify({ parse: 0, url: String(id), header: {}, playUrl: '' });
        const params = JSON.parse(utf8dec(b64dec(id)));
        const fields = pbParse(apiData(await postProto('/api/proto/v5/videoUsableUrl', params)));
        const header = {};
        for (const raw of fields[6] || []) {
            const item = pbParse(raw), key = pbText(item, 1);
            if (key) header[key] = pbText(item, 2);
        }
        return JSON.stringify({ parse: 0, url: pbText(fields, 1), header, playUrl: '' });
    } catch (e) {
        return JSON.stringify({ parse: 1, url: String(id), header: {} });
    }
}

async function search(wd, quick, pg = 1) {
    try {
        await ensureDynamicKey();
        const list = parseDramaPage(await postProto('/api/proto/v5/drama/search', {
            searchKeys: String(wd), page: String(parseInt(pg, 10) || 1), pagesize: '21'
        }));
        return JSON.stringify({ list: list.length ? [list[0]] : [], page: Number(pg) || 1 });
    } catch (e) {
        return JSON.stringify({ list: [], page: Number(pg) || 1 });
    }
}

export default { init, home, homeVod, category, detail, play, search };
