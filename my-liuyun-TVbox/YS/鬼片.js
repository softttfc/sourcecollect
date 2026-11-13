// 鬼片360 (www.guipian360.org) - TVBox QuickJS 琉芸JS版
var HOST = 'https://www.guipian360.org';
var UA = 'Dalvik/2.1.0 (Linux; U; Android 13)';
var PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

var CLASSES = [
    { type_id: '1', type_name: '鬼片大全' },
    { type_id: '6', type_name: '大陆鬼片' },
    { type_id: '9', type_name: '港台鬼片' },
    { type_id: '8', type_name: '林正英鬼片' },
    { type_id: '7', type_name: '日韩鬼片' },
    { type_id: '11', type_name: '欧美鬼片' },
    { type_id: '10', type_name: '泰国鬼片' },
    { type_id: '3', type_name: '恐怖片' },
    { type_id: '2', type_name: '电视剧' }
];

function hdrs() {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': HOST + '/',
        'Connection': 'keep-alive'
    };
}

function fetchHtml(url) {
    try {
        var r = req(url, { headers: hdrs(), timeout: 15000 });
        return (r && r.content) || '';
    } catch (e) {
        return '';
    }
}

function decodeEntities(s) {
    return (s || '').replace(/&nbsp;/g, ' ').replace(/&ensp;/g, '').replace(/&emsp;/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function cleanText(s) {
    return decodeEntities((s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function fixPic(u) {
    if (!u) return '';
    if (u.indexOf('http') === 0) return u;
    if (u.charAt(0) === '/') return HOST + u;
    return u;
}

function cleanName(s) {
    return decodeEntities(s || '').split('/')[0].replace(/^\s+|\s+$/g, '').replace(/《/g, '').replace(/》/g, '');
}

function extractVideos(html) {
    var vodList = [], seen = {};
    if (!html) return vodList;
    var re = /<[^>]+class="[^"]*u-movie[^"]*"[\s\S]*?<\/(?:article|div|li)>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var block = m[0];
        var hrefM = /href="([^"]+)"/.exec(block);
        var titleM = /title="([^"]+)"/.exec(block);
        if (!titleM) titleM = /alt="([^"]+)"/.exec(block);
        if (!titleM) titleM = /<h2>([^<]+)<\/h2>/.exec(block);
        var picM = /data-original="([^"]+)"/.exec(block);
        if (!picM) picM = /src="([^"]+)"/.exec(block);
        var remarkM = /class="zhuangtai"[^>]*>(?:<span>)?([^<]+)/.exec(block);
        if (!hrefM || !titleM) continue;
        var idM = /\/(\d+)\.html/.exec(hrefM[1]);
        if (!idM) continue;
        var vid = idM[1];
        if (seen[vid]) continue;
        seen[vid] = 1;
        vodList.push({
            vod_id: vid,
            vod_name: cleanName(titleM[1]),
            vod_pic: fixPic(picM ? picM[1] : ''),
            vod_remarks: remarkM ? cleanText(remarkM[1]) : ''
        });
    }
    return vodList;
}

// ================= 接口 =================
function homeContent(filter) {
    var html = fetchHtml(HOST);
    return { 'class': CLASSES, list: extractVideos(html) };
}

function homeVideoContent() {
    return { list: extractVideos(fetchHtml(HOST)) };
}

function categoryContent(tid, pg, filter, extend) {
    try {
        var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
        var url = page > 1 ? HOST + '/list/' + tid + '_' + page + '.html' : HOST + '/list/' + tid + '.html';
        var html = fetchHtml(url);
        var vlist = extractVideos(html);
        var pageCount = 99;
        var pm = /href="\/list\/\d+_(\d+)\.html"[^>]*>\.\./.exec(html);
        if (pm) pageCount = parseInt(pm[1], 10);
        return { list: vlist, page: page, pagecount: pageCount, limit: 20, total: 9999 };
    } catch (e) {
        return { list: [], page: 1, pagecount: 1, limit: 20, total: 0 };
    }
}

function searchContent(key, quick, pg) {
    try {
        var html = fetchHtml(HOST + '/index.php?m=vod-search&wd=' + encodeURIComponent(String(key)));
        return { list: extractVideos(html), page: parseInt(pg, 10) || 1 };
    } catch (e) {
        return { list: [], page: 1 };
    }
}

