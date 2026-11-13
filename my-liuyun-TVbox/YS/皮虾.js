// ================== 皮皮虾 · TVBox QuickJS ==================
// 源：pixia.py（Appto v5 接口）
// 接口：/apptov5/v1/config/get、/home/data、/vod/lists、/search/lists、/vod/getVod、/parsing/proxy
// 播放：线路 from@加密串，按 config 的解析标签逐个 POST /parsing/proxy 换直链，失败交壳
// ==========================================================

// 原 ext 已内置，配置可只写 api
const DEFAULT_HOST = "http://154.94.224.56:8762";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJkYXRhIjp7InVzZXJfY2hlY2siOiI4ZTEyNDE1Y2UyOGQzMGM4MWE3MDBiNWYxMDgzZTU2OCIsInVzZXJfaWQiOjM0NTYsInVzZXJfbmFtZSI6IjEwMTAxMiJ9LCJleHAiOjE4MDQ3MzkyODAuNjA4MTA4MywiaWF0IjoxNzczMjAzMjgxLCJpc3MiOiJBcHBUbyIsImp0aSI6ImZmZDMyYjk4N2VkMTg1ZjNiNGQ5Zjc5NzU2YWRjNGQ5IiwibmJmIjoxNzczMjAzMjgxLCJzdWIiOiJBcHBUbyJ9.tDhURwWVzsPy0-yXvo_d3bgsmoq9Ri5n0Y4fQsvxKy0";
const UA_APP = "Dart/2.19 (dart:io)";
const PLAYER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";

const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.indexOf(DESC_PREFIX) === 0) return s;
    return DESC_PREFIX + s;
}

let HOST = "";
let CONFIG = null;
let PARSING = {};
let detailCache = {};

function uuid4() {
    const hex = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
        else if (i === 14) out += "4";
        else if (i === 19) out += hex.charAt(8 + Math.floor(Math.random() * 4));
        else out += hex.charAt(Math.floor(Math.random() * 16));
    }
    return out;
}
const LOCAL_UUID = uuid4();

function headers() {
    return {
        "User-Agent": UA_APP,
        "appto-local-uuid": LOCAL_UUID,
        "token": TOKEN,
        "Accept": "application/json",
        "Accept-Encoding": "identity"
    };
}

function trimHost(h) {
    h = String(h || "").trim().replace(/^`+/, "").replace(/`+$/, "");
    while (h.length > 1 && h.charAt(h.length - 1) === "/") h = h.substring(0, h.length - 1);
    return h;
}

async function fetchText(url, opt) {
    try {
        const res = await req(url, opt || { method: "GET", headers: headers(), timeout: 12000 });
        if (!res || res.code !== 200) return "";
        return String(res.content || "");
    } catch (e) {
        return "";
    }
}

async function getJson(url, timeout) {
    const txt = await fetchText(url, { method: "GET", headers: headers(), timeout: timeout || 12000 });
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
}

async function postForm(url, payload, timeout) {
    const parts = [];
    for (const k in payload) {
        if (!payload.hasOwnProperty(k)) continue;
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(payload[k]));
    }
    const h = headers();
    h["Content-Type"] = "application/x-www-form-urlencoded";
    const txt = await fetchText(url, { method: "POST", headers: h, data: parts.join("&"), timeout: timeout || 12000 });
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { return null; }
}

