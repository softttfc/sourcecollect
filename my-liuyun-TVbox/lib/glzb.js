// 芸直播 - TVBox QuickJS (txt 直播源直连版)
// 源格式: 分组名,#genre#  +  频道名,URL$备注
// 分组: 🇨🇳芸芸公告🇨🇳 / 📡咪咕央卫 / 📡咪咕頻道 / 📺港澳代理 / 🎹音樂欣賞 / 👑會員頻道
// 会员分组名以 _密码 结尾（如 👑會員頻道_1234），界面隐藏后缀；在搜索框输入该密码即可解锁会员频道

var SRC_URL = 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/yyzb.php';
var USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
var CACHE_TTL = 1800000;
var TIMEOUT = 20000;

var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var LOCK_TIP = '🔒 会员频道需要密码：在搜索框输入会员密码即可解锁';

// 分组封面覆盖(键=分组名, 值=图片地址)
var GROUP_PIC_OVERRIDE = {
    '🇨🇳魔盒公告🇨🇳': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/魔盒.jpg',
    '📡咪咕頻道': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/咪咕.jpg',
    '📡IPV6频道': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/琉芸.jpg',
    '📡超清頻道': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/卫视.jpg',
    '📺港澳頻道': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/魔盒.jpg',
    '🎹音樂欣賞': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/音乐.jpg',
    '👑會員頻道': 'https://cnb.cool/my-liuyun/TVbox/-/git/raw/main/lib/至尊.jpg'
};

var CACHE = { ts: 0, groups: null };

function fetchGroups() {
    var now = (new Date()).getTime();
    if (CACHE.groups && now - CACHE.ts < CACHE_TTL) return CACHE.groups;
    var res = req(SRC_URL, { headers: { 'User-Agent': USER_AGENT }, timeout: TIMEOUT });
    var content = '';
    if (typeof res === 'object' && res !== null) {
        content = res.content !== undefined ? res.content : (res.body || '');
    } else {
        content = String(res || '');
    }
    if (!content) throw new Error('直播源拉取失败');
    var groups = parseTxt(content);
    if (!groups.length) throw new Error('直播源解析为空');
    CACHE.ts = now;
    CACHE.groups = groups;
    return groups;
}

// 分组名 _xxx 视为密码后缀，展示时剥离
function splitName(gname) {
    var m = String(gname).match(/^(.+)_([A-Za-z0-9]{3,12})$/);
    if (m) return { base: m[1], pwd: m[2] };
    return { base: String(gname), pwd: '' };
}

function parseTxt(text) {
    var lines = String(text).replace(/\r/g, '').split('\n');
    var groups = [], cur = null, i, line, idx, gname, name, rest, url, note, di, sn;
    for (i = 0; i < lines.length; i++) {
        line = lines[i].replace(/^\s+|\s+$/g, '');
        if (!line) continue;
        idx = line.indexOf(',#genre#');
        if (idx > -1) {
            gname = line.substring(0, idx).replace(/^\s+|\s+$/g, '');
            sn = splitName(gname);
            cur = { name: gname, base: sn.base, pwd: sn.pwd, channels: [] };
            groups.push(cur);
            continue;
        }
        idx = line.indexOf(',');
        if (idx < 1 || !cur) continue;
        name = line.substring(0, idx).replace(/^\s+|\s+$/g, '');
        rest = line.substring(idx + 1).replace(/^\s+|\s+$/g, '');
        if (!rest) continue;
        url = rest; note = '';
        di = rest.indexOf('$');
        if (di > -1) { url = rest.substring(0, di); note = rest.substring(di + 1); }
        if (!url) continue;
        cur.channels.push({ name: name, url: url, note: note });
    }
    return groups;
}

function findGroup(tid) {
    var groups = fetchGroups();
    var name = String(tid || '');
    try { name = decodeURIComponent(name); } catch (e) { }
    for (var i = 0; i < groups.length; i++) {
        if (groups[i].base === name || groups[i].name === name) return groups[i];
    }
    return null;
}

function lockedGroups() {
    var groups = fetchGroups(), out = [], i;
    for (i = 0; i < groups.length; i++) {
        if (groups[i].pwd) out.push(groups[i]);
    }
    return out;
}

function groupPic(gname) {
    return GROUP_PIC_OVERRIDE[gname] || '';
}

// 会员频道 ID 附带签名，防止按 分组|序号 猜地址
function sig(pwd, idx) {
    var s = String(pwd) + '|' + String(idx);
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0x7fffffff;
    return h.toString(36);
}

