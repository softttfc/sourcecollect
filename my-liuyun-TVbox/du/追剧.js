// 追剧影视 - TVBox QuickJS (琉芸 JS版), 站点 www.598rc.com
var HOST = 'https://www.598rc.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; V2136A Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36';
var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var CATES = ['女频恋爱', '反转爽', '脑洞悬疑', '年代穿越', '古装仙侠', '现代都市'];

function _headers(mobile) {
    return {
        'User-Agent': mobile ? MOBILE_UA : UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': HOST + '/'
    };
}
function _get(url, mobile, retry) {
    retry = retry === undefined ? 2 : retry;
    for (var i = 0; i <= retry; i++) {
        try {
            var r = req(url, { headers: _headers(mobile), timeout: 15000 });
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
function _quote(s) {
    return encodeURIComponent(String(s).replace(/^\s+|\s+$/g, ''));
}
function isVideoFormat(url) {
    if (!url) return false;
    var u = url.split('?')[0].toLowerCase();
    return /\.(m3u8|mp4|flv|ts|mkv)$/.test(u);
}
function _b64decode(s) {
    var C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    s = String(s).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = '', i = 0;
    while (i < s.length) {
        var c1 = C.indexOf(s.charAt(i++));
        var c2 = C.indexOf(s.charAt(i++));
        var c3 = C.indexOf(s.charAt(i++));
        var c4 = C.indexOf(s.charAt(i++));
        var n = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
        out += String.fromCharCode((n >> 16) & 255);
        if (c3 !== 64) out += String.fromCharCode((n >> 8) & 255);
        if (c4 !== 64) out += String.fromCharCode(n & 255);
    }
    return out;
}
function _decodeUrl(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
}

// 列表解析(首页/分类/搜索共用 pic 结构)
function _parseList(html) {
    var videos = [];
    if (!html) return videos;
    var seen = {};
    var re = /<div class="pic">([\s\S]*?)<\/div>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var chunk = m[1];
        var lk = chunk.match(/href="\/zj(?:detail|play)\/(\d+)(?:\.html|-[^"]*)"/);
        if (!lk) continue;
        var vid = lk[1];
        if (seen[vid]) continue;
        var tm = chunk.match(/title="([^"]*)"/);
        var name = tm ? _clean(tm[1]) : '';
        if (!name) {
            var am = chunk.match(/alt="([^"]*)"/);
            name = am ? _clean(am[1]) : '';
        }
        if (!name) continue;
        seen[vid] = 1;
        var pm = chunk.match(/data-src="([^"]+)"/);
        var pic = pm ? _abs(pm[1].replace(/^\s+|\s+$/g, '')) : '';
        var rm = chunk.match(/s4[^>]*>([\s\S]*?)<\/span>/);
        videos.push({ vod_id: vid, vod_name: name, vod_pic: pic, vod_remarks: rm ? _clean(rm[1]) : '' });
    }
    return videos;
}

// 分页: /zjshow 12段(page=8) /zjsearch 14段(page=10)
function _segPagecount(html, route, segLen, pageIdx) {
    var re = new RegExp('/' + route + '/([^"\'<>]+?)\\.html', 'g');
    var m, mx = 1;
    while ((m = re.exec(html || '')) !== null) {
        var seg = m[1].split('-');
        if (seg.length === segLen && /^\d+$/.test(seg[pageIdx])) {
            var n = parseInt(seg[pageIdx], 10);
            if (n > mx) mx = n;
        }
    }
    return mx;
}

function _buildFilters() {
    var by = [{ n: '最新', v: 'time' }, { n: '人气', v: 'hits' }, { n: '评分', v: 'score' }];
    var years = [{ n: '全部', v: '' }];
    var ys = ['2026', '2025', '2024', '2023', '2022'];
    for (var j = 0; j < ys.length; j++) years.push({ n: ys[j], v: ys[j] });
    var letters = [{ n: '全部', v: '' }];
    var ls = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    for (var k = 0; k < ls.length; k++) letters.push({ n: ls[k], v: ls[k] });
    letters.push({ n: '0~9', v: '0~9' });
    var filters = {};
    for (var i = 0; i < CATES.length; i++) {
        filters[CATES[i]] = [
            { key: 'by', name: '排序', value: by },
            { key: 'year', name: '年份', value: years },
            { key: 'letter', name: '字母', value: letters }
        ];
    }
    return filters;
}

