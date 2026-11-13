// 妞妞短剧 - TVBox QuickJS (琉芸JS版)
// 主站 new.tianjinzhitongdaohe.com (nntoken) + csj-sp.csjdeveloper.com (nnatoken, AES-ECB+HMAC-SHA256)
var XURL = 'https://new.tianjinzhitongdaohe.com';
var CSJ = 'https://csj-sp.csjdeveloper.com/csj_sp';
var SITEID = '5627189';
var HMAC_SECRET = 'aceaa47f96b4875d446b2e1d97e03bbb';
var KEY_LOGIN = 'dafdb3d2a5c343d6';
var KEY_API = 'ce49b18dd4e0a4d8';
var OK_UA = 'okhttp/4.12.0';
var HEADERX = { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' };
var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

var _nntoken = '', _nnatoken = '', _tokenDay = '';

// ================= 纯JS crypto (SHA-256/HMAC-SHA256/AES-128-ECB, FIPS向量已验证) =================
var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function utf8Bytes(s) {
    var b = unescape(encodeURIComponent(s));
    var out = [];
    for (var i = 0; i < b.length; i++) out.push(b.charCodeAt(i) & 255);
    return out;
}
function bytesUtf8(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}
function hexStr(b) {
    var s = '';
    for (var i = 0; i < b.length; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s;
}
function sha256Bytes(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length;
    var lenLo = (len * 8) >>> 0, lenHi = Math.floor(len / 0x20000000) >>> 0;
    bytes = bytes.slice();
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var i = 3; i >= 0; i--) bytes.push((lenHi >>> (8 * i)) & 255);
    for (var i = 3; i >= 0; i--) bytes.push((lenLo >>> (8 * i)) & 255);
    function rr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
    var W = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
        for (var t = 0; t < 16; t++) W[t] = (bytes[off + t * 4] << 24 | bytes[off + t * 4 + 1] << 16 | bytes[off + t * 4 + 2] << 8 | bytes[off + t * 4 + 3]) >>> 0;
        for (var t = 16; t < 64; t++) {
            var s0 = rr(W[t - 15], 7) ^ rr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
            var s1 = rr(W[t - 2], 17) ^ rr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
            W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
        }
        var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
        for (var t = 0; t < 64; t++) {
            var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
            var ch = (e & f) ^ (~e & g);
            var t1 = (hh + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
            var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
            var maj = (a & b) ^ (a & c) ^ (b & c);
            var t2 = (S0 + maj) >>> 0;
            hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
        H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + hh) >>> 0;
    }
    var out = [];
    for (var i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    return out;
}
function hmacSha256Hex(key, msg) {
    var kb = utf8Bytes(key);
    if (kb.length > 64) kb = sha256Bytes(kb);
    while (kb.length < 64) kb.push(0);
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad.push(kb[i] ^ 0x36); opad.push(kb[i] ^ 0x5c); }
    return hexStr(sha256Bytes(opad.concat(sha256Bytes(ipad.concat(utf8Bytes(msg))))));
}

var AES_SBOX = [99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22];
var AES_INV_SBOX = [82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101, 182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211, 10, 247, 228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220, 234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173, 53, 133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29, 41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75, 198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125];
var AES_RCON = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
function aesKeyExpand(kb) {
    var w = kb.slice();
    var r = 0;
    while (w.length < 176) {
        var t = w.slice(w.length - 4);
        if (w.length % 16 === 0) {
            t = [t[1], t[2], t[3], t[0]];
            for (var j = 0; j < 4; j++) t[j] = AES_SBOX[t[j]];
            t[0] ^= AES_RCON[r++];
        }
        for (var j = 0; j < 4; j++) w.push(w[w.length - 16] ^ t[j]);
    }
    return w;
}
function gmul(a, b) {
    var p = 0;
    for (var i = 0; i < 8; i++) {
        if (b & 1) p ^= a;
        var hb = a & 0x80;
        a = (a << 1) & 0xff;
        if (hb) a ^= 0x1b;
        b >>>= 1;
    }
    return p;
}
function aesEncryptBlock(blk, w) {
    var s = blk.slice();
    var i, r, r2, c, t, a;
    function addRk(rnd) { for (var k = 0; k < 16; k++) s[k] ^= w[rnd * 16 + k]; }
    addRk(0);
    for (r = 1; r < 10; r++) {
        for (i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
        t = s.slice();
        for (r2 = 0; r2 < 4; r2++) for (c = 0; c < 4; c++) s[c * 4 + r2] = t[((c + r2) % 4) * 4 + r2];
        for (c = 0; c < 4; c++) {
            a = [s[c * 4], s[c * 4 + 1], s[c * 4 + 2], s[c * 4 + 3]];
            s[c * 4] = gmul(a[0], 2) ^ gmul(a[1], 3) ^ a[2] ^ a[3];
            s[c * 4 + 1] = a[0] ^ gmul(a[1], 2) ^ gmul(a[2], 3) ^ a[3];
            s[c * 4 + 2] = a[0] ^ a[1] ^ gmul(a[2], 2) ^ gmul(a[3], 3);
            s[c * 4 + 3] = gmul(a[0], 3) ^ a[1] ^ a[2] ^ gmul(a[3], 2);
        }
        addRk(r);
    }
    for (i = 0; i < 16; i++) s[i] = AES_SBOX[s[i]];
    t = s.slice();
    for (r2 = 0; r2 < 4; r2++) for (c = 0; c < 4; c++) s[c * 4 + r2] = t[((c + r2) % 4) * 4 + r2];
    addRk(10);
    return s;
}
function aesDecryptBlock(blk, w) {
    var s = blk.slice();
    var i, r, r2, c, t, a;
    function addRk(rnd) { for (var k = 0; k < 16; k++) s[k] ^= w[rnd * 16 + k]; }
    addRk(10);
    for (r = 9; r >= 1; r--) {
        t = s.slice();
        for (r2 = 0; r2 < 4; r2++) for (c = 0; c < 4; c++) s[c * 4 + r2] = t[((c - r2 + 4) % 4) * 4 + r2];
        for (i = 0; i < 16; i++) s[i] = AES_INV_SBOX[s[i]];
        addRk(r);
        for (c = 0; c < 4; c++) {
            a = [s[c * 4], s[c * 4 + 1], s[c * 4 + 2], s[c * 4 + 3]];
            s[c * 4] = gmul(a[0], 14) ^ gmul(a[1], 11) ^ gmul(a[2], 13) ^ gmul(a[3], 9);
            s[c * 4 + 1] = gmul(a[0], 9) ^ gmul(a[1], 14) ^ gmul(a[2], 11) ^ gmul(a[3], 13);
            s[c * 4 + 2] = gmul(a[0], 13) ^ gmul(a[1], 9) ^ gmul(a[2], 14) ^ gmul(a[3], 11);
            s[c * 4 + 3] = gmul(a[0], 11) ^ gmul(a[1], 13) ^ gmul(a[2], 9) ^ gmul(a[3], 14);
        }
    }
    t = s.slice();
    for (r2 = 0; r2 < 4; r2++) for (c = 0; c < 4; c++) s[c * 4 + r2] = t[((c - r2 + 4) % 4) * 4 + r2];
    for (i = 0; i < 16; i++) s[i] = AES_INV_SBOX[s[i]];
    addRk(0);
    return s;
}
function b64enc(bytes) {
    var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
        var a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : null, c = i + 2 < bytes.length ? bytes[i + 2] : null;
        out += CH.charAt(a >> 2) + CH.charAt(((a & 3) << 4) | (b === null ? 0 : b >> 4)) + (b === null ? '=' : CH.charAt(((b & 15) << 2) | (c === null ? 0 : c >> 6))) + (c === null ? '=' : CH.charAt(c & 63));
    }
    return out;
}
function b64dec(s) {
    var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var clean = String(s).replace(/[^A-Za-z0-9+/=]/g, '').replace(/=+$/, '');
    var out = [];
    for (var i = 0; i < clean.length; i += 4) {
        var c0 = CH.indexOf(clean.charAt(i)), c1 = CH.indexOf(clean.charAt(i + 1));
        var c2 = i + 2 < clean.length ? CH.indexOf(clean.charAt(i + 2)) : 0;
        var c3 = i + 3 < clean.length ? CH.indexOf(clean.charAt(i + 3)) : 0;
        if (c2 < 0) c2 = 0;
        if (c3 < 0) c3 = 0;
        var n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
        out.push((n >> 16) & 255);
        if (i + 2 < clean.length) out.push((n >> 8) & 255);
        if (i + 3 < clean.length) out.push(n & 255);
    }
    return out;
}
var _keyCache = {};
function aesEcbEncrypt(plainStr, keyStr) {
    var w = _keyW(keyStr);
    var data = utf8Bytes(plainStr);
    var pad = 16 - (data.length % 16);
    for (var i = 0; i < pad; i++) data.push(pad);
    var out = [];
    for (var off = 0; off < data.length; off += 16) {
        var blk = aesEncryptBlock(data.slice(off, off + 16), w);
        for (var j = 0; j < 16; j++) out.push(blk[j]);
    }
    return b64enc(out);
}
function aesEcbDecrypt(b64, keyStr) {
    var w = _keyW(keyStr);
    var data = b64dec(b64);
    if (!data.length || data.length % 16 !== 0) return '';
    var out = [];
    for (var off = 0; off < data.length; off += 16) {
        var blk = aesDecryptBlock(data.slice(off, off + 16), w);
        for (var j = 0; j < 16; j++) out.push(blk[j]);
    }
    var pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) out = out.slice(0, out.length - pad);
    return bytesUtf8(out);
}
function _keyW(k) {
    if (!_keyCache[k]) _keyCache[k] = aesKeyExpand(utf8Bytes(k));
    return _keyCache[k];
}

