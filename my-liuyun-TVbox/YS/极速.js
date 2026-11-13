// 极速追剧 TVBox 爬虫（ jisuzhuiju.com 官方API - 琉芸JS 版）
// 自定义 PHP 站（非 MacCMS），服务端渲染 + 播放解析接口，无签名。
// HOST: https://jisuzhuiju.com
const HOST = "https://jisuzhuiju.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

const classes = [
    { type_id: "dianying", type_name: "电影" },
    { type_id: "dianshiju", type_name: "电视剧" },
    { type_id: "dongman", type_name: "动漫" },
    { type_id: "zongyi", type_name: "综艺" }
];

function withPrefix(s) {
    s = (s || "").trim();
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

// 全局 req 由 TVBox 提供；node 测试时注入 mock
async function get(url, referer) {
    try {
        const res = await req(url, {
            headers: {
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Referer": referer || HOST + "/"
            },
            timeout: 20000
        });
        return res ? (res.content || "") : "";
    } catch (e) {
        console.error("请求失败[" + url + "]:", e.message);
        return "";
    }
}

function cleanHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/<br\s*\/?>/g, " ")
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

function fixPic(pic) {
    if (!pic) return "";
    pic = pic.trim();
    if (pic.indexOf("//") === 0) return "https:" + pic;
    if (pic.charAt(0) === "/") return HOST + pic;
    return pic;
}

function isBadPage(html) {
    if (!html) return true;
    if (html.indexOf("404 - 页面没找到") >= 0 || html.indexOf("System Error") >= 0) return true;
    return false;
}

async function getHtml(url) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const html = await get(url);
        if (!isBadPage(html)) return html;
        if (attempt < 2) { try { await new Promise(r => setTimeout(r, 800 + attempt * 500)); } catch (e) {} }
    }
    return "";
}

// ===================== 列表解析（首页/分类/搜索通用） =====================
function parseVideoList(html) {
    const videos = [];
    if (!html) return videos;
    const cardRe = /<a[^>]*href="(\/detail\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = cardRe.exec(html)) !== null) {
        const vodId = m[2];
        const block = m[3];
        let pic = "", title = "";
        const im1 = block.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"/);
        const im2 = im1 ? null : block.match(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"/);
        if (im1) { pic = im1[1]; title = im1[2]; }
        else if (im2) { title = im2[1]; pic = im2[2]; }
        else continue;
        title = title.replace("封面图片", "").trim();
        const tm = block.match(/class="vod-title[^"]*"[^>]*>([^<]*)</);
        if (tm && tm[1].trim()) title = tm[1].trim();
        let note = "";
        const sm = block.match(/class="vod-subtitle[^"]*"[^>]*>([^<]*)</);
        if (sm) note = sm[1].trim();
        if (!title) continue;
        videos.push({
            vod_id: vodId,
            vod_name: title,
            vod_pic: fixPic(pic),
            vod_remarks: note
        });
    }
    // 去重（同一 id 可能出现在多个板块/搜索多个锚点）
    const seen = {};
    const dedup = [];
    for (const v of videos) {
        if (seen[v.vod_id]) continue;
        seen[v.vod_id] = true;
        dedup.push(v);
    }
    return dedup;
}

