// ================== 爱电影 · TVBox QuickJS ==================
// 源：爱电影（mw-movie REST API，gs4x7nq4.com）
// 签名：data串 -> md5 -> sha1，放 t/sign 请求头
// 分类：/vod/show/id/{tid}{筛选}/page/{pg}（HTML内嵌转义JSON）
// 播放：/api/.../v2/video/episode/url?id=&nid= 取直链 parse:0
// ==========================================================

const HOST = "https://www.gs4x7nq4.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SIGN_KEY = "cb808529bae6b6be45ecfab29a4889bc";
const ERROR_URL = "https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-720p.mp4";

const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

// 纯JS SHA1（QuickJS 无原生 sha1）
function sha1(msg) {
    function rotl(n, s) { return (n << s) | (n >>> (32 - s)); }
    const bytes = unescape(encodeURIComponent(msg));
    const words = [];
    for (let i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes.charCodeAt(i) << (24 - (i % 4) * 8));
    const bitLen = bytes.length * 8;
    words[bitLen >> 5] = (words[bitLen >> 5] || 0) | (0x80 << (24 - (bitLen % 32)));
    const wEnd = (((bitLen + 64) >>> 9) << 4) + 15;
    words[wEnd] = bitLen;
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    const w = new Array(80);
    for (let j = 0; j <= wEnd; j += 16) {
        for (let i = 0; i < 80; i++) {
            w[i] = i < 16 ? (words[j + i] || 0) : rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            let f, k;
            if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
            else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
            else { f = b ^ c ^ d; k = 0xCA62C1D6; }
            const tmp = (rotl(a, 5) + f + e + k + w[i]) | 0;
            e = d; d = c; c = rotl(b, 30); b = a; a = tmp;
        }
        h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }
    function hex(n) { let s = ""; for (let i = 7; i >= 0; i--) s += ((n >>> (i * 4)) & 0xF).toString(16); return s; }
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

function makeHeaders(dataPrefix) {
    const t = String(Date.now());
    const data = (dataPrefix ? dataPrefix + "&" : "") + "key=" + SIGN_KEY + "&t=" + t;
    return {
        "User-Agent": UA,
        "referer": HOST,
        "t": t,
        "sign": sha1(md5X(data)),
        "Accept-Encoding": "identity"
    };
}

async function getJson(url, dataPrefix, timeout) {
    try {
        const res = await req(url, { method: "GET", headers: makeHeaders(dataPrefix), timeout: timeout || 12000 });
        if (!res || res.code !== 200) return null;
        return JSON.parse(String(res.content || ""));
    } catch (e) {
        return null;
    }
}

function remarksOf(i) {
    return String(i.typeId1 === 1 ? (i.vodVersion || "") : (i.vodRemarks || ""));
}

function mapVod(i) {
    return {
        vod_id: String(i.vodId),
        vod_name: String(i.vodName || ""),
        vod_pic: String(i.vodPic || ""),
        vod_remarks: remarksOf(i)
    };
}

const classList = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "电视剧" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" }
];

