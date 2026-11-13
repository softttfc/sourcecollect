
// 360影视 (api.web.360kan.com 官方API) - 琉芸JS 版
const appConfig = {
    siteName: "360影视",
    siteUrl: "https://www.360kan.com",
    apiUrl: "https://api.web.360kan.com",
    soUrl: "https://api.so.360kan.com"
};
const UA = "Mozilla/5.0 (Linux; Android 10; M2012K11AC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
function withPrefix(s) {
    s = s || "";
    if (!s || s.startsWith(DESC_PREFIX)) return s;
    return DESC_PREFIX + s;
}

async function init(ext) {
    console.log("初始化爬虫:", appConfig.siteName);
}

const classList = [
    { type_id: "2", type_name: "电视剧" },
    { type_id: "1", type_name: "电影" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" }
];

const rankFilter = {
    "key": "rank", "name": "排序", "value": [
        { "n": "最近热门", "v": "rankhot" },
        { "n": "最近上映", "v": "ranklatest" }
    ]
};
const myFilters = {};
classList.forEach(item => {
    myFilters[item.type_id] = [rankFilter];
});

function getHeaders() {
    return { "User-Agent": UA };
}

function fixUrl(u) {
    if (!u) return '';
    if (u.startsWith('//')) return 'https:' + u;
    return u;
}

async function fetchJson(url) {
    const res = await req(url, {
        method: "GET",
        headers: getHeaders(),
        timeout: 20000
    });
    return JSON.parse(res.content);
}

// vod_id 统一格式: cat@id
function makeId(cat, id) {
    return cat + "@" + id;
}
function splitId(vodId) {
    vodId = String(vodId || "");
    const idx = vodId.indexOf("@");
    if (idx < 0) return { cat: "2", id: vodId };
    return { cat: vodId.slice(0, idx), id: vodId.slice(idx + 1) };
}

async function home(filter) {
    let list = [];
    try {
        // 四个分类各取热榜前9条合并作为推荐
        const cats = ["2", "1", "3", "4"];
        const results = await Promise.all(cats.map(cat =>
            fetchJson(`${appConfig.apiUrl}/v1/rank?cat=${cat}&size=9`).catch(() => null)
        ));
        let seen = {};
        results.forEach((data, i) => {
            if (!data || !data.data) return;
            data.data.forEach(item => {
                const vod_id = makeId(item.cat || cats[i], item.ent_id);
                if (seen[vod_id]) return;
                seen[vod_id] = true;
                list.push({
                    vod_id: vod_id,
                    vod_name: item.title || "",
                    vod_pic: fixUrl(item.cover || ""),
                    vod_remarks: item.comment || ""
                });
            });
        });
    } catch (e) {
        console.error("首页推荐获取失败:", e.message);
    }

    return JSON.stringify({
        class: classList,
        filters: myFilters,
        list: list.slice(0, 30)
    });
}

async function category(tid, pg, filter, extend) {
    pg = pg || 1;
    extend = extend || {};
    const rank = extend.rank || "rankhot";
    try {
        const url = `${appConfig.apiUrl}/v1/filter/list?catid=${tid}&rank=${rank}&cat=&year=&area=&act=&size=35&pageno=${pg}&callback=`;
        const data = await fetchJson(url);
        let list = [];
        const movies = (data.data && data.data.movies) || [];
        movies.forEach(item => {
            list.push({
                vod_id: makeId(tid, item.id),
                vod_name: item.title || "",
                vod_pic: fixUrl(item.cover || ""),
                vod_remarks: item.pubdate || ""
            });
        });
        return JSON.stringify({
            list: list,
            page: pg,
            pagecount: list.length >= 35 ? pg + 1 : pg,
            limit: 35,
            total: 9999
        });
    } catch (e) {
        console.error("分类列表获取失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function search(wd, quick, page) {
    page = page || 1;
    try {
        const url = `${appConfig.soUrl}/index?force_v=1&kw=${encodeURIComponent(wd)}&from=&pageno=${page}&v_ap=1&tab=all`;
        const data = await fetchJson(url);
        let list = [];
        const rows = (data.data && data.data.longData && data.data.longData.rows) || [];
        rows.forEach(item => {
            if (!item.cat_id || !item.en_id) return;
            list.push({
                vod_id: makeId(item.cat_id, item.en_id),
                vod_name: item.titleTxt || item.titlealias || "",
                vod_pic: fixUrl(item.cover || ""),
                vod_remarks: item.cat_name || ""
            });
        });
        return JSON.stringify({ list: list, page: page, pagecount: list.length > 0 ? page + 1 : page });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], pagecount: 0 });
    }
}

