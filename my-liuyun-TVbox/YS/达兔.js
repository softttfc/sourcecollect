// 达达兔影院 (kshaodj.com) - TVBox QuickJS, MacCMS 琉芸JS版
var HOST = 'https://kshaodj.com';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var CATS = [['dianying', '电影'], ['lianxuju', '连续剧'], ['duanju', '短剧'], ['dongman', '动漫'], ['zongyi', '综艺']];
var _filterCache = {};

function hdrs() {
    return { 'User-Agent': UA, 'Referer': HOST + '/' };
}

function fetchHtml(url) {
    try {
        var r = req(url, { headers: hdrs(), timeout: 20000 });
        return (r && r.content) || '';
    } catch (e) {
        return '';
    }
}

function absUrl(u) {
    if (!u) return '';
    if (u.indexOf('http') === 0) return u;
    return HOST + (u.charAt(0) === '/' ? u : '/' + u);
}

function decodeEntities(s) {
    return (s || '').replace(/&nbsp;/g, ' ').replace(/&ensp;/g, '').replace(/&emsp;/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

// ---------- 卡片解析 ----------
function parseCards(html) {
    var vods = [], seen = {};
    if (!html) return vods;
    var re = /<li class="(?:vodlist_item|searchlist_item|balist_item)[^"]*"[^>]*>([\s\S]*?)<\/li>/g;
    var m;
    while ((m = re.exec(html)) !== null) {
        var block = m[1];
        var am = /<a\b[^>]*class="(?:vodlist_thumb|balist_thumb)[^"]*"[^>]*>/.exec(block);
        if (!am) continue;
        var tag = am[0];
        var hm = /href="(\/subject\/[^"]+?)(?:\.html)?"/.exec(tag);
        var tm = /title="([^"]*)"/.exec(tag);
        var sm = /url\(['"]?([^)'"]+)/.exec(tag);
        if (!hm || !tm) continue;
        var vid = hm[1].replace('/subject/', '').replace(/\/+$/, '');
        if (!vid || seen[vid]) continue;
        seen[vid] = 1;
        var rm = /<span class="pic_text[^"]*">([^<]*)<\/span>/.exec(block);
        vods.push({
            vod_id: vid,
            vod_name: decodeEntities(tm[1]).replace(/^\s+|\s+$/g, ''),
            vod_pic: absUrl(sm ? sm[1].replace(/^\s+|\s+$/g, '') : ''),
            vod_remarks: rm ? rm[1].replace(/^\s+|\s+$/g, '') : ''
        });
    }
    return vods;
}

// ---------- 二级分类筛选 (动态实爬) ----------
function slotValue(href, idx) {
    try {
        var d = decodeURIComponent(href);
        var seg = d.split('/show/')[1].replace(/\.html.*$/, '').split('-');
        return seg.length > idx ? seg[idx] : '';
    } catch (e) {
        return '';
    }
}

function loadFilters(cid) {
    if (_filterCache[cid]) return _filterCache[cid];
    var html = fetchHtml(HOST + '/show/' + cid + '-----------.html');
    var groups = [];

    function opts(blockHtml, idx, key, name) {
        var items = [{ n: '全部', v: '' }];
        var re = /<a[^>]*href="(\/show\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        var m;
        while ((m = re.exec(blockHtml)) !== null) {
            var v = slotValue(m[1], idx);
            var nm = decodeEntities(m[2]).replace(/^\s+|\s+$/g, '');
            if (!nm || nm === '全部') continue;
            var dup = false;
            for (var i = 0; i < items.length; i++) if (items[i].n === nm) { dup = true; break; }
            if (!dup) items.push({ n: nm, v: v });
        }
        if (items.length > 1) groups.push({ key: key, name: name, value: items });
    }

    var m = /id="hl02"[\s\S]*?<\/ul>/.exec(html);
    if (m) opts(m[0], 3, 'class', '类型');
    m = /id="hl03"[\s\S]*?<\/ul>/.exec(html);
    if (m) opts(m[0], 1, 'area', '地区');
    m = /id="hl04"[\s\S]*?<\/ul>/.exec(html);
    if (m) opts(m[0], 11, 'year', '年份');
    m = /screen_list sx_tz[\s\S]*?<\/ul>/.exec(html);
    if (m) {
        var items = [{ n: '全部', v: '' }];
        var re2 = /href="(\/show\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        var m2;
        while ((m2 = re2.exec(m[0])) !== null) {
            var v = slotValue(m2[1], 2);
            var nm = decodeEntities(m2[2]).replace(/^\s+|\s+$/g, '');
            if (!nm) continue;
            var dup = false;
            for (var i = 0; i < items.length; i++) if (items[i].n === nm) { dup = true; break; }
            if (!dup) items.push({ n: nm, v: v });
        }
        if (items.length > 1) groups.unshift({ key: 'by', name: '排序', value: items });
    }
    _filterCache[cid] = groups;
    return groups;
}

