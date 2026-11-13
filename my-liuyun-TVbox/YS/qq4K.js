// 腾讯视频 (v.qq.com) - QuickJS 同步版
// 分类: pbaccess getMVLPage (page_context 串行翻页)
// 详情: node.video.qq.com float_vinfo2 + union.video.qq.com 批量集名
// 搜索: pbaccess MbSearch
// 播放: 外部解析接口链 -> 全部失败回退 jx:1 外部全局解析

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SEARCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.139 Safari/537.36';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

const PARSE_URLS = [
    'http://8.134.205.252:39466/ceshi/qianyi.php?key=rkd&url=',
    'http://114.66.51.153:2006/api/?key=9df31116c47da6a984097931955ad8d2&url=',
    'http://zq0143yimmi.xian.zxtongshuo.cn/qq.php?url='
];
const BLOCKED_URLS = ['.mp4'];

const CLASSES = [
    ['tv', '电视剧'], ['movie', '电影'], ['mini_series', '短剧'], ['variety', '综艺'],
    ['cartoon', '动漫'], ['child', '少儿'], ['doco', '纪录片']
];
const CHANNEL_IDS = {
    'tv': '100113', 'movie': '100173', 'variety': '100109', 'cartoon': '100119',
    'child': '100150', 'doco': '100105', 'mini_series': '120188'
};
const FILTERS = {
    "tv": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最新上架", "v": "79" }, { "n": "高分好评", "v": "85" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "爱情", "v": "1" }, { "n": "都市", "v": "2" }, { "n": "青春", "v": "3" }, { "n": "奇幻", "v": "4" }, { "n": "武侠", "v": "5" }, { "n": "古装", "v": "6" }, { "n": "科幻", "v": "7" }, { "n": "猎奇", "v": "8" }, { "n": "竞技", "v": "9" }, { "n": "传奇", "v": "10" }, { "n": "逆袭", "v": "19" }, { "n": "军旅", "v": "11" }, { "n": "家庭", "v": "12" }, { "n": "喜剧", "v": "13" }, { "n": "悬疑", "v": "14" }, { "n": "权谋", "v": "15" }, { "n": "革命", "v": "16" }, { "n": "现实", "v": "17" }, { "n": "刑侦", "v": "18" }, { "n": "民国", "v": "20" }, { "n": "IP改编", "v": "21" }] }, { "key": "ipay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "1" }, { "n": "限免", "v": "2" }, { "n": "会员", "v": "3" }] }, { "key": "iarea", "name": "地区", "value": [{ "n": "全部", "v": "-1" }, { "n": "内地", "v": "0" }, { "n": "中国香港", "v": "14" }, { "n": "中国台湾", "v": "4" }, { "n": "美国", "v": "8" }, { "n": "泰国", "v": "9" }, { "n": "英国", "v": "1" }, { "n": "韩国", "v": "5" }, { "n": "日本", "v": "10" }, { "n": "其他", "v": "9999" }] }, { "key": "iyear", "name": "年份", "value": [{ "n": "全部", "v": "-1" }, { "n": "即将上线", "v": "1" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2" }, { "n": "2023", "v": "3" }, { "n": "2022", "v": "4" }, { "n": "2021", "v": "5" }, { "n": "2020-2016", "v": "6" }, { "n": "2015-2011", "v": "7" }, { "n": "2010-2000", "v": "8" }, { "n": "更早", "v": "9" }] }, { "key": "theater", "name": "剧场", "value": [{ "n": "全部", "v": "-1" }, { "n": "X剧场", "v": "1" }, { "n": "板凳单元", "v": "2" }, { "n": "萤火单元", "v": "3" }, { "n": "十分剧场", "v": "4" }] }, { "key": "award", "name": "获奖", "value": [{ "n": "全部", "v": "-1" }, { "n": "白玉兰奖", "v": "1" }, { "n": "飞天奖", "v": "2" }, { "n": "金鹰奖", "v": "3" }] }],
    "movie": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最新", "v": "83" }, { "n": "高分好评", "v": "81" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "动作", "v": "4" }, { "n": "喜剧", "v": "3" }, { "n": "爱情", "v": "5" }, { "n": "科幻", "v": "12" }, { "n": "犯罪", "v": "6" }, { "n": "冒险", "v": "7" }, { "n": "恐怖", "v": "11" }, { "n": "动画", "v": "15" }, { "n": "战争", "v": "8" }, { "n": "悬疑", "v": "10" }, { "n": "灾难", "v": "25" }, { "n": "青春", "v": "26" }] }, { "key": "ipay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "1" }, { "n": "会员", "v": "8" }, { "n": "付费", "v": "4" }, { "n": "限免", "v": "3300" }] }, { "key": "iarea", "name": "地区", "value": [{ "n": "全部", "v": "-1" }, { "n": "内地", "v": "100024" }, { "n": "中国香港", "v": "100025" }, { "n": "中国台湾", "v": "100026" }, { "n": "美国", "v": "100029" }, { "n": "日本", "v": "100027" }, { "n": "韩国", "v": "100028" }, { "n": "泰国", "v": "100031" }, { "n": "印度", "v": "100030" }, { "n": "英国", "v": "15" }, { "n": "法国", "v": "16" }, { "n": "德国", "v": "17" }, { "n": "其他", "v": "100033" }] }, { "key": "iyear", "name": "年份", "value": [{ "n": "全部", "v": "-1" }, { "n": "即将上线", "v": "999" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "20" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "1" }, { "n": "2016", "v": "2" }, { "n": "2015", "v": "3" }, { "n": "更早", "v": "10" }] }, { "key": "producer", "name": "出品方", "value": [{ "n": "全部", "v": "-1" }, { "n": "腾讯出品", "v": "1" }, { "n": "索尼", "v": "2" }, { "n": "派拉蒙", "v": "3" }, { "n": "迪士尼", "v": "4" }, { "n": "环球", "v": "5" }, { "n": "华谊", "v": "6" }, { "n": "华纳", "v": "7" }, { "n": "光线", "v": "8" }, { "n": "BBC", "v": "10" }, { "n": "20世纪影业", "v": "11" }, { "n": "开心麻花", "v": "12" }] }, { "key": "characteristic", "name": "特征", "value": [{ "n": "全部", "v": "-1" }, { "n": "院线电影", "v": "1" }, { "n": "网络电影", "v": "2" }, { "n": "独播", "v": "5" }, { "n": "原声", "v": "8" }, { "n": "粤语", "v": "9" }, { "n": "获奖佳片", "v": "6" }] }],
    "variety": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最近更新", "v": "23" }, { "n": "高分好评", "v": "85" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "游戏", "v": "10" }, { "n": "脱口秀", "v": "2" }, { "n": "音乐舞台", "v": "11" }, { "n": "情感", "v": "12" }, { "n": "生活", "v": "22" }, { "n": "职场", "v": "20" }, { "n": "喜剧", "v": "14" }, { "n": "美食", "v": "19" }, { "n": "潮流运动", "v": "21" }, { "n": "竞技", "v": "24" }, { "n": "影视", "v": "16" }, { "n": "电竞", "v": "15" }, { "n": "推理", "v": "25" }, { "n": "访谈", "v": "3" }, { "n": "亲子", "v": "17" }, { "n": "文化", "v": "26" }, { "n": "互动", "v": "23" }, { "n": "晚会", "v": "6" }, { "n": "资讯", "v": "7" }] }, { "key": "ipay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "1" }, { "n": "会员", "v": "6" }] }, { "key": "exclusive", "name": "出品", "value": [{ "n": "全部", "v": "-1" }, { "n": "腾讯自制", "v": "1" }, { "n": "独播", "v": "2" }] }, { "key": "iarea", "name": "地区", "value": [{ "n": "全部", "v": "-1" }, { "n": "国内", "v": "1" }, { "n": "海外", "v": "2" }] }, { "key": "iyear", "name": "年份", "value": [{ "n": "全部", "v": "-1" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "50" }, { "n": "2019", "v": "7" }, { "n": "2018", "v": "1" }, { "n": "2017", "v": "2" }, { "n": "2016", "v": "3" }, { "n": "更早", "v": "99" }] }],
    "cartoon": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最近更新", "v": "23" }, { "n": "高分好评", "v": "85" }] }, { "key": "iarea", "name": "地区", "value": [{ "n": "全部", "v": "-1" }, { "n": "内地", "v": "1" }, { "n": "日本", "v": "2" }, { "n": "欧美", "v": "3" }, { "n": "其他", "v": "4" }] }, { "key": "ipay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "867" }, { "n": "会员", "v": "6" }, { "n": "限免", "v": "3300" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "玄幻", "v": "9" }, { "n": "科幻", "v": "4" }, { "n": "奇幻", "v": "21" }, { "n": "武侠", "v": "13" }, { "n": "仙侠", "v": "23" }, { "n": "都市", "v": "24" }, { "n": "恋爱", "v": "7" }, { "n": "搞笑", "v": "1" }, { "n": "冒险", "v": "2" }, { "n": "悬疑", "v": "17" }, { "n": "竞技", "v": "20" }, { "n": "日常", "v": "15" }, { "n": "真人", "v": "18" }, { "n": "治愈", "v": "25" }, { "n": "游戏", "v": "26" }, { "n": "异能", "v": "27" }, { "n": "历史", "v": "19" }, { "n": "古风", "v": "28" }, { "n": "智斗", "v": "29" }, { "n": "恐怖", "v": "30" }, { "n": "美食", "v": "31" }, { "n": "音乐", "v": "32" }, { "n": "其他", "v": "12" }] }, { "key": "iyear", "name": "年份", "value": [{ "n": "全部", "v": "-1" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "50" }, { "n": "2019", "v": "11" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "2017" }, { "n": "2016", "v": "1" }, { "n": "更早", "v": "10" }] }, { "key": "anime_status", "name": "状态", "value": [{ "n": "全部", "v": "-1" }, { "n": "即将上线", "v": "46" }, { "n": "更新中", "v": "44" }, { "n": "已完结", "v": "45" }] }],
    "child": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最新", "v": "76" }] }, { "key": "iyear", "name": "年龄", "value": [{ "n": "全部", "v": "-1" }, { "n": "0-3岁", "v": "1" }, { "n": "4-6岁", "v": "2" }, { "n": "7-9岁", "v": "3" }, { "n": "10岁以上", "v": "4" }, { "n": "全年龄", "v": "7" }] }, { "key": "ipay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "1" }, { "n": "会员", "v": "2" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "磨耳朵", "v": "22" }, { "n": "涨知识", "v": "23" }, { "n": "冒险", "v": "10" }, { "n": "儿歌", "v": "1" }, { "n": "交通工具", "v": "11" }, { "n": "益智早教", "v": "2" }, { "n": "玩具", "v": "4" }, { "n": "魔幻·科幻", "v": "12" }, { "n": "动物", "v": "13" }, { "n": "真人·特摄", "v": "14" }, { "n": "家长甄选", "v": "17" }, { "n": "动画电影", "v": "20" }] }, { "key": "gender", "name": "性别", "value": [{ "n": "全部", "v": "-1" }, { "n": "女孩", "v": "1" }, { "n": "男孩", "v": "2" }] }],
    "doco": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最新", "v": "74" }, { "n": "高分好评", "v": "85" }] }, { "key": "itrailer", "name": "出品方", "value": [{ "n": "全部", "v": "-1" }, { "n": "腾讯出品", "v": "15" }, { "n": "央视", "v": "8" }, { "n": "BBC", "v": "1" }, { "n": "国家地理", "v": "4" }, { "n": "探索频道", "v": "3174" }, { "n": "HBO", "v": "3175" }, { "n": "NHK", "v": "2" }, { "n": "ITV", "v": "3530" }, { "n": "历史频道", "v": "7" }] }, { "key": "itype", "name": "类型", "value": [{ "n": "全部", "v": "-1" }, { "n": "自然", "v": "4" }, { "n": "美食", "v": "10" }, { "n": "社会", "v": "3" }, { "n": "人文", "v": "6" }, { "n": "历史", "v": "1" }, { "n": "军事", "v": "2" }, { "n": "科技", "v": "8" }, { "n": "财经", "v": "14" }, { "n": "探险", "v": "15" }, { "n": "罪案", "v": "7" }, { "n": "竞技", "v": "12" }, { "n": "旅游", "v": "11" }] }, { "key": "iregion", "name": "地区", "value": [{ "n": "全部", "v": "0" }, { "n": "国内", "v": "1" }, { "n": "国外", "v": "2" }] }, { "key": "pay", "name": "资费", "value": [{ "n": "全部", "v": "-1" }, { "n": "免费", "v": "1" }, { "n": "会员", "v": "2" }, { "n": "限免", "v": "3" }] }, { "key": "iyear", "name": "年份", "value": [{ "n": "全部", "v": "-1" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "1" }, { "n": "2023", "v": "2" }, { "n": "2022", "v": "3" }, { "n": "2021", "v": "4" }, { "n": "2020", "v": "5" }, { "n": "2019-2015", "v": "6" }, { "n": "更早", "v": "9" }] }],
    "mini_series": [{ "key": "sort", "name": "排序", "value": [{ "n": "最热", "v": "75" }, { "n": "最新上架", "v": "76" }, { "n": "限免中", "v": "90" }] }, { "key": "prefer", "name": "偏好", "value": [{ "n": "全部", "v": "-1" }, { "n": "男频", "v": "2" }, { "n": "女频", "v": "1" }] }, { "key": "story", "name": "故事背景", "value": [{ "n": "全部", "v": "-1" }, { "n": "古装爱情", "v": "1" }, { "n": "都市爱情", "v": "2" }, { "n": "都市奇幻", "v": "3" }, { "n": "古装权谋", "v": "5" }, { "n": "年代", "v": "6" }, { "n": "青春", "v": "8" }, { "n": "职场", "v": "10" }, { "n": "民国", "v": "11" }, { "n": "末日", "v": "12" }, { "n": "乡村", "v": "15" }, { "n": "悬疑推理", "v": "18" }, { "n": "玄幻", "v": "19" }, { "n": "喜剧", "v": "21" }] }, { "key": "identity", "name": "身份人设", "value": [{ "n": "全部", "v": "-1" }, { "n": "总裁", "v": "1" }, { "n": "大女主", "v": "2" }, { "n": "战神", "v": "3" }, { "n": "萌娃", "v": "4" }, { "n": "神医", "v": "5" }, { "n": "落难千金", "v": "6" }, { "n": "赘婿", "v": "7" }, { "n": "神豪", "v": "8" }, { "n": "大男主", "v": "9" }, { "n": "女帝", "v": "10" }, { "n": "皇后王妃", "v": "11" }, { "n": "青梅竹马", "v": "13" }, { "n": "欢喜冤家", "v": "16" }, { "n": "大叔", "v": "24" }, { "n": "小人物", "v": "28" }, { "n": "团宠", "v": "29" }] }, { "key": "attraction", "name": "主要看点", "value": [{ "n": "全部", "v": "-1" }, { "n": "穿越", "v": "3" }, { "n": "重生", "v": "4" }, { "n": "逆袭", "v": "5" }, { "n": "家庭伦理", "v": "6" }, { "n": "虐心", "v": "7" }, { "n": "曲折爱情", "v": "8" }, { "n": "破镜重圆", "v": "9" }, { "n": "马甲", "v": "10" }, { "n": "异能", "v": "11" }, { "n": "甜宠爱情", "v": "12" }, { "n": "奇幻爱情", "v": "13" }, { "n": "闪婚", "v": "15" }, { "n": "系统流", "v": "16" }, { "n": "传承觉醒", "v": "19" }, { "n": "亲情", "v": "20" }, { "n": "宅门风云", "v": "21" }, { "n": "家族恩怨", "v": "22" }, { "n": "身份之谜", "v": "23" }, { "n": "追妻", "v": "25" }, { "n": "虐渣复仇", "v": "29" }, { "n": "权力争夺", "v": "47" }, { "n": "恐怖", "v": "49" }, { "n": "娱乐圈", "v": "88" }, { "n": "脑洞", "v": "89" }] }]
};

