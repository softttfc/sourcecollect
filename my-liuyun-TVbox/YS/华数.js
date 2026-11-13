// 华数TV (www.wasu.cn 官方API) - 琉芸JS 版
const appConfig = {
    siteName: "华数",
    indexUrl: "https://www.wasu.cn",
    searchUrl: "https://ups.5g.wasu.tv/rmp-user-suggest/1000101/hzhs/searchServlet",
    detailUrl: "https://mcspapp.5g.wasu.tv/bvradio_app/hzhs/newsServlet",
    playUrl: "https://mcspapp.5g.wasu.tv/thirdApiFile/file/getPlayUrl",
    siteId: "1000101"
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.startsWith(DESC_PREFIX)) return s;
    return DESC_PREFIX + s;
}

// ===================== 纯JS加密工具 =====================
// SHA-256 硬编码常量
const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];
const H0 = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

function sha256Bytes(bytes) {
    // padding
    const ml = bytes.length * 8;
    const padded = bytes.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    // 64-bit length (high 32 bit = 0 for our sizes)
    padded.push(0,0,0,0);
    padded.push((ml >>> 24) & 0xff, (ml >>> 16) & 0xff, (ml >>> 8) & 0xff, ml & 0xff);

    const h = H0.slice();
    const w = new Array(64);
    for (let i = 0; i < padded.length; i += 64) {
        for (let j = 0; j < 16; j++) {
            w[j] = ((padded[i+j*4]<<24) | (padded[i+j*4+1]<<16) | (padded[i+j*4+2]<<8) | padded[i+j*4+3]) >>> 0;
        }
        for (let j = 16; j < 64; j++) {
            const s0 = rotr(w[j-15],7) ^ rotr(w[j-15],18) ^ (w[j-15]>>>3);
            const s1 = rotr(w[j-2],17) ^ rotr(w[j-2],19) ^ (w[j-2]>>>10);
            w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
        }
        let a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
        for (let j = 0; j < 64; j++) {
            const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (hh + S1 + ch + K[j] + w[j]) >>> 0;
            const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) >>> 0;
            hh=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
        }
        h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
        h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
    }
    const out = [];
    for (let i = 0; i < 8; i++) {
        out.push((h[i]>>>24)&0xff, (h[i]>>>16)&0xff, (h[i]>>>8)&0xff, h[i]&0xff);
    }
    return out;
}

function utf8Encode(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xc0|(c>>6), 0x80|(c&0x3f));
        else if (c < 0xd800 || c >= 0xe000) out.push(0xe0|(c>>12), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f));
        else { i++; c = 0x10000 + (((c & 0x3ff)<<10) | (str.charCodeAt(i) & 0x3ff)); out.push(0xf0|(c>>18),0x80|((c>>12)&0x3f),0x80|((c>>6)&0x3f),0x80|(c&0x3f)); }
    }
    return out;
}

function hmacSha256(keyBytes, dataBytes) {
    const block = 64;
    let k = keyBytes.length > block ? sha256Bytes(keyBytes) : keyBytes.slice();
    while (k.length < block) k.push(0);
    const ipad = [], opad = [];
    for (let i = 0; i < block; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    return sha256Bytes(opad.concat(sha256Bytes(ipad.concat(dataBytes))));
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64encode(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i], b1 = bytes[i+1], b2 = bytes[i+2];
        s += B64.charAt(b0>>2);
        s += B64.charAt(((b0&3)<<4) | ((b1||0)>>4));
        s += b1 === undefined ? "=" : B64.charAt(((b1&15)<<2) | ((b2||0)>>6));
        s += b2 === undefined ? "=" : B64.charAt(b2&63);
    }
    return s;
}
function b64decode(str) {
    str = str.replace(/[^A-Za-z0-9+/=]/g, "");
    const out = [];
    for (let i = 0; i < str.length; i += 4) {
        const c0 = B64.indexOf(str[i]), c1 = B64.indexOf(str[i+1]);
        const c2 = B64.indexOf(str[i+2]), c3 = B64.indexOf(str[i+3]);
        out.push((c0<<2)|(c1>>4));
        if (c2 !== -1 && str[i+2] !== "=") out.push(((c1&15)<<4)|(c2>>2));
        if (c3 !== -1 && str[i+3] !== "=") out.push(((c2&3)<<6)|c3);
    }
    return out;
}

