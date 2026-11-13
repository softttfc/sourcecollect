
// 哔哩影视 (api.bilibili.com 官方API) - 琉芸JS 版
const appConfig = {
    siteName: "哔哩影视[官]",
    apiUrl: "https://api.bilibili.com",
    cookie: ""
};
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.startsWith(DESC_PREFIX)) return s;
    return DESC_PREFIX + s;
}

async function init(ext) {
    // ext 可传入B站Cookie字符串 (bili_jct/DedeUserID/SESSDATA), 提升搜索可用性与清晰度
    if (ext) {
        appConfig.cookie = typeof ext === "string" ? ext : (ext.cookie || "");
    }
    console.log("初始化爬虫:", appConfig.siteName);
}

const classList = [
    { type_id: "3", type_name: "芸制" },
    { type_id: "2", type_name: "电影" },
    { type_id: "5", type_name: "电视剧" },
    { type_id: "7", type_name: "综艺" },
    { type_id: "4", type_name: "国创" }
];

function getHeaders() {
    const h = {
        "User-Agent": UA,
        "Referer": "https://www.bilibili.com"
    };
    if (appConfig.cookie) h["Cookie"] = appConfig.cookie;
    return h;
}

async function fetchJson(url) {
    const res = await req(url, {
        method: "GET",
        headers: getHeaders(),
        timeout: 20000
    });
    return JSON.parse(res.content);
}

function mapRankItem(vod) {
    return {
        vod_id: String(vod.season_id).trim(),
        vod_name: (vod.title || "").trim(),
        vod_pic: (vod.cover || "").trim(),
        vod_remarks: vod.new_ep ? vod.new_ep.index_show : (vod.index_show || "")
    };
}

// 番剧热播榜
async function getRank(tid, pg) {
    const jo = await fetchJson(`${appConfig.apiUrl}/pgc/web/rank/list?season_type=${tid}&pagesize=20&page=${pg}&day=3`);
    if (jo.code !== 0) return [];
    const list = jo.result ? jo.result.list : jo.data.list;
    return (list || []).map(mapRankItem);
}

// 其他分类热播榜
async function getRank2(tid, pg) {
    const jo = await fetchJson(`${appConfig.apiUrl}/pgc/season/rank/web/list?season_type=${tid}&pagesize=20&page=${pg}&day=3`);
    if (jo.code !== 0) return [];
    const list = jo.result ? jo.result.list : jo.data.list;
    return (list || []).map(mapRankItem);
}

