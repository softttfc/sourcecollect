import cheerio from 'assets://js/lib/cheerio.min.js';

const appConfig = {
    siteName: "咕噜影视",
    siteUrl: "https://www.guludyw.com"
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

async function init(ext) {
    console.log("初始化爬虫:", appConfig.siteName);
}

const classList = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "电视剧" },
    { type_id: "3", type_name: "动漫" },
    { type_id: "4", type_name: "综艺" },
    { type_id: "10", type_name: "短剧" }
];

const genreList = [
    "动作", "喜剧", "爱情", "科幻", "恐怖", "剧情", "战争", "悬疑", "惊悚", "犯罪",
    "冒险", "奇幻", "武侠", "古装", "历史", "运动", "灾难", "情色", "音乐", "歌舞",
    "儿童", "其他"
];

function buildFilterValue(list) {
    const value = [{ n: "全部", v: "" }];
    for (let i = 0; i < list.length; i++) value.push({ n: list[i], v: list[i] });
    return value;
}

const orderFilter = {
    key: "order", name: "排序", value: [
        { n: "最新", v: "time" },
        { n: "最热", v: "hits" }
    ]
};

const typeFilter = {
    key: "type", name: "类型", value: buildFilterValue(genreList)
};

const myFilters = {};
classList.forEach(item => {
    myFilters[item.type_id] = item.type_id === "10" ? [orderFilter] : [typeFilter, orderFilter];
});

function fixUrl(u) {
    if (!u) return "";
    if (u.indexOf("http") === 0) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.indexOf("/") === 0) return appConfig.siteUrl + u;
    return u;
}

function picOf($node) {
    const img = $node.find("img").first();
    if (!img || !img.length) return "";
    return fixUrl(img.attr("data-original") || img.attr("data-src") || img.attr("src") || "");
}

function idOf(href) {
    const m = String(href || "").match(/vod-read-id-(\d+)/);
    return m ? m[1] : "";
}

function remarkOf($, $node) {
    let s = "";
    $node.find("em").each(function () {
        if (!s) s = $(this).text().trim();
    });
    if (!s) $node.find("span").each(function () {
        if (!s) s = $(this).text().trim();
    });
    return s;
}

function parseListHtml(html, pg) {
    const $ = cheerio.load(html);
    let list = [];
    let seen = {};

    $(".list_yy li").each(function () {
        const $a = $(this).find('a[href*="vod-read"]').first();
        if (!$a.length) return;
        const vid = idOf($a.attr("href"));
        if (!vid || seen[vid]) return;
        const name = $(this).find("p a").first().text().trim() || $(this).find("img").first().attr("alt") || "";
        if (!name) return;
        seen[vid] = true;
        list.push({ vod_id: vid, vod_name: name, vod_pic: picOf($(this)), vod_remarks: remarkOf($, $(this)) });
    });

    let pagecount = Number(pg || 1);
    $("a[href]").each(function () {
        const h = $(this).attr("href") || "";
        const m = h.match(/-p-(\d+)/) || h.match(/page-(\d+)/);
        if (m) {
            const p = parseInt(m[1], 10);
            if (p > pagecount) pagecount = p;
        }
    });
    return { list: list, pagecount: pagecount };
}

async function home(filter) {
    let list = [];
    try {
        const html = (await req(appConfig.siteUrl + "/index.php", {
            method: "GET",
            headers: { "User-Agent": UA, "Referer": appConfig.siteUrl }
        })).content;
        const $ = cheerio.load(html);
        let seen = {};
        $(".list_yy li").each(function () {
            const $a = $(this).find('a[href*="vod-read"]').first();
            if (!$a.length) return;
            const vid = idOf($a.attr("href"));
            if (!vid || seen[vid]) return;
            const name = $(this).find("p a").first().text().trim() || $(this).find("img").first().attr("alt") || "";
            if (!name) return;
            seen[vid] = true;
            list.push({ vod_id: vid, vod_name: name, vod_pic: picOf($(this)), vod_remarks: remarkOf($, $(this)) });
        });
    } catch (e) {
        console.error("首页推荐获取失败:", e.message);
    }
    return JSON.stringify({ class: classList, filters: myFilters, list: list.slice(0, 30) });
}

