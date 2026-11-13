/**
 * 奇优影院 TVBox QuickJS 爬虫（琉芸JS版）
 * 单站 HTML 解析（stui 模板）+ 二级播放解析（iframe -> videoUrl / api.php）
 * 实站适配：
 *  1. 封面图位于 a 标签 style="background:url(...)"，原版 xpath 取不到，已补充提取
 *  2. 搜索 GET /search.php 会被 302 回首页，已改为 POST 表单提交
 */

var HOST = 'http://www.qiyoudy2.com';
var UA_SPIDER = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)';
var UA_PLAY = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
var INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var TIMEOUT = 20000; // 毫秒

var CATEGORIES = [
    { type_id: '2', type_name: '电视剧' },
    { type_id: '1', type_name: '电影' },
    { type_id: '3', type_name: '动漫' },
    { type_id: '4', type_name: '综艺' }
];

var _homeCache = { t: 0, data: null };

function _get(url, referer) {
    try {
        var res = req(url, {
            method: 'get',
            headers: {
                'User-Agent': UA_SPIDER,
                'Referer': referer || (HOST + '/'),
                'Accept-Encoding': 'identity'
            },
            timeout: TIMEOUT
        });
        if (!res || !res.content) return null;
        var text = res.content;
        text = text.replace(/^﻿/, '');
        text = text.replace(/^\s*<\?xml[^>]*\?>/, '');
        return text;
    } catch (e) {
        return null;
    }
}

function _fix(u) {
    if (!u) return '';
    if (u.indexOf('//') === 0) return 'http:' + u;
    if (u.charAt(0) === '/') return HOST + u;
    return u;
}

function _stripTags(s) {
    return (s || '').replace(/<[^>]+>/g, '').trim();
}

// 列表卡片解析：href 含 /view/N.html 的 a 标签，按 id 去重
var A_RE = /<a\b([^>]*href="([^"]*\/view\/(\d+)\.html)"[^>]*)>([\s\S]*?)<\/a>/g;

function _parseList(html) {
    var result = [], seen = {};
    if (!html) return result;
    A_RE.lastIndex = 0;
    var m;
    while ((m = A_RE.exec(html)) !== null) {
        var vid = m[3];
        if (seen[vid]) continue;
        seen[vid] = true;
        var attrs = m[1] || '';
        var inner = m[4] || '';
        var title = '';
        var tm = /title="([^"]*)"/.exec(attrs);
        if (tm) title = tm[1];
        if (!title) title = _stripTags(inner);
        // 封面：a 的 data-original -> 内部 img -> style background
        var pic = '';
        var pm = /data-original="([^"]*)"/.exec(attrs);
        if (pm) pic = pm[1];
        if (!pic) {
            var im = /<img[^>]*(?:data-original|data-src|src)="([^"]*)"/.exec(inner);
            if (im) pic = im[1];
        }
        if (!pic) {
            var sm = /url\(([^)]+)\)/.exec(attrs);
            if (sm) pic = sm[1].replace(/['"]/g, '').trim();
        }
        pic = _fix(pic);
        if (pic.indexOf('http') !== 0) pic = '';
        if (!title) continue;
        result.push({ vod_id: vid, vod_name: title, vod_pic: pic });
    }
    return result;
}

function init(extend) {}

function home(filter) {
    var html = _get(HOST + '/');
    var list = _parseList(html);
    _homeCache = { t: Date.now(), data: JSON.stringify({ list: list }) };
    return JSON.stringify({ 'class': CATEGORIES, list: list, filters: {} });
}

function homeVod() {
    if (_homeCache.data && Date.now() - _homeCache.t < 600000) return _homeCache.data;
    var html = _get(HOST + '/');
    var list = _parseList(html);
    _homeCache = { t: Date.now(), data: JSON.stringify({ list: list }) };
    return _homeCache.data;
}

function category(tid, pg, filter, extend) {
    var page = /^\d+$/.test(String(pg)) ? parseInt(pg, 10) : 1;
    var url = page === 1 ? (HOST + '/list/' + tid + '.html') : (HOST + '/list/' + tid + '_' + page + '.html');
    var html = _get(url);
    return JSON.stringify({
        page: page,
        pagecount: 99,
        limit: 36,
        total: 999,
        list: _parseList(html)
    });
}