// ================= 网络 =================
function postJson(url, payload, token) {
    var h = {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json;charset=UTF-8',
        'User-Agent': OK_UA
    };
    if (token !== undefined) h['token'] = token;
    var r = req(url, { method: 'post', data: payload, postType: 'json', headers: h, timeout: 15000 });
    return (r && r.content) || '';
}

// csj 加密接口: AES-ECB body + HMAC-SHA256 签名
function postEncrypted(url, data, index) {
    try {
        var t10 = String(Math.floor(Date.now() / 1000));
        var xnonce = 'X9UknYKtLa3DmtjC';
        var body1 = String(data);
        body1 = body1.replace(/&timestamp=\d+/, '&timestamp=' + t10);
        body1 = body1.replace(/&index=\d+/, '&index=' + index);
        body1 = body1.replace(/&count=\d+/, '&count=1');
        body1 = body1.replace(/&lock_free=\d+/, '&lock_free=1');
        body1 = body1.replace(/&lock_ad=\d+/, '&lock_ad=1');
        body1 = body1.replace(/&lock_index=\d+/, '&lock_index=' + index);
        var body2 = aesEcbEncrypt(body1, KEY_API);
        var sig = hmacSha256Hex(HMAC_SECRET, t10 + xnonce + body1);
        var tokens = ensureToken();
        var r = req(url, {
            method: 'post',
            body: body2,
            headers: {
                'X-Salt': 'FD8188A8D5',
                'X-Nonce': xnonce,
                'X-Timestamp': t10,
                'X-Access-Token': tokens.nnatoken,
                'X-Signature': sig,
                'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-1'
            },
            timeout: 15000
        });
        var txt = (r && r.content) || '';
        if (!txt) return {};
        var dec = aesEcbDecrypt(txt, KEY_API);
        return JSON.parse(dec);
    } catch (e) { return {}; }
}

