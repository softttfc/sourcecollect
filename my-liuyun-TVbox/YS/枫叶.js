// ================== 枫叶影院 / 枫叶4K 合并版 · TVBox QuickJS ==================
// 站点池：zzztool.com（主）→ cadkssb.com（备）→ cd-zj.com（旧），自动探测可用域名
// 数据源：/index.php/ajax/data JSON 接口（可绕过图形验证码墙，全库 4.6万+ 条）
// 分类：电影/电视剧/综艺/动漫/热门短剧（type_id 1~5；类型筛选走子类 tid，服务端生效）
// 说明：地区/年份/语言/字母/排序 服务端 ajax 接口不识别，改为客户端在同页扫描结果内过滤
// 搜索：站点原生搜索/联想均被验证码墙拦截，改为最新片库索引扫描（预算 15s + 30 分钟缓存）
// 播放：player_aaaa 解密优先返回 m3u8 直链 parse:0；令牌线路走 YYNB/JD4K 解析链；失败回退 parse:1
// ==========================================================================

const PUBLISH_URL = "https://www.vip1949.com/";
const DEFAULT_SITES = ["https://www.zzztool.com", "https://www.cadkssb.com", "https://www.cd-zj.com"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CACHE_MS = 300000;
const SEARCH_BUDGET_MS = 12000;
const FILTER_BUDGET_MS = 7000;
const FILTER_MAX_PAGES = 12;
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

// 二次解析服务：线路前缀 -> 解析站域名
const parseMap = {
    YYNB: "https://zzrs.mfdyvip.com",
    JD4K: "https://fgsrg.hzqingshan.com"
};

// 直链线路优先（自营为 m3u8 直链），令牌线路垫底
const LINE_FIRST = ["自营"];

let baseUrl = DEFAULT_SITES[0];
let cacheHost = "", cacheTime = 0;
let searchIndex = null, searchIndexTime = 0;

function withPrefix(s) {
    s = String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

function stripTags(s) {
    return String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;nbsp;/gi, " ")
        .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

// 站点会在简介前塞入 SEO 模板文案，统一剔除后再加固定前缀
function cleanContent(s) {
    let t = stripTags(s);
    t = t.replace(/^\s*(简介|劇情|剧情)[:：]\s*/, "");
    t = t.replace(/^【[^】]*】[\s\S]*?。/, "");       // 例：【4K超清】《X》…信息已整理…。
    t = t.replace(/^【[^】]*】[\s\S]*?演员信息[。.]?/, "");
    return t.replace(/\s+/g, " ").trim();
}

// 站点偶尔返回 unicode 转义版页面（防采集变体），需要先还原
function unescText(s) {
    s = String(s || "");
    if (s.indexOf("\\u") < 0) return s;
    try { return JSON.parse('"' + s.replace(/"/g, '\\"') + '"'); } catch (e) { return s; }
}

function waitShort(ms) {
    const t = Date.now();
    while (Date.now() - t < ms) {}
}

function fixPic(u) {
    u = String(u || "").replace(/&amp;/g, "&").trim();
    if (!u || u.indexOf("null.jpg") >= 0) return "";
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) === "/") return baseUrl + u;
    return u;
}

function esc(s) {
    return String(s || "").replace(/#/g, "%23").replace(/\$/g, "%24");
}

// QuickJS 老版本无 matchAll，用全局 exec 循环替代
function matchAllStr(str, re) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(str)) !== null) {
        out.push(m);
        if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
}

function isZzz() {
    return baseUrl.indexOf("zzztool") >= 0 || baseUrl.indexOf("cadkssb") >= 0;
}

function headers(referer) {
    const h = {
        "User-Agent": UA,
        "Accept": "text/html,application/json,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Accept-Encoding": "identity"
    };
    h.Referer = referer === undefined || referer === null ? baseUrl + "/" : referer;
    return h;
}

async function fetchText(url, referer, timeout) {
    for (let k = 0; k < 3; k++) {
        try {
            const r = await req(url, { method: "GET", headers: headers(referer), timeout: timeout || 12000 });
            let c = (r && r.content) || "";
            if (!c) continue;
            // 站点/CDN 偶把整页 HTML 包成 JSON 字符串（如 "\"<!DOCTYPE html>..."），需先解包
            c = String(c).trim();
            if (c.charAt(0) === '"') {
                try {
                    const un = JSON.parse(c);
                    if (typeof un === "string" && un.length > 200) c = un;
                } catch (e) {}
            }
            if (r.code === 200 && c.indexOf("系统安全验证") < 0) return c;
        } catch (e) {}
    }
    return "";
}

async function fetchJson(url, referer, timeout) {
    const t = await fetchText(url, referer, timeout);
    if (!t) return null;
    try { return JSON.parse(t); } catch (e) { return null; }
}

// ---------- 域名自愈 ----------
async function pingHost(host) {
    const u = host + "/index.php/ajax/data?mid=1&tid=0&page=1&limit=20";
    const j = await fetchJson(u, host + "/", 6000);
    return !!(j && j.code === 1 && j.list && j.list.length);
}

async function getOnlineHost() {
    // 1) 默认域名池（最快，逐个大JSON探测）
    for (const s of DEFAULT_SITES) {
        if (await pingHost(s)) return s;
    }
    // 2) 默认池全挂时，从发布页取最新域名再试
    let sites = [];
    try {
        const html = await fetchText(PUBLISH_URL, "", 8000);
        const m = html.match(/const\s+domains\s*=\s*([\s\S]*?]);/);
        if (m) {
            const js = m[1].replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
            try {
                const arr = JSON.parse(js);
                for (const it of arr) {
                    const u = String(it.url || "").replace(/\/$/, "");
                    if (u && sites.indexOf(u) < 0) sites.push(u);
                }
            } catch (e) {}
        }
    } catch (e) {}
    for (const s of sites) {
        if (await pingHost(s)) return s;
    }
    return DEFAULT_SITES[0];
}

async function ensureHost() {
    const now = Date.now();
    if (cacheHost && now - cacheTime < CACHE_MS) { baseUrl = cacheHost; return; }
    const host = await getOnlineHost();
    if (host) { baseUrl = host; cacheHost = host; cacheTime = now; }
}

// ---------- 分类与筛选 ----------
const classList = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "电视剧" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" },
    { type_id: "5", type_name: "热门短剧" },
    { type_id: "qq", type_name: "腾讯VIP精选" },
    { type_id: "bli", type_name: "B站VIP精选" },
    { type_id: "youku", type_name: "优酷VIP精选" }
];

