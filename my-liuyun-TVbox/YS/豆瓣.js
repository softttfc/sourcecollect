// 豆瓣[官] TVBox QuickJS 爬虫（由 drpy 规则 豆瓣[官].js 转换）
// 保留原样：豆瓣小程序开放接口，纯榜单/筛选浏览源，无详情无解析（msearch 协议点击聚合搜索）
// 说明：原规则 js 内嵌的 api.douban.com 已失效（403），改用其 host 字段指向的 frodo.douban.com（实测可用）
const API_HOST = "https://frodo.douban.com/api/v2";
const APIKEY = "0ac44ae016490db2204ce0a042db2916";
const COUNT = 30;
const TIMEOUT = 5000;
const HEADERS = {
    "Connection": "Keep-Alive",
    "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html",
    "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat"
};
// 豆瓣图床防盗链：部分 TVBox 构建支持 vod_pic 后缀携带请求头
const PIC_SUFFIX = "@Referer=https://api.douban.com/@User-Agent=Mozilla/5.0%20(Windows%20NT%2010.0;%20Win64;%20x64)%20AppleWebKit/537.36%20(KHTML,%20like%20Gecko)%20Chrome/113.0.0.0%20Safari/537.36";

const classes = [
    { type_id: "rank_list_movie", type_name: "魔盒首页" },
    { type_id: "hot_gaia", type_name: "热门电影" },
    { type_id: "tv_hot", type_name: "热播剧集" },
    { type_id: "show_hot", type_name: "热播综艺" },
    { type_id: "rank_list_tv", type_name: "电视榜单" }
];

