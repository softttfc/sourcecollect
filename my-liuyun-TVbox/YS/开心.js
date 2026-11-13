// ================== 开心影院 · TVBox QuickJS ==================
// 站：https://www.kxyy1.cc（maccms 自定义模板）
// 分类：电影1/电视剧2/综艺3/动漫4/短剧26
// 详情多线路按可播性重排：MD源/BF源/LZ源 优先，XG源 次之，YX源(NBY-XMYAES假源) 垫底
// 播放：抓取播放页 player 配置提取 m3u8 直链 parse:0，失败回退 parse:1 嗅探
// ============================================================

const SITE = "https://www.kxyy1.cc";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

// 线路优先级（实测）：MD/BF/LZ 可播，XG 常超时，YX=NBY-XMYAES 假源
const LINE_PRIORITY = ["MD源", "BF源", "LZ源"];
const LINE_BAD = ["YX源"];

const classList = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "电视剧" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" },
    { type_id: "26", type_name: "短剧" }
];

function headers() {
    return { "User-Agent": UA, "Referer": SITE + "/", "Accept-Encoding": "identity" };
}

async function fetchText(url, timeout) {
    try {
        const res = await req(url, { method: "GET", headers: headers(), timeout: timeout || 12000 });
        if (!res || res.code !== 200) return "";
        return String(res.content || "");
    } catch (e) {
        return "";
    }
}

function esc(s) {
    return String(s || "").replace(/#/g, "%23").replace(/\$/g, "%24");
}

function stripTags(s) {
    return String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseCards(html, imgAttr) {
    const list = [];
    const seen = {};
    const re = /<a[^>]+href="(\/voddetail\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const id = m[2];
        if (seen[id]) continue;
        seen[id] = true;
        const inner = m[3];
        const im = inner.match(/<img[^>]+(?:data-src|src)="([^"]+)"/);
        const badge = inner.match(/<span class="badge[^"]*"[^>]*>([^<]*)<\/span>/);
        list.push({
            vod_id: id,
            vod_name: stripTags(m[4]),
            vod_pic: im ? im[1] : "",
            vod_remarks: badge ? badge[1].trim() : ""
        });
    }
    return list;
}

async function init(ext) {
    console.log("[开心影院] init");
}

async function home(filter) {
    const html = await fetchText(SITE + "/");
    const list = parseCards(html).slice(0, 30);
    return JSON.stringify({ class: classList, filters: {}, list: list });
}

async function homeVod() {
    const html = await fetchText(SITE + "/");
    return JSON.stringify({ list: parseCards(html).slice(0, 30) });
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1, 10) || 1;
    const url = SITE + "/vodshow/" + tid + "--------" + pg + "---1.html";
    const html = await fetchText(url, 15000);
    const list = parseCards(html);
    let pagecount = pg;
    const pn = html.match(/class="pagination[\s\S]*?<\/ul>/);
    if (pn) {
        const nums = pn[0].match(/vodshow\/\d+-+(\d+)-+1\.html/g) || [];
        nums.forEach(h => {
            const n = parseInt((h.match(/vodshow\/\d+-+(\d+)-+1/) || [])[1] || 0, 10);
            if (n > pagecount) pagecount = n;
        });
        if (list.length >= 20 && pagecount === pg) pagecount = pg + 1;
    }
    return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 24, total: 0 });
}

async function search(key, quick, pg) {
    const url = SITE + "/index.php/ajax/suggest?wd=" + encodeURIComponent(key) + "&mid=1";
    const txt = await fetchText(url, 12000);
    const list = [];
    try {
        const j = JSON.parse(txt);
        const rows = j.list || [];
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i].id) continue;
            list.push({
                vod_id: String(rows[i].id),
                vod_name: String(rows[i].name || ""),
                vod_pic: String(rows[i].pic || "").replace(/\\\//g, "/"),
                vod_remarks: ""
            });
        }
    } catch (e) {}
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: 20, total: list.length });
}