// ---------- 播放地址还原 ----------
var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64DecodeAscii(s) {
    s = (s || '').replace(/[^A-Za-z0-9+\/=]/g, '');
    while (s.length % 4) s += '=';
    var out = '', i = 0;
    while (i < s.length) {
        var e1 = B64.indexOf(s.charAt(i++));
        var e2 = B64.indexOf(s.charAt(i++));
        var c3 = s.charAt(i++), c4 = s.charAt(i++);
        var e3 = c3 === '=' ? 64 : B64.indexOf(c3);
        var e4 = c4 === '=' ? 64 : B64.indexOf(c4);
        if (e1 < 0 || e2 < 0) return null;
        var n = (e1 << 18) | (e2 << 12) | ((e3 & 63) << 6) | (e4 & 63);
        out += String.fromCharCode((n >> 16) & 255);
        if (e3 !== 64) out += String.fromCharCode((n >> 8) & 255);
        if (e4 !== 64) out += String.fromCharCode(n & 255);
    }
    return out;
}

// player_data.url: 每12个base64字符插入 yMc+首字母大写, 枚举大小写组合还原
function decodePlayUrl(enc) {
    var b64 = (enc || '').split('&')[0];
    var parts = b64.split(/yMc(.)/);
    // split带捕获组: [chunk0, mark1, chunk1, mark2, chunk2, ...]
    var chunks = [], marks = [];
    for (var i = 0; i < parts.length; i++) {
        if (i % 2 === 0) chunks.push(parts[i]);
        else marks.push(parts[i]);
    }
    if (!marks.length) {
        var raw0 = b64DecodeAscii(b64);
        if (raw0 && raw0.indexOf('http') === 0) return raw0;
        return '';
    }
    var options = [];
    for (var j = 0; j < marks.length; j++) {
        var mch = marks[j];
        var opts = [mch];
        var lo = mch.toLowerCase();
        if (/[a-z]/i.test(mch) && lo !== mch) opts.push(lo);
        options.push(opts);
    }
    // 笛卡尔积
    var combos = [[]];
    for (var oi = 0; oi < options.length; oi++) {
        var next = [];
        for (var ci = 0; ci < combos.length; ci++) {
            for (var oj = 0; oj < options[oi].length; oj++) {
                next.push(combos[oi === 0 ? ci : ci].concat(options[oi][oj]));
            }
        }
        combos = next;
        if (combos.length > 256) break;
    }
    for (var k = 0; k < combos.length; k++) {
        var cand = chunks[0];
        for (var c = 0; c < combos[k].length; c++) cand += combos[k][c] + chunks[c + 1];
        var raw = b64DecodeAscii(cand);
        if (!raw) continue;
        if (raw.indexOf('http') === 0 && raw.indexOf('.m3u8') !== -1) {
            var ok = true;
            for (var x = 0; x < raw.length; x++) {
                var code = raw.charCodeAt(x);
                if (code < 32 || code >= 127) { ok = false; break; }
            }
            if (ok) return raw;
        }
    }
    return '';
}

// ================= 接口 =================
function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < CATS.length; i++) classes.push({ type_id: CATS[i][0], type_name: CATS[i][1] });
    var result = { 'class': classes };
    if (filter) {
        var filters = {};
        for (var j = 0; j < CATS.length; j++) {
            var groups = loadFilters(CATS[j][0]);
            if (groups.length) filters[CATS[j][0]] = groups;
        }
        var has = false;
        for (var k in filters) { has = true; break; }
        if (has) result.filters = filters;
    }
    return result;
}

function homeVideoContent() {
    return { list: parseCards(fetchHtml(HOST + '/')), parse: 0, jx: 0 };
}

function showUrl(cid, pg, extend) {
    var area = '', by = '', cls = '', year = '';
    if (extend && typeof extend === 'object') {
        area = extend.area || '';
        by = extend.by || '';
        cls = extend['class'] || '';
        year = extend.year || '';
    }
    var segs = [cid, area, by, cls, '', '', '', '', pg > 1 ? String(pg) : '', '', '', year];
    return HOST + '/show/' + segs.join('-') + '.html';
}

function categoryContent(tid, pg, filter, extend) {
    try {
        var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
        var cid = 'dianying';
        for (var i = 0; i < CATS.length; i++) if (String(tid) === CATS[i][0]) { cid = CATS[i][0]; break; }
        if (typeof extend === 'string') {
            try { extend = extend ? JSON.parse(extend) : {}; } catch (e) { extend = {}; }
        }
        var html = fetchHtml(showUrl(cid, page, extend || {}));
        var vods = parseCards(html);
        var pagecount = 1;
        var m = /共有\s*(\d+)\s*页/.exec(html);
        if (m) pagecount = parseInt(m[1], 10);
        else if (vods.length < 20) pagecount = page;
        return { list: vods, page: page, pagecount: pagecount, limit: 90, total: 999999 };
    } catch (e) {
        return { list: [], page: 1, pagecount: 1, limit: 90, total: 0 };
    }
}

