// ================== 快映Fox · TVBox QuickJS ==================
// 源：Appfox.py（ext 为域名配置 JSON，返回 apiDomain）
// 接口：/api.php/Appfox/init、/appfox/nav、/Appfox/nav_video、/Appfox/vodList、/Appfox/vod、/Appfox/config
// 播放：直链 m3u8/mp4 直接返回；网页线路按 playerCode 匹配 jiexiDataList 解析器，失败交壳嗅探
// ==========================================================

// 域名配置已内置（原 ext JSON 内容：{"apiDomain": "https://www.kanzurm65ak.top/"}）
// DEFAULT_EXT 仅作为域名失效时的自愈源，TVBox 配置可只写 api，无需 ext
const DEFAULT_HOST = "https://www.kanzurm65ak.top";
const DEFAULT_EXT = "https://www.pjb777.top/ky4kbgq7b273.json";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PLAYER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

let HOST = "";
let PLAY_CONFIG = null;
let PARSES = {};
let detailCache = {};

function defHeaders() {
    return {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.8",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache"
    };
}

function trimHost(h) {
    h = String(h || "").trim().replace(/^`+/, "").replace(/`+$/, "");
    while (h.length > 1 && h.charAt(h.length - 1) === "/") h = h.substring(0, h.length - 1);
    return h;
}

async function fetchText(url, timeout) {
    try {
        const res = await req(url, { method: "GET", headers: defHeaders(), timeout: timeout || 8000 });
        if (!res || res.code !== 200) return "";
        return String(res.content || "");
    } catch (e) {
        return "";
    }
}

async function getJson(url, timeout) {
    const txt = await fetchText(url, timeout);
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
}

