// 茶杯狐影视 (www.cupfox.in 官方API) - 琉芸JS 版
const HOST = "https://www.cupfox.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";

const classes = [
    { type_id: "tv", type_name: "电视剧" },
    { type_id: "movie", type_name: "电影" },
    { type_id: "anime", type_name: "动漫" },
    { type_id: "show", type_name: "综艺" },
    { type_id: "doc", type_name: "纪录片" }
];

function withPrefix(s) {
    s = s || "";
    if (!s || s.startsWith(DESC_PREFIX)) return s;
    return DESC_PREFIX + s;
}

async function get(url) {
    const res = await req(url, {
        headers: { "User-Agent": UA, "Referer": HOST + "/" }
    });
    return res ? res.content : "";
}

function stripTags(s) {
    return String(s || "").replace(/<[^>]+>/g, "").trim();
}

// 解析列表：提取每个 movie-list-item 的 id/title/pic/rating
function parseList(html) {
    const list = [];
    const re = /<div class="jsx-\d+ movie-list-item">[\s\S]*?<a href="\/vod-detail\/(\d+)\.html">[\s\S]*?<img src="([^"]+)"[\s\S]*?<div class="jsx-\d+ movie-title">([^<]*)<\/div>[\s\S]*?<div class="jsx-\d+ movie-rating">([^<]*)<\/div>/g;
    let m;
    const seen = {};
    while ((m = re.exec(html)) !== null) {
        const id = m[1];
        if (seen[id]) continue;
        seen[id] = true;
        list.push({
            vod_id: HOST + "/vod-detail/" + id + ".html",
            vod_name: stripTags(m[3]),
            vod_pic: m[2].startsWith("http") ? m[2] : HOST + m[2],
            vod_remarks: stripTags(m[4]) || ""
        });
    }
    return list;
}

// 解析详情
function parseDetail(html, input) {
    const idMatch = input.match(/vod-detail\/(\d+)\.html/);
    const id = idMatch ? idMatch[1] : "";

    // title: 第一个 movie-list-title
    let title = "";
    const tm = html.match(/<span class="jsx-\d+ movie-list-title">([^<]+)<\/span>/);
    if (tm) title = stripTags(tm[1]);
    if (!title) {
        const tm2 = html.match(/<title>([^<]+)<\/title>/);
        if (tm2) title = stripTags(tm2[1]).replace(" 在线观看 - 茶杯狐 Cupfox", "");
    }

    // pic
    const pic = id ? (HOST + "/simg/" + id + ".jpg") : "";

    // content
    let content = "";
    const cm = html.match(/<meta name="description" content="([^"]*)"/);
    if (cm) content = stripTags(cm[1]);

    // subjects: 第一个 movie-list-subject-block 里的所有 movie-list-subject
    let subjects = [];
    const sb = html.match(/<div class="jsx-\d+ movie-list-subject-block">([\s\S]*?)<\/div>/);
    if (sb) {
        const subRe = /<span class="jsx-\d+ movie-list-subject">([^<]+)<\/span>/g;
        let sm;
        while ((sm = subRe.exec(sb[1])) !== null) {
            const t = stripTags(sm[1]);
            if (t) subjects.push(t);
        }
    }

    // 年份
    let year = "";
    for (const s of subjects) { if (/^\d{4}$/.test(s)) { year = s; break; } }

    // 演员
    const actor = subjects.slice(3).join(" ");

    // 播放按钮
    const playBtns = [];
    const pbRe = /<span class="jsx-\d+ movie-list-subject play-btn" ep_slug="([^"]*)">([^<]+)<\/span>/g;
    let pm;
    while ((pm = pbRe.exec(html)) !== null) {
        playBtns.push({ ep: pm[1], name: stripTags(pm[2]) });
    }
    // 规则里 reverse
    playBtns.reverse();

    const urls = [];
    for (const b of playBtns) {
        if (b.ep && b.name) {
            urls.push(b.name + "$" + id + "-" + b.ep);
        }
    }

    return {
        vod_id: input,
        vod_name: title,
        vod_pic: pic,
        type_name: subjects.slice(0, 3).join(" "),
        vod_year: year,
        vod_area: subjects[1] || "",
        vod_actor: actor,
        vod_content: withPrefix(content),
        vod_play_from: "茶杯狐",
        vod_play_url: urls.join("#")
    };
}

async function init(ext) {
    console.log("初始化爬虫: 茶杯狐");
}

async function home(filter) {
    return JSON.stringify({
        class: classes,
        filters: {},
        list: []
    });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    try {
        const html = await get(HOST + "/type/" + tid + "/?page=" + pg);
        const list = parseList(html);
        return JSON.stringify({
            list: list,
            page: pg,
            pagecount: list.length >= 24 ? pg + 1 : pg,
            limit: 24,
            total: 999999
        });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function search(wd, quick, page) {
    page = page || 1;
    try {
        const html = await get(HOST + "/search?q=" + encodeURIComponent(wd));
        const list = parseList(html);
        return JSON.stringify({
            list: list,
            page: page,
            pagecount: list.length >= 24 ? page + 1 : page,
            limit: 24,
            total: 999999
        });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function detail(id) {
    try {
        const html = await get(id);
        const vod = parseDetail(html, id);
        return JSON.stringify({ list: [vod] });
    } catch (e) {
        console.error("详情失败:", e.message);
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, vipFlags) {
    try {
        const res = await req(HOST + "/tea/" + id, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
                "Referer": HOST + "/"
            }
        });
        const text = res ? res.content : "";
        let data;
        try { data = JSON.parse(text); } catch (e) { return JSON.stringify({ parse: 0, playUrl: "", url: "" }); }
        const plays = data.video_plays || [];
        const url = plays.length ? plays[0].play_data : "";
        return JSON.stringify({
            parse: 0,
            playUrl: "",
            url: url
        });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