// ================= token 链 =================
function dateKey() {
    var d = new Date();
    return '' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
}
function ensureToken() {
    var day = dateKey();
    if (_tokenDay === day && _nntoken && _nnatoken) return { nntoken: _nntoken, nnatoken: _nnatoken };
    // 1) 主站访客token
    try {
        var r = req(XURL + '/api/v1/app/user/visitorInfo', {
            headers: {
                'deviceid': 'aa11fc54-ba9c-3980-add5-447d3fa5b939',
                'token': '',
                'User-Agent': OK_UA,
                'client': 'app',
                'devicetype': 'Android'
            },
            timeout: 15000
        });
        var tk = JSON.parse((r && r.content) || '{}');
        _nntoken = (tk.data && tk.data.token) || '';
    } catch (e) { _nntoken = ''; }
    // 2) csj 登录取 access_token
    try {
        var t = String(Math.floor(Date.now() / 1000));
        var nonce = 'VX1KKGtoBDCi1fB1';
        var body = 'ac=wifi&os=Android&vod_version=1.10.21.6-tob&os_version=9&type=1&clientVersion=v5.2.5&uuid=Y4WNZ3SAWK7MAJMH7CXCDHJ4VMPVFRZQTBSIA4XTYO4AWEUHIK6Q01&resolution=1280*2618&openudid=889edced38f1069b&dt=Pixel%204&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&os_api=28&install_id=1549688030634536&device_brand=google&sdk_version=1.1.3.0&package_name=com.niuniu.ztdh.app&siteid=' + SITEID + '&dev_log_aid=667431&oaid=&timestamp=' + t;
        var sig = hmacSha256Hex(HMAC_SECRET, t + nonce + body);
        var enc = aesEcbEncrypt(body, KEY_LOGIN);
        var r2 = req(CSJ + '/api/v1/user/login?siteid=' + SITEID, {
            method: 'post',
            body: enc,
            headers: {
                'X-Salt': '786774955F',
                'X-Nonce': nonce,
                'X-Timestamp': t,
                'X-Signature': sig,
                'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-1'
            },
            timeout: 15000
        });
        var resp = (r2 && r2.content) || '';
        var dec = aesEcbDecrypt(resp, KEY_LOGIN);
        var lj = JSON.parse(dec);
        _nnatoken = (lj.data && lj.data.access_token) || '';
    } catch (e) { _nnatoken = ''; }
    _tokenDay = day;
    return { nntoken: _nntoken, nnatoken: _nnatoken };
}

