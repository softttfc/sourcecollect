// 看戏影视 (www.kanxiya.com) - TVBox QuickJS, 琉芸JS版
var HOST = 'https://www.kanxiya.com';
var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
var PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

function buildFilters() {
    var area = [{ n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' }, { n: '台湾', v: '台湾' }, { n: '美国', v: '美国' }, { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }, { n: '泰国', v: '泰国' }, { n: '新加坡', v: '新加坡' }, { n: '马来西亚', v: '马来西亚' }, { n: '印度', v: '印度' }, { n: '英国', v: '英国' }, { n: '法国', v: '法国' }, { n: '加拿大', v: '加拿大' }, { n: '西班牙', v: '西班牙' }, { n: '俄罗斯', v: '俄罗斯' }, { n: '其它', v: '其它' }];
    var year = [{ n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' }, { n: '2024', v: '2024' }, { n: '2023', v: '2023' }, { n: '2022', v: '2022' }, { n: '2021', v: '2021' }, { n: '2020', v: '2020' }, { n: '2019', v: '2019' }, { n: '2018', v: '2018' }, { n: '2017', v: '2017' }, { n: '2016', v: '2016' }, { n: '2015', v: '2015' }, { n: '2014', v: '2014' }, { n: '2013', v: '2013' }, { n: '2012', v: '2012' }, { n: '2011', v: '2011' }, { n: '2010', v: '2010' }];
    return {
        '1': [
            { key: 'class', name: '类型', value: [{ n: '全部', v: '1' }, { n: '动作片', v: '5' }, { n: '喜剧片', v: '6' }, { n: '爱情片', v: '7' }, { n: '科幻片', v: '8' }, { n: '恐怖片', v: '9' }, { n: '剧情片', v: '10' }, { n: '战争片', v: '11' }] },
            { key: 'area', name: '地区', value: area },
            { key: 'year', name: '年份', value: year }
        ],
        '2': [
            { key: 'class', name: '类型', value: [{ n: '全部', v: '2' }, { n: '国产剧', v: '12' }, { n: '港台剧', v: '13' }, { n: '欧美剧', v: '14' }, { n: '日韩剧', v: '15' }, { n: '海外剧', v: '16' }] },
            { key: 'area', name: '地区', value: area },
            { key: 'year', name: '年份', value: year }
        ],
        '3': [
            { key: 'area', name: '地区', value: area },
            { key: 'year', name: '年份', value: year }
        ],
        '4': [
            { key: 'area', name: '地区', value: area },
            { key: 'year', name: '年份', value: year }
        ]
    };
}

function hdrs() {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
    };
}

function fetchHtml(url) {
    if (url.indexOf('http') !== 0) url = HOST + url;
    try {
        var r = req(url, { headers: hdrs(), timeout: 15000 });
        return (r && r.content) || '';
    } catch (e) {
        return '';
    }
}

function fixPic(u) {
    if (!u) return '';
    u = u.replace(/&amp;/g, '&');
    if (u.indexOf('//') === 0) return 'https:' + u;
    if (u.charAt(0) === '/') return HOST + u;
    return u;
}

function decodeEntities(s) {
    return (s || '').replace(/&nbsp;/g, ' ').replace(/&ensp;/g, '').replace(/&emsp;/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function cleanText(s) {
    return decodeEntities((s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

function getAttr(tag, name) {
    var m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i'));
    if (m) return m[1];
    m = tag.match(new RegExp(name + "\\s*=\\s*'([^']*)'", 'i'));
    return m ? m[1] : '';
}

// 列表: ul.stui-vodlist 内 a.stui-vodlist__thumb
function parseList(html) {
    var out = [], seen = {};
    if (!html) return out;
    var re = /<a\b[^>]*class\s*=\s*"[^"]*stui-vodlist__thumb[^"]*"[^>]*href\s*=\s*"[^"]*?\/post\/(\d+)\.html"[^>]*>/gi;
    var re2 = /<a\b[^>]*href\s*=\s*"[^"]*?\/post\/(\d+)\.html"[^>]*class\s*=\s*"[^"]*stui-vodlist__thumb[^"]*"[^>]*>/gi;
    var matches = [], m;
    while ((m = re.exec(html)) !== null) matches.push({ id: m[1], tag: m[0], idx: m.index });
    while ((m = re2.exec(html)) !== null) {
        var dup = false;
        for (var i = 0; i < matches.length; i++) if (matches[i].idx === m.index) { dup = true; break; }
        if (!dup) matches.push({ id: m[1], tag: m[0], idx: m.index });
    }
    matches.sort(function (a, b) { return a.idx - b.idx; });
    for (var i = 0; i < matches.length; i++) {
        var cur = matches[i];
        if (seen[cur.id]) continue;
        var to = i < matches.length - 1 ? matches[i + 1].idx : Math.min(html.length, cur.idx + 1200);
        var block = html.substring(cur.idx, to);
        var name = getAttr(cur.tag, 'title');
        if (!name) {
            var im = block.match(/<img\b[^>]*>/i);
            if (im) name = getAttr(im[0], 'alt');
        }
        if (!name) continue;
        var pic = fixPic(getAttr(cur.tag, 'data-original') || getAttr(cur.tag, 'data-src'));
        if (!pic) {
            var im2 = block.match(/<img\b[^>]*>/i);
            if (im2) pic = fixPic(getAttr(im2[0], 'data-original') || getAttr(im2[0], 'data-src') || getAttr(im2[0], 'src'));
        }
        var note = '';
        var nm = block.match(/class\s*=\s*"[^"]*pic-text[^"]*"[^>]*>([\s\S]*?)<\//i);
        if (nm) note = cleanText(nm[1]);
        seen[cur.id] = 1;
        out.push({ vod_id: cur.id, vod_name: decodeEntities(name).replace(/^\s+|\s+$/g, ''), vod_pic: pic, vod_remarks: note });
    }
    return out;
}

// player_data={...} 平衡花括号提取 (字符串转义感知)
function extractPlayerData(html) {
    var m = /player_data\s*=\s*\{/.exec(html);
    if (!m) return null;
    var start = m.index + m[0].length - 1;
    var depth = 0, inStr = false, esc = false;
    for (var i = start; i < html.length; i++) {
        var c = html.charAt(i);
        if (inStr) {
            if (esc) esc = false;
            else if (c === '\\') esc = true;
            else if (c === '"') inStr = false;
        } else {
            if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(html.substring(start, i + 1)); } catch (e) { return null; }
                }
            }
        }
    }
    return null;
}

// ================= 接口 =================
function homeContent(filter) {
    return {
        'class': [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '电视剧' },
            { type_id: '3', type_name: '综艺' },
            { type_id: '4', type_name: '动漫' }
        ],
        filters: buildFilters()
    };
}

function homeVideoContent() {
    return { list: parseList(fetchHtml('/')) };
}

function categoryContent(tid, pg, filter, extend) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    var args = {};
    var ext = extend;
    if (typeof ext === 'string') { try { ext = ext ? JSON.parse(ext) : {}; } catch (e) { ext = {}; } }
    if (ext && typeof ext === 'object') {
        for (var k in ext) if (ext[k]) args[k] = String(ext[k]);
    }
    if (filter && typeof filter === 'object') {
        for (var k2 in filter) if (filter[k2] && !(k2 in args)) args[k2] = String(filter[k2]);
    }
    var routeTid = args['class'] || String(tid);
    var area = args.area || '';
    var year = args.year || '';
    var segs = [routeTid, encodeURIComponent(area), '', '', '', '', '', '', String(page), '', '', encodeURIComponent(year)];
    var url = '/tags/' + segs.join('-') + '.html';
    var html = fetchHtml(url);
    var items = parseList(html);
    var pagecount = page;
    if (items.length) {
        var tm = /<a[^>]*>尾页<\/a>/.exec(html);
        if (tm) {
            var mm = /-(\d+)---/.exec(tm[0]) || /-(\d+)---/.exec(html.substring(tm.index, tm.index + 200));
            if (mm) pagecount = parseInt(mm[1], 10);
        } else {
            var am = /\/tags\/[^.]*?-(\d+)---[^.]*\.html/.exec(html);
            if (am) pagecount = parseInt(am[1], 10);
        }
        if (pagecount < page) pagecount = page;
    } else {
        pagecount = page > 1 ? page - 1 : 1;
    }
    return { list: items, page: page, pagecount: pagecount, limit: 24, total: pagecount * 24 };
}

function detailContent(ids) {
    var result = { list: [] };
    var vid = String(ids).split(',')[0].replace(/^\s+|\s+$/g, '');
    try {
        var html = fetchHtml('/post/' + vid + '.html');
        if (!html) return result;

        var name = '';
        var m = html.match(/<h1[^>]*class\s*=\s*"[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
             || html.match(/class\s*=\s*"[^"]*stui-content__detail[^"]*"[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i);
        if (m) name = cleanText(m[1]);

        var pic = '';
        var tp = html.match(/class\s*=\s*"[^"]*(?:stui-content__thumb|stui-vodlist__thumb)[^"]*"[\s\S]*?(<img\b[^>]*>)/i);
        if (tp) pic = fixPic(getAttr(tp[1], 'data-original') || getAttr(tp[1], 'src'));

        var year = '', area = '', remarks = '', director = '', actor = '', content = '';
        var di = html.indexOf('stui-content__detail');
        if (di >= 0) {
            var detBlock = html.substring(di, di + 8000);
            var reP = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
            var pm;
            while ((pm = reP.exec(detBlock)) !== null) {
                if (pm[1].indexOf('data2') === -1) continue;
                var lm = pm[1].match(/class\s*=\s*"[^"]*data2[^"]*"[^>]*>([\s\S]*?)<\//i);
                if (!lm) continue;
                var lab = cleanText(lm[1]);
                var val = cleanText(pm[1]);
                if (val.indexOf(lab) === 0) val = val.substring(lab.length).replace(/^\s+|\s+$/g, '');
                if (lab.indexOf('演员') === 0) {
                    var am2 = pm[1].match(/class\s*=\s*"[^"]*data5[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p)>/i);
                    actor = am2 ? cleanText(am2[1]) : val;
                }
                else if (lab.indexOf('状态') === 0) remarks = val;
                else if (lab.indexOf('年份') === 0) year = val;
                else if (lab.indexOf('地区') === 0) area = val;
                else if (lab.indexOf('导演') === 0) director = val;
            }
        }

        var cm = html.match(/class\s*=\s*"[^"]*(?:detail-content|detail-sketch)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|p|span)>/i);
        if (cm) content = cleanText(cm[1]);
        if (content.indexOf(PREFIX) !== 0) content = PREFIX + content;

        // 播放源: .stui-vodlist__head (h4 名 + ul li a /play/)
        var playFrom = [], playUrl = [];
        var heads = [];
        var hi = html.indexOf('stui-vodlist__head');
        while (hi >= 0) {
            var ds = html.lastIndexOf('<div', hi);
            heads.push(ds >= 0 ? ds : hi);
            hi = html.indexOf('stui-vodlist__head', hi + 1);
        }
        for (var b = 0; b < heads.length; b++) {
            var bEnd = b < heads.length - 1 ? heads[b + 1] : html.length;
            var block = html.substring(heads[b], bEnd);
            if (block.indexOf('stui-content__playlist') === -1) continue;
            var h4 = block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
            var srcName = h4 ? cleanText(h4[1]).replace(/\s+/g, '') : '';
            if (!srcName) continue;
            var eps = [];
            var reA = /<a\b[^>]*href\s*=\s*"[^"]*?\/play\/(.*?)\.html"[^>]*>([\s\S]*?)<\/a>/gi;
            var em;
            while ((em = reA.exec(block)) !== null) {
                var epName = cleanText(em[2]).replace(/\$/g, ' ').replace(/#/g, ' ');
                if (epName && em[1]) eps.push(epName + '$' + em[1]);
            }
            if (eps.length) {
                playFrom.push(srcName);
                playUrl.push(eps.join('#'));
            }
        }

        result.list.push({
            vod_id: vid,
            vod_name: name,
            vod_pic: pic,
            vod_year: year,
            vod_area: area,
            vod_remarks: remarks,
            vod_director: director,
            vod_actor: actor,
            vod_content: content,
            vod_play_from: playFrom.join('$$$'),
            vod_play_url: playUrl.join('$$$')
        });
    } catch (e) { }
    return result;
}

function searchContent(key, quick, pg) {
    try {
        var decoded = key;
        try { decoded = decodeURIComponent(key); } catch (e) { }
        var segs = [encodeURIComponent(decoded)];
        for (var i = 0; i < 13; i++) segs.push('');
        var html = fetchHtml('/search/' + segs.join('-') + '.html');
        var items = parseList(html);
        return { list: items, page: 1, pagecount: 1, limit: 24, total: items.length };
    } catch (e) {
        return { list: [], page: 1, pagecount: 1, limit: 24, total: 0 };
    }
}

function playerContent(flag, id, vipFlags) {
    var pageUrl = String(id).indexOf('http') === 0 ? String(id) : HOST + '/play/' + id + '.html';
    try {
        var html = fetchHtml(pageUrl);
        if (html) {
            var pd = extractPlayerData(html);
            if (pd && pd.url) {
                var pu = String(pd.url).replace(/\\\//g, '/');
                if (pu.indexOf('http') === 0 && (/\.m3u8(\?|$)/.test(pu) || /\.mp4(\?|$)/.test(pu))) {
                    return { parse: 0, url: pu, header: { 'User-Agent': UA } };
                }
            }
        }
    } catch (e) { }
    return { parse: 1, url: pageUrl };
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