function lineRank(name) {
    for (let i = 0; i < LINE_PRIORITY.length; i++) if (name.indexOf(LINE_PRIORITY[i]) === 0) return i;
    for (let i = 0; i < LINE_BAD.length; i++) if (name.indexOf(LINE_BAD[i]) === 0) return 100 + i;
    return 50; // 未知线路保持中段
}

async function detail(id) {
    const vid = String(Array.isArray(id) ? id[0] : id);
    const html = await fetchText(SITE + "/voddetail/" + vid + ".html", 15000);
    if (!html) return JSON.stringify({ list: [] });

    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "";
    const nameM = h1.match(/^(.+?)\s*\(\d{4}\)/);
    const yearM = h1.match(/\((\d{4})\)/);
    const pic = (html.match(/og:image" content="([^"]+)"/) || [])[1] || "";
    const pick = (label) => {
        const m = html.match(new RegExp("<strong>" + label + "[：:]</strong>([\\s\\S]*?)</p>"));
        return m ? stripTags(m[1]) : "";
    };
    const descM = html.match(/id="synopsis"[\s\S]*?<div class="card-body">([\s\S]*?)<\/div>/);

    // 线路名：#tabs-home-N + </svg> 后的文本
    const lineNames = {};
    const navRe = /#tabs-home-(\d+)"[\s\S]*?<\/svg>\s*([^<]+?)\s*&nbsp;/g;
    let nm;
    while ((nm = navRe.exec(html)) !== null) lineNames[nm[1]] = nm[2].trim();

    // 播放块（按文档顺序）与剧集
    const lines = [];
    const paneRe = /tab-pane fade" id="tabs-home-(\d+)"([\s\S]*?)(?=tab-pane fade" id="tabs-home-|<\/div><\/div><\/div><\/div>)/g;
    let pm;
    while ((pm = paneRe.exec(html)) !== null) {
        const paneId = pm[1];
        const eps = [];
        const epRe = /href="(\/vodplay\/[^"]+)"[^>]*>([^<]*)<\/a>/g;
        let em;
        while ((em = epRe.exec(pm[2])) !== null) {
            eps.push({ name: stripTags(em[2]) || ("第" + (eps.length + 1) + "集"), url: em[1] });
        }
        if (eps.length) lines.push({ name: lineNames[paneId] || ("线路" + paneId), eps: eps });
    }

    // 按可播性重排
    lines.sort((a, b) => lineRank(a.name) - lineRank(b.name));
    const froms = [];
    const urls = [];
    for (let i = 0; i < lines.length; i++) {
        const bad = lineRank(lines[i].name) >= 100;
        froms.push(bad ? lines[i].name + "（可能失效）" : lines[i].name);
        urls.push(lines[i].eps.map(e => esc(e.name) + "$" + esc(e.url)).join("#"));
    }

    return JSON.stringify({
        list: [{
            vod_id: vid,
            vod_name: nameM ? nameM[1].trim() : stripTags(h1),
            vod_pic: pic,
            vod_year: yearM ? yearM[1] : "",
            vod_area: pick("制片国家/地区"),
            vod_actor: pick("主演"),
            vod_director: pick("导演"),
            vod_remarks: pick("摘要"),
            vod_content: withPrefix(descM ? stripTags(descM[1]) : ""),
            vod_play_from: froms.join("$$$"),
            vod_play_url: urls.join("$$$")
        }]
    });
}

async function play(flag, id, flags) {
    let pageUrl = String(id || "");
    if (pageUrl.indexOf("http") !== 0) pageUrl = SITE + pageUrl;
    const html = await fetchText(pageUrl, 12000);
    const m = html.match(/"url"\s*:\s*"([^"]+)"/);
    const head = { "User-Agent": UA, "Referer": SITE + "/" };
    if (m) {
        const u = m[1].replace(/\\\//g, "/");
        if (/^https?:\/\/.*\.(m3u8|mp4|flv|mkv)/i.test(u)) {
            return JSON.stringify({ parse: 0, url: u, header: head });
        }
    }
    // 假源/加密线路回退嗅探
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