// ================= 接口 =================
function toVod(v) {
    return {
        vod_id: String(v.id),
        vod_name: v.name || '',
        vod_pic: v.cover || '',
        vod_remarks: v.totalEpisode ? String(v.totalEpisode) + '集' : (v.classify || '短剧')
    };
}

function homeContent(filter) {
    var classes = [];
    try {
        var tokens = ensureToken();
        var txt = postJson(XURL + '/api/v1/app/screen/screenType', {}, tokens.nntoken);
        var data = JSON.parse(txt);
        if (data.data && data.data.length && data.data[0].children && data.data[0].children.length && data.data[0].children[0].children) {
            var setup = data.data[0].children[0].children;
            for (var i = 0; i < setup.length; i++) {
                var name = setup[i].name;
                if (name) classes.push({ type_id: name, type_name: name });
            }
        }
    } catch (e) { }
    if (!classes.length) {
        var fixed = ['都市', '穿越', '逆袭', '总裁', '虐恋', '甜宠', '重生', '玄幻'];
        for (var i = 0; i < fixed.length; i++) classes.push({ type_id: fixed[i], type_name: fixed[i] });
    }
    return { 'class': classes };
}

function homeVideoContent() {
    var videos = [];
    try {
        var tokens = ensureToken();
        var payload = { condition: { classify: '都市', typeId: 'S1' }, pageNum: '1', pageSize: 20 };
        var txt = postJson(XURL + '/api/v1/app/screen/screenMovie', payload, tokens.nntoken);
        var data = JSON.parse(txt);
        var recs = (data.data && data.data.records) || [];
        for (var i = 0; i < recs.length; i++) videos.push(toVod(recs[i]));
    } catch (e) { }
    return { list: videos };
}

function categoryContent(tid, pg, filter, extend) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    var videos = [];
    try {
        var tokens = ensureToken();
        var payload = { condition: { classify: String(tid), typeId: 'S1' }, pageNum: String(page), pageSize: 40 };
        var txt = postJson(XURL + '/api/v1/app/screen/screenMovie', payload, tokens.nntoken);
        var data = JSON.parse(txt);
        var recs = (data.data && data.data.records) || [];
        for (var i = 0; i < recs.length; i++) videos.push(toVod(recs[i]));
    } catch (e) { }
    return { list: videos, page: page, pagecount: videos.length ? 9999 : page, limit: 40, total: 999999 };
}

function cleanEp(n) {
    return String(n || '').replace(/第/g, '').replace(/集/g, '');
}