async function ensureHost(ext) {
    if (HOST) return HOST;
    let host = "";
    if (ext && typeof ext === "object") {
        host = ext.host || ext.apiDomain || "";
    } else {
        // 配置里的 ext 可能被反引号包裹
        let src = String(ext ? ext : "").replace(/^`+/, "").replace(/`+$/, "").trim();
        if (src) {
            if (/^https?:\/\//.test(src)) {
                const t = await fetchText(src, 8000);
                if (t) {
                    try { host = JSON.parse(t).apiDomain || ""; } catch (e) { host = t.trim(); }
                }
            } else if (src.charAt(0) === "{") {
                try {
                    const obj = JSON.parse(src);
                    host = obj.host || obj.apiDomain || "";
                } catch (e) { host = ""; }
            } else {
                host = src;
            }
        }
    }
    host = trimHost(host);
    // 未配置 ext 时直接用内置域名
    HOST = (/^https?:\/\//.test(host) ? host : DEFAULT_HOST);
    console.log("[快映] host:", HOST);
    return HOST;
}

// 内置域名失效时，从 ext 配置源拉取最新 apiDomain（每次运行只尝试一次）
let hostRefreshed = false;
async function refreshHost() {
    if (hostRefreshed) return false;
    hostRefreshed = true;
    const t = await fetchText(DEFAULT_EXT, 8000);
    if (!t) return false;
    let host = "";
    try { host = JSON.parse(t).apiDomain || ""; } catch (e) { host = t.trim(); }
    host = trimHost(host);
    if (/^https?:\/\//.test(host) && host !== HOST) {
        HOST = host;
        console.log("[快映] 域名自愈:", HOST);
        return true;
    }
    return false;
}


async function ensureConfig() {
    if (PLAY_CONFIG !== null && PARSES && Object.keys(PARSES).length) return;
    const data = await getJson(HOST + "/api.php/Appfox/config", 10000);
    const d = (data && data.data) || {};
    PLAY_CONFIG = {
        playerList: d.playerList || [],
        jiexiDataList: d.jiexiDataList || []
    };
    PARSES = {};
    const jxList = PLAY_CONFIG.jiexiDataList;
    for (let i = 0; i < jxList.length; i++) {
        const code = String(jxList[i].playerCode || "");
        const url = String(jxList[i].url || "");
        if (code && url.indexOf("http") === 0) PARSES[code] = url;
    }
}

function buildClasses(types) {
    const cls = [];
    for (let i = 0; i < types.length; i++) {
        cls.push({ type_id: String(types[i].type_id), type_name: String(types[i].type_name) });
    }
    return cls;
}

function mapVod(v) {
    if (!v || typeof v !== "object") return null;
    const id = v.vod_id === undefined || v.vod_id === null ? "" : String(v.vod_id);
    if (!id) return null;
    return {
        vod_id: id,
        vod_name: String(v.vod_name || ""),
        vod_pic: String(v.vod_pic || ""),
        vod_remarks: String(v.vod_remarks || ""),
        vod_year: String(v.vod_year || ""),
        vod_area: String(v.vod_area || ""),
        vod_actor: String(v.vod_actor || ""),
        vod_director: String(v.vod_director || ""),
        vod_content: withPrefix(String(v.vod_content || "")),
        type_name: String(v.type_name || "")
    };
}

async function navList() {
    const nav = await getJson(HOST + "/api.php/appfox/nav", 10000);
    if (!nav || !nav.data) return [];
    let navId = "";
    for (let i = 0; i < nav.data.length; i++) {
        if (nav.data[i] && nav.data[i].navigationId) { navId = nav.data[i].navigationId; break; }
    }
    if (!navId) return [];
    const res = await getJson(HOST + "/api.php/Appfox/nav_video?id=" + navId, 10000);
    if (!res || !res.data) return [];
    const list = [];
    const seen = {};
    for (let i = 0; i < res.data.length; i++) {
        const block = res.data[i] || {};
        const banner = block.banner || [];
        const cats = block.categories || [];
        for (let b = 0; b < banner.length; b++) {
            const v = mapVod(banner[b]);
            if (v && !seen[v.vod_id]) { seen[v.vod_id] = true; list.push(v); }
        }
        for (let c = 0; c < cats.length; c++) {
            const videos = cats[c].videos || [];
            for (let k = 0; k < videos.length; k++) {
                const v = mapVod(videos[k]);
                if (v && !seen[v.vod_id]) { seen[v.vod_id] = true; list.push(v); }
            }
        }
    }
    return list;
}

async function init(ext) {
    await ensureHost(ext);
    await ensureConfig();
    if (!PLAY_CONFIG || !PLAY_CONFIG.playerList.length) {
        if (await refreshHost()) await ensureConfig();
    }
    console.log("[快映] 初始化完成，解析器:", Object.keys(PARSES).length);
}

async function home(filter) {
    await ensureHost();
    let data = await getJson(HOST + "/api.php/Appfox/init", 10000);
    if (!data) {
        await refreshHost();
        data = await getJson(HOST + "/api.php/Appfox/init", 10000);
    }
    let classes = [];
    if (data && data.data && data.data.type_list) classes = buildClasses(data.data.type_list);
    let list = [];
    try { list = await navList(); } catch (e) { list = []; }
    return JSON.stringify({ class: classes, filters: {}, list: list });
}

async function homeVod() {
    await ensureHost();
    let list = [];
    try { list = await navList(); } catch (e) { list = []; }
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    await ensureHost();
    pg = parseInt(pg || 1, 10) || 1;
    const url = HOST + "/api.php/Appfox/vodList?type_id=" + encodeURIComponent(String(tid))
        + "&class=全部&area=全部&lang=全部&year=全部&sort=最新&page=" + pg;
    const data = await getJson(url, 15000);
    const rows = data && data.data && data.data.recommend_list ? data.data.recommend_list : [];
    const list = [];
    for (let i = 0; i < rows.length; i++) {
        const v = mapVod(rows[i]);
        if (v) list.push(v);
    }
    let total = data && data.data ? parseInt(data.data.total || data.data.count || 0, 10) : 0;
    let pagecount = pg;
    if (list.length >= 30) {
        pagecount = total > 0 ? Math.ceil(total / 30) : pg + 1;
        if (pagecount < pg) pagecount = pg;
    }
    return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 30, total: total || list.length });
}