const MVL_URL = 'https://pbaccess.video.qq.com/trpc.multi_vector_layout.mvl_controller.MVLPageHTTPService/getMVLPage?&vversion_platform=2';
const SEARCH_URL = 'https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2';
const UNION_URL = 'https://union.video.qq.com/fcgi-bin/data?otype=json&tid=1804&appid=20001238&appkey=6c03bbe9658448a4&union_platform=1&idlist=';

const ctxCache = {};

// ==================== HTTP ====================
function getJson(url, timeout) {
    try {
        const r = req(url, { headers: { 'User-Agent': PC_UA, 'Referer': 'https://v.qq.com/' }, timeout: timeout || 15000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}
function postJson(url, body, ua, timeout) {
    try {
        const r = req(url, {
            method: 'post', data: body, postType: 'json',
            headers: {
                'User-Agent': ua || PC_UA, 'Content-Type': 'application/json',
                'Origin': 'https://v.qq.com', 'Referer': 'https://v.qq.com/'
            },
            timeout: timeout || 15000
        });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

// ==================== 分类列表 ====================
function mvlBody(channelId, filterParams, ctx) {
    const b = { page_params: { channel_id: channelId, filter_params: filterParams, page_type: 'operation', page_id: 'channel_list' } };
    if (ctx) b.page_context = ctx;
    return b;
}

function fetchMvlList(tid, pg, extend) {
    const channelId = CHANNEL_IDS[tid] || '100113';
    const ext = extend || {};
    const parts = ['sort=' + (ext.sort || '75')];
    for (const key in ext) {
        if (key === 'sort') continue;
        const val = ext[key];
        if (val && val !== '' && val !== '-1' && val !== '0') parts.push(key + '=' + val);
    }
    const filterParams = parts.join('&');
    const page = parseInt(pg, 10) || 1;

    // page_context 串行翻页 (内存缓存替代 storage0)
    let pageContext = null;
    const cacheKey = tid + '_' + filterParams;
    if (page > 1) {
        const cached = ctxCache[cacheKey];
        if (cached && cached.p && cached.c && cached.p < page) {
            pageContext = cached.c;
            for (let p = cached.p + 1; p < page; p++) {
                const rj = postJson(MVL_URL, mvlBody(channelId, filterParams, pageContext));
                if (rj && rj.ret === 0 && rj.data && rj.data.page_context) pageContext = rj.data.page_context;
                else break;
            }
        } else {
            for (let p = 1; p < page; p++) {
                const rj = postJson(MVL_URL, mvlBody(channelId, filterParams, pageContext));
                if (rj && rj.ret === 0 && rj.data && rj.data.page_context) pageContext = rj.data.page_context;
                else break;
            }
        }
    }

    const json = postJson(MVL_URL, mvlBody(channelId, filterParams, pageContext));
    const list = [];
    if (json && json.ret === 0 && json.data) {
        const data = json.data;
        if (data.page_context) ctxCache[cacheKey] = { p: page, c: data.page_context };
        const cards = ((data.modules || {}).normal || {}).cards || [];
        for (let i = 0; i < cards.length; i++) {
            const posterCards = ((cards[i].children_list || {}).poster_card || {}).cards || [];
            for (let j = 0; j < posterCards.length; j++) {
                const params = posterCards[j].params || {};
                const title = params.title || '';
                const cid = params.cid || '';
                const img = params.new_pic_vt || '';
                let desc = params.timelong || '';
                if (!desc) desc = params.second_title || params.sub_title || '';
                if (cid && title) list.push({ vod_id: String(cid), vod_name: title, vod_pic: img, vod_remarks: desc });
            }
        }
    }
    return { list, page };
}

// ==================== 详情 ====================
function parseQZ(text) {
    // QZOutputJson={...}; -> object
    let t = String(text || '').trim();
    const eq = t.indexOf('=');
    if (eq >= 0) t = t.substring(eq + 1);
    if (t.charAt(t.length - 1) === ';') t = t.substring(0, t.length - 1);
    try { return JSON.parse(t); } catch (e) { return null; }
}

function unionTitles(vids) {
    // 批量取集名, 每批30个
    const out = [];
    for (let i = 0; i < vids.length; i += 30) {
        const batch = vids.slice(i, i + 30);
        const r = req(UNION_URL + batch.join(','), { headers: { 'User-Agent': PC_UA, 'Referer': 'https://v.qq.com/' }, timeout: 15000 });
        const qz = parseQZ(r.content);
        const results = (qz && qz.results) || [];
        for (let k = 0; k < results.length; k++) {
            const f = results[k].fields || {};
            out.push({
                vid: f.vid || '',
                title: f.title || '',
                type: (f.category_map && f.category_map.length > 1) ? f.category_map[1] : ''
            });
        }
    }
    return out;
}

function detail(ids) {
    const cid = String(Array.isArray(ids) ? ids[0] : ids);
    const json = getJson('https://node.video.qq.com/x/api/float_vinfo2?cid=' + cid);
    if (!json || !json.c) return JSON.stringify({ list: [] });
    const c = json.c;

    const videoIds = c.video_ids || [];
    const d = [];
    if (videoIds.length === 1) {
        const meta = unionTitles(videoIds);
        d.push({
            title: (meta.length && meta[0].title) || '正片播放',
            url: 'https://v.qq.com/x/cover/' + cid + '/' + videoIds[0] + '.html',
            type: (meta.length && meta[0].type) || ''
        });
    } else if (videoIds.length > 1) {
        const meta = unionTitles(videoIds);
        for (let i = 0; i < meta.length; i++) {
            d.push({
                title: meta[i].title,
                url: 'https://v.qq.com/x/cover/' + cid + '/' + meta[i].vid + '.html',
                type: meta[i].type
            });
        }
    }

    // 正片 / 预告 / 花絮片花 / 特辑 分组
    const ygKeys = ['预告', '花絮', '片花', '特辑', '幕后', '采访', '制作', 'MV', '主题曲'];
    const isYg = (it) => it.type && ygKeys.some(k => it.type.indexOf(k) >= 0);
    const zp = d.filter(it => !isYg(it));
    const yg = d.filter(isYg);

    const playFrom = [], playUrl = [];
    const fmt = (it) => String(it.title || '').replace(/\$/g, ' ').replace(/#/g, ' ') + '$' + it.url;
    if (zp.length) { playFrom.push('正片'); playUrl.push(zp.map(fmt).join('#')); }
    if (yg.length) {
        const yg1 = yg.filter(it => it.type.indexOf('预告') >= 0);
        const yg2 = yg.filter(it => it.type.indexOf('花絮') >= 0 || it.type.indexOf('片花') >= 0);
        const yg3 = yg.filter(it => it.type.indexOf('特辑') >= 0 || it.type.indexOf('幕后') >= 0);
        if (yg1.length) { playFrom.push('预告'); playUrl.push(yg1.map(fmt).join('#')); }
        if (yg2.length) { playFrom.push('花絮片花'); playUrl.push(yg2.map(fmt).join('#')); }
        if (yg3.length) { playFrom.push('特辑'); playUrl.push(yg3.map(fmt).join('#')); }
    }

    let content = String(c.description || '');
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;

    return JSON.stringify({
        list: [{
            vod_id: cid,
            vod_name: c.title || '',
            type_name: (json.typ || []).join(','),
            vod_actor: (json.nam || []).join(','),
            vod_year: String(c.year || ''),
            vod_content: content,
            vod_remarks: json.rec || '',
            vod_pic: c.pic || '',
            vod_play_from: playFrom.join('$$$'),
            vod_play_url: playUrl.join('$$$')
        }]
    });
}

// ==================== 搜索 ====================
function search(key, quick, pg) {
    const body = {
        version: '25042201', clientType: 1, filterValue: '',
        uuid: 'B1E50847-D25F-4C4B-BBA0-36F0093487F6', retry: 0,
        query: String(key || ''), pagenum: (parseInt(pg, 10) || 1) - 1,
        isPrefetch: true, pagesize: 30, queryFrom: 0, searchDatakey: '',
        transInfo: '', isneedQc: true, preQid: '', adClientInfo: '',
        extraInfo: {
            isNewMarkLabel: '1', multi_terminal_pc: '1', themeType: '1',
            sugRelatedIds: '{}', appVersion: ''
        }
    };
    const json = postJson(SEARCH_URL, body, SEARCH_UA);
    const d = [], seen = {};
    const badKeys = ['：', '#', '特辑', '剪辑', '片花', '独家', '专访', '纯享', '制作', '幕后', '宣传', 'MV', '主题曲', '插曲', '彩蛋', '精彩', '集锦', '盘点', '回顾', '解说', '评测', '反应', 'reaction'];
    const isMain = (t) => {
        if (!t) return false;
        if (t.indexOf('<em>') >= 0 || t.indexOf('</em>') >= 0) return false;
        return !badKeys.some(k => t.indexOf(k) >= 0);
    };
    const isQQ = (sites) => {
        if (!sites || !sites.length) return true;
        return sites.some(s => s.enName && String(s.enName).toLowerCase() === 'qq');
    };
    const processItems = (itemList) => {
        if (!itemList) return;
        for (let i = 0; i < itemList.length; i++) {
            const it = itemList[i];
            if (it.doc && it.doc.id && it.videoInfo && isMain(it.videoInfo.title) && isQQ(it.videoInfo.playSites)) {
                const itemId = it.doc.id;
                if (!seen[itemId]) {
                    seen[itemId] = 1;
                    d.push({
                        vod_id: String(itemId),
                        vod_name: it.videoInfo.title,
                        vod_pic: it.videoInfo.imgUrl || '',
                        vod_remarks: it.videoInfo.secondLine || ''
                    });
                }
            }
        }
    };
    if (json && json.data) {
        if (json.data.normalList) processItems(json.data.normalList.itemList);
        const boxes = json.data.areaBoxList || [];
        for (let i = 0; i < boxes.length; i++) processItems(boxes[i].itemList);
    }
    return JSON.stringify({ list: d });
}

// ==================== 播放 ====================
function play(flag, id, vipFlags) {
    const targetUrl = String(id || '').split('?')[0];
    const danmaku = 'http://127.0.0.1:9978/proxy?do=danmu&site=js&url=' + targetUrl;
    for (let i = 0; i < PARSE_URLS.length; i++) {
        try {
            const r = req(PARSE_URLS[i] + encodeURIComponent(targetUrl), {
                headers: { 'User-Agent': PC_UA, 'Referer': 'https://v.qq.com/' }, timeout: 10000
            });
            const data = JSON.parse(r.content || '');
            if (data && data.url && data.url.indexOf('http') >= 0) {
                if (BLOCKED_URLS.some(b => data.url.indexOf(b) >= 0)) continue;
                return JSON.stringify({
                    parse: 0, playUrl: '', url: data.url, jx: 0,
                    header: { 'User-Agent': '' }, danmaku: danmaku
                });
            }
        } catch (e) {}
    }
    // 全部解析失败, 回退外部全局解析
    return JSON.stringify({
        parse: 0, playUrl: '', url: targetUrl, jx: 1,
        header: { 'User-Agent': '' }, danmaku: danmaku
    });
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    const classes = CLASSES.map(c => ({ type_id: c[0], type_name: c[1] }));
    return JSON.stringify({ 'class': classes, filters: filter ? FILTERS : {} });
}

function homeVod() {
    try {
        const r = fetchMvlList('tv', 1, null);
        return JSON.stringify({ list: r.list });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

function category(tid, pg, filter, extend) {
    let ext = extend || {};
    if (typeof extend === 'string') { try { ext = JSON.parse(extend); } catch (e) { ext = {}; } }
    const r = fetchMvlList(String(tid), pg, ext);
    return JSON.stringify({ list: r.list, page: r.page, pagecount: 999, limit: 20, total: 9999 });
}

export default { init, home, homeVod, category, detail, search, play };
