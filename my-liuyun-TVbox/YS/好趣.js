// 好趣网 TVBox QuickJS 版
// 修复：HTTPS、频道列表、搜索结果、中文搜索、播放线路及 signal 地址提取

const HOST = "https://tv.haoqu99.com";
const MOBILE_HOST = "https://m.haoqu99.com";
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const TIMEOUT = 15000;
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const CLASSES = [
    { type_id: "1", type_name: "央视" },
    { type_id: "2", type_name: "卫视频道" },
    { type_id: "4", type_name: "港澳台频道" },
    { type_id: "5", type_name: "国外电视台" },
    { type_id: "3/guangdong", type_name: "广东" },
    { type_id: "3/hunan", type_name: "湖南" },
    { type_id: "3/jiangsu", type_name: "江苏" },
    { type_id: "3/anhui", type_name: "安徽" },
    { type_id: "3/zhejiang", type_name: "浙江" },
    { type_id: "3/beijing", type_name: "北京" },
    { type_id: "3/liaoning", type_name: "辽宁" },
    { type_id: "3/jiangxi", type_name: "江西" },
    { type_id: "3/shandong", type_name: "山东" },
    { type_id: "3/heilongjiang", type_name: "黑龙江" },
    { type_id: "3/shanghai", type_name: "上海" },
    { type_id: "3/yunnan", type_name: "云南" },
    { type_id: "3/sichuan", type_name: "四川" },
    { type_id: "3/henan", type_name: "河南" },
    { type_id: "3/hubei", type_name: "湖北" },
    { type_id: "3/fujian", type_name: "福建" },
    { type_id: "3/zhongqing", type_name: "重庆" },
    { type_id: "3/hebei", type_name: "河北" },
    { type_id: "3/jilin", type_name: "吉林" },
    { type_id: "3/guangxi", type_name: "广西" },
    { type_id: "3/shan-xi", type_name: "山西" },
    { type_id: "3/shanxi", type_name: "陕西" },
    { type_id: "3/ningxia", type_name: "宁夏" },
    { type_id: "3/hainan", type_name: "海南" },
    { type_id: "3/gansu", type_name: "甘肃" },
    { type_id: "3/xinjiang", type_name: "新疆" },
    { type_id: "3/neimenggu", type_name: "内蒙古" },
    { type_id: "3/tianjin", type_name: "天津" },
    { type_id: "3/guizhou", type_name: "贵州" },
    { type_id: "3/qinghai", type_name: "青海" },
    { type_id: "3/xizang", type_name: "西藏" }
];

let homeCache = { time: 0, list: [] };
let categoryCache = {};

function init(ext) {}

function getHtml(url, referer, encoding) {
    const res = req(url, {
        headers: {
            "User-Agent": UA,
            "Referer": referer || HOST + "/",
            "Accept-Encoding": "identity"
        },
        timeout: TIMEOUT,
        encoding: encoding || "GBK",
        charset: encoding || "GBK"
    });
    if (!res) return "";
    if (typeof res === "string") return res;
    return res.content || res.body || "";
}

function decodeHtml(text) {
    return String(text || "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, function (m, n) {
            try { return String.fromCharCode(parseInt(n, 10)); } catch (e) { return m; }
        })
        .replace(/&amp;/gi, "&");
}