function buildCategoryUrl(tid, pg, extend) {
    extend = extend || {};
    const type = encodeURIComponent(extend.type || "");
    const order = extend.order || "time";
    let path = "/index.php/vod-type-id-" + tid + "-type-" + type +
        "-area--year--star--state--order-" + order;
    if (Number(pg || 1) > 1) path += "-p-" + pg;
    return appConfig.siteUrl + path + ".html";
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    const url = buildCategoryUrl(tid, pg, extend);
    try {
        const html = (await req(url, {
            method: "GET",
            headers: { "User-Agent": UA, "Referer": appConfig.siteUrl }
        })).content;
        const result = parseListHtml(html, pg);
        // 站点分类页只有「上一页/下一页」无总页数，只要还有下一页就放宽上限
        if (result.list.length && result.pagecount >= Number(pg) + 1) {
            result.pagecount = Number(pg) + 10;
        }
        return JSON.stringify(result);
    } catch (e) {
        console.error("分类列表获取失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function search(wd, quick, pg) {
    pg = pg || 1;
    try {
        const key = encodeURIComponent(wd || "");
        const url = Number(pg) > 1
            ? appConfig.siteUrl + "/index.php?s=vod-search-wd-" + key + "-p-" + pg
            : appConfig.siteUrl + "/index.php?s=vod-search&wd=" + key;
        const html = (await req(url, {
            method: "GET",
            headers: { "User-Agent": UA, "Referer": appConfig.siteUrl }
        })).content;
        const $ = cheerio.load(html);
        let list = [], seen = {};
        $(".list_search li").each(function () {
            const $a = $(this).find('a[href*="vod-read"]').first();
            if (!$a.length) return;
            const vid = idOf($a.attr("href"));
            if (!vid || seen[vid]) return;
            const name = $(this).find(".vod-intro-title").first().text().trim() || $(this).find("img").first().attr("alt") || "";
            if (!name) return;
            seen[vid] = true;
            let remarks = $(this).find(".vod-intro-time").first().text().trim();
            remarks = remarks.replace(/^更新时间[：:]\s*/, "");
            list.push({ vod_id: vid, vod_name: name, vod_pic: picOf($(this)), vod_remarks: remarks });
        });

        let pagecount = Number(pg);
        const totalMatch = html.match(/共有<i[^>]*>(\d+)<\/i>个视频/);
        if (totalMatch && list.length) {
            pagecount = Math.ceil(parseInt(totalMatch[1], 10) / list.length);
        } else if (html.indexOf("ff-next") >= 0) {
            pagecount = Number(pg) + 1;
        }
        return JSON.stringify({ list: list, pagecount: pagecount });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function detail(id) {
    try {
        let detailUrl = String(id || "");
        if (detailUrl.indexOf("http") !== 0) {
            if (detailUrl.indexOf("vod-read") >= 0) {
                detailUrl = appConfig.siteUrl + (detailUrl.charAt(0) === "/" ? detailUrl : "/" + detailUrl);
            } else {
                detailUrl = appConfig.siteUrl + "/index.php/vod-read-id-" + detailUrl + ".html";
            }
        }
        const html = (await req(detailUrl, {
            method: "GET",
            headers: { "User-Agent": UA, "Referer": appConfig.siteUrl }
        })).content;
        const $ = cheerio.load(html);

        const vod_name = $("h1").first().text().trim();
        const vod_pic = picOf($(".text_img"));
        let vod_director = "", vod_actor = "", vod_area = "", vod_year = "", vod_content = "", vod_class = "";

        $(".text-sinfo p").each(function () {
            const text = $(this).text().trim();
            if (text.indexOf("主演") >= 0 && !vod_actor) vod_actor = text.replace(/^(主演|演员)[：:]?\s*/, "").trim();
            if (text.indexOf("导演") >= 0 && !vod_director) vod_director = text.replace(/^导演[：:]?\s*/, "").trim();
            if (text.indexOf("类型") >= 0 && !vod_class) {
                const t = text.replace(/^类型[：:]?\s*/, "").replace(/\s+/g, " ").trim();
                vod_class = t.split(" ")[0] || "";
            }
            if (text.indexOf("地区") >= 0 && !vod_area) vod_area = text.replace(/^(地区|国家)[：:]?\s*/, "").trim();
            if (text.indexOf("年份") >= 0 && !vod_year) {
                const y = text.match(/(19|20)\d{2}/);
                if (y) vod_year = y[0];
            }
        });

        const contentArr = [];
        $(".text_content li").each(function () {
            const t = $(this).text().trim();
            if (t) contentArr.push(t);
        });
        vod_content = contentArr.length ? contentArr.join("\n") : $(".text_content").text().trim();

        const lines = [], playlists = [];
        $(".show_1").each(function (idx) {
            let lineName = $(this).find("h2").first().text().trim() || ("线路" + (idx + 1));
            const eps = [];
            $(this).find('a[href*="vod-play"]').each(function () {
                let name = $(this).text().trim() || ("第" + (eps.length + 1) + "集");
                let href = fixUrl($(this).attr("href") || "");
                if (!href) return;
                name = name.replace(/#/g, "%23").replace(/\$/g, "%24");
                href = href.replace(/#/g, "%23").replace(/\$/g, "%24");
                eps.push(name + "$" + href);
            });
            if (eps.length) { lines.push(lineName); playlists.push(eps); }
        });

        if (!lines.length) {
            const eps = [];
            $('#play_online a[href*="vod-play"]').each(function () {
                let href = fixUrl($(this).attr("href") || "");
                if (!href) return;
                const name = $(this).text().trim() || ("第" + (eps.length + 1) + "集");
                eps.push(name.replace(/#/g, "%23").replace(/\$/g, "%24") + "$" + href.replace(/#/g, "%23").replace(/\$/g, "%24"));
            });
            if (eps.length) { lines.push("默认"); playlists.push(eps); }
        }

        return JSON.stringify({
            list: [{
                vod_id: String(id),
                vod_name: vod_name,
                vod_pic: vod_pic,
                vod_actor: vod_actor,
                vod_director: vod_director,
                vod_remarks: "",
                vod_year: vod_year,
                vod_area: vod_area,
                vod_content: withPrefix(vod_content),
                type_name: vod_class,
                vod_play_from: lines.join("$$$"),
                vod_play_url: playlists.map(eps => eps.join("#")).join("$$$")
            }]
        });
    } catch (e) {
        console.error("解析详情页异常:", e.message);
        return JSON.stringify({ list: [] });
    }
}

function b64UrlDecode(s) {
    try {
        s = String(s || "");
        try { s = decodeURIComponent(s); } catch (e) { s = s.replace(/%3D/gi, "="); }
        s = s.replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "");
        const pad = s.indexOf("=");
        if (pad >= 0) s = s.substring(0, pad);
        while (s.length % 4) s += "=";
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const rev = {};
        for (let i = 0; i < 64; i++) rev[chars.charAt(i)] = i;
        let out = "", acc = 0, bits = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s.charAt(i);
            if (!(c in rev)) continue;
            acc = (acc << 6) | rev[c];
            bits += 6;
            if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 255); }
        }
        return out;
    } catch (e) { return ""; }
}

async function play(flag, id, flags) {
    const headers = { "User-Agent": UA, "Referer": appConfig.siteUrl };
    const raw = String(id || "");
    try {
        if (/\.(m3u8|mp4|flv|ts)(\?.*)?$/i.test(raw)) {
            return JSON.stringify({ parse: 0, header: headers, url: raw });
        }

        let url = raw;
        if (url.indexOf("?s=") >= 0) {
            const abs = url.indexOf("http") === 0
                ? url
                : appConfig.siteUrl + (url.charAt(0) === "/" ? url : "/" + url);
            url = abs.replace("?s=", "");
        } else if (url.indexOf("http") !== 0 && url.indexOf("vod-play") >= 0) {
            url = appConfig.siteUrl + (url.charAt(0) === "/" ? url : "/" + url);
        }

        const html = (await req(url, { method: "GET", headers: headers })).content;

        let iframe = "";
        const $ = cheerio.load(html);
        iframe = $("iframe").first().attr("src") || "";
        if (!iframe) {
            const m = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
            if (m) iframe = m[1];
        }

        if (iframe) {
            iframe = iframe.trim();
            if (iframe.indexOf("//") === 0) iframe = "https:" + iframe;
            else if (iframe.indexOf("/") === 0) iframe = appConfig.siteUrl + iframe;

            const mu = iframe.match(/[&?]mu=([^&"']+)/);
            if (mu) {
                const decoded = b64UrlDecode(mu[1]);
                if (/\.(m3u8|mp4)(\?|$)/i.test(decoded)) {
                    return JSON.stringify({ parse: 0, header: headers, url: fixUrl(decoded) });
                }
            }

            if (iframe.indexOf("t.php?url=") >= 0 && iframe.indexOf("t=m3u8") < 0) {
                iframe += "&t=m3u8";
            }

            const vm = iframe.match(/https?:\/\/[^"'\s<>]+\.(m3u8|mp4)[^"'\s<>]*/i);
            if (vm) return JSON.stringify({ parse: 0, header: headers, url: vm[0] });

            return JSON.stringify({ parse: 1, header: headers, url: iframe });
        }

        const vm2 = html.match(/https?:\/\/[^"'\s<>]+\.(m3u8|mp4)[^"'\s<>]*/i);
        if (vm2) return JSON.stringify({ parse: 0, header: headers, url: vm2[0] });

        return JSON.stringify({ parse: 1, header: headers, url: url });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, header: headers, url: raw });
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
