// 西饭短剧 (xifan-api-cn.youlishipin.com) - QuickJS 同步版
// 列表/首页: drama/portalPage; 详情: drama/getDuanjuInfo; 搜索: search/getSearchList; 播放直链 parse:0

const HOST = 'https://xifan-api-cn.youlishipin.com';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 8.0; DUK-AL20 Build/HUAWEIDUK-AL20; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/6.2 TBS/044353 Mobile Safari/537.36 MicroMessenger/6.7.3.1360(0x26070333) NetType/WIFI Language/zh_CN Process/tools'
};
const SESSION = '&session=eyJpbmZvIjp7InVpZCI6IiIsInJ0IjoiMTc0MDY1ODI5NCIsInVuIjoiT1BHXzFlZGQ5OTZhNjQ3ZTQ1MjU4Nzc1MTE2YzFkNzViN2QwIiwiZnQiOiIxNzQwNjU4Mjk0In19&feedssession=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1dHlwIjowLCJidWlkIjoxNjMzOTY4MTI2MTQ4NjQxNTM2LCJhdWQiOiJkcmFtYSIsInZlciI6MiwicmF0IjoxNzQwNjU4Mjk0LCJ1bm0iOiJPUEdfMWVkZDk5NmE2NDdlNDUyNTg3NzUxMTZjMWQ3NWI3ZDAiLCJpZCI6IjNiMzViZmYzYWE0OTgxNDQxNDBlZjI5N2JkMDY5NGNhIiwiZXhwIjoxNzQxMjYzMDk0LCJkYyI6Imd6cXkifQ.JS3QY6ER0P2cQSxAE_OGKSMIWNAMsYUZ3mJTnEpf-Rc';

const CLASSES = ['都市', '青春', '现代', '豪门', '逆袭', '穿越', '打脸'];