function cleanText(html) {
    return decodeHtml(String(html || "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function attr(tag, name) {
    const re = new RegExp(name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
    const m = re.exec(String(tag || ""));
    return m ? decodeHtml(m[2]) : "";
}

function fixUrl(url) {
    url = decodeHtml(url).trim();
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (url.charAt(0) === "/") return HOST + url;
    if (!/^https?:\/\//i.test(url)) return HOST + "/" + url.replace(/^\.?\//, "");
    return url.replace(/^http:\/\/(tv|m)\.haoqu99\.com/i, "https://$1.haoqu99.com");
}

function parseCards(html) {
    const list = [];
    const seen = {};
    const itemRe = /<li\b[^>]*class=["'][^"']*\bp-item\b[^"']*["'][^>]*>[\s\S]*?<\/li>/gi;
    let item;
    while ((item = itemRe.exec(String(html || ""))) !== null) {
        const block = item[0];
        const a = /<a\b[^>]*>/i.exec(block);
        if (!a) continue;
        const id = attr(a[0], "href");
        if (!id || /^javascript:/i.test(id)) continue;
        const vid = fixUrl(id);
        if (seen[vid]) continue;
        const img = /<img\b[^>]*>/i.exec(block);
        const nameMatch = /<(?:i|strong)\b[^>]*class=["'][^"']*\bs\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:i|strong)>/i.exec(block);
        let name = nameMatch ? cleanText(nameMatch[1]) : "";
        if (!name) name = cleanText(attr(a[0], "title").replace(/在线直播.*$/, ""));
        if (!name && img) name = cleanText(attr(img[0], "alt"));
        if (!name) continue;
        seen[vid] = true;
        list.push({
            vod_id: vid,
            vod_name: name,
            vod_pic: img ? fixUrl(attr(img[0], "src")) : "",
            vod_remarks: "直播"
        });
    }
    return list;
}

function getHomeList() {
    if (homeCache.list.length && Date.now() - homeCache.time < 600000) return homeCache.list;
    const html = getHtml(HOST + "/");
    const first = /<ul\b[^>]*class=["'][^"']*\bp-list-sya\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i.exec(html);
    const list = parseCards(first ? first[1] : html);
    if (list.length) homeCache = { time: Date.now(), list: list };
    return list;
}

function getCategoryList(tid) {
    const cached = categoryCache[tid];
    if (cached && Date.now() - cached.time < 600000) return cached.list;
    const html = getHtml(HOST + "/" + tid);
    const list = parseCards(html);
    if (list.length) categoryCache[tid] = { time: Date.now(), list: list };
    return list;
}

function home(filter) {
    return JSON.stringify({ class: CLASSES, list: getHomeList(), filters: {} });
}

function homeVod() {
    return JSON.stringify({ list: getHomeList() });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const list = page === 1 ? getCategoryList(String(tid)) : [];
    return JSON.stringify({
        list: list,
        page: 1,
        pagecount: 1,
        limit: list.length,
        total: list.length
    });
}

function detail(ids) {
    const vid = Array.isArray(ids) ? String(ids[0]) : String(ids);
    const pageUrl = fixUrl(vid);
    const html = getHtml(pageUrl);
    if (!html) return JSON.stringify({ list: [] });

    const titleMatch = /<strong\b[^>]*class=["'][^"']*\bt\b[^"']*["'][^>]*>([\s\S]*?)<\/strong>/i.exec(html);
    const name = titleMatch ? cleanText(titleMatch[1]) : "好趣直播";
    const infoPos = html.indexOf("v-info");
    const infoHtml = infoPos >= 0 ? html.substring(infoPos, infoPos + 30000) : html;
    const img = /<img\b[^>]*>/i.exec(infoHtml);
    const contentMatch = /<div\b[^>]*class=["'][^"']*\bdrop-panel\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(infoHtml);
    let content = contentMatch ? cleanText(contentMatch[1]) : "";
    if (content.length > 1200) content = content.substring(0, 1200) + "…";

    const lines = [];
    const seen = {};
    const sourceRe = /<li\b[^>]*data-player=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi;
    let source;
    while ((source = sourceRe.exec(html)) !== null) {
        const playerId = source[1];
        if (!/^\d+$/.test(playerId) || seen[playerId]) continue;
        seen[playerId] = true;
        const title = cleanText(source[2]) || ("线路" + (lines.length + 1));
        lines.push(title + "$" + MOBILE_HOST + "/e/extend/tv.php?id=" + playerId);
    }
    if (!lines.length) {
        const current = /var\s+sourid\s*=\s*["'](\d+)["']/i.exec(html);
        if (current) lines.push("默认线路$" + MOBILE_HOST + "/e/extend/tv.php?id=" + current[1]);
    }
    if (!lines.length) return JSON.stringify({ list: [] });

    return JSON.stringify({
        list: [{
            vod_id: pageUrl,
            vod_name: name,
            vod_pic: img ? fixUrl(attr(img[0], "src")) : "",
            vod_remarks: "直播",
            vod_content: DESC_PREFIX + content,
            vod_play_from: "好趣直播",
            vod_play_url: lines.join("#")
        }]
    });
}

function playResult(url, parse, referer) {
    const header = { "User-Agent": UA };
    if (referer) header["Referer"] = referer;
    return JSON.stringify({ parse: parse, url: url, header: header });
}

function safeDecode(url) {
    try { return decodeURIComponent(url); } catch (e) { return url; }
}

function absoluteUrl(url, baseUrl) {
    url = decodeHtml(url).trim();
    if (!url) return "";
    if (url.indexOf("//") === 0) return "https:" + url;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = /^(https?:\/\/[^/]+)/i.exec(baseUrl);
    if (url.charAt(0) === "/" && origin) return origin[1] + url;
    return baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1) + url;
}

function nestedPlayerUrl(playerUrl) {
    const match = /[?&](?:id|url|src|play)=([^&]+)/i.exec(playerUrl);
    if (!match) return "";
    const value = safeDecode(match[1]);
    return /^https?:\/\//i.test(value) ? value : "";
}

function extractMediaUrl(html, baseUrl) {
    const text = String(html || "").replace(/\\\//g, "/");
    const source = /<source\b[^>]*src=["']([^"']+)["']/i.exec(text);
    if (source && /\.m3u8(?:$|\?)/i.test(source[1])) return absoluteUrl(source[1], baseUrl);
    const media = /https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?/i.exec(text);
    return media ? decodeHtml(media[0]) : "";
}

function resolveIframe(url, pageUrl) {
    const nested = nestedPlayerUrl(url);
    const target = nested || url;
    const html = getHtml(target, pageUrl, "UTF8");
    if (/^\s*#EXTM3U/i.test(html)) return { url: target, referer: pageUrl, parse: 0 };
    let media = extractMediaUrl(html, target);
    if (media) return { url: media, referer: target, parse: 0 };

    const idMatch = /[?&]id=([^&]+)/i.exec(target);
    if (idMatch && /app\.hfbtc\.cn\/shows\//i.test(html)) {
        const channel = safeDecode(idMatch[1]).replace(/[^a-z0-9_-]/gi, "");
        const numberRe = new RegExp("n\\[['\"]" + channel + "['\"]\\]\\s*=\\s*(\\d+)", "i");
        const number = numberRe.exec(html);
        const apiBase = /https?:\/\/app\.hfbtc\.cn\/shows\/\d+\//i.exec(html);
        if (number && apiBase) {
            const apiUrl = apiBase[0] + number[1] + ".html";
            const apiHtml = getHtml(apiUrl, target, "UTF8");
            media = extractMediaUrl(apiHtml, apiUrl);
            if (media) return { url: media, referer: apiUrl, parse: 0 };
        }
    }
    if (nested && !/\.php(?:$|\?)/i.test(nested)) return { url: nested, referer: "", parse: 1 };
    return null;
}

function play(flag, id, vipFlags) {
    const pageUrl = fixUrl(String(id || ""));
    const html = getHtml(pageUrl, MOBILE_HOST + "/");
    const signal = /signal\s*=\s*["']([^"']+)["']/i.exec(html);
    if (signal) {
        const parts = signal[1].split("$");
        const url = fixUrl(parts[1] || "");
        const type = String(parts[2] || "").toLowerCase();
        if (url) {
            if (type !== "iframe" || /\.m3u8(?:$|\?)/i.test(url)) return playResult(url, 0, pageUrl);
            try {
                const resolved = resolveIframe(url, pageUrl);
                if (resolved) return playResult(resolved.url, resolved.parse, resolved.referer);
            } catch (e) {}
            return playResult(url, 1, pageUrl);
        }
    }
    return playResult(pageUrl, 1, MOBILE_HOST + "/");
}

function parseSearch(html) {
    const list = [];
    const seen = {};
    const resultRe = /<h2\b[^>]*class=["'][^"']*\br\b[^"']*["'][^>]*>[\s\S]*?<a\b([^>]*)>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi;
    let item;
    while ((item = resultRe.exec(String(html || ""))) !== null) {
        const id = attr(item[1], "href");
        const name = cleanText(item[2]);
        if (!id || !name) continue;
        const vid = fixUrl(id);
        if (seen[vid]) continue;
        seen[vid] = true;
        list.push({ vod_id: vid, vod_name: name, vod_pic: "", vod_remarks: "直播" });
    }
    return list;
}

function encodeSearchKeyword(wd) {
    if (/^[\x00-\x7F]*$/.test(wd)) return encodeURIComponent(wd);
    try {
        if (typeof gbkTool !== "undefined" && gbkTool && typeof gbkTool.encode === "function") {
            const encoded = gbkTool.encode(wd);
            if (typeof encoded === "string" && /%[0-9a-f]{2}/i.test(encoded)) return encoded;
        }
    } catch (e) {}
    return "";
}

function localSearch(wd) {
    const keyword = wd.toLowerCase();
    const ordered = CLASSES.slice().sort(function (a, b) {
        const am = a.type_name.toLowerCase().indexOf(keyword) >= 0 ? 0 : 1;
        const bm = b.type_name.toLowerCase().indexOf(keyword) >= 0 ? 0 : 1;
        return am - bm;
    });
    const list = [];
    const seen = {};
    for (const cls of ordered) {
        let cards = [];
        try { cards = getCategoryList(cls.type_id); } catch (e) {}
        for (const card of cards) {
            if (seen[card.vod_id] || card.vod_name.toLowerCase().indexOf(keyword) < 0) continue;
            seen[card.vod_id] = true;
            list.push(card);
        }
    }
    return list;
}

function search(key, quick, pg) {
    const wd = String(key || "").trim();
    if (!wd) return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 0, total: 0 });
    const encoded = encodeSearchKeyword(wd);
    if (encoded) {
        try {
            const html = getHtml(HOST + "/e/sch/index.php?page=0&keyboard=" + encoded + "&sear=1");
            const list = parseSearch(html);
            if (list.length || html.indexOf("系统搜索到约有") >= 0) {
                return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: list.length, total: list.length });
            }
        } catch (e) {}
    }
    const list = localSearch(wd);
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: list.length, total: list.length });
}

export default { init, home, homeVod, category, detail, play, search };