// ===================== 华数签名逻辑 =====================
let cachedKey = null;

async function getAppKey() {
    if (cachedKey) return cachedKey;
    const html = (await req(appConfig.indexUrl, {
        method: "GET",
        headers: { "User-Agent": UA },
        timeout: 20000
    })).content;
    const m = html.match(/src="(\/[\d\.]+\/assets\/js\/index-[\w\.-]+\.js)"/);
    if (!m) throw new Error("未找到JS路径");
    const jsUrl = appConfig.indexUrl + m[1];
    const js = (await req(jsUrl, {
        method: "GET",
        headers: { "User-Agent": UA },
        timeout: 20000
    })).content;
    const km = js.match(/const \w+="([^"]+)",\w+="([^"]+)",\w+="([^"]+)";/);
    if (!km) throw new Error("未找到密钥");
    cachedKey = km[2];
    return cachedKey;
}

// dataString 若为空则对 "{}" 签名
async function getSign(dataString) {
    const keyB64 = await getAppKey();
    const key = b64decode(keyB64);
    const data = utf8Encode(dataString || "{}");
    return b64encode(hmacSha256(key, data));
}

function getCommonHeaders(sign) {
    return {
        "accept": "application/json, text/plain, */*",
        "launchchannel": "web_channel",
        "origin": appConfig.indexUrl,
        "referer": appConfig.indexUrl,
        "siteid": appConfig.siteId,
        "user-agent": UA,
        "x-sign": sign
    };
}

function pickPic(vod) {
    return vod.hPic || vod.vPic || vod.poster || vod.coverImg || "";
}

// QuickJS 无 URLSearchParams, 手动拼 query
function buildQuery(obj) {
    const parts = [];
    for (const k in obj) {
        if (obj[k] !== undefined && obj[k] !== null) {
            parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
        }
    }
    return parts.join("&");
}

// ===================== TVBox接口 =====================
async function init(ext) {
    console.log("初始化爬虫:", appConfig.siteName);
}

const classList = [
    { type_id: "961", type_name: "电影" },
    { type_id: "962", type_name: "剧集" },
    { type_id: "963", type_name: "少儿" },
    { type_id: "965", type_name: "栏目" },
    { type_id: "966", type_name: "新闻" }
];

const years = [{n:"全部",v:"全部"}];
for (let y = 2026; y >= 2010; y--) years.push({n:String(y),v:String(y)});