async function ensureHost(ext) {
    if (HOST) return HOST;
    let src = "";
    if (ext && typeof ext === "object") {
        src = String(ext.host || ext.apiDomain || "");
    } else {
        src = String(ext || "").replace(/^`+/, "").replace(/`+$/, "").trim();
    }
    let host = "";
    if (!src) {
        host = DEFAULT_HOST;
    } else if (!/^https?:\/\//.test(src)) {
        host = "";
    } else if (/^https?:\/\/[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(\:\d+)?\/?$/.test(src)) {
        host = src;
    } else {
        // 非标准域名格式 → 当作返回 domain 的配置地址
        const t = await fetchText(src, { method: "GET", headers: headers(), timeout: 9000 });
        if (t) {
            try {
                const obj = JSON.parse(t);
                host = obj.domain || obj.host || obj.apiDomain || "";
            } catch (e) {
                host = t.trim();
            }
        }
    }
    host = trimHost(host);
    HOST = (/^https?:\/\//.test(host) ? host : DEFAULT_HOST);
    console.log("[皮皮虾] host:", HOST);
    return HOST;
}

async function ensureConfig() {
    if (CONFIG && PARSING && Object.keys(PARSING).length) return CONFIG;
    const data = await getJson(HOST + "/apptov5/v1/config/get?p=android&__platform=android", 15000);
    if (!data || !data.data) {
        CONFIG = { cate: [], parsing: {} };
        return CONFIG;
    }
    const cfg = data.data;
    const cate = [];
    const hc = cfg.get_home_cate || [];
    for (let i = 0; i < hc.length; i++) {
        const item = hc[i];
        const ext = item.extend;
        const isDict = ext && typeof ext === "object" && Object.prototype.toString.call(ext) !== "[object Array]";
        if (isDict) cate.push({ type_id: String(item.cate), type_name: String(item.title || "") });
    }
    PARSING = {};
    const lists = (cfg.get_parsing && cfg.get_parsing.lists) || [];
    for (let i = 0; i < lists.length; i++) {
        const key = String(lists[i].key || "");
        const labels = [];
        const items = lists[i].config || [];
        for (let j = 0; j < items.length; j++) {
            if (items[j].type === "json" && items[j].label) labels.push(items[j].label);
        }
        if (key && labels.length) PARSING[key] = labels;
    }
    CONFIG = { cate: cate, parsing: PARSING };
    return CONFIG;
}

function mapVod(v) {
    if (!v || typeof v !== "object") return null;
    const id = v.vod_id === undefined || v.vod_id === null ? "" : String(v.vod_id);
    if (!id || id === "undefined") return null;
    let pic = String(v.vod_pic || "");
    if (pic.indexOf("mac://") === 0) pic = "http://" + pic.substring(6);
    return {
        vod_id: id,
        vod_name: String(v.vod_name || ""),
        vod_pic: pic,
        vod_remarks: String(v.vod_remarks || ""),
        vod_year: String(v.vod_year || ""),
        vod_area: String(v.vod_area || ""),
        vod_actor: String(v.vod_actor || ""),
        vod_director: String(v.vod_director || ""),
        vod_content: withPrefix(String(v.vod_content || v.vod_blurb || ""))
    };
}

async function init(ext) {
    await ensureHost(ext);
    await ensureConfig();
    console.log("[皮皮虾] 初始化完成，分类:", CONFIG.cate.length, "解析线路:", Object.keys(PARSING).length);
}

async function home(filter) {
    await ensureHost();
    await ensureConfig();
    const classes = CONFIG.cate;
    let list = [];
    const data = await getJson(HOST + "/apptov5/v1/home/data?id=1&mold=1&__platform=android", 15000);
    const sections = (data && data.data && data.data.sections) || [];
    const seen = {};
    for (let i = 0; i < sections.length; i++) {
        const items = sections[i].items || [];
        for (let k = 0; k < items.length; k++) {
            const v = mapVod(items[k]);
            if (v && !seen[v.vod_id]) { seen[v.vod_id] = true; list.push(v); }
        }
    }
    return JSON.stringify({ class: classes, filters: {}, list: list });
}

async function homeVod() {
    await ensureHost();
    const data = await getJson(HOST + "/apptov5/v1/home/data?id=1&mold=1&__platform=android", 15000);
    const sections = (data && data.data && data.data.sections) || [];
    const list = [];
    const seen = {};
    for (let i = 0; i < sections.length; i++) {
        const items = sections[i].items || [];
        for (let k = 0; k < items.length; k++) {
            const v = mapVod(items[k]);
            if (v && !seen[v.vod_id]) { seen[v.vod_id] = true; list.push(v); }
        }
    }
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    await ensureHost();
    pg = parseInt(pg || 1, 10) || 1;
    extend = extend || {};
    const area = encodeURIComponent(extend.area || "");
    const lang = encodeURIComponent(extend.lang || "");
    const year = encodeURIComponent(extend.year || "");
    const order = encodeURIComponent(extend.sort || "time");
    const url = HOST + "/apptov5/v1/vod/lists?area=" + area + "&lang=" + lang + "&year=" + year
        + "&order=" + order + "&type_id=" + encodeURIComponent(String(tid)) + "&type_name=&page=" + pg
        + "&pageSize=21&__platform=android";
    const data = await getJson(url, 15000);
    const rows = (data && data.data && data.data.data) || [];
    const total = (data && data.data && parseInt(data.data.total || 0, 10)) || 0;
    const list = [];
    for (let i = 0; i < rows.length; i++) {
        const v = mapVod(rows[i]);
        if (v) list.push(v);
    }
    const pagecount = total > 0 ? Math.ceil(total / 21) : (list.length >= 21 ? pg + 1 : pg);
    return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 21, total: total || list.length });
}