// ===================== 播放源解析 =====================
function parsePlaySources(html, vodId) {
    const sources = [];
    if (!html) return sources;

    // 线路名 data-target -> 名称
    const tabMap = {};
    const tabRe = /data-target="(source-\d+)"[^>]*>([^<]*)</g;
    let tm;
    while ((tm = tabRe.exec(html)) !== null) {
        tabMap[tm[1]] = cleanHtml(tm[2]);
    }

    // panel 位置切片
    const panelRe = /<div[^>]*class="source-panel"[^>]*id="(source-\d+)"/g;
    const posList = [];
    let pm;
    while ((pm = panelRe.exec(html)) !== null) {
        posList.push({ pos: pm.index, pid: pm[1] });
    }

    for (let k = 0; k < posList.length; k++) {
        const start = posList[k].pos;
        const end = k + 1 < posList.length ? posList[k + 1].pos : html.length;
        const body = html.substring(start, end);

        const epRe = new RegExp('href="/vodplay/' + vodId + '-([A-Za-z0-9]+)-(\\d+)\\.html"[^>]*>([\\s\\S]*?)</a>', "g");
        const eps = [];
        let em;
        while ((em = epRe.exec(body)) !== null) {
            eps.push({ playFrom: em[1], index: parseInt(em[2]), name: cleanHtml(em[3]) });
        }
        if (!eps.length) continue;
        const playFrom = eps[0].playFrom;
        const name = tabMap[posList[k].pid] || ("线路" + (k + 1));
        eps.sort((a, b) => a.index - b.index);
        const epList = eps.map(function (e) {
            const epName = e.name || ("第" + e.index + "集");
            return epName + "$" + vodId + "-" + playFrom + "-" + e.index;
        });
        sources.push({ sourceName: name, episodes: epList });
    }
    return sources;
}

// ===================== TVBox 接口 =====================
async function init(ext) {
    console.log("初始化爬虫: 极速追剧");
}

async function home(filter) {
    let list = [];
    try {
        const html = await getHtml(HOST);
        list = html ? parseVideoList(html).slice(0, 30) : [];
    } catch (e) {
        console.error("首页失败:", e.message);
    }
    return JSON.stringify({ class: classes, filters: {}, list: list });
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1);
    if (!pg || pg < 1) pg = 1;
    // 站点无翻页参数，仅首页返回数据
    if (pg > 1) {
        return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 60, total: 0 });
    }
    try {
        const valid = classes.some(c => c.type_id === String(tid));
        if (!valid) return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 60, total: 0 });
        const html = await getHtml(HOST + "/type/" + tid + ".html");
        const videos = html ? parseVideoList(html) : [];
        return JSON.stringify({
            list: videos,
            page: pg,
            pagecount: 1,
            limit: 60,
            total: videos.length
        });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 60, total: 0 });
    }
}

async function search(wd, quick, page) {
    page = parseInt(page || 1) || 1;
    const keyword = String(wd || "").trim();
    if (!keyword) return JSON.stringify({ page: page, pagecount: 1, limit: 0, total: 0, list: [] });
    try {
        const html = await getHtml(HOST + "/search?keyword=" + encodeURIComponent(keyword));
        if (!html) return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 30, total: 0 });
        let videos = parseVideoList(html);
        if (!quick) {
            const kl = keyword.toLowerCase();
            videos.sort(function (a, b) {
                const na = a.vod_name.toLowerCase(), nb = b.vod_name.toLowerCase();
                const sa = na === kl ? 0 : (na.indexOf(kl) === 0 ? 1 : (na.indexOf(kl) >= 0 ? 2 : 3));
                const sb = nb === kl ? 0 : (nb.indexOf(kl) === 0 ? 1 : (nb.indexOf(kl) >= 0 ? 2 : 3));
                return sa - sb;
            });
        }
        return JSON.stringify({
            list: videos,
            page: page,
            pagecount: 9999,
            limit: 30,
            total: 999999
        });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 30, total: 0 });
    }
}