const myFilters = {
    "961": [
        {key:"地区",name:"地区",value:[{n:"全部",v:"全部"},{n:"内地",v:"内地"},{n:"港台",v:"港台"},{n:"欧美",v:"欧美"},{n:"日韩",v:"日韩"},{n:"泰国",v:"泰国"},{n:"其他",v:"其他"}]},
        {key:"类型",name:"类型",value:[{n:"全部",v:"全部"},{n:"动作",v:"动作"},{n:"科幻",v:"科幻"},{n:"惊悚",v:"惊悚"},{n:"冒险",v:"冒险"},{n:"剧情",v:"剧情"},{n:"励志",v:"励志"},{n:"爱情",v:"爱情"},{n:"喜剧",v:"喜剧"},{n:"家庭",v:"家庭"},{n:"历史",v:"历史"},{n:"魔幻",v:"魔幻"},{n:"恐怖",v:"恐怖"},{n:"战争",v:"战争"},{n:"武侠",v:"武侠"}]},
        {key:"年代",name:"年代",value:years}
    ],
    "962": [
        {key:"地区",name:"地区",value:[{n:"全部",v:"全部"},{n:"内地",v:"内地"},{n:"港台",v:"港台"},{n:"日韩",v:"日韩"},{n:"欧美",v:"欧美"},{n:"泰国",v:"泰国"},{n:"其他",v:"其他"}]},
        {key:"类型",name:"类型",value:[{n:"全部",v:"全部"},{n:"都市",v:"都市"},{n:"爱情",v:"爱情"},{n:"短剧",v:"短剧"},{n:"战争",v:"战争"},{n:"家庭",v:"家庭"},{n:"悬疑",v:"悬疑"},{n:"古装",v:"古装"},{n:"谍战",v:"谍战"},{n:"喜剧",v:"喜剧"},{n:"农村",v:"农村"},{n:"刑侦",v:"刑侦"},{n:"武侠",v:"武侠"},{n:"历史",v:"历史"}]},
        {key:"年代",name:"年代",value:years}
    ],
    "963": [
        {key:"地区",name:"地区",value:[{n:"全部",v:"全部"},{n:"内地",v:"内地"},{n:"日韩",v:"日韩"},{n:"欧美",v:"欧美"},{n:"港台",v:"港台"},{n:"其他",v:"其他"}]},
        {key:"类型",name:"类型",value:[{n:"全部",v:"全部"},{n:"动作",v:"动作"},{n:"冒险",v:"冒险"},{n:"益智",v:"益智"},{n:"亲子",v:"亲子"},{n:"热血",v:"热血"},{n:"剧情",v:"剧情"},{n:"魔幻",v:"魔幻"},{n:"励志",v:"励志"},{n:"机战",v:"机战"},{n:"搞笑",v:"搞笑"},{n:"科幻",v:"科幻"},{n:"治愈",v:"治愈"},{n:"儿歌",v:"儿歌"},{n:"教育",v:"教育"},{n:"校园",v:"校园"},{n:"童话",v:"童话"},{n:"推理",v:"推理"},{n:"怀旧",v:"怀旧"},{n:"宠物",v:"宠物"},{n:"舞蹈",v:"舞蹈"}]},
        {key:"年代",name:"年代",value:years}
    ],
    "965": [
        {key:"地区",name:"地区",value:[{n:"全部",v:"全部"},{n:"内地",v:"内地"},{n:"欧美",v:"欧美"}]},
        {key:"类型",name:"类型",value:[{n:"全部",v:"全部"},{n:"文化",v:"文化"},{n:"纪实",v:"纪实"},{n:"访谈",v:"访谈"},{n:"历史",v:"历史"},{n:"美食",v:"美食"},{n:"旅游",v:"旅游"},{n:"时尚",v:"时尚"},{n:"情感",v:"情感"},{n:"生活",v:"生活"},{n:"真人秀",v:"真人秀"}]},
        {key:"年代",name:"年代",value:years}
    ],
    "966": [
        {key:"类型",name:"类型",value:[{n:"全部",v:"全部"},{n:"国内视野",v:"国内视野"},{n:"国际纵览",v:"国际纵览"},{n:"军事话题",v:"军事话题"},{n:"社会百态",v:"社会百态"},{n:"央视频",v:"央视频"}]}
    ]
};

function mapList(vod) {
    return {
        vod_id: vod.nodeId + "@" + vod.newsId,
        vod_name: vod.title || "",
        vod_pic: pickPic(vod),
        vod_year: vod.pubTime || "",
        vod_remarks: vod.episodeDesc || ""
    };
}

