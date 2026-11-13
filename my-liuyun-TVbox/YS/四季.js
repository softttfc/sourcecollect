/**
 * 四季（1234影视）TVBox QuickJS 爬虫（琉芸JS版）
 * 源站: https://www.1234sp.cc （镜像: qiushui.vip / qiushuitv.cn / qiushuiying.cn）
 * HTML 解析 + 滑块人形验证（搜索）+ iframe 双模式播放解析
 * ext 可传入自定义域名覆盖默认 HOST
 */

var HOST = 'https://www.1234sp.cc';
var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
var TIMEOUT = 18000; // 毫秒
var PAGE_SIZE = 36;
var INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var CLASSES = [
    { name: '连续剧', id: 'A2xeflx0UY1tu' },
    { name: '电影', id: 'A2mOC0y4HbZ3l' },
    { name: '动漫', id: 'A2ttqWI1YGgTu' },
    { name: '综艺', id: 'A2b7iFz0ozYru' }
];

var _permit = null;
var _permitExp = 0;

function _nowSec() {
    return Math.floor(Date.now() / 1000);
}

function _headers(referer, cookie) {
    var h = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'identity',
        'Referer': referer || (HOST + '/')
    };
    if (cookie) h['Cookie'] = cookie;
    return h;
}

function _get(url, referer, cookie) {
    try {
        var res = req(url, { method: 'get', headers: _headers(referer, cookie), timeout: TIMEOUT });
        if (!res || res.code !== 200 || !res.content) return null;
        return res;
    } catch (e) {
        return null;
    }
}

function _stripTags(s) {
    return (s || '').replace(/<[^>]+>/g, '').trim();
}

function _decodeEntities(s) {
    return (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

var CARD_RE = /<article class="pixel-card">\s*<a class="pixel-card__link" href="\/v\/([A-Za-z0-9]+)\.html"[^>]*?title="([^"]+)"[\s\S]*?<img src="([^"]+)"[^>]*?>[\s\S]*?<span class="pixel-card__remark">([^<]*)<\/span>/g;

function _parseCards(html) {
    var list = [];
    if (!html) return list;
    CARD_RE.lastIndex = 0;
    var m;
    while ((m = CARD_RE.exec(html)) !== null) {
        list.push({
            vod_id: m[1],
            vod_name: m[2],
            vod_pic: m[3],
            vod_remarks: (m[4] || '').trim()
        });
    }
    return list;
}

function _parsePageCount(html) {
    if (!html) return 1;
    var nav = /<nav class="pixel-pagination"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    if (!nav) return 1;
    var re = /aria-label="第\s*(\d+)\s*页"/g;
    var max = 1, m;
    while ((m = re.exec(nav[1])) !== null) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
    }
    return max;
}

function _b64urlEncode(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 0x80) {
            bytes.push(c);
        } else if (c < 0x800) {
            bytes.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        } else if (c >= 0xD800 && c <= 0xDBFF) {
            var c2 = str.charCodeAt(++i);
            var cp = 0x10000 + ((c & 0x3FF) << 10) + (c2 & 0x3FF);
            bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
        } else {
            bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '';
    for (var j = 0; j < bytes.length; j += 3) {
        var b0 = bytes[j];
        var b1 = (j + 1 < bytes.length) ? bytes[j + 1] : null;
        var b2 = (j + 2 < bytes.length) ? bytes[j + 2] : null;
        out += chars.charAt(b0 >> 2);
        out += chars.charAt(((b0 & 3) << 4) | (b1 === null ? 0 : b1 >> 4));
        out += (b1 === null) ? '=' : chars.charAt(((b1 & 15) << 2) | (b2 === null ? 0 : b2 >> 6));
        out += (b2 === null) ? '=' : chars.charAt(b2 & 63);
    }
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function _findPermitCookie(hdrs) {
    if (!hdrs) return null;
    var keys = Object.keys(hdrs);
    for (var i = 0; i < keys.length; i++) {
        if (keys[i].toLowerCase() === 'set-cookie') {
            var v = hdrs[keys[i]];
            var arr = (typeof v === 'string') ? [v] : v;
            for (var k = 0; k < arr.length; k++) {
                var m = /maccms_human_permit=([^;]+)/.exec(arr[k]);
                if (m) return m[1];
            }
        }
    }
    return null;
}

function _solveHumanCheck(returnPath) {
    try {
        var chUrl = HOST + '/human-check?return=' + encodeURIComponent(returnPath);
        var res = _get(chUrl, HOST + returnPath);
        if (!res) return false;
        var m1 = /name="challenge" value="([^"]+)"/.exec(res.content);
        var m2 = /name="return" value="([^"]+)"/.exec(res.content);
        if (!m1 || !m2) return false;
        var vres = req(HOST + '/human-check/verify', {
            method: 'post',
            postType: 'form',
            redirect: false,
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Accept-Encoding': 'identity',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': HOST,
                'Referer': chUrl
            },
            data: {
                challenge: m1[1],
                'return': m2[1],
                duration_ms: '850',
                move_points: '47',
                final_percent: '100',
                pressed: 'true',
                released: 'true'
            },
            timeout: TIMEOUT
        });
        var permit = vres ? _findPermitCookie(vres.headers) : null;
        if (!permit) return false;
        _permit = permit;
        _permitExp = _nowSec() + 10000; // 服务端 Max-Age 10800，提前一点过期
        return true;
    } catch (e) {
        return false;
    }
}