// /zjshow/5--{by}-{cateId}--{letter}---{catePg}---{year}.html
function _cateUrl(tid, pg, extend) {
    var seg = ['5', '', '', '', '', '', '', '', '', '', '', ''];
    seg[2] = extend.by ? _quote(extend.by) : '';
    seg[3] = tid ? _quote(tid) : '';
    seg[5] = extend.letter ? _quote(extend.letter) : '';
    seg[8] = String(pg);
    seg[11] = extend.year ? _quote(extend.year) : '';
    return HOST + '/zjshow/' + seg.join('-') + '.html';
}

// 多线路 div.xianlu: <a href="..."|javascript:;>线路名<small>N</small></a>
function _parseLines(phtml) {
    var lines = [];
    var block = phtml ? phtml.match(/<div class="xianlu">([\s\S]*?)<\/div>/) : null;
    if (!block) return lines;
    var re = /<a\s+([^>]*)>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(block[1])) !== null) {
        var hrefM = m[1].match(/href="([^"]*)"/);
        var href = hrefM ? hrefM[1] : '';
        var name = _clean(m[2].replace(/<small>[\s\S]*?<\/small>/g, ''));
        if (!name) continue;
        var sidM = href.match(/-(\d+)-1\.html/);
        lines.push({ name: name, href: href, sid: sidM ? sidM[1] : '' });
    }
    return lines;
}
// 剧集 div.jisu: <a href="/zjplay/{id}-{sid}-{nid}.html">集名<div class="playon">..</div></a>
function _parseEps(phtml) {
    var eps = [];
    var block = phtml ? phtml.match(/<div class="jisu">([\s\S]*?)<\/div>\s*<div class="xianlu">/) : null;
    if (!block) return eps;
    var re = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(block[1])) !== null) {
        var name = _clean(m[2].replace(/<div class="playon">[\s\S]*?<\/div>/g, ''));
        if (!name) continue;
        name = name.replace(/#/g, '').replace(/\$/g, '');
        eps.push(name + '$' + m[1]);
    }
    return eps;
}

