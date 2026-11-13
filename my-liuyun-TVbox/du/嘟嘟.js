// 嘟嘟短剧 (read.api.duodutek.com) - QuickJS 同步版
// 列表: pageModel/getResourceById; 详情: book/getChapterList; 播放: mp4 直链 parse:0
// 首页推荐: 5 个分类各取前 2 条聚合

const XURL = 'http://read.api.duodutek.com';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/50.0.2661.87 Safari/537.36' };
const COMMON = 'productId=2a8c14d1-72e7-498b-af23-381028eb47c0&vestId=2be070e0-c824-4d0e-a67a-8f688890cadb&channel=oppo19&osType=android&version=20&token=202509271001001446030204698626';

const CLASSES = [
    ['1287', '甜宠'], ['1288', '逆袭'], ['1289', '热血'], ['1290', '现代'], ['1291', '古代']
];

function getJson(url) {
    try {
        const r = req(url, { headers: HEADERS, timeout: 20000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

function mapVod(v) {
    return {
        vod_id: String(v.id || '') + '@' + (v.introduction || ''),
        vod_name: v.name || '',
        vod_pic: v.icon || '',
        vod_remarks: (v.heat || 0) + '万播放'
    };
}

function init(ext) {}

function home(filter) {
    return JSON.stringify({
        'class': CLASSES.map(c => ({ type_id: c[0], type_name: c[1] })),
        filters: {}
    });
}

function homeVod() {
    const videos = [];
    for (let i = 0; i < CLASSES.length; i++) {
        const d = getJson(XURL + '/novel-api/app/pageModel/getResourceById?' + COMMON + '&resourceId=' + CLASSES[i][0] + '&pageNum=1&pageSize=6');
        const rows = (((d && d.data) || {}).datalist) || [];
        for (let j = 0; j < Math.min(2, rows.length); j++) videos.push(mapVod(rows[j]));
    }
    return JSON.stringify({ list: videos });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const d = getJson(XURL + '/novel-api/app/pageModel/getResourceById?' + COMMON + '&resourceId=' + encodeURIComponent(tid) + '&pageNum=' + page + '&pageSize=10');
    const list = (((d && d.data) || {}).datalist || []).map(mapVod);
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const parts = did.split('@');
    const bookId = parts[0];
    let content = parts.slice(1).join('@') || '';
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;

    const d = getJson(XURL + '/novel-api/basedata/book/getChapterList?' + COMMON + '&bookId=' + encodeURIComponent(bookId));
    const chapters = (d && d.data) || [];
    const eps = [];
    for (let i = 0; i < chapters.length; i++) {
        const sp = ((chapters[i].shortPlayList || [])[0] || {});
        const url = (((sp.chapterShortPlayVoList || [])[0] || {}).shortPlayUrl) || '';
        if (url) eps.push('第' + (i + 1) + '集$' + url);
    }
    if (!eps.length) return JSON.stringify({ list: [] });

    return JSON.stringify({
        list: [{
            vod_id: did,
            vod_content: content,
            vod_play_from: '短剧专线',
            vod_play_url: eps.join('#')
        }]
    });
}

function play(flag, id, vipFlags) {
    return JSON.stringify({ parse: 0, playUrl: '', url: String(id || ''), header: HEADERS });
}

function search(key, quick, pg) {
    return JSON.stringify({ list: [], page: 1, pagecount: 1, limit: 10, total: 0 });
}

export default { init, home, homeVod, category, detail, search, play };