const filters = {'interests': [{'key': 'status', 'name': '状态', 'value': [{'n': '想看', 'v': 'mark'}, {'n': '在看', 'v': 'doing'}, {'n': '看过', 'v': 'done'}]}, {'key': 'subtype_tag', 'name': '形式', 'value': [{'n': '全部', 'v': ''}, {'n': '电影', 'v': 'movie'}, {'n': '电视', 'v': 'tv'}]}, {'key': 'year_tag', 'name': '年代', 'value': [{'n': '全部', 'v': '全部'}, {'n': '2025', 'v': '2025'}, {'n': '2024', 'v': '2024'}, {'n': '2023', 'v': '2023'}, {'n': '2022', 'v': '2022'}, {'n': '2021', 'v': '2021'}, {'n': '2020', 'v': '2020'}, {'n': '2019', 'v': '2019'}, {'n': '2010年代', 'v': '2010年代'}, {'n': '2000年代', 'v': '2000年代'}, {'n': '90年代', 'v': '90年代'}, {'n': '80年代', 'v': '80年代'}, {'n': '70年代', 'v': '70年代'}, {'n': '60年代', 'v': '60年代'}, {'n': '更早', 'v': '更早'}]}], 'hot_gaia': [{'key': 'sort', 'name': '排序', 'value': [{'n': '热度', 'v': 'recommend'}, {'n': '最新', 'v': 'time'}, {'n': '评分', 'v': 'rank'}]}, {'key': 'area', 'name': '地区', 'value': [{'n': '全部', 'v': '全部'}, {'n': '华语', 'v': '华语'}, {'n': '欧美', 'v': '欧美'}, {'n': '韩国', 'v': '韩国'}, {'n': '日本', 'v': '日本'}]}], 'tv_hot': [{'key': 'type', 'name': '分类', 'value': [{'n': '综合', 'v': 'tv_hot'}, {'n': '国产剧', 'v': 'tv_domestic'}, {'n': '欧美剧', 'v': 'tv_american'}, {'n': '日剧', 'v': 'tv_japanese'}, {'n': '韩剧', 'v': 'tv_korean'}, {'n': '动画', 'v': 'tv_animation'}]}], 'show_hot': [{'key': 'type', 'name': '分类', 'value': [{'n': '综合', 'v': 'show_hot'}, {'n': '国内', 'v': 'show_domestic'}, {'n': '国外', 'v': 'show_foreign'}]}], 'movie': [{'key': '类型', 'name': '类型', 'value': [{'n': '全部类型', 'v': ''}, {'n': '喜剧', 'v': '喜剧'}, {'n': '爱情', 'v': '爱情'}, {'n': '动作', 'v': '动作'}, {'n': '科幻', 'v': '科幻'}, {'n': '动画', 'v': '动画'}, {'n': '悬疑', 'v': '悬疑'}, {'n': '犯罪', 'v': '犯罪'}, {'n': '惊悚', 'v': '惊悚'}, {'n': '冒险', 'v': '冒险'}, {'n': '音乐', 'v': '音乐'}, {'n': '历史', 'v': '历史'}, {'n': '奇幻', 'v': '奇幻'}, {'n': '恐怖', 'v': '恐怖'}, {'n': '战争', 'v': '战争'}, {'n': '传记', 'v': '传记'}, {'n': '歌舞', 'v': '歌舞'}, {'n': '武侠', 'v': '武侠'}, {'n': '情色', 'v': '情色'}, {'n': '灾难', 'v': '灾难'}, {'n': '西部', 'v': '西部'}, {'n': '纪录片', 'v': '纪录片'}, {'n': '短片', 'v': '短片'}]}, {'key': '地区', 'name': '地区', 'value': [{'n': '全部地区', 'v': ''}, {'n': '华语', 'v': '华语'}, {'n': '欧美', 'v': '欧美'}, {'n': '韩国', 'v': '韩国'}, {'n': '日本', 'v': '日本'}, {'n': '中国大陆', 'v': '中国大陆'}, {'n': '美国', 'v': '美国'}, {'n': '中国香港', 'v': '中国香港'}, {'n': '中国台湾', 'v': '中国台湾'}, {'n': '英国', 'v': '英国'}, {'n': '法国', 'v': '法国'}, {'n': '德国', 'v': '德国'}, {'n': '意大利', 'v': '意大利'}, {'n': '西班牙', 'v': '西班牙'}, {'n': '印度', 'v': '印度'}, {'n': '泰国', 'v': '泰国'}, {'n': '俄罗斯', 'v': '俄罗斯'}, {'n': '加拿大', 'v': '加拿大'}, {'n': '澳大利亚', 'v': '澳大利亚'}, {'n': '爱尔兰', 'v': '爱尔兰'}, {'n': '瑞典', 'v': '瑞典'}, {'n': '巴西', 'v': '巴西'}, {'n': '丹麦', 'v': '丹麦'}]}, {'key': 'sort', 'name': '排序', 'value': [{'n': '近期热度', 'v': 'T'}, {'n': '首映时间', 'v': 'R'}, {'n': '高分优先', 'v': 'S'}]}, {'key': '年代', 'name': '年代', 'value': [{'n': '全部年代', 'v': ''}, {'n': '2023', 'v': '2023'}, {'n': '2022', 'v': '2022'}, {'n': '2021', 'v': '2021'}, {'n': '2020', 'v': '2020'}, {'n': '2019', 'v': '2019'}, {'n': '2010年代', 'v': '2010年代'}, {'n': '2000年代', 'v': '2000年代'}, {'n': '90年代', 'v': '90年代'}, {'n': '80年代', 'v': '80年代'}, {'n': '70年代', 'v': '70年代'}, {'n': '60年代', 'v': '60年代'}, {'n': '更早', 'v': '更早'}]}], 'tv': [{'key': '类型', 'name': '类型', 'value': [{'n': '不限', 'v': ''}, {'n': '电视剧', 'v': '电视剧'}, {'n': '综艺', 'v': '综艺'}]}, {'key': '电视剧形式', 'name': '电视剧形式', 'value': [{'n': '不限', 'v': ''}, {'n': '喜剧', 'v': '喜剧'}, {'n': '爱情', 'v': '爱情'}, {'n': '悬疑', 'v': '悬疑'}, {'n': '动画', 'v': '动画'}, {'n': '武侠', 'v': '武侠'}, {'n': '古装', 'v': '古装'}, {'n': '家庭', 'v': '家庭'}, {'n': '犯罪', 'v': '犯罪'}, {'n': '科幻', 'v': '科幻'}, {'n': '恐怖', 'v': '恐怖'}, {'n': '历史', 'v': '历史'}, {'n': '战争', 'v': '战争'}, {'n': '动作', 'v': '动作'}, {'n': '冒险', 'v': '冒险'}, {'n': '传记', 'v': '传记'}, {'n': '剧情', 'v': '剧情'}, {'n': '奇幻', 'v': '奇幻'}, {'n': '惊悚', 'v': '惊悚'}, {'n': '灾难', 'v': '灾难'}, {'n': '歌舞', 'v': '歌舞'}, {'n': '音乐', 'v': '音乐'}]}, {'key': '综艺形式', 'name': '综艺形式', 'value': [{'n': '不限', 'v': ''}, {'n': '真人秀', 'v': '真人秀'}, {'n': '脱口秀', 'v': '脱口秀'}, {'n': '音乐', 'v': '音乐'}, {'n': '歌舞', 'v': '歌舞'}]}, {'key': '地区', 'name': '地区', 'value': [{'n': '全部地区', 'v': ''}, {'n': '华语', 'v': '华语'}, {'n': '欧美', 'v': '欧美'}, {'n': '国外', 'v': '国外'}, {'n': '韩国', 'v': '韩国'}, {'n': '日本', 'v': '日本'}, {'n': '中国大陆', 'v': '中国大陆'}, {'n': '中国香港', 'v': '中国香港'}, {'n': '美国', 'v': '美国'}, {'n': '英国', 'v': '英国'}, {'n': '泰国', 'v': '泰国'}, {'n': '中国台湾', 'v': '中国台湾'}, {'n': '意大利', 'v': '意大利'}, {'n': '法国', 'v': '法国'}, {'n': '德国', 'v': '德国'}, {'n': '西班牙', 'v': '西班牙'}, {'n': '俄罗斯', 'v': '俄罗斯'}, {'n': '瑞典', 'v': '瑞典'}, {'n': '巴西', 'v': '巴西'}, {'n': '丹麦', 'v': '丹麦'}, {'n': '印度', 'v': '印度'}, {'n': '加拿大', 'v': '加拿大'}, {'n': '爱尔兰', 'v': '爱尔兰'}, {'n': '澳大利亚', 'v': '澳大利亚'}]}, {'key': 'sort', 'name': '排序', 'value': [{'n': '近期热度', 'v': 'T'}, {'n': '首播时间', 'v': 'R'}, {'n': '高分优先', 'v': 'S'}]}, {'key': '年代', 'name': '年代', 'value': [{'n': '全部', 'v': ''}, {'n': '2023', 'v': '2023'}, {'n': '2022', 'v': '2022'}, {'n': '2021', 'v': '2021'}, {'n': '2020', 'v': '2020'}, {'n': '2019', 'v': '2019'}, {'n': '2010年代', 'v': '2010年代'}, {'n': '2000年代', 'v': '2000年代'}, {'n': '90年代', 'v': '90年代'}, {'n': '80年代', 'v': '80年代'}, {'n': '70年代', 'v': '70年代'}, {'n': '60年代', 'v': '60年代'}, {'n': '更早', 'v': '更早'}]}, {'key': '平台', 'name': '平台', 'value': [{'n': '全部', 'v': ''}, {'n': '腾讯视频', 'v': '腾讯视频'}, {'n': '爱奇艺', 'v': '爱奇艺'}, {'n': '优酷', 'v': '优酷'}, {'n': '湖南卫视', 'v': '湖南卫视'}, {'n': 'Netflix', 'v': 'Netflix'}, {'n': 'HBO', 'v': 'HBO'}, {'n': 'BBC', 'v': 'BBC'}, {'n': 'NHK', 'v': 'NHK'}, {'n': 'CBS', 'v': 'CBS'}, {'n': 'NBC', 'v': 'NBC'}, {'n': 'tvN', 'v': 'tvN'}]}], 'rank_list_movie': [{'key': '榜单', 'name': '榜单', 'value': [{'n': '实时热门电影', 'v': 'movie_real_time_hotest'}, {'n': '一周口碑电影榜', 'v': 'movie_weekly_best'}, {'n': '豆瓣电影Top250', 'v': 'movie_top250'}]}], 'rank_list_tv': [{'key': '榜单', 'name': '榜单', 'value': [{'n': '实时热门电视', 'v': 'tv_real_time_hotest'}, {'n': '华语口碑剧集榜', 'v': 'tv_chinese_best_weekly'}, {'n': '全球口碑剧集榜', 'v': 'tv_global_best_weekly'}, {'n': '国内口碑综艺榜', 'v': 'show_chinese_best_weekly'}, {'n': '国外口碑综艺榜', 'v': 'show_global_best_weekly'}]}]};