function getJson(url) {
    try {
        const r = req(url, { headers: HEADERS, timeout: 15000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

function mapElements(d) {
    const out = [];
    const elements = (((d || {}).result) || {}).elements || [];
    for (let i = 0; i < elements.length; i++) {
        const contents = elements[i].contents || [];
        for (let j = 0; j < contents.length; j++) {
            const v = contents[j].duanjuVo;
            if (!v) continue;
            let title = v.title || '';
            if (title.indexOf('<') >= 0 || title.indexOf('>') >= 0) title = title.replace(/<[^>]+>/g, '');
            const total = v.total || '';
            out.push({
                vod_id: String(v.duanjuId || '') + '#' + (v.source || ''),
                vod_name: title,
                vod_remarks: total ? total + '集' : '',
                vod_pic: v.coverImageUrl || ''
            });
        }
    }
    return out;
}

const EP_PATTERNS = [
    [/第\s*(\d+)\s*集/, '第{n}集'], [/第\s*(\d+)\s*章/, '第{n}章'], [/第\s*(\d+)\s*话/, '第{n}话'],
    [/(\d+)\s*集/, '第{n}集'], [/(\d+)\s*章/, '第{n}章'], [/(\d+)\s*话/, '第{n}话'],
    [/EP\s*(\d+)/i, '第{n}集']
];

function extractEpisodeInfo(title, vodName) {
    if (!title || title === vodName) return '';
    for (let i = 0; i < EP_PATTERNS.length; i++) {
        const m = EP_PATTERNS[i][0].exec(title);
        if (m) return EP_PATTERNS[i][1].replace('{n}', m[1]);
    }
    if (vodName && title.indexOf(vodName) === 0) {
        let cleaned = title.substring(vodName.length).replace(/^\s+/, '');
        const seps = ['：', ':', '-', '—', '——', ' '];
        for (let i = 0; i < seps.length; i++) {
            if (cleaned.indexOf(seps[i]) === 0) { cleaned = cleaned.substring(seps[i].length).replace(/^\s+/, ''); break; }
        }
        if (cleaned) {
            for (let i = 0; i < EP_PATTERNS.length; i++) {
                const m = EP_PATTERNS[i][0].exec(cleaned);
                if (m) return EP_PATTERNS[i][1].replace('{n}', m[1]);
            }
        }
    }
    return '';
}

function shouldUseAutoNumbering(eps) {
    if (!eps.length) return false;
    const testRe = [/第\s*\d+\s*集/, /第\s*\d+\s*章/, /第\s*\d+\s*话/, /\d+\s*集/, /\d+\s*章/, /\d+\s*话/, /EP\s*\d+/i];
    let valid = 0;
    for (let i = 0; i < eps.length; i++) {
        const t = eps[i].title || '';
        for (let j = 0; j < testRe.length; j++) {
            if (testRe[j].test(t)) { valid++; break; }
        }
    }
    return valid <= eps.length / 2;
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    return JSON.stringify({
        'class': CLASSES.map(n => ({ type_id: n, type_name: n })),
        filters: {}
    });
}

function homeVod() {
    const ts = Math.floor(Date.now() / 1000);
    const d = getJson(HOST + '/xifan/drama/portalPage?reqType=aggregationPage&offset=0&quickEngineVersion=-1&scene=&categoryNames=&categoryVersion=&density=1.5&pageID=page_theater&version=2001001&androidVersionCode=28&requestId=' + ts + 'd4aa487d53e646c2&appId=drama&teenMode=false&userBaseMode=false' + SESSION);
    return JSON.stringify({ list: mapElements(d) });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const offset = (page - 1) * 30;
    const ts = Math.floor(Date.now() / 1000);
    // 注: 服务端已废弃 categoryId 参数 (带上会导致部分分类返回空), 仅以 categoryNames 筛选
    const d = getJson(HOST + '/xifan/drama/portalPage?reqType=aggregationPage&offset=' + offset + '&quickEngineVersion=-1&scene=&categoryNames=' + encodeURIComponent(tid) + '&categoryVersion=1&density=1.5&pageID=page_theater&version=2001001&androidVersionCode=28&requestId=' + ts + 'aa498144140ef297&appId=drama&teenMode=false&userBaseMode=false' + SESSION);
    return JSON.stringify({ list: mapElements(d), page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const parts = did.split('#');
    const duanjuId = parts[0], source = parts[1] || '';
    const d = getJson(HOST + '/xifan/drama/getDuanjuInfo?duanjuId=' + encodeURIComponent(duanjuId) + '&source=' + encodeURIComponent(source) + '&openFrom=homescreen&type=&pageID=page_inner_flow&density=1.5&version=2001001&androidVersionCode=28&requestId=1740658944980aa498144140ef297&appId=drama&teenMode=false&userBaseMode=false' + SESSION);
    const rd = ((d || {}).result) || {};
    const episodeList = rd.episodeList || [];
    if (!episodeList.length) return JSON.stringify({ list: [] });

    const vodName = rd.title || '';
    const autoNum = shouldUseAutoNumbering(episodeList);
    const eps = [];
    for (let i = 0; i < episodeList.length; i++) {
        const playUrl = episodeList[i].playUrl || '';
        if (!playUrl) continue;
        let title;
        if (autoNum) title = '第' + (i + 1) + '集';
        else title = extractEpisodeInfo(episodeList[i].title || '', vodName) || ('第' + (i + 1) + '集');
        title = title.split('#').join('＃').split('$').join('＄');
        eps.push(title + '$' + playUrl);
    }
    if (!eps.length) return JSON.stringify({ list: [] });

    let content = String(rd.qualification || rd.desc || '暂无简介');
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;

    return JSON.stringify({
        list: [{
            vod_id: did,
            vod_name: vodName,
            vod_pic: rd.coverImageUrl || '',
            vod_content: content,
            vod_remarks: (rd.total || '') + '集',
            vod_play_from: '西饭短剧',
            vod_play_url: eps.join('#')
        }]
    });
}

function play(flag, id, vipFlags) {
    return JSON.stringify({ parse: 0, playUrl: '', url: String(id || ''), header: HEADERS });
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const ts = Math.floor(Date.now() / 1000);
    const d = getJson(HOST + '/xifan/search/getSearchList?keyword=' + encodeURIComponent(String(key || '')) + '&pageIndex=' + page + '&version=2001001&androidVersionCode=28&requestId=' + ts + 'ea3a14bc0317d76f&appId=drama&teenMode=false&userBaseMode=false' + SESSION);
    return JSON.stringify({ list: mapElements(d), page: page, pagecount: 9999, limit: 90, total: 999999 });
}

export default { init, home, homeVod, category, detail, search, play };