async function detail(vodId) {
    try {
        const { cat, id } = splitId(vodId);
        const detailUrl = `${appConfig.apiUrl}/v1/detail?cat=${cat}&id=${id}`;
        const html = await fetchJson(detailUrl);
        const data = html.data || {};

        const vod_name = data.title || "";
        const vod_pic = data.cdncover || "";
        const vod_class = (data.moviecategory || []).join(",");
        const vod_area = (data.area || []).join(",");
        const vod_director = (data.director || []).join(",");
        const vod_actor = (data.actor || []).join(",");
        const vod_content = data.description || "";

        let lines = [];
        let playlists = [];
        const sites = data.playlink_sites || [];
        const delta = 200;

        for (const site of sites) {
            let vodItems = [];
            if (data.allupinfo && data.allupinfo[site]) {
                // 剧集类: 分段拉取全集
                const total = parseInt(data.allupinfo[site]);
                for (let j = 1; j < total; j += delta) {
                    const end = Math.min(total, j + delta - 1);
                    const url2 = `${detailUrl}&start=${j}&end=${end}&site=${site}`;
                    try {
                        const epJson = await fetchJson(url2);
                        const epData = epJson.data || {};
                        if (epData.allepidetail && epData.allepidetail[site]) {
                            epData.allepidetail[site].forEach(item => {
                                vodItems.push((item.playlink_num || "") + "$" + (item.url || ""));
                            });
                        } else if (epData.defaultepisode) {
                            epData.defaultepisode.forEach(item => {
                                vodItems.push(((item.period || "") + (item.name || "")) + "$" + (item.url || ""));
                            });
                        }
                    } catch (e) {
                        console.error(`拉取剧集失败 [${site} ${j}-${end}]:`, e.message);
                    }
                }
            } else if (data.playlinksdetail && data.playlinksdetail[site]) {
                // 单片类
                const item = data.playlinksdetail[site];
                vodItems.push((item.sort || "正片") + "$" + (item.default_url || ""));
            }
            if (vodItems.length > 0) {
                lines.push(site);
                playlists.push(vodItems);
            }
        }

        if (lines.length === 0) {
            lines.push("默认");
            playlists.push([`暂无播放地址$${appConfig.siteUrl}`]);
        }

        const { vod_play_from, vod_play_url } = buildVodPlayData(lines, playlists);

        return JSON.stringify({
            list: [{
                vod_id: vodId,
                vod_name,
                vod_pic,
                vod_actor,
                vod_director,
                vod_remarks: vod_area,
                vod_area,
                vod_content: withPrefix(vod_content),
                vod_class,
                vod_play_from,
                vod_play_url
            }]
        });
    } catch (error) {
        console.error(`解析详情异常 [ID: ${vodId}]:`, error);
        return JSON.stringify({ list: [] });
    }
}

function buildVodPlayData(lines, playlists) {
    const processedPlaylists = playlists.map(eps => eps.join('#'));
    return {
        vod_play_from: lines.filter(Boolean).join('$$$'),
        vod_play_url: processedPlaylists.join('$$$')
    };
}

async function play(flag, id, flags) {
    try {
        // 原版 lazy: 去掉url参数后交给壳嗅探
        const url = String(id || "").split("?")[0];
        return JSON.stringify({
            parse: 1,
            header: { "User-Agent": UA },
            url: url
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