function card(g, ch, idx) {
    var id = encodeURIComponent(g.base) + '|' + idx;
    if (g.pwd) id += '|' + sig(g.pwd, idx);
    return {
        vod_id: id,
        vod_name: ch.name,
        vod_pic: groupPic(g.base),
        vod_remarks: ch.note || ''
    };
}

function lockCard(g) {
    return {
        vod_id: 'unlock|' + encodeURIComponent(g.base),
        vod_name: g.base,
        vod_pic: groupPic(g.base),
        vod_remarks: '需要密码'
    };
}

// 代理需要修复分片绝对路径的 m3u8 源
var M3U8_PROXY_HOSTS = ['121.199.48.54', '38.75.136.137'];

// 判断 URL 是否需要 m3u8 代理修复
function needM3U8Proxy(url) {
    var u = String(url || '').toLowerCase();
    if (u.indexOf('.m3u8') === -1) return false;
    for (var i = 0; i < M3U8_PROXY_HOSTS.length; i++) {
        if (u.indexOf(M3U8_PROXY_HOSTS[i]) > -1) return true;
    }
    return false;
}

// 解析 URL 提取 base (scheme + host)
function getUrlBase(url) {
    var m = String(url || '').match(/^(https?:\/\/[^\/]+)/i);
    return m ? m[1] : '';
}

// 解析 URL 目录 (去掉文件名和 query)
function getUrlDir(url) {
    var m = String(url || '').match(/^(https?:\/\/[^\/]+\/[^?]*\/)/i);
    if (m) return m[1];
    // 尝试不带尾部斜杠
    var m2 = String(url || '').match(/^(https?:\/\/[^\/]+\/[^\/?]+)\?/i);
    if (m2) return m2[1].substring(0, m2[1].lastIndexOf('/') + 1);
    return '';
}