// 「我的豆瓣」的豆瓣用户ID，由 init(ext) 传入
let doubanId = "";

function buildQuery(params) {
    const parts = [];
    for (const k in params) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    return parts.join("&");
}

async function miniappRequest(path, query) {
    try {
        query = query || {};
        query.apikey = APIKEY;
        const url = API_HOST + path + "?" + buildQuery(query);
        const res = await req(url, { headers: HEADERS, timeout: TIMEOUT });
        const content = res ? (res.content || "") : "";
        if (!content) return {};
        return JSON.parse(content);
    } catch (e) {
        console.error("豆瓣请求失败[" + path + "]:", e.message);
        return {};
    }
}

function toVideoItem(item) {
    const rating = item.rating ? item.rating.value : "";
    const ratStr = rating || "暂无评分";
    const honor = item.honor_infos || [];
    const honorStr = honor.map(function (it) { return it.title; }).join("|");
    const title = item.title !== "未知电影" ? (item.title || "") : "暂不支持展示";
    return {
        vod_id: "msearch:" + title,
        vod_name: title,
        vod_pic: (item.pic && item.pic.normal ? item.pic.normal : "") + PIC_SUFFIX,
        vod_remarks: (ratStr + " " + honorStr).trim()
    };
}

function filterItems(items) {
    const lists = [];
    (items || []).forEach(function (item) {
        if (item && (item.type === "movie" || item.type === "tv")) lists.push(toVideoItem(item));
    });
    return lists;
}