function nv(n, v) { return { n: n, v: v }; }
const areaAll = [nv("全部", ""), nv("中国大陆", "/area/中国大陆"), nv("中国香港", "/area/中国香港"), nv("中国台湾", "/area/中国台湾"), nv("美国", "/area/美国"), nv("日本", "/area/日本"), nv("韩国", "/area/韩国"), nv("印度", "/area/印度"), nv("泰国", "/area/泰国"), nv("其他", "/area/其他")];
const areaNoIndia = [nv("全部", ""), nv("中国大陆", "/area/中国大陆"), nv("中国香港", "/area/中国香港"), nv("中国台湾", "/area/中国台湾"), nv("日本", "/area/日本"), nv("韩国", "/area/韩国"), nv("美国", "/area/美国"), nv("泰国", "/area/泰国"), nv("其他", "/area/其他")];
const areaSimple = [nv("全部", ""), nv("中国大陆", "/area/中国大陆"), nv("中国香港", "/area/中国香港"), nv("中国台湾", "/area/中国台湾"), nv("日本", "/area/日本"), nv("韩国", "/area/韩国"), nv("美国", "/area/美国"), nv("其他", "/area/其他")];
const areaAnime = [nv("全部", ""), nv("中国大陆", "/area/中国大陆"), nv("日本", "/area/日本"), nv("美国", "/area/美国"), nv("其他", "/area/其他")];
const yearFull = [nv("全部", ""), nv("2024", "/year/2024"), nv("2023", "/year/2023"), nv("2022", "/year/2022"), nv("2021", "/year/2021"), nv("2020", "/year/2020"), nv("2019", "/year/2019"), nv("2018", "/year/2018"), nv("2017", "/year/2017"), nv("2016", "/year/2016"), nv("2015", "/year/2015"), nv("2014", "/year/2014"), nv("2013", "/year/2013"), nv("2012", "/year/2012"), nv("2011", "/year/2011"), nv("2010", "/year/2010"), nv("2009~2000", "/year/2009~2000")];
const year14 = [nv("全部", ""), nv("2024", "/year/2024"), nv("2023", "/year/2023"), nv("2022", "/year/2022"), nv("2021", "/year/2021"), nv("2020", "/year/2020"), nv("2019", "/year/2019"), nv("2018", "/year/2018"), nv("2017", "/year/2017"), nv("2016", "/year/2016"), nv("2015", "/year/2015"), nv("2014", "/year/2014"), nv("2013", "/year/2013"), nv("2012", "/year/2012"), nv("2011", "/year/2011"), nv("2010", "/year/2010")];
const year6 = [nv("全部", ""), nv("2024", "/year/2024"), nv("2023", "/year/2023"), nv("2022", "/year/2022"), nv("2021", "/year/2021"), nv("2020", "/year/2020")];
const lang6 = [nv("全部", ""), nv("国语", "/lang/国语"), nv("英语", "/lang/英语"), nv("粤语", "/lang/粤语"), nv("韩语", "/lang/韩语"), nv("日语", "/lang/日语"), nv("其他", "/lang/其他")];
const lang7 = [nv("全部", ""), nv("普通话", "/lang/普通话"), nv("英语", "/lang/英语"), nv("粤语", "/lang/粤语"), nv("韩语", "/lang/韩语"), nv("日语", "/lang/日语"), nv("泰语", "/lang/泰语"), nv("其他", "/lang/其他")];
const lang4 = [nv("全部", ""), nv("国语", "/lang/国语"), nv("英语", "/lang/英语"), nv("日语", "/lang/日语"), nv("其他", "/lang/其他")];
const byMovie = [nv("上映时间", "/sortType/1/sortOrder/0"), nv("人气高低", "/sortType/3/sortOrder/0"), nv("评分高低", "/sortType/4/sortOrder/0")];
const byFull = [nv("最近更新", "/sortType/1/sortOrder/0"), nv("添加时间", "/sortType/2/sortOrder/0"), nv("人气高低", "/sortType/3/sortOrder/0"), nv("评分高低", "/sortType/4/sortOrder/0")];

const myFilters = {
    "1": [
        { key: "type", name: "类型", value: [nv("全部", ""), nv("喜剧", "/type/22"), nv("动作", "/type/23"), nv("科幻", "/type/30"), nv("爱情", "/type/26"), nv("悬疑", "/type/27"), nv("奇幻", "/type/87"), nv("剧情", "/type/37"), nv("恐怖", "/type/36"), nv("犯罪", "/type/35"), nv("动画", "/type/33"), nv("惊悚", "/type/34"), nv("战争", "/type/25"), nv("冒险", "/type/31"), nv("灾难", "/type/81"), nv("伦理", "/type/83"), nv("其他", "/type/43")] },
        { key: "area", name: "地区", value: areaAll },
        { key: "year", name: "年份", value: yearFull },
        { key: "lang", name: "语言", value: lang6 },
        { key: "by", name: "排序", value: byMovie }
    ],
    "2": [
        { key: "type", name: "类型", value: [nv("全部", ""), nv("国产剧", "/type/14"), nv("欧美剧", "/type/15"), nv("港台剧", "/type/16"), nv("日韩剧", "/type/62"), nv("其他剧", "/type/68")] },
        { key: "class", name: "剧情", value: [nv("全部", ""), nv("古装", "/class/古装"), nv("战争", "/class/战争"), nv("喜剧", "/class/喜剧"), nv("家庭", "/class/家庭"), nv("犯罪", "/class/犯罪"), nv("动作", "/class/动作"), nv("奇幻", "/class/奇幻"), nv("剧情", "/class/剧情"), nv("历史", "/class/历史"), nv("短片", "/class/短片")] },
        { key: "area", name: "地区", value: areaNoIndia },
        { key: "year", name: "时间", value: year14 },
        { key: "lang", name: "语言", value: lang7 },
        { key: "by", name: "排序", value: byFull }
    ],
    "3": [
        { key: "type", name: "类型", value: [nv("全部", ""), nv("国产综艺", "/type/69"), nv("港台综艺", "/type/70"), nv("日韩综艺", "/type/72"), nv("欧美综艺", "/type/73")] },
        { key: "class", name: "剧情", value: [nv("全部", ""), nv("真人秀", "/class/真人秀"), nv("音乐", "/class/音乐"), nv("脱口秀", "/class/脱口秀")] },
        { key: "area", name: "地区", value: areaSimple },
        { key: "year", name: "时间", value: year6 },
        { key: "lang", name: "语言", value: lang6 },
        { key: "by", name: "排序", value: byFull }
    ],
    "4": [
        { key: "type", name: "类型", value: [nv("全部", ""), nv("国产动漫", "/type/75"), nv("日韩动漫", "/type/76"), nv("欧美动漫", "/type/77")] },
        { key: "class", name: "剧情", value: [nv("全部", ""), nv("喜剧", "/class/喜剧"), nv("科幻", "/class/科幻"), nv("热血", "/class/热血"), nv("冒险", "/class/冒险"), nv("动作", "/class/动作"), nv("运动", "/class/运动"), nv("战争", "/class/战争"), nv("儿童", "/class/儿童")] },
        { key: "area", name: "地区", value: areaAnime },
        { key: "year", name: "时间", value: year14 },
        { key: "lang", name: "语言", value: lang4 },
        { key: "by", name: "排序", value: byFull }
    ]
};

