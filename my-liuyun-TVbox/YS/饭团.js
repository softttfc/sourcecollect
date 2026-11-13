// 饭团影院 TVBox 爬虫（ https://www.fantuantva.com 官方API - 琉芸JS 版）
// 站点入口 fantuantva.com 会 302 跳到镜像 www.bzpos.com（HTTP）。镜像池模板/ID 不一致，
// 因此 HOST 固定为已验证模板的 www.bzpos.com，避免解析抖动。
const HOST = "http://www.bzpos.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

function withPrefix(s) {
    s = (s || "").trim();
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

// 全局 req 由 TVBox 提供；node 测试时注入 mock
async function get(url, referer) {
    try {
        const res = await req(url, {
            headers: { "User-Agent": UA, "Referer": referer || HOST + "/" },
            timeout: 20000
        });
        return res ? (res.content || "") : "";
    } catch (e) {
        console.error("请求失败[" + url + "]:", e.message);
        return "";
    }
}

function stripTags(s) {
    return String(s || "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function absUrl(u) {
    if (!u) return "";
    if (/^https?:\/\//.test(u)) return u;
    if (u.charAt(0) === "/") return HOST + u;
    return HOST + "/" + u;
}

// ===================== 分类 =====================
const classes = [
    { type_id: "dianying", type_name: "电影" },
    { type_id: "lianxuju", type_name: "连续剧" },
    { type_id: "zongyi", type_name: "综艺" },
    { type_id: "dongman", type_name: "动漫" }
];

const areaValues = [
    { n: "全部", v: "" }, { n: "中国大陆", v: "中国大陆" }, { n: "中国香港", v: "中国香港" },
    { n: "中国台湾", v: "中国台湾" }, { n: "美国", v: "美国" }, { n: "法国", v: "法国" },
    { n: "英国", v: "英国" }, { n: "日本", v: "日本" }, { n: "韩国", v: "韩国" },
    { n: "德国", v: "德国" }, { n: "泰国", v: "泰国" }, { n: "印度", v: "印度" },
    { n: "其它", v: "其它" }
];
const yearValues = [{ n: "全部", v: "" }];
for (let y = 2026; y >= 2010; y--) yearValues.push({ n: String(y), v: String(y) });
yearValues.push({ n: "更早", v: "2009" });
const byValues = [
    { n: "最近更新", v: "time" },
    { n: "高分", v: "score" },
    { n: "人气", v: "hits" }
];
const filters = {
    "dianying": [{ key: "area", name: "地区", value: areaValues }, { key: "year", name: "年份", value: yearValues }, { key: "by", name: "排序", value: byValues }],
    "lianxuju": [{ key: "area", name: "地区", value: areaValues }, { key: "year", name: "年份", value: yearValues }, { key: "by", name: "排序", value: byValues }],
    "zongyi": [{ key: "area", name: "地区", value: areaValues }, { key: "year", name: "年份", value: yearValues }, { key: "by", name: "排序", value: byValues }],
    "dongman": [{ key: "area", name: "地区", value: areaValues }, { key: "year", name: "年份", value: yearValues }, { key: "by", name: "排序", value: byValues }]
};

// 分类 URL：/s/{cateId}[/area/{area}][/by/{by}][/year/{year}]/page/{pg}.html
function buildCateUrl(tid, pg, extend) {
    extend = extend || {};
    let url = "/s/" + tid;
    if (extend.area) url += "/area/" + encodeURIComponent(extend.area);
    if (extend.by) url += "/by/" + extend.by;
    if (extend.year) url += "/year/" + extend.year;
    url += "/page/" + (pg || 1) + ".html";
    return HOST + url;
}

// ===================== 列表解析 =====================
// <div class="show_play"> <a href="/v/ID.html" class="tcl-img" title="TITLE"> ... <img data-original="PIC"> ... <p class="tc_wz">REMARK</p>
function parseList(html) {
    const list = [];
    const seen = {};
    const re = /<div class="show_play">[\s\S]*?<a href="([^"]+)"[^>]*title="([^"]*)"[\s\S]*?data-original="([^"]*)"[\s\S]*?<p class="tc_wz">([\s\S]*?)<\/p>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const url = m[1];
        const name = stripTags(m[2]);
        if (!url || !name || seen[url]) continue;
        seen[url] = true;
        list.push({
            vod_id: url,
            vod_name: name,
            vod_pic: m[3] || "",
            vod_remarks: stripTags(m[4])
        });
    }
    return list;
}

function pageCount(html, list, pg) {
    const m = html.match(/href="[^"]*\/page\/(\d+)\.html"[^>]*title="尾页"/);
    if (m) return parseInt(m[1]);
    return list.length ? pg + 1 : pg;
}

// ===================== 详情解析 =====================
function parseRoutes(html) {
    // 各线路标题：<li class="tab-switch swiper-slide" switch="tab_con_playlist_N"><a ...>名称</a></li>
    const routes = [];
    const routeRe = /<li class="tab-switch[^"]*"\s+switch="(tab_con_playlist_\d+)">\s*<a[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = routeRe.exec(html)) !== null) {
        routes.push({ cid: m[1], name: stripTags(m[2]) });
    }

    // 按 <div class="tab-content" 切分，收集每个线路下的集数（/p/{vod}-{sid}-{nid}.html）
    const epMap = {};
    const blocks = html.split(/<div class="tab-content"/);
    for (let i = 1; i < blocks.length; i++) {
        const idm = blocks[i].match(/^\s*id="([^"]+)"/);
        if (!idm) continue;
        const eps = [];
        const aRe = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let am;
        while ((am = aRe.exec(blocks[i])) !== null) {
            if (/^\/p\/\d+-\d+-\d+\.html$/.test(am[1])) {
                eps.push(stripTags(am[2]) + "$" + am[1]);
            }
        }
        if (eps.length) epMap[idm[1]] = eps;
    }

    const from = [];
    const url = [];
    routes.forEach(function (r) {
        const eps = epMap[r.cid];
        if (eps && eps.length) {
            from.push(r.name);
            url.push(eps.join("#"));
        }
    });
    return { from: from.join("$$$"), url: url.join("$$$") };
}