// 推荐：实时热门榜
async function recommend() {
    const res = await miniappRequest("/subject_collection/subject_real_time_hotest/items", {});
    return filterItems(res.subject_collection_items);
}

async function init(ext) {
    doubanId = String(ext || "").trim();
    console.log("初始化爬虫: 豆瓣[官]");
}

async function home(filter) {
    let list = [];
    try { list = await recommend(); } catch (e) { console.error("推荐失败:", e.message); }
    return JSON.stringify({ class: classes, filters: filters, list: list });
}

async function category(tid, pg, filter, extend) {
    const MY_CATE = String(tid || "");
    const MY_PAGE = parseInt(pg || 1) || 1;
    const MY_FL = extend || {};
    let res = {};
    try {
        if (MY_CATE === "interests") {
            if (doubanId) {
                const status = MY_FL.status || "mark";
                const subtype_tag = MY_FL.subtype_tag || "";
                const year_tag = MY_FL.year_tag || "全部";
                res = await miniappRequest("/user/" + doubanId + "/interests", {
                    type: "movie", status: status, subtype_tag: subtype_tag, year_tag: year_tag,
                    start: (MY_PAGE - 1) * COUNT, count: COUNT
                });
            } else {
                res = {};
            }
        } else if (MY_CATE === "hot_gaia") {
            const sort = MY_FL.sort || "recommend";
            const area = MY_FL.area || "全部";
            res = await miniappRequest("/movie/" + MY_CATE, {
                area: area, sort: sort, start: (MY_PAGE - 1) * COUNT, count: COUNT
            });
        } else if (MY_CATE === "tv_hot" || MY_CATE === "show_hot") {
            const stype = MY_FL.type || MY_CATE;
            res = await miniappRequest("/subject_collection/" + stype + "/items", {
                start: (MY_PAGE - 1) * COUNT, count: COUNT
            });
        } else if (MY_CATE.indexOf("rank_list") === 0) {
            let id = MY_CATE === "rank_list_movie" ? "movie_real_time_hotest" : "tv_real_time_hotest";
            id = MY_FL.榜单 || id;
            res = await miniappRequest("/subject_collection/" + id + "/items", {
                start: (MY_PAGE - 1) * COUNT, count: COUNT
            });
        } else {
            let sort, tags, selected_categories;
            if (Object.keys(MY_FL).length > 0) {
                sort = MY_FL.sort || "T";
                tags = Object.values(MY_FL).join(",");
                if (MY_CATE === "movie") {
                    selected_categories = { "类型": MY_FL.类型 || "", "地区": MY_FL.地区 || "" };
                } else {
                    selected_categories = { "类型": MY_FL.类型 || "", "形式": MY_FL.类型 ? MY_FL.类型 + "地区" : "", "地区": MY_FL.地区 || "" };
                }
            } else {
                sort = "T";
                tags = "";
                if (MY_CATE === "movie") {
                    selected_categories = { "类型": "", "地区": "" };
                } else {
                    selected_categories = { "类型": "", "形式": "", "地区": "" };
                }
            }
            res = await miniappRequest("/" + MY_CATE + "/recommend", {
                tags: tags, sort: sort, refresh: 0,
                selected_categories: JSON.stringify(selected_categories),
                start: (MY_PAGE - 1) * COUNT, count: COUNT
            });
        }
    } catch (e) {
        console.error("分类失败:", e.message);
        res = {};
    }

    let items = [];
    if (/^rank_list|tv_hot|show_hot/.test(MY_CATE)) {
        items = res.subject_collection_items || [];
    } else if (MY_CATE === "interests") {
        (res.interests || []).forEach(function (it) { if (it && it.subject) items.push(it.subject); });
    } else {
        items = res.items || [];
    }
    const total = parseInt(res.total) || 0;
    return JSON.stringify({
        list: filterItems(items),
        page: MY_PAGE,
        pagecount: total ? Math.ceil(total / COUNT) : MY_PAGE,
        limit: COUNT,
        total: total
    });
}

async function detail(id) {
    // 原规则二级为空：本源为榜单浏览源，vod_id 为 msearch 协议，点击由 TVBox 聚合搜索处理
    return JSON.stringify({ list: [] });
}

async function search(wd, quick, page) {
    // 原规则 searchUrl 为空（搜索:'*'），不实现站内搜索
    return JSON.stringify({ list: [], page: parseInt(page || 1) || 1, pagecount: 1, limit: COUNT, total: 0 });
}

async function play(flag, id, vipFlags) {
    // 原规则 play_parse:false，无播放解析
    return JSON.stringify({ parse: 0, playUrl: "", url: "" });
}

export default { init, home, category, detail, search, play };