function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < CATES.length; i++) classes.push({ type_id: CATES[i], type_name: CATES[i] });
    return { 'class': classes, 'filters': _buildFilters() };
}
function homeVideoContent() {
    var html = _get(HOST + '/zjshow/5-----------.html');
    return { list: _parseList(html) };
}
function categoryContent(tid, pg, filter, extend) {
    pg = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    extend = extend || {};
    var html = _get(_cateUrl(String(tid), pg, extend));
    var videos = _parseList(html);
    var pagecount = _segPagecount(html, 'zjshow', 12, 8);
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
    var dhtml = _get(HOST + '/zjdetail/' + vid + '.html');
    var phtml = _get(HOST + '/zjplay/' + vid + '-1-1.html');
    if (!phtml && !dhtml) return { list: [] };

    // player_aaaa 内含 vod_name/vod_actor/vod_director/vod_class/url/from/sid
    var data = null;
    var pj = phtml ? phtml.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/) : null;
    if (pj) { try { data = JSON.parse(pj[1]); } catch (e) { data = null; } }
    var vd = data && data.vod_data ? data.vod_data : {};

    var name = _clean(vd.vod_name || '');
    if (!name) {
        var nm = phtml ? phtml.match(/<h1 class="name[^"]*"[^>]*>([\s\S]*?)<\/h1>/) : null;
        if (nm) name = _clean(nm[1]).replace(/全集$/, '');
    }
    if (!name) {
        var tm = phtml ? phtml.match(/<title>([\s\S]*?)<\/title>/) : null;
        name = tm ? _clean(tm[1]).replace(/^《|》.*$/g, '') : '';
    }
    var pic = '';
    var dm = dhtml ? dhtml.match(/<div class="pic">\s*<a href="\/zjplay\/[^"]*"[^>]*>\s*<img[^>]+data-src="([^"]+)"/) : null;
    if (dm) pic = _abs(dm[1]);
    if (!pic) {
        var dm2 = phtml ? phtml.match(/<img[^>]+data-src="(\/upload\/[^"]+)"/) : null;
        if (dm2) pic = _abs(dm2[1]);
    }

    var actor = htmlUnescape(_clean(vd.vod_actor || '')).replace(/&amp;/g, '&');
    var director = htmlUnescape(_clean(vd.vod_director || ''));
    var vclass = _clean(vd.vod_class || '');

    var year = '';
    if (phtml) {
        var ym = phtml.match(/\/zjshow\/5-----------(\d{4})\.html/);
        if (ym) year = ym[1];
    }
    var area = '';
    if (phtml) {
        var am = phtml.match(/\/zjshow\/5-([^-][^"]*?)-{10}\.html"[^>]*>([\s\S]*?)<\/a>/);
        if (am) area = _clean(am[2]);
    }
    var content = '';
    if (phtml) {
        var cm = phtml.match(/id="ysinfotext"[^>]*>([\s\S]*?)<\/div>/);
        if (cm) content = _clean(cm[1]);
    }
    if (!content || content === '内详') content = '暂无简介';
    if (content.indexOf(DESC_PREFIX) !== 0) content = DESC_PREFIX + content;

    // 线路与剧集: 当前页对应的线路直接取, 其余线路逐页抓取
    var lines = _parseLines(phtml);
    var playFrom = [], playUrl = [];
    var curSid = data && data.sid !== undefined ? String(data.sid) : '1';
    for (var i = 0; i < lines.length; i++) {
        var ln = lines[i];
        var sid = ln.sid || curSid;
        var eps;
        if (sid === curSid) {
            eps = _parseEps(phtml);
        } else {
            eps = _parseEps(_get(HOST + '/zjplay/' + vid + '-' + sid + '-1.html'));
        }
        if (!eps.length) eps = ['全集$' + '/zjplay/' + vid + '-' + sid + '-1.html'];
        playFrom.push(ln.name);
        playUrl.push(eps.join('#'));
    }
    if (!playFrom.length) {
        var eps0 = _parseEps(phtml);
        playFrom.push('默认');
        playUrl.push(eps0.length ? eps0.join('#') : ('全集$' + '/zjplay/' + vid + '-1-1.html'));
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
            type_name: vclass,
            vod_content: content,
            vod_play_from: playFrom.join('$$$'),
            vod_play_url: playUrl.join('$$$')
        }]
    };
}
function playerContent(flag, id, vipFlags) {
    var url = _abs(String(id || ''));
    var header = { 'User-Agent': UA, 'Referer': HOST + '/' };
    var result = { parse: 1, playUrl: '', url: url, header: header };
    var html = _get(url);
    if (!html) return result;
    var m = html.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (!m) return result;
    var real = '';
    var data = null;
    try { data = JSON.parse(m[1]); } catch (e) { data = null; }
    if (data) {
        real = data.url || '';
        var enc = data.encrypt;
        if (enc === 1 || enc === '1') {
            real = _decodeUrl(real);
        } else if (enc === 2 || enc === '2') {
            real = _decodeUrl(_b64decode(real));
        }
    } else {
        var mm = m[1].match(/"url"\s*:\s*"([\s\S]*?)"/);
        real = mm ? mm[1] : '';
    }
    if (!real) return result;
    real = real.replace(/\\\//g, '/');
    if (real.indexOf('//') === 0) real = 'https:' + real;
    result.url = real;
    result.parse = isVideoFormat(real) ? 0 : 1;
    return result;
}
function searchContent(key, quick, pg) {
    pg = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    // /zjsearch/{wd}----------{pg}---.html 共14段
    var seg = ['', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    seg[0] = _quote(key);
    seg[10] = String(pg);
    var url = HOST + '/zjsearch/' + seg.join('-') + '.html';
    var html = _get(url, true);
    if (html && (html.indexOf('verify-card') > -1 || html.indexOf('安全验证') > -1)) html = '';
    var videos = _parseList(html);
    var pagecount = _segPagecount(html, 'zjsearch', 14, 10);
    return {
        list: videos,
        page: pg,
        pagecount: Math.max(pagecount, pg),
        limit: videos.length ? videos.length : 10,
        total: videos.length ? pagecount * videos.length : 0
    };
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