function parseDetail(html, input) {
    let title = "";
    const tm = html.match(/<div class="con_name">[\s\S]*?title="([^"]*)"/);
    if (tm) title = stripTags(tm[1]);
    if (!title) {
        const t2 = html.match(/<title>([^<]*)<\/title>/);
        if (t2) title = stripTags(t2[1]);
    }

    let pic = "";
    const pm = html.match(/<div class="detail-info-pic">[\s\S]*?<img[^>]*src="([^"]+)"/);
    if (pm) pic = absUrl(pm[1]);

    function field(label) {
        const m = html.match(new RegExp(label + "：<span>([\\s\\S]*?)<\\/span>"));
        return m ? stripTags(m[1]) : "";
    }

    let content = "";
    const cm = html.match(/<div class="yplx_c3[\s\S]*?<span>([\s\S]*?)<\/span>/);
    if (cm) content = stripTags(cm[1]);

    const play = parseRoutes(html);

    return {
        vod_id: input,
        vod_name: title,
        vod_pic: pic,
        type_name: field("类型"),
        vod_year: field("年份"),
        vod_area: field("地区"),
        vod_actor: field("主演"),
        vod_director: field("导演"),
        vod_remarks: field("状态"),
        vod_content: withPrefix(content),
        vod_play_from: play.from || "饭团",
        vod_play_url: play.url
    };
}

// ===================== 搜索解析 =====================
function parseSearch(html) {
    const box = html.match(/<div class="reusltbox">([\s\S]*?)<\/ul>/);
    const scope = box ? box[1] : html;
    const list = [];
    const seen = {};
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let m;
    while ((m = liRe.exec(scope)) !== null) {
        const seg = m[1];
        const href = (seg.match(/href="(\/v\/\d+\.html)"/) || [])[1];
        if (!href || seen[href]) continue;
        let name = (seg.match(/<a[^>]*href="\/v\/\d+\.html"[^>]*title="([^"]*)"/) || [])[1];
        if (!name) name = (seg.match(/<a[^>]*href="\/v\/\d+\.html"[^>]*>([\s\S]*?)<\/a>/) || [])[1];
        name = stripTags(name);
        if (!name) continue;
        seen[href] = true;
        const pic = absUrl((seg.match(/src="([^"]+)"/) || [])[1] || "");
        const remark = stripTags((seg.match(/状态：<span>([\s\S]*?)<\/span>/) || [])[1] || "");
        list.push({ vod_id: href, vod_name: name, vod_pic: pic, vod_remarks: remark });
    }
    // 兜底：直接扫标题锚点
    if (!list.length) {
        const gRe = /<a[^>]*href="(\/v\/\d+\.html)"[^>]*title="([^"]*)"/g;
        let g;
        while ((g = gRe.exec(html)) !== null) {
            if (seen[g[1]]) continue;
            seen[g[1]] = true;
            list.push({ vod_id: g[1], vod_name: stripTags(g[2]), vod_pic: "", vod_remarks: "" });
        }
    }
    return list;
}

// ===================== TVBox 接口 =====================
async function init(ext) {
    console.log("初始化爬虫: 饭团影院");
}

async function home(filter) {
    return JSON.stringify({ class: classes, filters: filters, list: [] });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    try {
        const html = await get(buildCateUrl(tid, pg, extend));
        const list = parseList(html);
        return JSON.stringify({
            list: list,
            page: pg,
            pagecount: pageCount(html, list, pg),
            limit: 24,
            total: 999999
        });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function detail(id) {
    try {
        const url = /^https?:\/\//.test(id) ? id : absUrl(id);
        const html = await get(url);
        if (!html) return JSON.stringify({ list: [] });
        const vod = parseDetail(html, id);
        return JSON.stringify({ list: [vod] });
    } catch (e) {
        console.error("详情失败:", e.message);
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, page) {
    page = page || 1;
    try {
        const url = HOST + "/vodsearch/-------------.html?wd=" + encodeURIComponent(wd);
        const html = await get(url);
        // 该站搜索开启了 MacCMS 安全验证（验证码），客户端无法绕过；
        // 命中验证页时优雅返回空列表（其他网络环境可能可用）。
        if (!html || /系统安全验证|安全验证\.\.\./.test(html)) {
            console.warn("搜索被站点安全验证拦截，返回空结果");
            return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 24, total: 0 });
        }
        const list = parseSearch(html);
        return JSON.stringify({
            list: list,
            page: page,
            pagecount: list.length ? page + 1 : page,
            limit: 24,
            total: 999999
        });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function play(flag, id, vipFlags) {
    try {
        const url = /^https?:\/\//.test(id) ? id : absUrl(id);
        const html = await get(url, HOST + "/");
        const m = html.match(/player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (!m) return JSON.stringify({ parse: 0, playUrl: "", url: "" });
        let data;
        try { data = JSON.parse(m[1]); } catch (e) { return JSON.stringify({ parse: 0, playUrl: "", url: "" }); }
        const real = data.url || "";
        return JSON.stringify({
            parse: 0,
            playUrl: "",
            url: real,
            header: { "User-Agent": UA, "Referer": HOST + "/" }
        });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
