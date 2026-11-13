// 短剧巴士 - TVBox QuickJS (琉芸 JS版), 站点 www.duanju84.com (MacCMS模板HTML爬虫)
var HOST = 'https://www.duanju84.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var CATE_MANUAL = [
    ['短剧', '27'],
    ['男频爽剧', 'label_boy'],
    ['女频爽剧', 'label_girl'],
    ['热门推荐', 'label_hot']
];
var CLASS_FALLBACK = ['重生', '民国', '穿越', '年代', '现代', '言情', '反转', '爽文', '女恋', '总裁', '闪婚', '离婚', '都市', '脑洞', '古装', '仙侠'];
var FROM_NAMES = {
    'bfzym3u8': '暴风', 'lzm3u8': '量子', 'ffm3u8': '非凡', 'snm3u8': '闪电',
    'tkm3u8': '天空', 'hnm3u8': '海纳', 'jsm3u8': '极速', 'dbm3u8': '多宝',
    'lem3u8': '乐视', 'wjm3u8': '无尽', 'ukm3u8': '优酷', 'play': '默认'
};
var _filterCache = null;
var _lastSearch = 0;

function _headers() {
    return {
        'User-Agent': UA,
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
// 搜索接口限频3秒: QuickJS无线程不能sleep, 用自旋守卫
function _spinWait(ms) {
    var start = Date.now();
    while (Date.now() - start < ms) { }
}
function _searchGet(url, retry) {
    retry = retry === undefined ? 2 : retry;
    for (var i = 0; i <= retry; i++) {
        var wait = 3200 - (Date.now() - _lastSearch);
        if (wait > 0) _spinWait(wait);
        var html = _get(url, 1);
        _lastSearch = Date.now();
        // 滑块/图形验证码拦截: 直接放弃, 优雅降级为空列表
        if (html && (html.indexOf('verify-card') > -1 || html.indexOf('安全验证') > -1)) return '';
        if (html && html.indexOf('频繁操作') < 0) return html;
    }
    return '';
}
function htmlUnescape(s) {
    return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '—');
}
function _clean(text) {
    if (!text) return '';
    var t = String(text).replace(/<[^>]+>/g, '');
    t = htmlUnescape(t).replace(/ /g, ' ');
    t = t.replace(/\s+/g, ' ');
    var out = t.replace(/^\s+|\s+$/g, '');
    return out;
}
function _abs(url) {
    if (!url) return '';
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('/') === 0) return HOST + url;
    if (url.indexOf('http') === 0) return url;
    return HOST + '/' + url;
}
function _maxPage(html, pattern) {
    var re = new RegExp(pattern, 'g');
    var m, mx = 1;
    while ((m = re.exec(html || '')) !== null) {
        var n = parseInt(m[1], 10);
        if (n > mx) mx = n;
    }
    return mx;
}
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
function _quotePlus(s) {
    return encodeURIComponent(String(s).replace(/^\s+|\s+$/g, '')).replace(/%20/g, '+');
}
// 对齐 Python quote(safe=":/?#[]@!$&'()*+,;=%~")
function _quoteUrl(s) {
    var safe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~:/?#[]@!$&'()*+,;=%";
    var out = '';
    var b = unescape(encodeURIComponent(s));
    for (var i = 0; i < b.length; i++) {
        var ch = b.charAt(i);
        if (safe.indexOf(ch) > -1) out += ch;
        else out += '%' + ('0' + b.charCodeAt(i).toString(16).toUpperCase()).slice(-2);
    }
    return out;
}
function isVideoFormat(url) {
    if (!url) return false;
    var u = url.split('?')[0].toLowerCase();
    return /\.(m3u8|mp4|flv|ts|mkv|avi)$/.test(u);
}

// 列表解析(首页/分类/标签/搜索共用 img-list 结构)
function _parseList(html) {
    var videos = [];
    if (!html) return videos;
    var seen = {};
    var re = /<a\s+href="\/duanju\/(\d+)\.html"\s+title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var vid = m[1];
        if (seen[vid]) continue;
        seen[vid] = 1;
        var inner = m[3];
        var pic = '';
        var pm = inner.match(/data-original="([^"]+)"/);
        if (pm) pic = _abs(pm[1].replace(/^\s+|\s+$/g, ''));
        if (!pic) {
            var im = inner.match(/<img[^>]+src="([^"]+)"/);
            if (im && im[1].indexOf('load.png') < 0) pic = _abs(im[1].replace(/^\s+|\s+$/g, ''));
        }
        var name = _clean(m[2]);
        if (!name) {
            var nm = inner.match(/<p class="txt-ov">([\s\S]*?)<\/p>/);
            name = nm ? _clean(nm[1]) : '';
        }
        if (!name) continue;
        videos.push({ vod_id: vid, vod_name: name, vod_pic: pic, vod_remarks: '' });
    }
    return videos;
}