var CSJ_BASE_DATA = 'not_include=0&lock_free=1&type=1&clientVersion=v5.2.5&uuid=6IDYUSASPQY5BBVACWQW3LLTPV4V7DE26UOCX5TZTVUGX4VUJNXQ01&resolution=1080*2320&openudid=82f4175d577a2939&dt=22021211RC&os_api=31&install_id=1496879012031075&sdk_version=1.1.3.0&siteid=' + SITEID + '&dev_log_aid=667431&oaid=abec0dfff623201b&timestamp=1752498494&direction=0&ac=mobile&os=Android&vod_version=1.10.21.6-tob&os_version=12&count=1&index=1&shortplay_id={SPID}&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&device_brand=Redmi&package_name=com.niuniu.ztdh.app';
var CSJ_UNLOCK_DATA = 'ac=mobile&os=Android&vod_version=1.10.21.6-tob&os_version=12&lock_ad=3&lock_free=3&type=1&clientVersion=v5.2.5&uuid=6IDYUSASPQY5BBVACWQW3LLTPV4V7DE26UOCX5TZTVUGX4VUJNXQ01&resolution=1080*2320&openudid=82f4175d577a2939&shortplay_id={SPID}&dt=22021211RC&sha1=46121F77CE2FCAD3DBC3B9EC8A24908C1A8AD6D9&lock_index=21&os_api=31&install_id=1496879012031075&device_brand=Redmi&sdk_version=1.1.3.0&package_name=com.niuniu.ztdh.app&siteid=' + SITEID + '&dev_log_aid=667431&oaid=abec0dfff623201b&timestamp=1752498493';

function detailContent(ids) {
    var did = String(ids).split(',')[0];
    var vod_name = '未知', vod_pic = '', vod_content = '', vod_director = '', vod_actor = '';
    var vod_area = '', vod_year = '', vod_remarks = '', totalEp = 0;
    var xianlu = '', bofang = '';
    try {
        var tokens = ensureToken();
        // 详情基础信息
        try {
            var txt = postJson(XURL + '/api/v1/app/play/movieDesc', { id: did, typeId: 'S1' }, tokens.nntoken);
            var dj = JSON.parse(txt);
            if (dj.code === 200 && dj.data) {
                var dd = dj.data;
                vod_name = dd.name || vod_name;
                vod_pic = dd.cover || '';
                vod_content = dd.introduce || '';
                vod_director = dd.director || '';
                vod_actor = dd.star || '';
                vod_area = dd.area || '';
                vod_year = dd.year || '';
                var parts = [];
                if (dd.score) parts.push('评分:' + dd.score);
                if (dd.classify) parts.push('类型:' + dd.classify);
                if (dd.watch) parts.push('播放:' + dd.watch);
                vod_remarks = parts.join(' | ');
            }
        } catch (e) { }
        // 剧集列表
        var txt2 = postJson(XURL + '/api/v1/app/play/movieDetails', { id: did, source: 0, typeId: 'S1', userId: '546932' }, tokens.nntoken);
        var data = JSON.parse(txt2);
        var vd = data.data || {};
        totalEp = vd.totalEpisode || 0;
        if (vod_name === '未知' && vd.name) vod_name = vd.name;
        if (!vod_pic && vd.cover) vod_pic = vd.cover;
        if (!vod_content && vd.introduce) vod_content = vd.introduce;
        if (vd.episodeList && vd.episodeList.length) {
            var eps = [];
            for (var i = 0; i < vd.episodeList.length; i++) {
                var ep = vd.episodeList[i];
                eps.push('第' + cleanEp(ep.episode) + '集$' + did + '@' + ep.id);
            }
            bofang = eps.join('#');
            xianlu = '妞妞短剧';
        } else if (vd.thirdPlayId) {
            var spid = vd.thirdPlayId;
            var r1 = postEncrypted(CSJ + '/api/v1/shortplay/detail?siteid=' + SITEID, CSJ_BASE_DATA.split('{SPID}').join(spid), '1');
            if (r1.data && r1.data.episode_right_list) {
                var eps2 = [];
                for (var j = 0; j < r1.data.episode_right_list.length; j++) {
                    var it = r1.data.episode_right_list[j];
                    eps2.push('第' + cleanEp(it.index) + '集$第' + cleanEp(it.index) + '集+' + (it.lock_type || '') + '+' + spid);
                }
                if (eps2.length) {
                    bofang = eps2.join('#');
                    xianlu = '妞妞短剧2';
                }
            }
        }
    } catch (e) { }
    if (totalEp > 0) vod_remarks = vod_remarks ? ('总集数:' + totalEp + ' | ' + vod_remarks) : ('总集数:' + totalEp);
    if (vod_content.indexOf(DESC_PREFIX) !== 0) vod_content = DESC_PREFIX + (vod_content || '暂无剧情介绍');
    return {
        list: [{
            vod_id: did,
            vod_name: vod_name,
            vod_pic: vod_pic,
            vod_content: vod_content,
            vod_director: vod_director,
            vod_actor: vod_actor,
            vod_area: vod_area,
            vod_year: vod_year,
            vod_remarks: vod_remarks,
            vod_play_from: xianlu || '暂无资源',
            vod_play_url: bofang || '暂无播放地址$0'
        }]
    };
}

