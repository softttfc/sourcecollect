// 护航影院 - TVBox QuickJS (琉芸JS版), 站点 www.qdhuhang.com
var HOST = 'https://www.qdhuhang.com';
var MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; V2136A Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36';
var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var CATES = [
    ['女频剧', '49'], ['反转剧', '50'], ['穿越剧', '51'], ['古装剧', '52'],
    ['都市剧', '53'], ['脑洞剧', '54'], ['爽文剧', '55']
];

function _headers() {
    return {
        'User-Agent': MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': HOST + '/'
    };
}
function _get(url, retry) {
    retry = retry === undefined ? 2 : retry;
    for (var i = 0; i <= retry; i++) {
        try {
            var r = req(url, { headers: _headers(), timeout: 15000 });
            if (r && r.content) return r.content;
        } catch (e) { }
    }
    return '';
}
function htmlUnescape(s) {
    return String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—');
}
function _clean(text) {
    if (!text) return '';
    var t = String(text).replace(/<[^>]+>/g, '');
    t = htmlUnescape(t).replace(/ /g, ' ');
    t = t.replace(/\s+/g, ' ');
    return t.replace(/^\s+|\s+$/g, '');
}
function _abs(url) {
    if (!url) return '';
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('/') === 0) return HOST + url;
    if (url.indexOf('http') === 0) return url;
    return HOST + '/' + url;
}
function isVideoFormat(url) {
    if (!url) return false;
    var u = url.split('?')[0].toLowerCase();
    return /\.(m3u8|mp4|flv|ts|mkv)$/.test(u);
}

