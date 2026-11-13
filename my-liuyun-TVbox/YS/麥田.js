// 麥田 TVBox 爬虫（ mtys.php/v6 - 琉芸JS 版）
// MacCMS 风格 app JSON 接口（mtys.php/v6），直连 IP，无签名。
// 播放源数据在详情的 vod_url_with_player：直链源直接播放。
// 注意：NB源（NBY-XMYAES 加密）经其 parse_api 解析后返回的 m3u8 分片为 44 字节 webp 占位图（假视频），
// 且链接秒级过期，TVBox 默认播第一条线路会黑屏空白，故详情中直接剔除该源。
const HOSTS = [
    "http://172.247.227.203:25321",
    "http://172.247.31.147:25321"
];
const API_PATH = "/mtys.php/v6";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

const classes = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "电视剧" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" },
    { type_id: "25", type_name: "少儿" },
    { type_id: "26", type_name: "短剧" },
    { type_id: "30", type_name: "直播" }
];

function buildFilters() {
    const years = [];
    for (let y = 2026; y >= 2000; y--) years.push(String(y));
    const base = {
        class: { key: "class", name: "类型", value: [{ v: "", n: "全部" },
            "国产剧", "港台剧", "欧美剧", "日韩剧", "海外剧", "喜剧片", "动作片", "爱情片",
            "科幻片", "恐怖片", "剧情片", "战争片", "纪录片", "动画片", "综艺", "短剧"
        ].map(v => typeof v === "string" ? { v: v, n: v } : v) },
        area: { key: "area", name: "地区", value: [{ v: "", n: "全部" }].concat(
            ["大陆", "香港", "台湾", "美国", "韩国", "日本", "英国", "法国", "泰国", "印度", "其他"]
            .map(v => ({ v: v, n: v }))) },
        lang: { key: "lang", name: "语言", value: [{ v: "", n: "全部" }].concat(
            ["国语", "粤语", "英语", "韩语", "日语", "泰语"].map(v => ({ v: v, n: v }))) },
        year: { key: "year", name: "年份", value: [{ v: "", n: "全部" }].concat(years.map(v => ({ v: v, n: v }))) }
    };
    const filters = {};
    for (const c of classes) filters[c.type_id] = [base.class, base.area, base.lang, base.year];
    return filters;
}
const filters = buildFilters();

function withPrefix(s) {
    s = (s || "").replace(/^[\s　]+|[\s　]+$/g, "");
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

function fixPic(pic) {
    if (!pic) return "";
    pic = String(pic).trim();
    if (pic.indexOf("//") === 0) return "http:" + pic;
    return pic;
}

// 全局 req 由 TVBox 提供；node 测试时注入 mock。多 host 容灾，返回解析后的 JSON。
async function getJson(pathAndQuery) {
    for (const host of HOSTS) {
        try {
            const res = await req(host + API_PATH + pathAndQuery, {
                headers: {
                    "User-Agent": UA,
                    "Accept": "application/json, text/plain, */*",
                    "Referer": host + "/"
                },
                timeout: 15000
            });
            const content = res ? (res.content || "") : "";
            if (!content) continue;
            const data = JSON.parse(content);
            if (data) return data;
        } catch (e) {
            console.error("请求失败[" + host + pathAndQuery + "]:", e.message);
        }
    }
    return null;
}

async function getRaw(url, headers) {
    try {
        const res = await req(url, {
            headers: headers || { "User-Agent": UA, "Accept": "*/*" },
            timeout: 15000
        });
        return res ? (res.content || "") : "";
    } catch (e) {
        console.error("请求失败[" + url + "]:", e.message);
        return "";
    }
}

function toVideoItem(v) {
    return {
        vod_id: String(v.vod_id),
        vod_name: v.vod_name || "",
        vod_pic: fixPic(v.vod_pic),
        vod_remarks: v.vod_remarks || ""
    };
}

// ===================== TVBox 接口 =====================
async function init(ext) {
    console.log("初始化爬虫: 麥田");
}

// 规则首页固定为「动漫」
async function home(filter) {
    let list = [];
    try {
        const data = await getJson("/video?pg=1&tid=4&class=&area=&lang=&year=&order=");
        if (data && data.data) list = data.data.map(toVideoItem);
    } catch (e) {
        console.error("首页失败:", e.message);
    }
    return JSON.stringify({ class: classes, filters: filters, list: list });
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1);
    if (!pg || pg < 1) pg = 1;
    try {
        extend = extend || {};
        const q = "?pg=" + pg +
            "&tid=" + encodeURIComponent(tid) +
            "&class=" + encodeURIComponent(extend.class || "") +
            "&area=" + encodeURIComponent(extend.area || "") +
            "&lang=" + encodeURIComponent(extend.lang || "") +
            "&year=" + encodeURIComponent(extend.year || "") +
            "&order=" + encodeURIComponent(extend.order || "");
        const data = await getJson("/video" + q);
        const list = data && data.data ? data.data.map(toVideoItem) : [];
        const limit = parseInt(data && data.limit) || 20;
        const total = parseInt(data && data.total) || 0;
        const pagecount = parseInt(data && data.pagecount) || (total ? Math.ceil(total / limit) : 1);
        return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: limit, total: total });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 20, total: 0 });
    }
}

async function search(wd, quick, page) {
    page = parseInt(page || 1) || 1;
    const keyword = String(wd || "").trim();
    if (!keyword) return JSON.stringify({ page: page, pagecount: 1, limit: 20, total: 0, list: [] });
    try {
        const data = await getJson("/search?pg=" + page + "&tid=0&text=" + encodeURIComponent(keyword));
        const list = data && data.data ? data.data.map(toVideoItem) : [];
        const limit = parseInt(data && data.limit) || 20;
        const total = parseInt(data && data.total) || 0;
        const pagecount = total ? Math.ceil(total / limit) : (list.length ? page : 1);
        return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: limit, total: total });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 20, total: 0 });
    }
}