async function search(key, quick, pg) {
    await ensureHost();
    pg = parseInt(pg || 1, 10) || 1;
    const url = HOST + "/apptov5/v1/search/lists?wd=" + encodeURIComponent(key) + "&page=" + pg + "&type=&__platform=android";
    const data = await getJson(url, 15000);
    const rows = (data && data.data && data.data.data) || [];
    const total = (data && data.data && parseInt(data.data.total || 0, 10)) || 0;
    const list = [];
    for (let i = 0; i < rows.length; i++) {
        const v = mapVod(rows[i]);
        if (v) list.push(v);
        if (rows[i] && rows[i].vod_id !== undefined) detailCache[String(rows[i].vod_id)] = rows[i];
    }
    const pagecount = total > 0 ? Math.ceil(total / 21) : pg;
    return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 21, total: total || list.length });
}

async function detail(id) {
    await ensureHost();
    await ensureConfig();
    const vid = String(Array.isArray(id) ? id[0] : id);
    const data = await getJson(HOST + "/apptov5/v1/vod/getVod?id=" + encodeURIComponent(vid), 15000);
    const d = data && data.data;
    if (!d) return JSON.stringify({ list: [] });

    const froms = [];
    const urls = [];
    const playList = d.vod_play_list || [];
    for (let i = 0; i < playList.length; i++) {
        const eps = playList[i].urls || [];
        const info = playList[i].player_info || {};
        const from = String(info.from || "");
        const show = String(info.show || from);
        const parts = [];
        for (let j = 0; j < eps.length; j++) {
            parts.push(String(eps[j].name || ("第" + (j + 1) + "集")) + "$" + from + "@" + String(eps[j].url || ""));
        }
        froms.push(show);
        urls.push(parts.join("#"));
    }

    const vod = {
        vod_id: String(d.vod_id || vid),
        vod_name: String(d.vod_name || ""),
        vod_pic: "",
        vod_remarks: String(d.vod_remarks || ""),
        vod_director: String(d.vod_director || ""),
        vod_actor: String(d.vod_actor || ""),
        vod_year: String(d.vod_year || ""),
        vod_area: String(d.vod_area || ""),
        vod_content: withPrefix(String(d.vod_content || "")),
        vod_play_from: froms.join("$$$"),
        vod_play_url: urls.join("$$$")
    };
    return JSON.stringify({ list: [vod] });
}

async function play(flag, id, flags) {
    await ensureHost();
    await ensureConfig();
    const raw = String(id || "");
    const parts = raw.split("@");
    if (parts.length !== 2) {
        return JSON.stringify({ parse: 0, url: raw, header: { "User-Agent": PLAYER_UA } });
    }
    const playFrom = parts[0];
    const rawUrl = parts[1];
    const labels = PARSING[playFrom];
    if (!labels || !labels.length) {
        return JSON.stringify({ parse: 0, url: rawUrl, header: { "User-Agent": PLAYER_UA } });
    }
    for (let i = 0; i < labels.length; i++) {
        const data = await postForm(HOST + "/apptov5/v1/parsing/proxy?__platform=android", {
            play_url: rawUrl,
            label: labels[i],
            key: playFrom
        }, 12000);
        if (!data || data.code === 422) continue;
        if (!data.data || !data.data.url) continue;
        const ua = data.data.UA || data.data.UserAgent || PLAYER_UA;
        return JSON.stringify({ parse: 0, url: String(data.data.url), header: { "User-Agent": ua } });
    }
    return JSON.stringify({ parse: 1, url: rawUrl, header: { "User-Agent": PLAYER_UA } });
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