// 用 QuickJS req 代理 m3u8，修复绝对路径分片为相对路径
// 把以 / 开头的绝对路径分片 改成 ../ 相对路径
// 这样无论播放器是否正确支持绝对路径都能工作
function proxyM3U8(url) {
    try {
        var dir = getUrlDir(url); // m3u8 所在目录，如 http://121.199.48.54/live1/
        if (!dir) return null;
        var res = req(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': '*/*' }, timeout: TIMEOUT });
        var content = '';
        if (typeof res === 'object' && res !== null) {
            content = res.content !== undefined ? res.content : (res.body || '');
        } else {
            content = String(res || '');
        }
        if (!content || content.indexOf('#EXTM3U') === -1) return null;
        // 把所有以 / 开头的分片绝对路径改成 ../ 相对路径
        // /live/xxx.ts -> ../live/xxx.ts (相对于 /live1/ 目录就是 /live/xxx.ts)
        content = content.replace(/(\r?\n)\/([^\/\s#][^\s]*)/g, function(m, nl, path) {
            return nl + '../' + path;
        });
        // 处理 #EXT-X-MAP 标签里的绝对路径
        content = content.replace(/(URI=")\/([^"]+)(")/g, function(m, p1, path, p3) {
            return p1 + '../' + path + p3;
        });
        return content;
    } catch (e) {
        return null;
    }
}

// 把字符串转成 base64 (兼容 QuickJS)
function toBase64(str) {
    if (typeof btoa === 'function') {
        try { return btoa(str); } catch (e) { }
    }
    var base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '', i = 0;
    var len = str.length;
    while (i < len) {
        var c1 = str.charCodeAt(i++) & 0xff;
        var c2 = i < len ? str.charCodeAt(i++) & 0xff : 0;
        var c3 = i < len ? str.charCodeAt(i++) & 0xff : 0;
        var b1 = c1 >> 2;
        var b2 = ((c1 & 0x3) << 4) | (c2 >> 4);
        var b3 = ((c2 & 0xf) << 2) | (c3 >> 6);
        var b4 = c3 & 0x3f;
        out += base64.charAt(b1) + base64.charAt(b2);
        out += (i - 2 < len) ? base64.charAt(b3) : '=';
        out += (i - 1 < len) ? base64.charAt(b4) : '=';
    }
    return out;
}

var spider = {
    init: function (cfg) {
        if (cfg && cfg.ext) {
            var ext = typeof cfg.ext === 'string' ? cfg.ext : (cfg.ext.url || '');
            if (ext) SRC_URL = ext;
        }
    },

    home: function (filter) {
        var groups = fetchGroups();
        var classes = [], i;
        for (i = 0; i < groups.length; i++) {
            classes.push({ type_id: encodeURIComponent(groups[i].base), type_name: groups[i].base });
        }
        return JSON.stringify({ class: classes, filters: {} });
    },

    homeVod: function () {
        var groups = fetchGroups();
        var list = [], i, j;
        for (i = 0; i < groups.length; i++) {
            if (groups[i].pwd) { list.push(lockCard(groups[i])); continue; }
            for (j = 0; j < groups[i].channels.length && j < 8; j++) {
                list.push(card(groups[i], groups[i].channels[j], j));
            }
        }
        return JSON.stringify({ list: list });
    },

    category: function (tid, pg, filter, extend) {
        var g = findGroup(tid);
        var list = [], i;
        if (g) {
            if (g.pwd) return JSON.stringify({ list: [lockCard(g)], page: 1, pagecount: 0, limit: 1, total: 1 });
            for (i = 0; i < g.channels.length; i++) list.push(card(g, g.channels[i], i));
        }
        return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: list.length, total: list.length });
    },

    detail: function (ids) {
        var id = typeof ids === 'string' ? ids : (ids && ids[0]) || '';
        var parts = String(id).split('|');
        if (parts[0] === 'unlock') {
            var base = '';
            try { base = decodeURIComponent(parts[1] || ''); } catch (e) { base = parts[1] || ''; }
            return JSON.stringify({
                list: [{
                    vod_id: id,
                    vod_name: base,
                    vod_pic: groupPic(base),
                    vod_content: DESC_PREFIX + LOCK_TIP,
                    vod_play_from: '',
                    vod_play_url: ''
                }]
            });
        }
        var g = findGroup(parts[0]);
        var idx = parseInt(parts[1] || '0', 10);
        if (!g || !g.channels[idx]) return JSON.stringify({ list: [] });
        if (g.pwd && String(parts[2] || '') !== sig(g.pwd, idx)) {
            return JSON.stringify({
                list: [{
                    vod_id: id,
                    vod_name: g.base,
                    vod_pic: groupPic(g.base),
                    vod_content: DESC_PREFIX + LOCK_TIP,
                    vod_play_from: '',
                    vod_play_url: ''
                }]
            });
        }
        var ch = g.channels[idx];
        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: ch.name,
                vod_pic: groupPic(g.base),
                vod_content: DESC_PREFIX + ch.name + (ch.note ? ' ' + ch.note : ''),
                vod_play_from: '琉芸直播',
                vod_play_url: '立即播放$' + encodeURIComponent(ch.url)
            }]
        });
    },

    play: function (flag, id, flags) {
        var url = String(id || '');
        // 多次尝试解码，防止 TVBox 内部重复编码
        for (var d = 0; d < 3; d++) {
            try {
                var decoded = decodeURIComponent(url);
                if (decoded === url) break;
                url = decoded;
            } catch (e) { break; }
        }

        // 对需要代理的 m3u8 源做分片路径修复
        if (needM3U8Proxy(url)) {
            var proxied = proxyM3U8(url);
            if (proxied) {
                try {
                    var base64 = toBase64(proxied);
                    return JSON.stringify({
                        parse: 0,
                        playUrl: '',
                        url: 'data:application/vnd.apple.mpegurl;base64,' + base64,
                        header: { 'User-Agent': USER_AGENT, 'Accept': '*/*' }
                    });
                } catch (e) { }
            }
            // 代理失败，回退直接播放
        }

        return JSON.stringify({
            parse: 0,
            playUrl: '',
            url: url,
            header: { 'User-Agent': USER_AGENT, 'Accept': '*/*' }
        });
    },

    // 会员密码即入口：搜索词与某会员分组密码一致时返回该分组全部频道
    search: function (wd, quick) {
        var groups = fetchGroups();
        var k = String(wd || '').replace(/^\s+|\s+$/g, '');
        var list = [], i, j;
        for (i = 0; i < groups.length; i++) {
            if (groups[i].pwd) continue;
            for (j = 0; j < groups[i].channels.length; j++) {
                if (groups[i].channels[j].name.indexOf(k) > -1) {
                    list.push(card(groups[i], groups[i].channels[j], j));
                }
            }
        }
        for (i = 0; i < groups.length; i++) {
            if (!groups[i].pwd || groups[i].pwd !== k) continue;
            for (j = 0; j < groups[i].channels.length; j++) {
                list.push(card(groups[i], groups[i].channels[j], j));
            }
        }
        return JSON.stringify({ list: list });
    }
};

export default spider;