// 列表: <li class="fed-list-item..."><a ... fed-part-2by3" href="/huhzc/{id}.html" data-original="PIC">
//       <span...></span><span class="...fed-text-center">备注</span></a><a ... html">名称</a>...</li>
function _parseList(html) {
    var videos = [];
    if (!html) return videos;
    var seen = {};
    var re = /fed-part-2by3"\s+href="\/huhzc\/(\d+)\.html"\s+data-original="([^"]*)"([\s\S]*?)<\/li>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var vid = m[1];
        if (seen[vid]) continue;
        seen[vid] = 1;
        var chunk = m[3];
        var tm = chunk.match(/html">([\s\S]*?)<\/a>/);
        var name = tm ? _clean(tm[1]) : '';
        if (!name) continue;
        var rm = chunk.match(/fed-text-center">([\s\S]*?)<\/span>/);
        videos.push({
            vod_id: vid,
            vod_name: name,
            vod_pic: _abs(m[2]),
            vod_remarks: rm ? _clean(rm[1]) : ''
        });
    }
    return videos;
}

function _pagecount(html, cateId) {
    var re = new RegExp('/qdhyl/' + cateId + '-(\\d+)\\.html', 'g');
    var m, mx = 1;
    while ((m = re.exec(html || '')) !== null) {
        var n = parseInt(m[1], 10);
        if (n > mx) mx = n;
    }
    return mx;
}

function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < CATES.length; i++) classes.push({ type_id: CATES[i][1], type_name: CATES[i][0] });
    return { 'class': classes, 'filters': {} };
}
function homeVideoContent() {
    var html = _get(HOST + '/qdhyl/48.html');
    return { list: _parseList(html) };
}
function categoryContent(tid, pg, filter, extend) {
    pg = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    var html = _get(HOST + '/qdhyl/' + tid + '-' + pg + '.html');
    var videos = _parseList(html);
    var pagecount = _pagecount(html, String(tid));
    return {
        list: videos,
        page: pg,
        pagecount: Math.max(pagecount, pg),
        limit: videos.length ? videos.length : 30,
        total: videos.length ? pagecount * videos.length : 0
    };
}
function detailContent(ids) {
    var vid = String(ids).split(',')[0];
    var im = vid.match(/(\d+)/);
    vid = im ? im[1] : vid;
    var html = _get(HOST + '/huhzc/' + vid + '.html');
    if (!html) return { list: [] };

    var meta = html.match(/<meta name="description" content="([\s\S]*?)"/);
    var desc = meta ? htmlUnescape(meta[1]) : '';
    var name = '';
    var nm = desc.match(/提供《([\s\S]*?)》/);
    if (nm) name = _clean(nm[1]);
    if (!name) {
        var tt = html.match(/<title>([\s\S]*?)<\/title>/);
        name = tt ? _clean(tt[1]).split('-')[0].replace(/^\s+|\s+$/g, '') : '';
    }
    var pic = '';
    var pm = html.match(/fed-part-2by3"\s+href="\/huhzc\/\d+\.html"\s+data-original="([^"]+)"/);
    if (pm) pic = _abs(pm[1]);

    var actor = '';
    var am = desc.match(/主演分别是([\s\S]*?)共同合作/);
    if (am) actor = _clean(am[1]);
    var director = '';
    var drm = desc.match(/导演([\s\S]*?)，主演/);
    if (drm) director = _clean(drm[1]);
    var year = '';
    var ym = desc.match(/(\d{4})年上映/);
    if (ym) year = ym[1];
    var area = '';
    var arm = desc.match(/上映于([\s\S]*?)地区/);
    if (arm) area = _clean(arm[1]);

    var content = '';
    var cm = desc.match(/讲述了:([\s\S]*?)$/);
    if (cm) content = _clean(cm[1]);
    if (!content) {
        var cp = html.match(/《[\s\S]*?》讲述了:([\s\S]*?)<\/p>/);
        if (cp) content = _clean(cp[1]);
    }
    if (!content) content = '暂无简介';
    if (content.indexOf(DESC_PREFIX) !== 0) content = DESC_PREFIX + content;

    // 线路: <span id="{pid}"><img src="/zuoz/img/ico_play.png"> 线路名</span>
    // 剧集: <dd class="{pid}"><ul class="ulNumList clearfix list_1">...<a title="集名" href="/angplay/...">..</a></ul></dd>
    var lineRe = /<span id="([^"]+)"[^>]*>\s*<img src="\/zuoz\/img\/ico_play\.png">([\s\S]*?)<\/span>/g;
    var lm;
    var playFrom = [], playUrl = [];
    while ((lm = lineRe.exec(html)) !== null) {
        var pid = lm[1];
        var lname = _clean(lm[2]);
        if (!lname) continue;
        var ddRe = new RegExp('<dd class="' + pid + '"[^>]*>([\\s\\S]*?)<\\/dd>');
        var dd = html.match(ddRe);
        var eps = [];
        if (dd) {
            var epRe = /<a\s+title="([^"]*)"\s+href="([^"]+)"[^>]*>/g;
            var em;
            while ((em = epRe.exec(dd[1])) !== null) {
                var ename = _clean(em[1]).replace(/#/g, '').replace(/\$/g, '');
                if (!ename) continue;
                eps.push(ename + '$' + em[2]);
            }
        }
        playFrom.push(lname);
        playUrl.push(eps.join('#'));
    }
    if (!playFrom.length) {
        playFrom.push('默认');
        playUrl.push('');
    }

    return {
        list: [{
            vod_id: vid,
            vod_name: name,
            vod_pic: pic,
            vod_year: year,
            vod_area: area,
            vod_lang: '国语',
            vod_remarks: '',
            vod_actor: actor,
            vod_director: director,
            type_name: '',
            vod_content: content,
            vod_play_from: playFrom.join('$$$'),
            vod_play_url: playUrl.join('$$$')
        }]
    };
}
function playerContent(flag, id, vipFlags) {
    var url = _abs(String(id || ''));
    var header = { 'User-Agent': MOBILE_UA, 'Referer': HOST + '/' };
    var result = { parse: 1, playUrl: '', url: url, header: header };
    var html = _get(url);
    if (!html) return result;
    // var now="https://.../index.m3u8"
    var m = html.match(/var now="([\s\S]*?)"/);
    if (!m || !m[1]) return result;
    var real = m[1].replace(/\\\//g, '/');
    if (real.indexOf('//') === 0) real = 'https:' + real;
    result.url = real;
    result.parse = isVideoFormat(real) ? 0 : 1;
    return result;
}
function searchContent(key, quick, pg) {
    // 规则未提供搜索接口, 返回空
    return { list: [], page: 1, pagecount: 1, limit: 0, total: 0 };
}

var spider = {
    init: function (extend) { },
    home: function (filter) { return JSON.stringify(homeContent(filter)); },
    homeVod: function () { return JSON.stringify(homeVideoContent()); },
    category: function (tid, pg, filter, extend) { return JSON.stringify(categoryContent(tid, pg, filter, extend)); },
    detail: function (ids) { return JSON.stringify(detailContent(ids)); },
    play: function (flag, id, vipFlags) { return JSON.stringify(playerContent(flag, id, vipFlags)); },
    search: function (key, quick, pg) { return JSON.stringify(searchContent(key, quick, pg)); }
};

export default spider;