async function home(filter) {
    let list = [];
    // 首页无原生推荐, 回退前4分类各8条
    try {
        const top4 = classList.slice(0, 4);
        const results = await Promise.all(top4.map(c =>
            category(c.type_id, 1, true, {}).then(JSON.parse).catch(() => null)
        ));
        let seen = {};
        results.forEach(r => {
            if (!r || !r.list) return;
            r.list.slice(0, 8).forEach(item => {
                if (seen[item.vod_id]) return;
                seen[item.vod_id] = true;
                list.push(item);
            });
        });
    } catch (e) {
        console.error("首页推荐获取失败:", e.message);
    }
    return JSON.stringify({ class: classList, filters: myFilters, list: list });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    extend = extend || {};
    try {
        const sign = await getSign();
        const qs = buildQuery({
            functionName: "getNewsSearchedByCondition",
            nodeId: tid,
            nodeTag: extend["类型"] || "全部",
            yearTag: extend["年代"] || "全部",
            countryTag: extend["地区"] || "全部",
            orderType: "0",
            pageSize: "40",
            page: String(pg),
            keyword: "",
            siteId: appConfig.siteId
        });
        const res = await req(`${appConfig.searchUrl}?${qs}`, {
            method: "GET",
            headers: getCommonHeaders(sign),
            timeout: 20000
        });
        const data = JSON.parse(res.content);
        const list = (data.data || []).map(mapList);
        return JSON.stringify({
            list: list,
            page: pg,
            pagecount: list.length >= 40 ? pg + 1 : pg,
            limit: 40,
            total: 9999
        });
    } catch (e) {
        console.error("分类列表获取失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function detail(id) {
    try {
        const parts = String(id).split("@");
        if (parts.length < 2) return JSON.stringify({ list: [] });
        const sign = await getSign();
        const qs = buildQuery({
            siteId: appConfig.siteId,
            functionName: "getCurrentNews",
            nodeId: parts[0],
            newsId: parts[1],
            platform: "web"
        });
        const res = await req(`${appConfig.detailUrl}?${qs}`, {
            method: "GET",
            headers: getCommonHeaders(sign),
            timeout: 20000
        });
        const d = JSON.parse(res.content);
        const v = d.data || {};

        let bofang = "";
        (v.vodList || []).forEach(vod => {
            const name = vod.title || "";
            const fl = vod.fileList || [];
            const playUrl = (fl.length > 1 ? fl[1].playUrl : fl[0] ? fl[0].playUrl : "");
            if (playUrl) bofang += name + "$" + playUrl + "#";
        });
        bofang = bofang.replace(/#$/, "");

        return JSON.stringify({
            list: [{
                vod_id: String(id),
                vod_name: v.title || "",
                vod_director: v.director || "",
                vod_actor: v.actor || "",
                vod_remarks: v.episodeDesc || "",
                vod_year: v.pubTime || "",
                vod_area: v.countryTag || "",
                vod_content: withPrefix(v.newsAbstract || ""),
                vod_pic: pickPic(v),
                vod_play_from: "华数",
                vod_play_url: bofang
            }]
        });
    } catch (error) {
        console.error(`解析详情异常 [ID: ${id}]:`, error);
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        const playUrl = String(id || "").replace(".mp4", "/playlist.m3u8");
        const payload = JSON.stringify({ playUrl: playUrl, platform: "web" });
        const sign = await getSign(payload);
        const res = await req(appConfig.playUrl, {
            method: "POST",
            headers: Object.assign(getCommonHeaders(sign), { "content-type": "application/json" }),
            data: { playUrl: playUrl, platform: "web" },
            postType: "json",
            timeout: 20000
        });
        const d = JSON.parse(res.content);
        const realUrl = d.data && d.data.playUrl;
        if (realUrl) {
            return JSON.stringify({
                parse: 0,
                url: realUrl,
                header: {
                    "User-Agent": UA,
                    "Referer": appConfig.indexUrl,
                    "Origin": appConfig.indexUrl
                }
            });
        }
    } catch (e) {
        console.error("播放失败:", e.message);
    }
    return JSON.stringify({ parse: 0, url: "" });
}

async function search(wd, quick, page) {
    page = page || 1;
    try {
        const sign = await getSign();
        const qs = buildQuery({
            functionName: "getNewsSearched",
            searchNewsType: "3,4,5",
            keyword: wd,
            pageSize: "20",
            page: String(page),
            siteId: appConfig.siteId
        });
        const res = await req(`${appConfig.searchUrl}?${qs}`, {
            method: "GET",
            headers: getCommonHeaders(sign),
            timeout: 20000
        });
        const data = JSON.parse(res.content);
        const list = (data.data || []).map(mapList);
        return JSON.stringify({
            list: list,
            page: page,
            pagecount: list.length >= 20 ? page + 1 : page
        });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

export default {
    init,
    home,
    category,
    detail,
    search,
    play
};