async function search(key, quick, pg) {
    await ensureHost();
    const url = HOST + "/api.php/Appfox/vod?ac=detail&wd=" + encodeURIComponent(key);
    const data = await getJson(url, 15000);
    const rows = (data && data.list) || [];
    const list = [];
    for (let i = 0; i < rows.length; i++) {
        const v = mapVod(rows[i]);
        if (v) list.push(v);
        if (rows[i] && rows[i].vod_id !== undefined) detailCache[String(rows[i].vod_id)] = rows[i];
    }
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: 30, total: list.length });
}

function splitFirst(str, sep) {
    const i = str.indexOf(sep);
    if (i < 0) return [str, ""];
    return [str.substring(0, i), str.substring(i + sep.length)];
}

async function detail(id) {
    await ensureHost();
    await ensureConfig();
    const vid = String(Array.isArray(id) ? id[0] : id);
    let video = detailCache[vid];
    if (!video) {
        const data = await getJson(HOST + "/api.php/Appfox/vod?ac=detail&ids=" + encodeURIComponent(vid), 15000);
        if (data && data.list && data.list.length) video = data.list[0];
    }
    if (!video) return JSON.stringify({ list: [] });

    const froms = String(video.vod_play_from || "").split("$$$");
    const urls = String(video.vod_play_url || "").split("$$$");

    const playerMap = {};
    const plist = PLAY_CONFIG.playerList || [];
    for (let i = 0; i < plist.length; i++) {
        const code = String(plist[i].playerCode || "");
        if (code) playerMap[code] = plist[i];
    }

    const newFroms = [];
    const newUrls = [];
    for (let i = 0; i < froms.length; i++) {
        const code = froms[i];
        let name = code;
        if (playerMap[code]) {
            const p = playerMap[code];
            if (String(p.playerCode) !== String(p.playerName)) name = String(p.playerName) + "\u2005(" + code + ")";
        }
        newFroms.push(name);
        if (i < urls.length) {
            const eps = urls[i].split("#");
            const out = [];
            for (let j = 0; j < eps.length; j++) {
                const ep = eps[j];
                const di = ep.indexOf("$");
                if (di >= 0) out.push(ep.substring(0, di + 1) + code + "@" + ep.substring(di + 1));
                else out.push(ep);
            }
            newUrls.push(out.join("#"));
        } else {
            newUrls.push("");
        }
    }

    const vod = mapVod(video);
    vod.vod_play_from = newFroms.join("$$$");
    vod.vod_play_url = newUrls.join("$$$");
    return JSON.stringify({ list: [vod] });
}

function isDirect(u) {
    return /^https?:\/\/.*\.(m3u8|mp4|flv|mkv)(\?|$)/i.test(u);
}

function isVideoUrl(u) {
    return /^https?:\/\/.*\.(m3u8|mp4|flv|mkv)/i.test(u);
}

async function play(flag, id, flags) {
    await ensureHost();
    await ensureConfig();
    let raw = String(id || "");
    let playFrom = "";
    const at = raw.indexOf("@");
    if (at >= 0) {
        playFrom = raw.substring(0, at);
        raw = raw.substring(at + 1);
    } else {
        playFrom = String(flag || "");
    }

    let url = raw;
    let jx = 0, parse = 0, parsed = 0;
    if (isDirect(url)) {
        return JSON.stringify({ jx: 0, parse: 0, url: url, header: { "User-Agent": PLAYER_UA } });
    }

    const keys = Object.keys(PARSES);
    for (let i = 0; i < keys.length && !parsed; i++) {
        const key = keys[i];
        if (playFrom && key.indexOf(playFrom) < 0 && playFrom.indexOf(key) < 0) continue;
        url = raw;
        const parser = PARSES[key];
        if (isVideoUrl(parser)) {
            // 解析器本身是直链前缀，交给壳拼装/嗅探
            url = parser + raw;
            parse = 1;
        } else {
            const res = await getJson(parser + raw, 8000);
            if (res && typeof res.url === "string" && res.url.indexOf("http") === 0) {
                url = res.url;
                parsed = 1;
                parse = 0;
            } else {
                url = raw;
            }
        }
    }

    if (!isVideoUrl(url) && !parsed && parse === 0) jx = 1;
    return JSON.stringify({ jx: jx, parse: parse, url: url, header: { "User-Agent": PLAYER_UA } });
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