function buildPlayerHeaders(player) {
    const header = { "User-Agent": player.user_agent || UA };
    if (player.headers) {
        if (typeof player.headers === "object") {
            for (const k in player.headers) header[k] = String(player.headers[k]);
        } else {
            try {
                const obj = JSON.parse(player.headers);
                if (obj && typeof obj === "object") for (const k in obj) header[k] = String(obj[k]);
            } catch (e) {}
        }
    }
    return header;
}

// NBY-XMYAES 加密源为假视频源（解析后分片是 webp 占位图），剔除
function isDecoySource(p) {
    return /NBY-XMYAES/i.test(String(p.url || ""));
}

// 播放器对 URL 中的非 ASCII 字符（如中文集名）兼容性差，统一百分号编码
function encodeNonAscii(url) {
    try {
        return String(url).replace(/[^\x00-\x7F]/g, function (ch) { return encodeURIComponent(ch); });
    } catch (e) { return url; }
}

async function detail(id) {
    try {
        const vodId = String(id);
        const data = await getJson("/video_detail?id=" + encodeURIComponent(vodId));
        const vod = data && data.data && data.data.vod_info;
        if (!vod) return JSON.stringify({ list: [] });

        const players = Array.isArray(vod.vod_url_with_player) ? vod.vod_url_with_player : [];
        const fromList = [];
        const urlList = [];
        for (const p of players) {
            if (isDecoySource(p)) continue;
            const raw = String(p.url || "");
            if (!raw) continue;
            const episodes = raw.split("#");
            const out = [];
            for (let i = 0; i < episodes.length; i++) {
                const seg = episodes[i];
                const di = seg.indexOf("$");
                const epName = di >= 0 ? seg.substring(0, di) : ("第" + (i + 1) + "集");
                out.push(epName + "$" + vodId + "-" + p.code + "-" + (i + 1));
            }
            if (!out.length) continue;
            fromList.push(p.name || p.code || ("线路" + (fromList.length + 1)));
            urlList.push(out.join("#"));
        }

        return JSON.stringify({
            list: [{
                vod_id: vodId,
                vod_name: vod.vod_name || "未知",
                vod_pic: fixPic(vod.vod_pic),
                type_name: vod.vod_class || "",
                vod_year: vod.vod_year || "",
                vod_area: vod.vod_area || "",
                vod_lang: vod.vod_lang || "",
                vod_actor: vod.vod_actor || "",
                vod_director: vod.vod_director || "",
                vod_remarks: vod.vod_remarks || "",
                vod_content: withPrefix(vod.vod_content || vod.vod_blurb || ""),
                vod_play_from: fromList.join("$$$"),
                vod_play_url: urlList.join("$$$")
            }]
        });
    } catch (e) {
        console.error("详情失败:", e.message);
        return JSON.stringify({ list: [] });
    }
}

const MEDIA_RE = /\.(m3u8|mp4|flv|avi|mov|rmvb|ts|mkv)([?#&]|$)/i;

// 取某源某集的原始播放地址（重拉详情定位）
async function getEpisode(vodId, code, index) {
    const data = await getJson("/video_detail?id=" + encodeURIComponent(vodId));
    const vod = data && data.data && data.data.vod_info;
    if (!vod || !Array.isArray(vod.vod_url_with_player)) return null;
    for (const p of vod.vod_url_with_player) {
        if (p.code !== code) continue;
        const episodes = String(p.url || "").split("#");
        const seg = episodes[index - 1];
        if (!seg) return null;
        const di = seg.indexOf("$");
        const rawUrl = di >= 0 ? seg.substring(di + 1) : seg;
        return { player: p, rawUrl: rawUrl };
    }
    return null;
}

async function play(flag, id, vipFlags) {
    try {
        const parts = String(id || "").split("-");
        if (parts.length < 3) return JSON.stringify({ parse: 0, playUrl: "", url: "" });
        const vodId = parts[0], code = parts[1], index = parseInt(parts[2]);
        const ep = await getEpisode(vodId, code, index);
        if (!ep || !ep.rawUrl) return JSON.stringify({ parse: 0, playUrl: "", url: "" });
        const rawUrl = ep.rawUrl;
        const player = ep.player;
        const header = buildPlayerHeaders(player);

        // 直链直接播放
        if (/^https?:\/\//i.test(rawUrl) && MEDIA_RE.test(rawUrl)) {
            return JSON.stringify({ parse: 0, playUrl: "", url: encodeNonAscii(rawUrl), header: header });
        }

        // 加密/中转地址：调用该源自带的 parse_api 换取直链
        if (player.parse_api) {
            const jxUrl = player.parse_api + encodeURIComponent(rawUrl);
            const body = await getRaw(jxUrl);
            if (body) {
                let finalUrl = "";
                try {
                    const obj = JSON.parse(body);
                    if (obj) finalUrl = obj.url || obj.playUrl || obj.play_url || obj.data || "";
                    if (typeof finalUrl === "object") finalUrl = finalUrl.url || "";
                } catch (e) {
                    const t = body.trim();
                    if (/^https?:\/\//i.test(t)) finalUrl = t.split(/[\r\n]/)[0].trim();
                }
                if (finalUrl && MEDIA_RE.test(finalUrl)) {
                    return JSON.stringify({ parse: 0, playUrl: "", url: encodeNonAscii(finalUrl), header: header });
                }
            }
        }

        // 网页地址交给 TVBox 内置嗅探兜底
        if (/^https?:\/\//i.test(rawUrl)) {
            return JSON.stringify({ parse: 1, playUrl: "", url: rawUrl, header: header });
        }
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