function detailContent(ids) {
    var vid = String(ids).split(',')[0].replace(/^\s+|\s+$/g, '');
    var html = fetchHtml(HOST + '/nv/' + vid + '.html');
    if (!html) return { list: [] };

    // 线路名 + 剧集 (#tv_tab 内, 截止 new max_tab)
    var tabs = [], playUrls = [];
    var tvStart = html.indexOf('id="tv_tab"');
    if (tvStart >= 0) {
        var seg = html.substring(tvStart);
        var endIdx = seg.indexOf('new max_tab');
        if (endIdx >= 0) seg = seg.substring(0, endIdx);
        var firstList = seg.indexOf('class="list');
        var tabZone = firstList >= 0 ? seg.substring(0, firstList) : seg;
        var reTab = /<li[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/g;
        var tm;
        while ((tm = reTab.exec(tabZone)) !== null) {
            var tn = cleanText(tm[1]);
            if (tn) tabs.push(tn);
        }
        // 各线路剧集块: <dl class="list c_N"...><ul class="abc">...
        var chunks = seg.split(/<dl class="list[^"]*"/);
        for (var i = 1; i < chunks.length; i++) {
            var chunk = chunks[i];
            var eps = [];
            var reA = /<a[^>]*href=["'][^"']*?\/play\/([^"']+?)\.html["'][^>]*>([\s\S]*?)<\/a>/g;
            var am;
            while ((am = reA.exec(chunk)) !== null) {
                var nm = cleanText(am[2]).replace(/\$/g, ' ').replace(/#/g, ' ');
                if (nm && am[1]) eps.push(nm + '$' + am[1]);
            }
            playUrls.push(eps.join('#'));
        }
    }
    if (!tabs.length) tabs = ['默认播放线路'];
    while (playUrls.length < tabs.length) playUrls.push('');

    var vodName = '';
    var nm = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (nm) vodName = cleanName(nm[1]);
    if (!vodName) {
        var tt = /<title>([\s\S]*?)<\/title>/.exec(html);
        if (tt) vodName = cleanName(tt[1].split('-')[0]);
    }
    if (!vodName) vodName = '未知影片';

    var picM = /<img[^>]+data-original="([^"]+)"/.exec(html);
    if (!picM) picM = /<img[^>]+src="([^"]+)"[^>]*class="lazy"/.exec(html);
    var vodPic = fixPic(picM ? picM[1] : '');

    var content = '';
    var cm = /<p class="jianjie-p"[^>]*>([\s\S]*?)<\/p>/.exec(html);
    if (cm) content = cleanText(cm[1]);
    if (!content) content = '暂无该影片的相关简介。';
    if (content.indexOf(PREFIX) !== 0) content = PREFIX + content;

    function meta(pattern, def) {
        var m = pattern.exec(html);
        return m ? cleanText(m[1]) : def;
    }

    return {
        list: [{
            vod_id: vid,
            vod_name: vodName,
            vod_pic: vodPic,
            vod_content: content,
            vod_director: meta(/<span>导演：<\/span>([\s\S]*?)<\/li>/, '未知'),
            vod_actor: meta(/<span>主演：<\/span>([\s\S]*?)<\/li>/, '未知'),
            vod_year: meta(/<strong>(\d{4})年<\/strong>/, '近期'),
            vod_area: meta(/地区：<\/span><a[^>]*>([\s\S]*?)<\/a>/, '未知'),
            vod_play_from: tabs.join('$$$'),
            vod_play_url: playUrls.join('$$$')
        }]
    };
}

function playerContent(flag, id, vipFlags) {
    var playUrl = HOST + '/play/' + id + '.html';
    var html = fetchHtml(playUrl);
    if (html.indexOf('var now="') === -1) {
        playUrl = HOST + '/play/' + id + '-0-0.html';
        html = fetchHtml(playUrl);
    }
    var m = /var now="([^"]+)"/.exec(html);
    if (m) {
        return { parse: 0, url: m[1], header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
    }
    return { parse: 1, url: playUrl, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
}

var spider = {
    init: function (extend) {
        try {
            if (extend && typeof extend === 'string' && extend.indexOf('http') === 0) {
                HOST = extend.replace(/\/+$/, '');
            }
        } catch (e) { }
    },
    home: function (filter) { return JSON.stringify(homeContent(filter)); },
    homeVod: function () { return JSON.stringify(homeVideoContent()); },
    category: function (tid, pg, filter, extend) { return JSON.stringify(categoryContent(tid, pg, filter, extend)); },
    detail: function (ids) { return JSON.stringify(detailContent(ids)); },
    play: function (flag, id, vipFlags) { return JSON.stringify(playerContent(flag, id, vipFlags)); },
    search: function (key, quick, pg) { return JSON.stringify(searchContent(key, quick, pg)); }
};

export default spider;