// VIP 精选标签页（HTML 分页，24 条/页，不受验证码墙影响）
const LABELS = { qq: "腾讯VIP精选", bli: "B站VIP精选", youku: "优酷VIP精选" };

function buildFilters() {
    const area = [{ n: "全部", v: "" }, { n: "大陆", v: "大陆" }, { n: "香港", v: "香港" }, { n: "台湾", v: "台湾" }, { n: "美国", v: "美国" }, { n: "韩国", v: "韩国" }, { n: "日本", v: "日本" }, { n: "泰国", v: "泰国" }, { n: "新加坡", v: "新加坡" }, { n: "马来西亚", v: "马来西亚" }, { n: "印度", v: "印度" }, { n: "英国", v: "英国" }, { n: "法国", v: "法国" }, { n: "加拿大", v: "加拿大" }, { n: "西班牙", v: "西班牙" }, { n: "俄罗斯", v: "俄罗斯" }, { n: "其它", v: "其它" }];
    const cur = new Date().getFullYear();
    const years = [{ n: "全部", v: "" }];
    for (let y = cur; y > cur - 24; y--) years.push({ n: String(y), v: String(y) });
    const lang = [{ n: "全部", v: "" }, { n: "国语", v: "国语" }, { n: "英语", v: "英语" }, { n: "粤语", v: "粤语" }, { n: "闽南语", v: "闽南语" }, { n: "韩语", v: "韩语" }, { n: "日语", v: "日语" }, { n: "法语", v: "法语" }, { n: "德语", v: "德语" }, { n: "其它", v: "其它" }];
    const sort = [{ n: "时间", v: "" }, { n: "人气", v: "hits" }, { n: "评分", v: "score" }];
    const letter = [{ n: "全部", v: "" }];
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") letter.push({ n: c, v: c });
    letter.push({ n: "0-9", v: "0-9" });
    return {
        "1": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "1" }, { n: "动作片", v: "6" }, { n: "喜剧片", v: "7" }, { n: "恐怖片", v: "8" }, { n: "科幻片", v: "9" }, { n: "爱情片", v: "10" }, { n: "剧情片", v: "11" }, { n: "战争片", v: "12" }, { n: "纪录片", v: "20" }] },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "2": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "2" }, { n: "国产剧", v: "13" }, { n: "日韩剧", v: "15" }, { n: "海外剧", v: "16" }] },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "3": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "3" }, { n: "大陆综艺", v: "21" }, { n: "日韩综艺", v: "22" }] },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "4": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "4" }, { n: "国产动漫", v: "25" }, { n: "日韩动漫", v: "26" }] },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ],
        "5": [
            { key: "class", name: "类型", value: [{ n: "全部", v: "5" }] },
            { key: "area", name: "地区", value: area },
            { key: "year", name: "年份", value: years },
            { key: "lang", name: "语言", value: lang },
            { key: "letter", name: "字母", value: letter },
            { key: "sort", name: "排序", value: sort }
        ]
    };
}