function _ensurePermit(returnPath) {
    if (_permit && _permitExp - 60 > _nowSec()) return true;
    return _solveHumanCheck(returnPath);
}

function init(extend) {
    try {
        var ext = null;
        if (typeof extend === 'string' && extend) {
            ext = extend;
        } else if (extend && extend.api) {
            ext = extend.api;
        }
        if (ext) {
            ext = String(ext).trim().replace(/`+/g, '').replace(/\/+$/, '');
            if (/^https?:\/\//.test(ext)) HOST = ext;
        }
    } catch (e) {}
}

function home(filter) {
    var result = { list: [], 'class': [], filters: {} };
    for (var i = 0; i < CLASSES.length; i++) {
        result['class'].push({ type_id: CLASSES[i].id, type_name: CLASSES[i].name });
        result.filters[CLASSES[i].id] = [];
    }
    try {
        var res = _get(HOST + '/');
        if (res) {
            var hero = /<div class="pixel-home__lead">([\s\S]*?)<\/div>\s*<\/section>/.exec(res.content);
            var seed = hero ? hero[1] : res.content;
            result.list = _parseCards(seed).slice(0, 30);
        }
    } catch (e) {}
    // 首页失败回退：用 4 个分类首页补齐，避免空数据
    if (result.list.length === 0) {
        for (var j = 0; j < CLASSES.length && result.list.length < 30; j++) {
            try {
                var cr = _get(HOST + '/list/' + CLASSES[j].id + '/1.html');
                if (!cr) continue;
                var cards = _parseCards(cr.content).slice(0, 8);
                for (var k = 0; k < cards.length && result.list.length < 30; k++) {
                    result.list.push(cards[k]);
                }
            } catch (e2) {}
        }
    }
    return JSON.stringify(result);
}

function homeVod() {
    var result = { list: [] };
    try {
        var res = _get(HOST + '/');
        if (!res) return JSON.stringify(result);
        var hero = /<div class="pixel-home__lead">([\s\S]*?)<\/div>\s*<\/section>/.exec(res.content);
        var seed = hero ? hero[1] : res.content;
        result.list = _parseCards(seed).slice(0, 30);
    } catch (e) {}
    return JSON.stringify(result);
}

function category(tid, pg, filter, extend) {
    var page = /^\d+$/.test(String(pg)) ? parseInt(pg, 10) : 1;
    var result = { list: [], page: page, pagecount: 1, limit: PAGE_SIZE, total: 0 };
    try {
        var res = _get(HOST + '/list/' + tid + '/' + page + '.html');
        if (!res) return JSON.stringify(result);
        result.list = _parseCards(res.content);
        var total = _parsePageCount(res.content);
        result.pagecount = total;
        result.total = total * PAGE_SIZE;
    } catch (e) {}
    return JSON.stringify(result);
}

function detail(id) {
    var vid = String(id);
    var vod = {
        vod_id: vid, vod_name: '', vod_pic: '', vod_year: '', vod_area: '',
        vod_class: '', vod_remarks: '', vod_director: '', vod_actor: '',
        vod_content: '', vod_play_from: '', vod_play_url: ''
    };
    try {
        var res = _get(HOST + '/v/' + vid + '.html');
        if (!res) return JSON.stringify({ list: [] });
        var html = res.content;

        var h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
        if (h1) vod.vod_name = _stripTags(h1[1]);

        var poster = /pixel-detail__poster[\s\S]{0,300}?<img[^>]*src="([^"]+)"/.exec(html);
        if (poster) vod.vod_pic = _decodeEntities(poster[1]);

        // meta 区域：dl.pixel-meta ... </dl>
        var metaM = /<dl class="pixel-meta"[^>]*>([\s\S]*?)<\/dl>/.exec(html);
        if (metaM) {
            var rowRe = /<div[^>]*>\s*<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>\s*<\/div>/g;
            var row;
            while ((row = rowRe.exec(metaM[1])) !== null) {
                var k = _stripTags(row[1]);
                var v = _stripTags(row[2]);
                if (k === '主演') vod.vod_actor = v;
                else if (k === '导演') vod.vod_director = v;
                else if (k === '类型') vod.vod_class = v;
                else if (k.replace(/\s+/g, '') === '地区/年份') {
                    var parts = v.split('/');
                    var cleaned = [];
                    for (var p = 0; p < parts.length; p++) {
                        var t = parts[p].trim();
                        if (t) cleaned.push(t);
                    }
                    if (cleaned.length > 0) vod.vod_area = cleaned[0];
                    if (cleaned.length > 1) vod.vod_year = cleaned[cleaned.length - 1];
                }
                else if (k === '状态') vod.vod_remarks = v;
            }
        }

        var intro = /data-vod-intro[^>]*>([\s\S]*?)<\/div>/.exec(html);
        if (intro) {
            var introText = _stripTags(intro[1]);
            if (introText.indexOf(INTRO_PREFIX) !== 0) introText = INTRO_PREFIX + introText;
            vod.vod_content = introText;
        } else {
            vod.vod_content = INTRO_PREFIX;
        }

        // 播放线路
        var fromNames = [], urlGroups = [];
        var playlistM = /data-playlist[\s\S]/.exec(html);
        if (playlistM) {
            var plHtml = html.substring(playlistM.index);
            // tab 标签
            var tabRe = /data-playlist-tab="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
            var tabs = {}, tabOrder = [], tm;
            while ((tm = tabRe.exec(plHtml)) !== null) {
                var label = _stripTags(tm[2]) || ('线路' + tm[1]);
                tabs[tm[1]] = label;
                tabOrder.push(tm[1]);
            }
            // panel 分块：按 data-playlist-panel="N" 位置切分
            var panelRe = /data-playlist-panel="([^"]+)"/g;
            var marks = [], pm;
            while ((pm = panelRe.exec(plHtml)) !== null) {
                marks.push({ id: pm[1], pos: pm.index });
            }
            var epRe = /<a[^>]*href="\/p\/([A-Za-z0-9]+)\/(\d+)\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
            for (var ti = 0; ti < tabOrder.length; ti++) {
                var lineNo = tabOrder[ti];
                var chunk = null;
                for (var mi = 0; mi < marks.length; mi++) {
                    if (marks[mi].id === lineNo) {
                        var end = (mi + 1 < marks.length) ? marks[mi + 1].pos : plHtml.length;
                        chunk = plHtml.substring(marks[mi].pos, end);
                        break;
                    }
                }
                if (!chunk) continue;
                var eps = [], em;
                epRe.lastIndex = 0;
                while ((em = epRe.exec(chunk)) !== null) {
                    var epName = _stripTags(em[4]);
                    if (!epName) continue;
                    eps.push(epName + '$' + em[1] + '|' + em[2] + '|' + em[3]);
                }
                if (eps.length > 0) {
                    fromNames.push(tabs[lineNo]);
                    urlGroups.push(eps.join('#'));
                }
            }
        }
        vod.vod_play_from = fromNames.join('$$$');
        vod.vod_play_url = urlGroups.join('$$$');
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
    return JSON.stringify({ list: [vod] });
}

function search(key, quick) {
    var result = { list: [] };
    var wd = String(key || '');
    if (!wd) return JSON.stringify(result);
    try {
        var bkey = _b64urlEncode(wd);
        var retPath = '/search/' + bkey + '/1.html';
        _ensurePermit(retPath);
        var cookie = _permit ? ('maccms_human_permit=' + _permit) : null;
        var res = _get(HOST + retPath, HOST + '/', cookie);
        if (res && (res.content.indexOf('<title>访问验证') >= 0 || res.content.indexOf('name="challenge"') >= 0)) {
            // 验证页被重定向跟随：重新过验证后重试一次
            if (_solveHumanCheck(retPath)) {
                cookie = 'maccms_human_permit=' + _permit;
                res = _get(HOST + retPath, HOST + '/', cookie);
            }
        }
        if (!res) return JSON.stringify(result);
        result.list = _parseCards(res.content);
    } catch (e) {}
    return JSON.stringify(result);
}

function play(flag, id, vipFlags) {
    var header = { 'User-Agent': UA };
    var parts = String(id).split('|');
    if (parts.length !== 3) {
        return JSON.stringify({ parse: 0, url: String(id), header: header });
    }
    var vid = parts[0], line = parts[1], nid = parts[2];
    try {
        var res = _get(HOST + '/p/' + vid + '/' + line + '/' + nid + '.html', HOST + '/v/' + vid + '.html');
        if (!res) return JSON.stringify({ parse: 0, url: '', header: header });
        var im = /<iframe[^>]+src="([^"]+)"/.exec(res.content);
        if (!im) return JSON.stringify({ parse: 0, url: '', header: header });
        var iframe = _decodeEntities(im[1]);

        // Pattern A：player.html?v=hex -> /proxy/hex 返回 JSON 直链
        var ma = /(https?:\/\/[^/"']+)\/(?:[a-z0-9]+\/)?player\.html\?v=([a-f0-9]{16,64})/.exec(iframe);
        if (ma) {
            var proxyUrl = ma[1] + '/proxy/' + ma[2];
            try {
                var pr = req(proxyUrl, {
                    method: 'get',
                    headers: {
                        'User-Agent': UA,
                        'Accept': 'application/json',
                        'Accept-Encoding': 'identity',
                        'Referer': iframe
                    },
                    timeout: TIMEOUT
                });
                if (pr && pr.content) {
                    var data = JSON.parse(pr.content);
                    if (data && data.code === 200 && data.url) {
                        return JSON.stringify({ parse: 0, url: String(data.url).trim(), header: header });
                    }
                }
            } catch (e) {}
            return JSON.stringify({ parse: 1, url: iframe, header: header });
        }

        // Pattern B：iframe query 中的 url/URL/src 直出
        var qIdx = iframe.indexOf('?');
        if (qIdx >= 0) {
            var qs = iframe.substring(qIdx + 1).split('#')[0].split('&');
            for (var i = 0; i < qs.length; i++) {
                var kv = qs[i].split('=');
                if (kv.length >= 2) {
                    var kName = kv[0];
                    if (kName === 'url' || kName === 'URL' || kName === 'src') {
                        var val = kv.slice(1).join('=');
                        try { val = decodeURIComponent(val); } catch (e2) {}
                        if (/^https?:\/\//.test(val)) {
                            return JSON.stringify({ parse: 0, url: val, header: header });
                        }
                    }
                }
            }
        }
        return JSON.stringify({ parse: 1, url: iframe, header: header });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: '', header: header });
    }
}

export default {
    name: '1234影视',
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    search: search,
    play: play
};