function detailContent(ids) {
    var vods = [];
    try {
        var vid = String(ids).replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
        var html = fetchHtml(HOST + '/subject/' + vid + '.html');
        if (!html) return { list: [] };
        var vod = { vod_id: vid };

        var m = /<h2 class="title">\s*([^<]+?)\s*<\/h2>/.exec(html);
        vod.vod_name = m ? decodeEntities(m[1]).replace(/^\s+|\s+$/g, '') : vid;
        m = /content_thumb[\s\S]*?url\(['"]?([^)'"]+)/.exec(html);
        vod.vod_pic = absUrl(m ? m[1].replace(/^\s+|\s+$/g, '') : '');
        m = /<span class="data_style">\s*([^<]+?)\s*<\/span>/.exec(html);
        vod.vod_remarks = m ? decodeEntities(m[1]).replace(/^\s+|\s+$/g, '') : '';
        var content = '';
        m = /<li class="desc[^"]*">([\s\S]*?)<\/li>/.exec(html);
        if (m) content = decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/^\s+|\s+$/g, '');
        if (content.indexOf(PREFIX) !== 0) content = PREFIX + content;
        vod.vod_content = content;

        var actors = [], seenA = {};
        var reA = /\/vod\/search\/actor\/[^"]*"[^>]*>([^<]+)<\/a>/g;
        var am;
        while ((am = reA.exec(html)) !== null) {
            var a = decodeEntities(am[1]).replace(/^\s+|\s+$/g, '');
            if (a && !seenA[a]) { seenA[a] = 1; actors.push(a); }
        }
        vod.vod_actor = actors.join(',').slice(0, 200);
        var dirs = [], seenD = {};
        var reD = /\/vod\/search\/director\/[^"]*"[^>]*>([^<]+)<\/a>/g;
        while ((am = reD.exec(html)) !== null) {
            var d = decodeEntities(am[1]).replace(/^\s+|\s+$/g, '');
            if (d && !seenD[d]) { seenD[d] = 1; dirs.push(d); }
        }
        vod.vod_director = dirs.join(',').slice(0, 200);

        // 播放源: #NumTab 的 alt 对应 #aaa 内 ul (notfull/full 双份, 取偶数位)
        var playFrom = [], playUrl = [];
        var tm = /<div class="play_source_tab[^"]*" id="NumTab">([\s\S]*?)<\/div>/.exec(html);
        var xm = /<div class="play_source" id="aaa">([\s\S]*?)<\/div>\s*<script/.exec(html);
        if (tm && xm) {
            var sources = [];
            var reS = /alt="([^"]+)"/g;
            var sm;
            while ((sm = reS.exec(tm[1])) !== null) sources.push(decodeEntities(sm[1]));
            var uls = [];
            var reU = /<ul class="content_playlist[^"]*">([\s\S]*?)<\/ul>/g;
            while ((sm = reU.exec(xm[1])) !== null) uls.push(sm[1]);
            var pickUls = [];
            for (var u = 0; u < uls.length; u += 2) pickUls.push(uls[u]);
            for (var si = 0; si < sources.length && si < pickUls.length; si++) {
                var eps = [];
                var reE = /<a href="(\/start\/[^"]+)">([^<]*)<\/a>/g;
                var em;
                while ((em = reE.exec(pickUls[si])) !== null) {
                    var nm = decodeEntities(em[2]).replace(/^\s+|\s+$/g, '');
                    if (!nm) {
                        var parts = em[1].split('-');
                        nm = parts[parts.length - 1].replace('.html', '');
                    }
                    nm = nm.replace(/\$/g, ' ').replace(/#/g, ' ');
                    eps.push(nm + '$' + absUrl(em[1]));
                }
                if (eps.length) {
                    playFrom.push(sources[si]);
                    playUrl.push(eps.join('#'));
                }
            }
        }
        vod.vod_play_from = playFrom.join('$$$');
        vod.vod_play_url = playUrl.join('$$$');
        vods.push(vod);
    } catch (e) { }
    return { list: vods };
}

function searchContent(key, quick, pg) {
    try {
        var html = fetchHtml(HOST + '/vod/search.html?wd=' + encodeURIComponent(String(key)));
        var vods = parseCards(html);
        return { list: vods, page: 1, pagecount: 1, limit: 90, total: vods.length };
    } catch (e) {
        return { list: [], page: 1, pagecount: 1, limit: 90, total: 0 };
    }
}

function playerContent(flag, id, vipFlags) {
    var result = { parse: 0, playUrl: '', url: '', header: {} };
    try {
        var pid = String(id || '').replace(/^\s+|\s+$/g, '');
        if (!pid) return result;
        if (pid.indexOf('http') === 0 && pid.indexOf('.m3u8') !== -1) {
            result.url = pid;
        } else {
            var pageUrl = pid.indexOf('http') === 0 ? pid : absUrl(pid);
            var html = fetchHtml(pageUrl);
            var m = /let player_data=\{.*"url":"([^"]+)"/.exec(html);
            if (m) {
                var url = decodePlayUrl(m[1]);
                if (url) result.url = url;
            }
            if (!result.url) return { parse: 1, playUrl: '', url: pageUrl, header: {} };
        }
        if (result.url) {
            result.header = { 'Referer': HOST + '/', 'User-Agent': UA };
        }
        return result;
    } catch (e) {
        return result;
    }
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