// ---------- 列表数据 ----------
function listApi(tid, pg, limit) {
    return baseUrl + "/index.php/ajax/data?mid=1&tid=" + encodeURIComponent(tid) + "&page=" + pg + "&limit=" + (limit || 20);
}

function mapItem(it) {
    const remarks = String(it.vod_remarks || "").trim();
    return {
        vod_id: String(it.vod_id),
        vod_name: stripTags(it.vod_name),
        vod_pic: fixPic(it.vod_pic || ""),
        vod_remarks: remarks,
        vod_year: String(it.vod_year || ""),
        vod_area: String(it.vod_area || ""),
        vod_lang: String(it.vod_lang || ""),
        vod_letter: String(it.vod_letter || ""),
        vod_score: Number(it.vod_score) || 0,
        vod_hits: Number(it.vod_hits) || 0
    };
}

function parseAjaxList(data) {
    const list = [], seen = {};
    const arr = (data && data.list) || [];
    for (const it of arr) {
        if (!it || !it.vod_id) continue;
        const v = mapItem(it);
        if (seen[v.vod_id]) continue;
        seen[v.vod_id] = true;
        list.push(v);
    }
    return list;
}

function parseExt(extend) {
    let ext = extend;
    if (typeof ext === "string" && ext.trim()) {
        try { ext = JSON.parse(ext); } catch (e) { ext = {}; }
    }
    if (!ext || typeof ext !== "object") ext = {};
    const args = {};
    for (const k in ext) if (ext[k]) args[k] = String(ext[k]);
    return args;
}

function matchFilter(v, args) {
    if (args.area && v.vod_area.indexOf(args.area) < 0) return false;
    if (args.year && v.vod_year.indexOf(args.year) < 0) return false;
    if (args.lang && v.vod_lang.indexOf(args.lang) < 0) return false;
    if (args.letter) {
        if (args.letter === "0-9") { if (!/^[0-9]/.test(v.vod_name)) return false; }
        else if (v.vod_letter && v.vod_letter.toUpperCase() !== args.letter) return false;
        else if (!v.vod_letter && v.vod_name.slice(0, 1).toUpperCase() !== args.letter) return false;
    }
    return true;
}

function sortList(list, sortKey) {
    if (sortKey === "score") list.sort((a, b) => (Number(b.vod_score) || 0) - (Number(a.vod_score) || 0));
    else if (sortKey === "hits") list.sort((a, b) => (Number(b.vod_hits) || 0) - (Number(a.vod_hits) || 0));
    return list;
}

async function init(ext) {
    let e = ext;
    if (typeof e === "string" && e.trim()) {
        try { e = JSON.parse(e); } catch (e2) { e = {}; }
    }
    if (e && typeof e === "object") {
        if (e.host) {
            baseUrl = String(e.host).replace(/\/$/, "");
            DEFAULT_SITES.unshift(baseUrl);
            cacheHost = ""; cacheTime = 0;      // 指定域名时强制重新探测
        }
        if (e.publish_url) PUBLISH_URL = e.publish_url;
        if (e.parse_map && typeof e.parse_map === "object") {
            for (const k in e.parse_map) parseMap[k] = e.parse_map[k];
        }
    }
    await ensureHost();
}

// ---------- 接口：首页 / 分类 ----------
async function home(filter) {
    await ensureHost();
    return JSON.stringify({
        class: classList,
        filters: buildFilters()
    });
}

async function homeVod() {
    await ensureHost();
    const data = await fetchJson(listApi(0, 1, 20));
    return JSON.stringify({ list: parseAjaxList(data) });
}