async function home(filter) {
    let list = [];
    try {
        // 番剧榜前5 + 国创/电影/电视剧/纪录片/综艺各前5
        const first = await getRank(1, 1).catch(() => []);
        list = list.concat(first.slice(0, 5));
        const others = await Promise.all([4, 2, 5, 3, 7].map(tid => getRank2(tid, 1).catch(() => [])));
        others.forEach(v => { list = list.concat(v.slice(0, 5)); });
    } catch (e) {
        console.error("首页推荐获取失败:", e.message);
    }

    return JSON.stringify({
        class: classList,
        filters: {},
        list: list
    });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    try {
        const list = await getRank2(tid, pg);
        return JSON.stringify({
            list: list,
            page: 1,
            pagecount: 1,
            limit: list.length,
            total: list.length
        });
    } catch (e) {
        console.error("分类列表获取失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function search(wd, quick, page) {
    page = page || 1;
    try {
        const base = `${appConfig.apiUrl}/x/web-interface/search/type?keyword=${encodeURIComponent(wd)}&page=${page}&search_type=`;
        const jo1 = await fetchJson(base + "media_bangumi");
        if (String(jo1.message) !== "0" && jo1.message !== undefined && !jo1.data) {
            // 风控拦截(缺Cookie)时返回空
            console.error("搜索被风控拦截, 请在ext中配置bili_cookie");
            return JSON.stringify({ list: [], pagecount: 0 });
        }
        const jo2 = await fetchJson(base + "media_ft").catch(() => null);
        const d1 = jo1.data || {};
        const d2 = (jo2 && jo2.data) || {};
        let vodList = [];
        if ((d1.numResults || 0) === 0) vodList = d2.result || [];
        else if ((d2.numResults || 0) === 0) vodList = d1.result || [];
        else vodList = (d1.result || []).concat(d2.result || []);

        const list = vodList.filter(v => v.season_id).map(v => ({
            vod_id: String(v.season_id).trim(),
            vod_name: (v.title || "").replace(/<[^>]+>/g, "").trim(),
            vod_pic: (v.cover || "").trim(),
            vod_remarks: v.index_show || ""
        }));
        return JSON.stringify({
            list: list,
            page: page,
            pagecount: list.length > 0 ? page + 1 : page
        });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

function zh(num) {
    num = Number(num) || 0;
    if (num > 1e8) return (num / 1e8).toFixed(2) + "亿";
    if (num > 1e4) return (num / 1e4).toFixed(2) + "万";
    return String(num);
}

async function detail(id) {
    try {
        const jo = (await fetchJson(`${appConfig.apiUrl}/pgc/view/web/season?season_id=${encodeURIComponent(String(id))}`)).result;
        if (!jo) return JSON.stringify({ list: [] });

        const stat = jo.stat || {};
        const status = "弹幕: " + zh(stat.danmakus) + "　点赞: " + zh(stat.likes) + "　投币: " + zh(stat.coins) + "　追番追剧: " + zh(stat.favorites);
        const score = jo.rating ? ("评分: " + jo.rating.score + "　" + (jo.subtitle || "")) : ("暂无评分" + "　" + (jo.subtitle || ""));

        let playurls1 = []; // B站: eid_cid (内置playurl, 带弹幕)
        let playurls2 = []; // 琉芸: 官方页面链接 (走外部解析)
        (jo.episodes || []).forEach(ep => {
            const part = String(ep.title || "").replace("#", "-") + " " + (ep.long_title || "");
            playurls1.push(part + "$" + ep.id + "_" + ep.cid);
            playurls2.push(part + "$" + ep.link);
        });

        return JSON.stringify({
            list: [{
                vod_id: String(jo.season_id),
                vod_name: jo.title || "",
                vod_pic: jo.cover || "",
                type_name: jo.share_sub_title || "",
                vod_year: (jo.publish && jo.publish.pub_time || "").substr(0, 4),
                vod_area: (jo.areas && jo.areas[0] && jo.areas[0].name) || "",
                vod_remarks: (jo.new_ep && jo.new_ep.desc) || "",
                vod_actor: status,
                vod_director: score,
                vod_content: withPrefix(jo.evaluate || ""),
                vod_play_from: "B站$$$琉芸",
                vod_play_url: playurls1.join("#") + "$$$" + playurls2.join("#")
            }]
        });
    } catch (error) {
        console.error(`解析详情异常 [ID: ${id}]:`, error);
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        id = String(id || "");

        // 琉芸线路: 官方页面链接, 走外部全局解析
        if (/^http/.test(id)) {
            return JSON.stringify({
                jx: 1,
                parse: 0,
                url: id,
                header: { "User-Agent": UA, "Referer": "https://www.bilibili.com" }
            });
        }

        // B站线路: eid_cid 内置playurl取流, 附弹幕
        const ids = id.split("_");
        const eid = ids[0];
        const cid = ids[1];
        const danmaku = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
        const fallbackUrl = `https://www.bilibili.com/bangumi/play/ep${eid}`;

        try {
            const jRoot = await fetchJson(`${appConfig.apiUrl}/pgc/player/web/playurl?qn=116&ep_id=${eid}&cid=${cid}`);
            if (jRoot.message === "success" && jRoot.result && jRoot.result.durl) {
                const durl = jRoot.result.durl;
                let maxSize = -1, position = 0;
                durl.forEach((d, i) => {
                    if (maxSize < Number(d.size)) { maxSize = Number(d.size); position = i; }
                });
                const playUrl = durl[position].url;
                if (playUrl) {
                    return JSON.stringify({
                        parse: 0,
                        playUrl: "",
                        url: playUrl,
                        header: { "Referer": "https://www.bilibili.com", "User-Agent": UA },
                        contentType: "video/x-flv",
                        danmaku: danmaku
                    });
                }
            }
            console.error("playurl获取失败(可能需大会员):", jRoot.message);
        } catch (e) {
            console.error("playurl请求异常:", e.message);
        }

        // 内置取流失败, 回退外部解析官方播放页
        return JSON.stringify({
            jx: 1,
            parse: 0,
            url: fallbackUrl,
            header: { "User-Agent": UA, "Referer": "https://www.bilibili.com" }
        });
    } catch (e) {
        console.error("播放失败:", e);
        return JSON.stringify({ parse: 0, url: "" });
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