function detail(ids) {
    var vid = Array.isArray(ids) ? String(ids[0]) : String(ids);
    var html = _get(HOST + '/view/' + vid + '.html');
    if (!html) return JSON.stringify({ list: [] });

    var name = '';
    var h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (h1) name = _stripTags(h1[1]);
    if (!name) {
        var h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(html);
        if (h2) name = _stripTags(h2[1]);
    }

    var pic = '';
    var thumb = /stui-content__thumb[\s\S]{0,600}?<img[^>]*data-original="([^"]*)"/.exec(html);
    if (!thumb) thumb = /stui-content__thumb[\s\S]{0,600}?<img[^>]*src="([^"]*)"/.exec(html);
    if (thumb) pic = _fix(thumb[1]);
    if (pic.indexOf('/static/img/load') >= 0) pic = '';

    // 线路名：nav-tabs 中 #downN 对应文本
    var sources = [];
    var tabRe = /<a[^>]*data-toggle="tab"[^>]*href="#(down\d+)"[^>]*>([\s\S]*?)<\/a>/g;
    var tm2;
    while ((tm2 = tabRe.exec(html)) !== null) {
        var txt = _stripTags(tm2[2]);
        if (txt) sources.push(txt);
    }

    // 剧集：tab-pane id="downN" 面板分块
    var panelRe = /<div(?=[^>]*class="[^"]*tab-pane)(?=[^>]*id="(down\d+)")[^>]*>/g;
    var marks = [], pm2;
    while ((pm2 = panelRe.exec(html)) !== null) {
        marks.push({ id: pm2[1], pos: pm2.index });
    }
    var episodes = [];
    var epRe = /<a\b([^>]*href="([^"]*\/play\/[^"]+)"[^>]*)>([\s\S]*?)<\/a>/g;
    for (var i = 0; i < marks.length; i++) {
        var end = (i + 1 < marks.length) ? marks[i + 1].pos : html.length;
        var chunk = html.substring(marks[i].pos, end);
        var eps = [];
        epRe.lastIndex = 0;
        var em;
        while ((em = epRe.exec(chunk)) !== null) {
            var t = '';
            var tt = /title="([^"]*)"/.exec(em[1] || '');
            if (tt) t = tt[1];
            if (!t) t = _stripTags(em[3]);
            if (!t) continue;
            eps.push(t + '$' + _fix(em[2]));
        }
        if (eps.length) episodes.push(eps.join('#'));
    }

    if (sources.length === 0 && episodes.length > 0) {
        for (var s = 0; s < episodes.length; s++) sources.push('线路' + (s + 1));
    }
    if (episodes.length === 0) {
        var fr = /<div[^>]*class="[^"]*play-btn[^"]*"[^>]*>[\s\S]{0,400}?<a[^>]*href="([^"]+)"/.exec(html);
        if (fr) {
            episodes = ['正片$' + _fix(fr[1])];
            sources = ['线路1'];
        }
    }

    // 线路倒序: 原 线路1→5 调整为 线路5→1 (名与集数成对反转)
    if (sources.length > 1) {
        sources.reverse();
        episodes.reverse();
    }

    var vod = {
        vod_id: vid,
        vod_name: name,
        vod_pic: pic,
        vod_content: INTRO_PREFIX,
        vod_play_from: sources.join('$$$'),
        vod_play_url: episodes.join('$$$')
    };
    return JSON.stringify({ list: [vod] });
}

function _parsePlay(url) {
    var html = _get(url);
    if (!html) return '';
    var d = /videoUrl\s*=\s*"([^"]+)"/.exec(html);
    if (d) return d[1];
    var im = /<iframe[^>]*src="([^"]+)"/.exec(html);
    if (!im) return '';
    var fsrc = im[1];
    if (fsrc.indexOf('//') === 0) fsrc = 'http:' + fsrc;
    else if (fsrc.charAt(0) === '/') fsrc = HOST + fsrc;
    var fhtml = _get(fsrc, HOST);
    if (!fhtml) return '';
    var d2 = /videoUrl\s*=\s*"([^"]+)"/.exec(fhtml);
    if (d2) return d2[1];
    // api.php 二次接口
    var Url = /const Url = "([^"]+)"/.exec(fhtml);
    var Sign = /const Sign = "([^"]+)"/.exec(fhtml);
    var From = /const From = "([^"]+)"/.exec(fhtml);
    if (Url && Sign) {
        try {
            var mh = /^(https?:\/\/[^/]+)/.exec(fsrc);
            var api = (mh ? mh[1] : HOST) + '/player/api.php';
            var apiUrl = api + '?url=' + encodeURIComponent(Url[1]) +
                '&sign=' + encodeURIComponent(Sign[1]) +
                '&t=' + encodeURIComponent(From ? From[1] : 'm3u8');
            var res = req(apiUrl, {
                method: 'get',
                headers: { 'User-Agent': UA_SPIDER, 'Referer': HOST + '/', 'Accept-Encoding': 'identity' },
                timeout: TIMEOUT
            });
            if (res && res.content) {
                var j = JSON.parse(res.content);
                if (j && j.code === 200 && j.url) return j.url;
            }
        } catch (e) {}
    }
    return '';
}

function search(key, quick, pg) {
    var wd = String(key || '').trim();
    var page = /^\d+$/.test(String(pg)) ? parseInt(pg, 10) : 1;
    if (!wd) return JSON.stringify({ list: [], page: page });
    var html = null;
    try {
        var res = req(HOST + '/search.php', {
            method: 'post',
            postType: 'form',
            headers: {
                'User-Agent': UA_SPIDER,
                'Referer': HOST + '/',
                'Accept-Encoding': 'identity',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: { searchword: wd },
            timeout: TIMEOUT
        });
        if (res && res.content) html = res.content;
    } catch (e) {}
    return JSON.stringify({ list: _parseList(html), page: page });
}

function play(flag, id, vipFlags) {
    var pageUrl = _fix(String(id || ''));
    var url = _parsePlay(pageUrl);
    var header = { 'User-Agent': UA_PLAY };
    if (url) {
        var m = /^https?:\/\/[^/]+/.exec(url);
        if (m) header['Referer'] = m[0] + '/';
        return JSON.stringify({ parse: 0, url: url, header: header });
    }
    // 解析失败兜底：交壳嗅探播放页，避免返回空 url
    header['Referer'] = HOST + '/';
    return JSON.stringify({ parse: 1, url: pageUrl, header: header });
}

export default {
    name: '奇优影院',
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