// VIP 精选标签页卡片解析（24 条/页，兼容两套模板）
function parseLabelCards(html) {
    const list = [], seen = {};
    if (html.indexOf('class="public-list-box') >= 0) {
        // 枫叶(cupfox)模板
        const blocks = html.split('<div class="public-list-box');
        for (let i = 1; i < blocks.length; i++) {
            const b = blocks[i];
            const m = b.match(/href="\/detail\/(\d+)\.html"[^>]*title="([^"]*)"/);
            if (!m) continue;
            const vid = m[1];
            if (seen[vid]) continue;
            seen[vid] = true;
            const pic = (b.match(/<img[^>]*(?:data-src|src)="([^"]+)"/) || [])[1] || "";
            const rm = b.match(/public-list-prb[^>]*>[\s\S]{0,80}?<i[^>]*>([^<]*)</);
            list.push({ vod_id: vid, vod_name: stripTags(m[2]), vod_pic: fixPic(pic), vod_remarks: rm ? stripTags(rm[1]) : "" });
        }
        return list;
    }
    // zzztool 模板
    const zblocks = html.split('<div class="module-card-item module-item">');
    for (let i = 1; i < zblocks.length; i++) {
        const b = zblocks[i];
        const m = b.match(/href="\/detail\/(\d+)\.html"/);
        if (!m) continue;
        const vid = m[1];
        if (seen[vid]) continue;
        seen[vid] = true;
        const nm = (b.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || (b.match(/alt="([^"]*)"/) || [])[1] || "";
        const pic = (b.match(/data-src="([^"]+)"/) || [])[1] || "";
        const rm = b.match(/module-item-note">([^<]*)</);
        list.push({ vod_id: vid, vod_name: stripTags(nm), vod_pic: fixPic(pic), vod_remarks: rm ? stripTags(rm[1]) : "" });
    }
    return list;
}

async function categoryLabel(slug, page) {
    const html = await fetchText(baseUrl + "/label/" + slug + "/page/" + page + ".html", null, 12000);
    if (!html) return JSON.stringify({ list: [], page: page, pagecount: page, limit: 24, total: 0 });
    const list = parseLabelCards(html);
    let pc = page;
    const pm = html.match(/当前\s*\d+\s*\/\s*(\d+)\s*页/);
    if (pm) pc = parseInt(pm[1], 10) || page;
    else {
        const nums = [], re = /\/label\/[a-z]+\/page\/(\d+)\.html/g;
        let mm;
        while ((mm = re.exec(html)) !== null) nums.push(parseInt(mm[1], 10));
        if (nums.length) pc = Math.max.apply(null, nums);
    }
    return JSON.stringify({ list: list, page: page, pagecount: pc, limit: 24, total: 0 });
}

async function category(tid, pg, filter, extend) {
    await ensureHost();
    const page = parseInt(pg, 10) || 1;
    const sid = String(tid || "").replace(/^\/label\//, "");
    if (LABELS[sid]) return await categoryLabel(sid, page);
    const args = parseExt(extend);
    const useTid = args.class || String(tid || "1").replace(/^\/label\/?/, "") || "1";
    const needLocal = !!(args.area || args.year || args.lang || args.letter || args.sort);

    // 无地区/年份等筛选：服务端分页直取
    if (!needLocal) {
        const data = await fetchJson(listApi(useTid, page, 20));
        const list = parseAjaxList(data);
        const pc = parseInt((data && data.pagecount) || 0, 10) || page;
        return JSON.stringify({ list: list, page: page, pagecount: list.length ? pc : 0, limit: 20, total: parseInt((data && data.total) || 0, 10) || 0 });
    }

    // 有本地筛选项：连续扫描多页（服务端不识别这些参数）
    const out = [], seen = {};
    const deadline = Date.now() + FILTER_BUDGET_MS;
    for (let i = 0; i < FILTER_MAX_PAGES; i++) {
        if (Date.now() > deadline) break;
        const data = await fetchJson(listApi(useTid, page + i, 20), null, 8000);
        const items = parseAjaxList(data);
        if (!items.length) break;
        let hit = 0;
        for (const v of items) {
            if (!matchFilter(v, args) || seen[v.vod_id]) continue;
            seen[v.vod_id] = true;
            out.push(v);
            hit++;
        }
        if (out.length >= 60) break;
    }
    if (args.sort) sortList(out, args.sort);
    return JSON.stringify({ list: out, page: 1, pagecount: out.length ? 2 : 0, limit: out.length, total: out.length });
}

// ---------- 接口：详情 ----------
function lineRank(name) {
    for (let i = 0; i < LINE_FIRST.length; i++) if (name.indexOf(LINE_FIRST[i]) >= 0) return i;
    if (name.indexOf("自营") >= 0) return 1;
    return 10;
}

function parseZzzDetail(html, vid) {
    let name = "", pic = "", director = "", actor = "", content = "";
    let m = html.match(/<h1[^>]*>([^<]+)</);
    if (m) name = stripTags(m[1]);
    if (!name) {
        const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
        const bm = t.match(/《([^》]+)》/);
        name = bm ? bm[1] : t;
    }
    m = html.match(/class="module-item-pic[^>]*>[\s\S]{0,200}?<img[^>]*(?:data-src|src)="([^"]+)"/);
    if (m) pic = fixPic(m[1]);
    const blocks = html.match(/<div class="module-info-item[\s\S]{0,400}?<\/div>\s*<\/div>/g) || [];
    for (const b of blocks) {
        const tm = b.match(/class="module-info-item-title"[^>]*>([^<]+)</);
        const cm = b.match(/class="module-info-item-content"[^>]*>([\s\S]*?)<\/div>/);
        if (!tm || !cm) continue;
        const tt = stripTags(tm[1]);
        const cc = stripTags(cm[1]);
        if (tt.indexOf("导演") >= 0) director = cc;
        else if (tt.indexOf("主演") >= 0) actor = cc;
    }
    const cm2 = html.match(/class="module-info-introduction-content[^>]*>([\s\S]*?)<\/div>/);
    if (cm2) content = cleanContent(cm2[1]);

    const from = [];
    const counts = {};
    const tabs = matchAllStr(html, /class="mx-anthology-tab-label"[^>]*>([^<]*)</g);
    for (const t of tabs) {
        let raw = stripTags(t[1]).replace(/[（(]\d+[）)]$/, "").replace(/\d+$/, "").trim();
        if (!raw) continue;
        counts[raw] = (counts[raw] || 0) + 1;
        from.push(counts[raw] > 1 ? raw + "-" + counts[raw] : raw);
    }
    const urls = [];
    const panels = html.split(/class="mx-anthology-panel[" ]/).slice(1);
    for (const p of panels) {
        const eps = [];
        const am = matchAllStr(p, /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g);
        for (const a of am) {
            const href = a[1];
            if (href.indexOf("/play/") < 0) continue;
            const title = stripTags(a[2]) || ("第" + (eps.length + 1) + "集");
            eps.push({ name: title, url: href });
        }
        if (eps.length) urls.push(eps);
    }
    return { name: name, pic: pic, director: director, actor: actor, content: content, from: from, urls: urls };
}

function parseFyDetail(html, vid) {
    let name = "", pic = "", director = "", actor = "", content = "";
    const t = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    const bm = t.match(/《([^》]+)》/);
    if (bm) name = bm[1].trim();
    if (!name) {
        const h = html.match(/class="slide-info-title[^"]*"[^>]*>([^<]+)</);
        if (h) name = stripTags(h[1]);
    }
    if (!name) name = (t.split("_")[0] || "").trim();
    pic = fixPic((html.match(/og:image" content="([^"]+)"/) || [])[1] || "");
    if (!pic) {
        const pm = html.match(/<img[^>]*(?:data-src|src)="((?:https?:)?\/\/[^"]+)"/);
        if (pm && pm[1].indexOf("null.jpg") < 0) pic = fixPic(pm[1]);
    }
    const infos = {};
    const infoRe = /<div class="slide-info hide"><strong class="r6">([^<]+)<\/strong>([\s\S]*?)<\/div>/g;
    let im;
    while ((im = infoRe.exec(html)) !== null) infos[stripTags(im[1]).replace(/[：:\s]/g, "")] = stripTags(im[2]);
    director = infos["导演"] || "";
    actor = infos["主演"] || "";
    const dm = html.match(/og:description" content="([^"]+)"/) || html.match(/id="height_limit"[^>]*>([\s\S]*?)<\/div>/);
    if (dm) content = cleanContent(dm[1]);

    const from = [];
    const lnRe = /<i class="fa ds-dianying"><\/i>([^<]{1,24})/g;
    let lm;
    while ((lm = lnRe.exec(html)) !== null) {
        const nm = stripTags(lm[1]);
        if (nm) from.push(nm);
    }
    const urls = [];
    const ulRe = /anthology-list-play size[^>]*>([\s\S]*?)<\/ul>/g;
    let um;
    while ((um = ulRe.exec(html)) !== null) {
        const eps = [];
        const epRe = /href="(\/play\/[^"]+)"[^>]*>([^<]*)</g;
        let em;
        while ((em = epRe.exec(um[1])) !== null) {
            eps.push({ name: stripTags(em[2]) || ("第" + (eps.length + 1) + "集"), url: em[1] });
        }
        if (eps.length) urls.push(eps);
    }
    return { name: name, pic: pic, director: director, actor: actor, content: content, from: from, urls: urls };
}

async function detail(id) {
    await ensureHost();
    const vid = String(Array.isArray(id) ? id[0] : id).split(",")[0].trim();
    const url = baseUrl + "/detail/" + vid + ".html";
    let html = await fetchText(url, null, 15000);
    if (!html) return JSON.stringify({ list: [] });

    const parseDetail = h => (isZzz() ? parseZzzDetail(h, vid) : parseFyDetail(h, vid));
    let d = parseDetail(html);
    // 站点偶发返回精简/转义变体，缺线路时短暂间隔重试两次
    for (let k = 0; k < 2 && (!d.name || !d.urls.length); k++) {
        waitShort(600);
        const h2 = await fetchText(url, null, 15000);
        if (h2) d = parseDetail(h2);
    }
    d.name = unescText(d.name);
    d.content = unescText(d.content);

    const lines = [];
    for (let i = 0; i < d.urls.length; i++) {
        lines.push({ name: d.from[i] || ("线路" + (i + 1)), eps: d.urls[i] });
    }
    lines.sort((a, b) => lineRank(a.name) - lineRank(b.name));
    // 同名线路去重后缀，避免壳内线路并列混淆
    const names = {};
    for (const l of lines) {
        if (names[l.name]) { names[l.name]++; l.name = l.name + "-" + names[l.name]; }
        else names[l.name] = 1;
    }

    return JSON.stringify({
        list: [{
            vod_id: vid,
            vod_name: d.name,
            vod_pic: d.pic,
            vod_director: d.director,
            vod_actor: d.actor,
            vod_content: withPrefix(d.content),
            vod_play_from: lines.map(l => l.name).join("$$$"),
            vod_play_url: lines.map(l => l.eps.map(e => esc(e.name) + "$" + esc(e.url)).join("#")).join("$$$")
        }]
    });
}

// ---------- 接口：搜索（片库最新索引扫描） ----------
async function buildSearchIndex() {
    const now = Date.now();
    if (searchIndex && now - searchIndexTime < 1800000) return searchIndex;
    const idx = [], seen = {};
    const deadline = now + SEARCH_BUDGET_MS;
    for (let pg = 1; pg <= 60; pg++) {
        if (Date.now() > deadline) break;
        const data = await fetchJson(listApi(0, pg, 20), null, 8000);
        const items = parseAjaxList(data);
        if (!items.length) break;
        for (const v of items) {
            if (!seen[v.vod_id]) { seen[v.vod_id] = true; idx.push(v); }
        }
    }
    searchIndex = idx;
    searchIndexTime = Date.now();
    return idx;
}

async function search(wd, quick, pg) {
    await ensureHost();
    const kw = String(wd || "").trim();
    if (!kw) return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 10, total: 0 });
    const idx = await buildSearchIndex();
    const low = kw.toLowerCase();
    const list = idx.filter(v => v.vod_name.toLowerCase().indexOf(low) >= 0);
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: list.length || 10, total: list.length });
}

// ---------- 接口：播放 ----------
function b64decode(str) {
    const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let out = "", i = 0;
    str = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
    while (i < str.length) {
        const e1 = C.indexOf(str[i++]), e2 = C.indexOf(str[i++]);
        const c3 = str[i++], c4 = str[i++];
        const e3 = c3 === "=" ? 64 : C.indexOf(c3), e4 = c4 === "=" ? 64 : C.indexOf(c4);
        const n = (e1 << 18) | (e2 << 12) | ((e3 & 63) << 6) | (e4 & 63);
        out += String.fromCharCode((n >> 16) & 255);
        if (e3 !== 64) out += String.fromCharCode((n >> 8) & 255);
        if (e4 !== 64) out += String.fromCharCode(n & 255);
    }
    return out;
}

function isDirect(u) {
    return /^https?:\/\/[^\s]*\.(m3u8|mp4|flv|mkv)/i.test(String(u || ""));
}

async function resolveVideoUrl(videoUrl, lineKey) {
    const chain = [];
    if (parseMap[lineKey]) chain.push(parseMap[lineKey]);
    if (parseMap.YYNB) chain.push(parseMap.YYNB);
    if (parseMap.JD4K) chain.push(parseMap.JD4K);
    for (const domain of chain) {
        try {
            const page = await fetchText(domain + "/player/?url=" + encodeURIComponent(videoUrl), baseUrl, 8000);
            if (!page) continue;
            const tm = page.match(/data-te="([^"]+)"/);
            const token = tm ? tm[1] : "";
            if (!token) continue;
            const postHeaders = headers(baseUrl);
            postHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
            const r = await req(domain + "/player/mplayer.php", {
                method: "POST",
                headers: postHeaders,
                data: { url: videoUrl, token: token },
                postType: "form",
                timeout: 10000
            });
            let finalUrl = "";
            try { finalUrl = (JSON.parse((r && r.content) || "{}").url) || ""; } catch (e) {}
            if (!finalUrl) continue;
            if (finalUrl.indexOf("/playproxy.php") === 0) finalUrl = domain + finalUrl;
            return finalUrl;
        } catch (e) {}
    }
    return "";
}

async function play(flag, id, flags) {
    const head = { "User-Agent": UA, "Referer": baseUrl + "/" };
    let raw = String(id || "");
    let path = raw.indexOf("$") >= 0 ? raw.split("$").pop() : raw;

    // 已是直链
    if (isDirect(path)) return JSON.stringify({ parse: 0, url: path, header: head });

    // 外部网页地址：交给解析链 / 内置嗅探
    if (/^http/.test(path)) {
        const lineKey = String(flag || "").split(/[-_]/)[0];
        const finalUrl = await resolveVideoUrl(path, lineKey);
        if (finalUrl) {
            let ref = "";
            const om = finalUrl.match(/^https?:\/\/[^\/]+/);
            if (om && (finalUrl.indexOf("playproxy") >= 0 || om[0].indexOf("mfdyvip") >= 0 || om[0].indexOf("hzqingshan") >= 0)) ref = om[0] + "/";
            const ph = { "User-Agent": UA };
            if (ref) ph.Referer = ref;
            return JSON.stringify({ parse: 0, url: finalUrl, header: ph });
        }
        return JSON.stringify({ parse: 1, url: path, header: head });
    }

    // 站内播放页
    let pageUrl;
    if (path.indexOf("/play/") === 0) pageUrl = baseUrl + path;
    else pageUrl = baseUrl + "/play/" + path + ".html";
    pageUrl = pageUrl.replace(/\.html\.html$/, ".html");
    const html = await fetchText(pageUrl, null, 12000);
    let videoUrl = "", lineKey = "";
    const m = html.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (m) {
        try {
            const j = JSON.parse(m[1]);
            videoUrl = String(j.url || "");
            lineKey = String(j.from || "");
            if (j.encrypt == 1) videoUrl = unescape(videoUrl);
            else if (j.encrypt == 2) videoUrl = unescape(b64decode(videoUrl));
        } catch (e) {}
    }
    if (!videoUrl) {
        const m2 = html.match(/"url"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/);
        if (m2) videoUrl = m2[1].replace(/\\\//g, "/").replace(/\\/g, "");
    }
    if (!videoUrl) {
        const m3 = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/);
        if (m3) videoUrl = m3[1];
    }
    if (!videoUrl) return JSON.stringify({ parse: 1, url: pageUrl, header: head });

    if (isDirect(videoUrl)) return JSON.stringify({ parse: 0, url: videoUrl, header: head });

    const finalUrl = await resolveVideoUrl(videoUrl, lineKey || String(flag || "").split(/[-_]/)[0]);
    if (finalUrl) {
        let ref = "";
        const om = finalUrl.match(/^https?:\/\/[^\/]+/);
        if (om && (finalUrl.indexOf("playproxy") >= 0 || om[0].indexOf("mfdyvip") >= 0 || om[0].indexOf("hzqingshan") >= 0)) ref = om[0] + "/";
        const ph = { "User-Agent": UA };
        if (ref) ph.Referer = ref;
        return JSON.stringify({ parse: 0, url: finalUrl, header: ph });
    }
    return JSON.stringify({ parse: 1, url: pageUrl, header: head });
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