function _fetchClasses() {
    var html = _get(HOST + '/list/27.html');
    var names = [];
    var re = /href="\/show\/27---([^-"]*)-{8}\.html"\s+title="([^"]*)"/g;
    var m;
    while ((m = re.exec(html || '')) !== null) {
        var name = _clean(m[2]);
        if (!name || name === '全部') continue;
        var raw = _clean(decodeURIComponent(m[1].replace(/\+/g, ' ')));
        var dup = false;
        for (var i = 0; i < names.length; i++) if (names[i][1] === raw) { dup = true; break; }
        if (raw && !dup) names.push([name, raw]);
    }
    if (!names.length) {
        for (var j = 0; j < CLASS_FALLBACK.length; j++) names.push([CLASS_FALLBACK[j], CLASS_FALLBACK[j]]);
    }
    return names;
}
function _buildFilters() {
    if (_filterCache) return _filterCache;
    var cls = [{ n: '全部', v: '' }];
    var list = _fetchClasses();
    for (var i = 0; i < list.length; i++) cls.push({ n: list[i][0], v: list[i][1] });
    var by = [{ n: '最新', v: 'time' }, { n: '人气', v: 'hits' }, { n: '评分', v: 'score' }];
    var years = [{ n: '全部', v: '' }];
    var ys = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
    for (var j = 0; j < ys.length; j++) years.push({ n: ys[j], v: ys[j] });
    _filterCache = {
        '27': [
            { key: 'class', name: '类型', value: cls },
            { key: 'by', name: '排序', value: by },
            { key: 'year', name: '年份', value: years }
        ]
    };
    return _filterCache;
}

function _showPage(tid, pg, extend) {
    // /show/{0:id}-{1:area}-{2:by}-{3:class}-{4:lang}-{5:letter}-{6:}-{7:}-{8:page}-{9:}-{10:}-{11:year}.html
    var seg = ['', '', '', '', '', '', '', '', '', '', '', ''];
    seg[0] = tid;
    seg[1] = extend.area ? _quotePlus(extend.area) : '';
    seg[2] = extend.by ? _quotePlus(extend.by) : '';
    seg[3] = extend['class'] ? _quotePlus(extend['class']) : '';
    seg[4] = extend.lang ? _quotePlus(extend.lang) : '';
    seg[8] = String(pg);
    seg[11] = extend.year ? _quotePlus(extend.year) : '';
    var url = HOST + '/show/' + seg.join('-') + '.html';
    var html = _get(url);
    var pc = _segPagecount(html, 'show', 12, 8);
    return [html, Math.max(pc, pg)];
}
function _labelPage(tag, pg) {
    var url = pg <= 1 ? (HOST + '/label/' + tag + '.html') : (HOST + '/label/' + tag + '/page/' + pg + '.html');
    var html = _get(url);
    var pc = _maxPage(html, '/label/[^"/]+/page/(\\d+)\\.html');
    return [html, Math.max(pc, pg)];
}

function _parseEps(chunk) {
    var eps = [];
    var re = /<a href="(\/djplay\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    var m;
    while ((m = re.exec(chunk || '')) !== null) {
        var t = _clean(m[2]);
        if (!t) continue;
        eps.push(t.replace(/#/g, '').replace(/\$/g, '') + '$' + m[1]);
    }
    return eps;
}
function _parsePlays(vid, detailHtml) {
    var playFrom = [], playUrl = [];
    var phtml = _get(HOST + '/djplay/' + vid + '-1-1.html');
    if (phtml) {
        var tabs = phtml.match(/<section class="tab clearfix" id="play_tab">([\s\S]*?)<\/section>/);
        var names = [];
        if (tabs) {
            var nre = /<li[^>]*><a[^>]*>([\s\S]*?)<\/a><\/li>/g;
            var nm;
            while ((nm = nre.exec(tabs[1])) !== null) names.push(_clean(nm[1]));
        }
        var boxes = phtml.match(/<section class="tab_box[^"]*" id="play_tab_box">([\s\S]*?)<\/section>/);
        var items = [];
        if (boxes) {
            var ire = /<div class="item[^"]*">\s*<div class="video_list[^"]*">([\s\S]*?)<\/div>/g;
            var im;
            while ((im = ire.exec(boxes[1])) !== null) items.push(im[1]);
        }
        var alt = '';
        if (!names.length) {
            var fm = phtml.match(/"from"\s*:\s*"([^"]*)"/);
            if (fm) alt = FROM_NAMES[fm[1]] || fm[1] || '';
        }
        for (var idx = 0; idx < items.length; idx++) {
            var eps = _parseEps(items[idx]);
            if (!eps.length) continue;
            var src;
            if (idx < names.length && names[idx]) src = names[idx];
            else if (idx === 0 && alt) src = alt;
            else src = '线路' + (idx + 1);
            playFrom.push(src);
            playUrl.push(eps.join('#'));
        }
    }
    if (!playFrom.length) {
        var box = (detailHtml || '').match(/id="play_tab_box">\s*<div class="video_list[^"]*">([\s\S]*?)<\/div>/);
        var eps2 = box ? _parseEps(box[1]) : [];
        if (eps2.length) {
            playFrom.push('默认');
            playUrl.push(eps2.join('#'));
        }
    }
    if (!playFrom.length) {
        playFrom.push('默认');
        playUrl.push('');
    }
    return [playFrom, playUrl];
}

function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < CATE_MANUAL.length; i++) classes.push({ type_id: CATE_MANUAL[i][1], type_name: CATE_MANUAL[i][0] });
    return { 'class': classes, 'filters': _buildFilters() };
}
function homeVideoContent() {
    var html = _get(HOST + '/');
    return { list: _parseList(html) };
}
function categoryContent(tid, pg, filter, extend) {
    pg = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    extend = extend || {};
    var html, pagecount;
    if (String(tid).indexOf('label_') === 0) {
        var r = _labelPage(String(tid).slice(6), pg);
        html = r[0]; pagecount = r[1];
    } else {
        var r2 = _showPage(String(tid), pg, extend);
        html = r2[0]; pagecount = r2[1];
    }
    var videos = _parseList(html);
    return {
        list: videos,
        page: pg,
        pagecount: pagecount,
        limit: videos.length ? videos.length : 30,
        total: videos.length ? pagecount * videos.length : 0
    };
}
function detailContent(ids) {
    var vid = String(ids).split(',')[0];
    var html = _get(HOST + '/duanju/' + vid + '.html');
    if (!html) return { list: [] };
    var name = '';
    var m = html.match(/<div class="detail-title[^"]*"[^>]*>\s*<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (m) name = _clean(m[1]);
    if (!name) {
        m = html.match(/<title>([\s\S]*?)<\/title>/);
        name = m ? _clean(m[1]).split('-')[0].replace(/^\s+|\s+$/g, '') : '';
    }
    var pic = '';
    m = html.match(/<div class="detail-pic[^"]*"[^>]*>\s*<img[^>]+data-original="([^"]+)"/);
    if (m) pic = _abs(m[1]);
    if (!pic) {
        m = html.match(/data-original="(https?:\/\/[^"]+)"/);
        pic = m ? _abs(m[1]) : '';
    }
    var actor = '', vclass = '', remarks = '';
    var dre = /<dt>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
    var dm;
    while ((dm = dre.exec(html)) !== null) {
        var key = _clean(dm[1]).replace(/[：:]$/, '');
        var val = _clean(dm[2]);
        if (key === '主角' || key === '主演') actor = val;
        else if (key === '分类') vclass = val.replace(/ /g, ' / ');
        else if (key === '状态' || key === '备注') remarks = val;
    }
    var content = '';
    m = html.match(/<div class="content-info[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (m) content = _clean(m[1]);
    if (name) content = content.replace(new RegExp('^《' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '》\\s*'), '');
    var year = '';
    m = content.match(/((?:19|20)\d{2})年上映/);
    if (m) year = m[1];
    if (!year && pic) {
        m = pic.match(/\/upload\/vod\/((?:19|20)\d{2})\d{4}/);
        if (m) year = m[1];
    }
    var pp = _parsePlays(vid, html);
    if (content.indexOf(DESC_PREFIX) !== 0) content = DESC_PREFIX + (content || '暂无简介');
    return {
        list: [{
            vod_id: vid,
            vod_name: name,
            vod_pic: pic,
            vod_year: year,
            vod_area: '中国大陆',
            vod_lang: '国语',
            vod_remarks: remarks,
            vod_actor: actor,
            vod_director: '',
            type_name: vclass,
            vod_content: content,
            vod_play_from: pp[0].join('$$$'),
            vod_play_url: pp[1].join('$$$')
        }]
    };
}
function playerContent(flag, id, vipFlags) {
    var header = { 'User-Agent': UA, 'Referer': HOST + '/' };
    var url = _abs(String(id || ''));
    var result = { parse: 1, playUrl: '', url: url, header: header };
    var html = _get(url);
    var real = '';
    if (html) {
        var m = html.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (!m) m = html.match(/player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (m) {
            try {
                var data = JSON.parse(m[1]);
                real = data.url || '';
            } catch (e) {
                var mm = m[1].match(/"url"\s*:\s*"([\s\S]*?)"/);
                real = mm ? mm[1].replace(/\\\//g, '/') : '';
            }
        }
        if (!real) {
            var mm2 = html.match(/(https?[^"']*?\.m3u8[^"']*)/);
            real = mm2 ? mm2[1].replace(/\\\//g, '/') : '';
        }
    }
    if (real) {
        real = real.replace(/\\\//g, '/');
        if (real.indexOf('//') === 0) real = 'https:' + real;
        real = _quoteUrl(real);
        result.url = real;
        result.parse = isVideoFormat(real) ? 0 : 1;
    }
    return result;
}
function searchContent(key, quick, pg) {
    pg = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    // /search/{wd}-{1..9}-{10:page}-{11}-{12}-{13}.html 共14段
    var seg = ['', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    seg[0] = _quotePlus(key);
    seg[10] = String(pg);
    var url = HOST + '/search/' + seg.join('-') + '.html';
    var html = _searchGet(url);
    var videos = _parseList(html);
    var pagecount = _segPagecount(html, 'search', 14, 10);
    return {
        list: videos,
        page: pg,
        pagecount: Math.max(pagecount, pg),
        limit: videos.length ? videos.length : 9,
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