async function init(ext) {
    console.log("[爱电影] init");
}

async function home(filter) {
    return JSON.stringify({ class: classList, filters: myFilters, list: JSON.parse(await homeVod()).list });
}

async function homeVod() {
    const data = await getJson(HOST + "/api/mw-movie/anonymous/home/hotSearch", "");
    const list = (data && data.data) || [];
    return JSON.stringify({ list: list.map(mapVod) });
}

// 按转义引号跟踪字符串状态，平衡截取 list 数组
function extractList(html) {
    const mark = '\\"list\\":[';
    const start = html.indexOf(mark);
    if (start < 0) return null;
    const arrStart = start + mark.length - 1;
    let depth = 0, inStr = false;
    for (let i = arrStart; i < html.length; i++) {
        const ch = html[i];
        if (ch === '\\' && html[i + 1] === '"') { inStr = !inStr; i++; continue; }
        if (inStr) continue;
        if (ch === '[') depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0) {
                const raw = html.substring(arrStart, i + 1);
                // 整段按 JS 字符串转义解码（简介内含 \" 转义引号，直接替换会破坏结构）
                try { return JSON.parse(JSON.parse('"' + raw.replace(/\r?\n/g, '\\n') + '"')); } catch (e) {}
                try { return JSON.parse(raw.replace(/\\"/g, '"')); } catch (e) { return null; }
            }
        }
    }
    return null;
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1, 10) || 1;
    extend = extend || {};
    const path = (extend.type || "") + (extend["class"] || "") + (extend.area || "") + (extend.year || "") + (extend.lang || "") + (extend.by || "");
    const url = HOST + "/vod/show/id/" + tid + path + "/page/" + pg;
    let list = [];
    try {
        const res = await req(url, { method: "GET", headers: { "User-Agent": UA, "referer": HOST, "Accept-Encoding": "identity" }, timeout: 15000 });
        const html = res && res.code === 200 ? String(res.content || "") : "";
        list = extractList(html) || [];
    } catch (e) {}
    const vods = list.map(mapVod);
    return JSON.stringify({ list: vods, page: pg, pagecount: vods.length >= 20 ? pg + 1 : pg, limit: vods.length || 20, total: 0 });
}

async function search(key, quick, pg) {
    pg = parseInt(pg || 1, 10) || 1;
    const url = HOST + "/api/mw-movie/anonymous/video/searchByWord?keyword=" + encodeURIComponent(key) + "&pageNum=" + pg + "&pageSize=12";
    const data = await getJson(url, "keyword=" + key + "&pageNum=" + pg + "&pageSize=12");
    const list = (data && data.data && data.data.result && data.data.result.list) || [];
    const total = (data && data.data && data.data.result && parseInt(data.data.result.total || 0, 10)) || 0;
    return JSON.stringify({ list: list.map(mapVod), page: pg, pagecount: total > 0 ? Math.ceil(total / 12) : (list.length >= 12 ? pg + 1 : pg), limit: 12, total: total });
}

async function detail(id) {
    const vid = String(Array.isArray(id) ? id[0] : id);
    const data = await getJson(HOST + "/api/mw-movie/anonymous/video/detail?id=" + vid, "id=" + vid);
    const d = data && data.data;
    if (!d) return JSON.stringify({ list: [] });
    const eps = d.episodeList || [];
    const playUrl = eps.map(e => String(e.name || "") + "$" + vid + "/" + String(e.nid)).join("#");
    return JSON.stringify({
        list: [{
            vod_id: vid,
            type_name: String(d.typeName || ""),
            vod_name: String(d.vodName || ""),
            vod_pic: String(d.vodPic || ""),
            vod_remarks: String(d.vodRemarks || ""),
            vod_year: String(d.vodYear || ""),
            vod_area: String(d.vodArea || ""),
            vod_actor: String(d.vodActor || ""),
            vod_director: String(d.vodDirector || ""),
            vod_content: withPrefix(String(d.vodContent || "")),
            vod_play_from: "官方线路",
            vod_play_url: playUrl
        }]
    });
}

async function play(flag, id, flags) {
    const parts = String(id || "").split("/");
    let playUrl = ERROR_URL;
    if (parts.length === 2) {
        const data = await getJson(HOST + "/api/mw-movie/anonymous/v2/video/episode/url?id=" + parts[0] + "&nid=" + parts[1], "id=" + parts[0] + "&nid=" + parts[1]);
        const u = data && data.data && data.data.list && data.data.list[0] && data.data.list[0].url;
        if (u) playUrl = String(u);
    }
    return JSON.stringify({ parse: 0, url: playUrl, header: { "User-Agent": UA } });
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    search: search,
    detail: detail,
    play: play
};
