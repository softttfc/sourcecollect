// 好好看 (hkan) 独立 JS 爬虫
// 由原 ack.js 通用引擎协议逆向后重写, 配置已固化, 接口无需 ext
// 协议: 匿名设备注册 + HmacSHA1 请求签名 + AES-256-CBC 响应解密

// ==================== 固化配置 ====================
const CFG = {
    host: "https://vcache.shkjbd.com",
    appid: "hkan",
    channelid: "c300000",
    versionName: "3.3.9",
    package: "com.hkanC300000V250930.T120445",
    sort: "dujia1,dujia",     // 线路优先级 (siteId)
    lineCount: 1,             // 保留线路数
    aesKey: "ayt5wy5afwmwrpb19k9s3psx3dymyd0n",  // 响应 AES-256 key
    aesIv: "b3t069ijy7pirw0j",                    // 响应 AES iv
    signKey: "ksggsr4tp6difdo1c3im8fqd3g",        // HmacSHA1 签名 key
    playUa: "com.salmon.film.app.start.App/3.3.9 (Linux;Android 12) AndroidXMedia3/1.6.1"
};
const PREFIX = "【琉🔹璃❤广告勿信👉剧情】📢";
const NS = "haohaokan";

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

// ==================== AES (纯JS, CBC 解密, 128/192/256 通用) ====================
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
function aesInvSub(s) { for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
function aesInvShift(s) {
    for (let r = 1; r < 4; r++) {
        const t = [];
        for (let c = 0; c < 4; c++) t.push(s[r + 4 * ((c - r + 4) % 4)]);
        for (let c = 0; c < 4; c++) s[r + 4 * c] = t[c];
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

// ==================== SHA-1 / HMAC-SHA1 (纯JS) ====================
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
            if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }
            const tmp = ((((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0);
            e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = tmp;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    const out = [];
    for (const v of [h0, h1, h2, h3, h4]) for (let i = 3; i >= 0; i--) out.push((v >>> (8 * i)) & 255);
    return out;
}
function hmacSha1(msg, keyStr) {
    const keyB = utf8enc(keyStr);
    let k = keyB.length > 64 ? sha1Bytes(keyB) : keyB.slice();
    while (k.length < 64) k.push(0);
    const ipad = [], opad = [];
    for (let i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    const inner = sha1Bytes(ipad.concat(utf8enc(msg)));
    return sha1Bytes(opad.concat(inner));
}

// ==================== 本地存储 (local 不可用时内存兜底) ====================
const MEM = {};
const LS = {
    get(k) { try { return local.get(NS, k) || ""; } catch (e) { return MEM[k] || ""; } },
    set(k, v) { MEM[k] = v; try { local.set(NS, k, v); } catch (e) {} }
};

// ==================== 设备与注册 ====================
const DEV = { did: "", dc: "", uuid: "", info: "" };
const USER = { id: "", token: "" };
let APP = null;      // appInit 缓存
let SRC_HDR = {};    // sourceHeader: siteId -> header

function randHex(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
    return s;
}
function genUuid() {
    const s = randHex(32);
    return s.slice(0, 8) + "-" + s.slice(8, 12) + "-4" + s.slice(13, 16) + "-" + "89ab"[Math.floor(Math.random() * 4)] + s.slice(17, 20) + "-" + s.slice(20, 32);
}
function ensureDevice() {
    if (DEV.did) return;
    DEV.did = LS.get("did"); DEV.dc = LS.get("dc"); DEV.uuid = LS.get("uuid");
    if (!DEV.did || !DEV.dc || !DEV.uuid) {
        DEV.did = randHex(16);
        DEV.dc = String(Date.now());
        DEV.uuid = genUuid();
        LS.set("did", DEV.did); LS.set("dc", DEV.dc); LS.set("uuid", DEV.uuid);
    }
    DEV.info = b64enc(utf8enc(JSON.stringify({
        brand: "xiaomi", model: "xiaomi", type: "phone",
        resolustionX: "1600", resolustionY: "900", orientation: "1",
        osName: "android", osVersion: "15", osLevel: "32",
        abi: "arm64-v8a,armeabi-v7a,armeabi",
        androidId: DEV.did, uuid: DEV.uuid, gaid: ""
    })));
}

// ==================== 请求封装 (签名 + 解密) ====================
function apiReq(method, path, query, isReg) {
    ensureDevice();
    const ts = String(Date.now());
    // 签名 query: key 字典序, k=v 值不编码, & 连接, 无 query 为空串
    let qs = "";
    if (query) qs = Object.keys(query).sort().map(k => k + "=" + query[k]).join("&");
    let msg = method + "|" + path + "|" + qs + "|" + ts + "|appId=" + CFG.appid +
        "&deviceCreatedAt=" + DEV.dc + "&deviceId=" + DEV.did + "&st=2";
    if (USER.id) msg += "&userId=" + USER.id;
    msg += "|";
    const sign = hexenc(hmacSha1(msg, CFG.signKey));
    const h = {
        "User-Agent": CFG.package + "/" + CFG.versionName + " Dalvik/2.1.0 (Linux; U; Android 12; SM-S9080 Build/3480d86.0)",
        "appid": CFG.appid,
        "os": "android",
        "appversion": CFG.versionName,
        "package": CFG.package,
        "deviceid": DEV.did,
        "devicecreatedat": DEV.dc,
        "deviceinfo": DEV.info,
        "channelid": CFG.channelid,
        "x-d-video": "1",
        "st": "2",
        "ts": ts,
        "sign": sign
    };
    if (isReg) h["apiver"] = "v2"; else h["x-cdn"] = "1";
    if (USER.id) { h["userid"] = USER.id; h["x-token"] = USER.token; }
    let url = CFG.host + path;
    if (query) url += "?" + Object.keys(query).map(k => k + "=" + encodeURIComponent(query[k])).join("&");
    let resp;
    try { resp = req(url, { method: method, headers: h, timeout: 15000, buffer: 2 }); } catch (e) { return null; }
    if (!resp || !resp.content) return null;
    try {
        const plain = utf8dec(aesCbcDec(utf8enc(CFG.aesKey), utf8enc(CFG.aesIv), b64dec(String(resp.content).trim())));
        return JSON.parse(plain);
    } catch (e) { return null; }
}

function ensureRegister() {
    ensureDevice();
    if (!USER.id || !USER.token) {
        USER.id = LS.get("uid"); USER.token = LS.get("tk");
    }
    if (USER.id && USER.token) return;
    const r = apiReq("post", "/user/anonymous", null, true);
    if (r && r.code === 200 && r.data && r.data.id) {
        USER.id = String(r.data.id);
        USER.token = String(r.data.token || "");
        LS.set("uid", USER.id); LS.set("tk", USER.token);
    }
}

function ensureAppInit() {
    if (APP) return;
    ensureRegister();
    const r = apiReq("get", "/v4/config/appInit.capi", { os: "android", appId: CFG.appid, userLevel: "2" });
    APP = (r && r.data) ? r.data : (r || {});
    SRC_HDR = {};
    const sh = APP.sourceHeader || [];
    for (const it of sh) { if (it.siteId && it.header) SRC_HDR[it.siteId] = it.header; }
}

// ==================== 工具 ====================
function picUrl(group, path) {
    if (!path) return "";
    path = String(path);
    if (/^https?:\/\//.test(path)) return path;
    const g = (APP && APP.groups) || [];
    for (const it of g) {
        if (it.id === group && it.url && it.url.length) return it.url[0].domain + path;
    }
    for (const it of g) {
        if (it.id === "vod1" && it.url && it.url.length) return it.url[0].domain + path;
    }
    return path;
}
function addPrefix(s) {
    s = String(s || "");
    return s.indexOf(PREFIX) === 0 ? s : PREFIX + s;
}

// ==================== 接口 ====================
function init(cfg) {
    try { ensureRegister(); } catch (e) {}
    try { ensureAppInit(); } catch (e) {}
}

function home(filter) {
    ensureAppInit();
    const cls = [];
    const tabs = (APP && APP.vodTabs) || [];
    for (const t of tabs) {
        if (t.type === "home") cls.push({ type_id: "home", type_name: "首页" });
        else if (t.type === "category" && Number(t.channelId) < 2000 && t.isAdult != 1)
            cls.push({ type_id: String(t.channelId), type_name: String(t.text) });
    }
    const filters = {};
    const nameMap = { sort: "排序", category: "分类", area: "地区", language: "语言", year: "年份" };
    const clq = (APP && APP.channelListQuery) || [];
    for (const c of cls) {
        const cid = Number(c.type_id);
        if (!cid) continue;
        for (const q of clq) {
            if (q.channelId === cid) {
                filters[c.type_id] = (q.items || []).map(it => ({
                    key: it.query,
                    name: nameMap[it.query] || it.query,
                    init: String(it.selected == null ? "" : it.selected),
                    value: (it.data || []).map(d => ({ n: String(d.name), v: String(d.id) }))
                }));
            }
        }
    }
    return JSON.stringify({ class: cls, filters: filters });
}

function homeVod() {
    ensureAppInit();
    const r = apiReq("get", "/v4/vod/home.capi", { os: "android", appId: CFG.appid, userLevel: "2" });
    const list = [];
    const blocks = (r && r.data && r.data.blocks) || [];
    for (const b of blocks) {
        const items = b.data || [];
        for (const it of items) {
            if (!it.url || String(it.url).indexOf("vod/detail") !== 0) continue;
            const m = /vodId=(\d+)/.exec(it.url);
            if (!m) continue;
            list.push({
                vod_id: m[1],
                vod_name: String(it.title || ""),
                vod_pic: picUrl(it.imageGroup, it.imagePath),
                vod_remarks: String(it.bottomLabel || "")
            });
        }
    }
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    ensureAppInit();
    pg = pg || 1;
    const ext = extend || {};
    const q = {
        channelId: String(tid),
        sort: String(ext.sort != null ? ext.sort : "3"),
        category: String(ext.category || ""),
        area: String(ext.area || ""),
        language: String(ext.language || ""),
        year: String(ext.year || ""),
        next: "page=" + pg,
        os: "android",
        appId: CFG.appid,
        userLevel: "2"
    };
    const r = apiReq("get", "/vod/channel/list.capi", q);
    const items = (r && r.data && r.data.items) || [];
    const list = items.map(it => ({
        vod_id: String(it.id),
        vod_name: String(it.title || ""),
        vod_pic: picUrl(it.imageGroup, it.imagePath),
        vod_remarks: String(it.bottomLabel || "")
    }));
    const hasNext = !!(r && r.data && r.data.next);
    return JSON.stringify({ list: list, page: pg, pagecount: hasNext ? pg + 1 : pg, limit: 20, total: 0 });
}

function search(wd, quick, pg) {
    ensureAppInit();
    pg = pg || 1;
    const q = {
        channelId: "0",
        k: String(wd),
        next: "page=" + pg,
        os: "android",
        appId: CFG.appid,
        userChannel: CFG.channelid,
        userLevel: "2"
    };
    const r = apiReq("get", "/vod/search/query", q);
    const items = (r && r.data && r.data.items) || [];
    const list = items.map(it => ({
        vod_id: String(it.id),
        vod_name: String(it.title || "").replace(/<[^>]+>/g, ""),
        vod_pic: picUrl(it.imageGroup, it.imagePath),
        vod_remarks: String(it.bottomLabel || ""),
        vod_year: (it.year && it.year.name) ? String(it.year.name) : "",
        vod_content: String(it.summary || "")
    }));
    return JSON.stringify({ list: list, page: pg, pagecount: 0, limit: 20, total: 0 });
}

function detail(id) {
    ensureAppInit();
    id = String(id);
    const r = apiReq("get", "/v2/vod/detail.capi", { vodId: id, os: "android", appId: CFG.appid, userLevel: "2" });
    const d = r && r.data;
    if (!d) return JSON.stringify({ list: [] });
    // 线路排序: sort 列表内优先, lineCount 截断
    const all = d.playSources || [];
    const pri = CFG.sort.split(",");
    const srcs = all.slice().sort((a, b) => {
        let ia = pri.indexOf(a.siteId), ib = pri.indexOf(b.siteId);
        if (ia < 0) ia = 999;
        if (ib < 0) ib = 999;
        return ia - ib;
    });
    const keep = (CFG.lineCount > 0 && srcs.length > CFG.lineCount) ? srcs.slice(0, CFG.lineCount) : srcs;
    // 补抓用的 episodeVodId (取任意有剧集线路的)
    let anyEid = "";
    for (const s of all) {
        if (s.list && s.list.length && s.list[0].episodeVodId) { anyEid = String(s.list[0].episodeVodId); break; }
    }
    const froms = [], urlGroups = [];
    for (const s of keep) {
        let eps = s.list || [];
        if (!eps.length) {
            const er = apiReq("get", "/v2/vod/episodes.capi", {
                vodId: id, siteId: String(s.siteId), episodeVodId: anyEid || id,
                os: "android", appId: CFG.appid, userLevel: "2"
            });
            if (er && er.data) eps = Array.isArray(er.data) ? er.data : (er.data.list || er.data.items || []);
        }
        const parts = [];
        for (const ep of eps) {
            const pu = ep.playUrls && ep.playUrls[0];
            if (!pu || !pu.url) continue;
            const title = String(ep.title || (ep.index ? "第" + ep.index + "集" : "播放"));
            parts.push(title + "$" + pu.url);
        }
        if (!parts.length) continue;
        froms.push(String(s.name || s.siteId) + " (" + s.siteId + ")");
        urlGroups.push(parts.join("#"));
    }
    const vod = {
        vod_id: String(d.id),
        vod_name: String(d.title || ""),
        vod_pic: picUrl(d.imageGroup, d.imagePath),
        vod_remarks: String(d.bottomLabel || ""),
        vod_year: (d.year && d.year.name) ? String(d.year.name) : "",
        vod_area: (d.area && d.area[0]) ? String(d.area[0].name) : "",
        vod_actor: (d.actors || []).map(a => a.name).join(","),
        vod_director: (d.directors || []).map(a => a.name).join(","),
        vod_content: addPrefix(d.summary || ""),
        vod_play_from: froms.join("$$$"),
        vod_play_url: urlGroups.join("$$$")
    };
    return JSON.stringify({ list: [vod] });
}

function play(flag, id, flags) {
    const h = { "User-Agent": CFG.playUa };
    try { ensureAppInit(); } catch (e) {}
    const m = /\(([^()]+)\)\s*$/.exec(flag || "");
    const sh = m && SRC_HDR[m[1]];
    if (sh) {
        for (const k in sh) {
            if (sh[k] !== "Local") h[k] = sh[k];
        }
    }
    return JSON.stringify({ jx: 0, parse: 0, url: String(id), header: h });
}

export default { init, home, homeVod, category, detail, play, search };