async function detail(id) {
    try {
        const vodId = String(id);
        const html = await getHtml(HOST + "/detail/" + vodId + ".html");
        if (!html) return JSON.stringify({ list: [] });

        let vodName = "", vodPic = "", vodYear = "", vodArea = "", vodActor = "",
            vodDirector = "", vodContent = "", vodRemarks = "", typeName = "";

        // ld+json：@graph 内的 Movie / TVSeries
        const lm = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        if (lm) {
            try {
                const data = JSON.parse(lm[1].trim());
                const graph = (data && data["@graph"]) || [];
                let movie = null;
                for (const obj of graph) {
                    if (obj && (obj["@type"] === "Movie" || obj["@type"] === "TVSeries")) { movie = obj; break; }
                }
                if (!movie && data && (data["@type"] === "Movie" || data["@type"] === "TVSeries")) movie = data;
                if (movie) {
                    vodName = movie.name || "";
                    vodPic = fixPic(movie.image || "");
                    vodYear = String(movie.datePublished || "").substring(0, 4);
                    vodActor = movie.actor || "";
                    vodDirector = movie.director || "";
                    typeName = cleanHtml(movie.genre || "");
                    vodRemarks = typeName;
                    vodContent = cleanHtml(movie.description || "");
                    const coo = movie.countryOfOrigin;
                    if (coo && typeof coo === "object") vodArea = coo.name || "";
                }
            } catch (e) {
                console.error("ld+json 解析失败:", e.message);
            }
        }

        // HTML 侧兜底
        if (!vodName) {
            const tm = html.match(/<h1[^>]*class="[^"]*detail-title[^"]*"[^>]*>([^<]*)</);
            if (tm) vodName = cleanHtml(tm[1]);
        }
        if (!vodName) {
            const tm = html.match(/<title>《?([^》<]*)》?/);
            if (tm) vodName = cleanHtml(tm[1]);
        }
        if (!vodPic) {
            const pm = html.match(/<img[^>]*src="([^"]+)"[^>]*alt="[^"]*封面/);
            if (pm) vodPic = fixPic(pm[1]);
        }

        function meta(label) {
            const mm = html.match(new RegExp('<span class="meta-label">\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '\\s*</span>\\s*<span class="meta-value">([\\s\\S]*?)</span>'));
            return mm ? cleanHtml(mm[1]) : "";
        }
        if (!vodActor) vodActor = meta("主演：");
        if (!vodDirector) vodDirector = meta("导演：");
        if (!vodYear) vodYear = meta("年份：");
        if (!vodArea) vodArea = meta("地区：");
        if (!vodContent) {
            const dm = html.match(/<meta name="description" content="([^"]*)"/);
            if (dm) vodContent = cleanHtml(dm[1]);
        }

        const sources = parsePlaySources(html, vodId);
        if (!sources.length) {
            console.error("未能解析到播放源");
            return JSON.stringify({ list: [] });
        }

        const fromList = [];
        const urlList = [];
        for (const src of sources) {
            fromList.push(src.sourceName);
            urlList.push(src.episodes.join("#"));
        }

        return JSON.stringify({
            list: [{
                vod_id: vodId,
                vod_name: vodName || "未知",
                vod_pic: vodPic,
                type_name: typeName,
                vod_year: vodYear,
                vod_area: vodArea,
                vod_actor: vodActor,
                vod_director: vodDirector,
                vod_content: withPrefix(vodContent),
                vod_remarks: vodRemarks,
                vod_play_from: fromList.join("$$$"),
                vod_play_url: urlList.join("$$$")
            }]
        });
    } catch (e) {
        console.error("详情失败:", e.message);
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, vipFlags) {
    try {
        const parts = String(id || "").split("-");
        if (parts.length < 3) return JSON.stringify({ parse: 0, playUrl: "", url: "" });
        const vodId = parts[0], playFrom = parts[1], index = parts[2];
        const api = HOST + "/api/play-url?vodId=" + encodeURIComponent(vodId) +
            "&playFrom=" + encodeURIComponent(playFrom) + "&index=" + encodeURIComponent(index);
        const res = await req(api, {
            headers: { "User-Agent": UA, "Referer": HOST + "/", "Accept": "*/*" },
            timeout: 15000
        });
        let data;
        try { data = JSON.parse(res ? res.content : ""); } catch (e) { data = null; }
        const playUrl = (data && data.url || "").trim();
        if (!playUrl) return JSON.stringify({ parse: 0, playUrl: "", url: "" });

        const isDirect = /\.(m3u8|mp4|flv|ts|mkv)([?#&]|$)/i.test(playUrl);
        const isIframe = data && data.mode === "iframe";
        if (isIframe && !isDirect) {
            // 网页解析源
            return JSON.stringify({ parse: 1, jx: 1, playUrl: playUrl, url: "", header: "" });
        }
        return JSON.stringify({
            parse: 0,
            playUrl: "",
            url: playUrl,
            header: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": HOST + "/"
            }
        });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