function playerContent(flag, id, vipFlags) {
    var out = { parse: 0, playUrl: '', url: '', header: HEADERX };
    try {
        var sid = String(id || '');
        var tokens = ensureToken();
        if (sid.indexOf('@') > -1) {
            var fg = sid.split('@');
            if (fg.length < 2) return out;
            var vid = fg[0].indexOf('$') > -1 ? fg[0].split('$').pop() : fg[0];
            var epId = fg[1];
            var txt = postJson(XURL + '/api/v1/app/play/movieDetails', { episodeId: epId, id: vid, source: 0, typeId: 'S1', userId: '546932' }, tokens.nntoken);
            var data = JSON.parse(txt);
            if (data.data && data.data.url) out.url = data.data.url;
            return out;
        }
        if (sid.indexOf('+') > -1) {
            var parts = sid.split('+');
            if (parts.length >= 3) {
                var index = cleanEp(parts[0]);
                var lockType = parts[1];
                var spid = parts[2];
                var baseData = CSJ_BASE_DATA.split('{SPID}').join(spid);
                if (lockType !== 'free') {
                    postEncrypted(CSJ + '/api/v1/pay/ad_unlock?siteid=' + SITEID, CSJ_UNLOCK_DATA.split('{SPID}').join(spid), index);
                }
                var r1 = postEncrypted(CSJ + '/api/v1/shortplay/detail?siteid=' + SITEID, baseData, index);
                if (r1.data && r1.data.list && r1.data.list.length) {
                    var vm = r1.data.list[0].video_model || {};
                    var vl = vm.video_list || {};
                    var v1 = vl.video_1 || {};
                    var mainUrl = v1.main_url || '';
                    if (mainUrl) {
                        var real = bytesUtf8(b64dec(mainUrl));
                        if (real) out.url = real;
                    }
                }
            }
            return out;
        }
    } catch (e) { }
    return out;
}

function searchContent(key, quick, pg) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    var videos = [];
    try {
        var tokens = ensureToken();
        var payload = { condition: { typeId: 'S1', value: String(key) }, pageNum: String(page), pageSize: 40 };
        var txt = postJson(XURL + '/api/v1/app/search/searchMovie', payload, tokens.nntoken);
        var data = JSON.parse(txt);
        var recs = (data.data && data.data.records) || [];
        for (var i = 0; i < recs.length; i++) {
            var v = recs[i];
            if (!v.name || v.name.indexOf(String(key)) < 0) continue;
            videos.push({
                vod_id: String(v.id),
                vod_name: v.name,
                vod_pic: v.cover || '',
                vod_remarks: v.year || '未知'
            });
        }
    } catch (e) { }
    return { list: videos, page: page, pagecount: videos.length ? 9999 : page, limit: 40, total: 999999 };
}

var spider = {
    init: function (extend) { },
    home: function (filter) { return JSON.stringify(homeContent(filter)); },
    homeVod: function () { return JSON.stringify(homeVideoContent()); },
    category: function (tid, pg, filter, extend) { return JSON.stringify(categoryContent(tid, pg, filter, extend)); },
    detail: function (ids) { return JSON.stringify(detailContent(ids)); },
    play: function (flag, id, vipFlags) { return JSON.stringify(playerContent(flag, id, vipFlags)); },
    search: function (key, quick, pg) { return JSON.stringify(searchContent(key, quick, pg)); }
};

export default spider;
