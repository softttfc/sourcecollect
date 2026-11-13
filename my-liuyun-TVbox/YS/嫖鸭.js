// 白嫖鸭 - TVBox QuickJS (drpy规则转标准爬虫), 聚合腾讯/芒果/爱奇艺/B站 琉芸JS版
var PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
var DESC_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
var MGTV_SALT = 'xHAa3YZflWLogZUOzl';
var BAK = '1d8b6e7d45233436';
var BSC = '560c52ccd288fed045859ed18bffd973';

var CLASS_NAMES = ['电影', '剧集', '综艺', '动漫', '记录', '少儿', '短剧', '漫剧', '体育', '中视频', '宠物'];
var CLASS_IDS = ['movie', 'tv', 'variety', 'cartoon', 'doco', 'child', 'short', 'manju', 'sports', 'midvideo', 'pettv'];

var CATE_MAP = {
    'movie': [['qq', 'movie'], ['mgtv', '3'], ['iqiyi', '1'], ['iqiyi', '16'], ['bili', '2']],
    'tv': [['qq', 'tv'], ['mgtv', '2'], ['iqiyi', '2'], ['bili', '5']],
    'variety': [['qq', 'variety'], ['mgtv', '1'], ['iqiyi', '6'], ['bili', '7']],
    'cartoon': [['qq', 'cartoon'], ['mgtv', '50'], ['iqiyi', '4'], ['bili', '1'], ['bili', '4']],
    'doco': [['qq', 'doco'], ['mgtv', '51'], ['iqiyi', '3'], ['bili', '3']],
    'child': [['qq', 'child'], ['mgtv', '10'], ['mgtv', '115'], ['iqiyi', '15']],
    'short': [['qq', 'short'], ['iqiyi', '35']],
    'manju': [['iqiyi', '37']],
    'sports': [['qq', 'sports']],
    'midvideo': [['qq', 'midvideo']],
    'pettv': [['qq', 'pettv']]
};
var PRIORITY = { 'mgtv': 0, 'bili': 1, 'qq': 2, 'iqiyi': 3 };
var QQ_CHAN = { 'movie': 100173, 'tv': 100113, 'variety': 100109, 'cartoon': 100119, 'child': 100150, 'doco': 100105, 'short': 120188, 'sports': 100103, 'midvideo': 110852, 'pettv': 100302 };

var FILTERS = {
    "movie": [
        { key: "itype", name: "类型", value: [{ n: "全部", v: "-1" }, { n: "动作", v: "4" }, { n: "喜剧", v: "3" }, { n: "爱情", v: "5" }, { n: "科幻", v: "12" }, { n: "犯罪", v: "6" }, { n: "冒险", v: "7" }, { n: "恐怖", v: "11" }, { n: "动画", v: "15" }, { n: "战争", v: "8" }, { n: "悬疑", v: "10" }, { n: "灾难", v: "25" }, { n: "青春", v: "26" }] },
        { key: "iarea", name: "地区", value: [{ n: "全部", v: "-1" }, { n: "内地", v: "100024" }, { n: "中国香港", v: "100025" }, { n: "中国台湾", v: "100026" }, { n: "美国", v: "100029" }, { n: "日本", v: "100027" }, { n: "韩国", v: "100028" }, { n: "泰国", v: "100031" }, { n: "印度", v: "100030" }, { n: "英国", v: "15" }, { n: "法国", v: "16" }, { n: "德国", v: "17" }, { n: "加拿大", v: "18" }, { n: "西班牙", v: "19" }, { n: "意大利", v: "20" }, { n: "澳大利亚", v: "21" }, { n: "其他", v: "100033" }] },
        { key: "iyear", name: "年份", value: [{ n: "全部", v: "-1" }, { n: "即将上线", v: "999" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "2020" }, { n: "2019", v: "20" }, { n: "2018", v: "2018" }, { n: "2017", v: "1" }, { n: "2016", v: "2" }, { n: "2015", v: "3" }, { n: "2014", v: "4" }, { n: "2013-2011", v: "5" }, { n: "2010-2006", v: "6" }, { n: "2005-2000", v: "7" }, { n: "90年代", v: "8" }, { n: "80年代", v: "9" }, { n: "其他", v: "10" }] }
    ],
    "tv": [
        { key: "itype", name: "类型", value: [{ n: "全部", v: "-1" }, { n: "爱情", v: "1" }, { n: "都市", v: "2" }, { n: "青春", v: "3" }, { n: "奇幻", v: "4" }, { n: "武侠", v: "5" }, { n: "古装", v: "6" }, { n: "科幻", v: "7" }, { n: "猎奇", v: "8" }, { n: "竞技", v: "9" }, { n: "传奇", v: "10" }, { n: "逆袭", v: "19" }, { n: "军旅", v: "11" }, { n: "家庭", v: "12" }, { n: "喜剧", v: "13" }, { n: "悬疑", v: "14" }, { n: "权谋", v: "15" }, { n: "革命", v: "16" }, { n: "现实", v: "17" }, { n: "刑侦", v: "18" }, { n: "民国", v: "20" }, { n: "IP改编", v: "21" }] },
        { key: "iarea", name: "地区", value: [{ n: "全部", v: "-1" }, { n: "内地", v: "0" }, { n: "中国香港", v: "14" }, { n: "中国台湾", v: "4" }, { n: "美国", v: "8" }, { n: "泰国", v: "9" }, { n: "英国", v: "1" }, { n: "韩国", v: "5" }, { n: "日本", v: "10" }, { n: "其他", v: "9999" }] },
        { key: "iyear", name: "年份", value: [{ n: "全部", v: "-1" }, { n: "即将上线", v: "1" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2" }, { n: "2023", v: "3" }, { n: "2022", v: "4" }, { n: "2021", v: "5" }, { n: "2020-2016", v: "6" }, { n: "2015-2011", v: "7" }, { n: "2010-2000", v: "8" }, { n: "更早", v: "9" }] }
    ],
    "variety": [
        { key: "itype", name: "类型", value: [{ n: "全部", v: "-1" }, { n: "游戏", v: "10" }, { n: "脱口秀", v: "2" }, { n: "音乐舞台", v: "11" }, { n: "情感", v: "12" }, { n: "生活", v: "22" }, { n: "职场", v: "20" }, { n: "喜剧", v: "14" }, { n: "美食", v: "19" }, { n: "潮流运动", v: "21" }, { n: "竞技", v: "24" }, { n: "影视", v: "16" }, { n: "电竞", v: "15" }, { n: "推理", v: "25" }, { n: "访谈", v: "3" }, { n: "亲子", v: "17" }, { n: "文化", v: "26" }, { n: "互动", v: "23" }, { n: "晚会", v: "6" }, { n: "资讯", v: "7" }] },
        { key: "iarea", name: "地区", value: [{ n: "全部", v: "-1" }, { n: "国内", v: "1" }, { n: "海外", v: "2" }] },
        { key: "iyear", name: "年份", value: [{ n: "全部", v: "-1" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "50" }, { n: "2019", v: "7" }, { n: "2018", v: "1" }, { n: "2017", v: "2" }, { n: "2016", v: "3" }, { n: "2015", v: "4" }, { n: "2014", v: "5" }, { n: "2013", v: "6" }, { n: "2012", v: "2012" }, { n: "2011", v: "2011" }, { n: "2010", v: "2010" }, { n: "更早", v: "99" }] }
    ],
    "cartoon": [
        { key: "itype", name: "类型", value: [{ n: "全部", v: "-1" }, { n: "玄幻", v: "9" }, { n: "科幻", v: "4" }, { n: "奇幻", v: "21" }, { n: "武侠", v: "13" }, { n: "仙侠", v: "23" }, { n: "都市", v: "24" }, { n: "恋爱", v: "7" }, { n: "搞笑", v: "1" }, { n: "冒险", v: "2" }, { n: "悬疑", v: "17" }, { n: "竞技", v: "20" }, { n: "日常", v: "15" }, { n: "真人", v: "18" }, { n: "治愈", v: "25" }, { n: "游戏", v: "26" }, { n: "异能", v: "27" }, { n: "历史", v: "19" }, { n: "古风", v: "28" }, { n: "智斗", v: "29" }, { n: "恐怖", v: "30" }, { n: "美食", v: "31" }, { n: "音乐", v: "32" }, { n: "其他", v: "12" }] },
        { key: "iarea", name: "地区", value: [{ n: "全部", v: "-1" }, { n: "内地", v: "1" }, { n: "日本", v: "2" }, { n: "欧美", v: "3" }, { n: "其他", v: "4" }] },
        { key: "iyear", name: "年份", value: [{ n: "全部", v: "-1" }, { n: "2026", v: "2026" }, { n: "2025", v: "2025" }, { n: "2024", v: "2024" }, { n: "2023", v: "2023" }, { n: "2022", v: "2022" }, { n: "2021", v: "2021" }, { n: "2020", v: "50" }, { n: "2019", v: "11" }, { n: "2018", v: "2018" }, { n: "2017", v: "2017" }, { n: "2016", v: "1" }, { n: "2015", v: "2" }, { n: "2014", v: "3" }, { n: "2013", v: "4" }, { n: "2012", v: "5" }, { n: "2011", v: "6" }, { n: "00年代", v: "7" }, { n: "90年代", v: "8" }, { n: "80年代", v: "9" }, { n: "更早", v: "10" }] }
    ]
};

// ================= MD5 (硬编码常量, QuickJS兼容, 已验证) =================
function md5(input) {
    var b = unescape(encodeURIComponent(input));
    var bytes = [];
    for (var i = 0; i < b.length; i++) bytes.push(b.charCodeAt(i) & 255);
    var K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];
    var S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    var lenLo = (bytes.length * 8) >>> 0;
    var lenHi = Math.floor(bytes.length / 0x20000000) >>> 0;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var i = 0; i < 4; i++) bytes.push((lenLo >>> (8 * i)) & 255);
    for (var i = 0; i < 4; i++) bytes.push((lenHi >>> (8 * i)) & 255);
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    function rol(x, n) { return (((x << n) | (x >>> (32 - n))) >>> 0); }
    for (var off = 0; off < bytes.length; off += 64) {
        var M = [];
        for (var j = 0; j < 16; j++) M[j] = (bytes[off + j * 4] | (bytes[off + j * 4 + 1] << 8) | (bytes[off + j * 4 + 2] << 16) | (bytes[off + j * 4 + 3] << 24));
        var A = a0, B = b0, C = c0, D = d0;
        for (var j = 0; j < 64; j++) {
            var F, g;
            if (j < 16) { F = (B & C) | (~B & D); g = j; }
            else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
            else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
            else { F = C ^ (B | ~D); g = (7 * j) % 16; }
            var tmp = D; D = C; C = B;
            B = (B + rol((A + F + K[j] + M[g]) >>> 0, S[j])) >>> 0;
            A = tmp;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    function leHex(w) {
        var s = '';
        for (var i = 0; i < 4; i++) s += ('0' + ((w >>> (8 * i)) & 255).toString(16)).slice(-2);
        return s;
    }
    return leHex(a0) + leHex(b0) + leHex(c0) + leHex(d0);
}

// ================= 工具 =================
function getText(url, hdrs) {
    try {
        var r = req(url, { headers: hdrs || { 'User-Agent': PC_UA }, timeout: 15000 });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function postJson(url, body, hdrs) {
    try {
        var h = { 'User-Agent': PC_UA, 'Content-Type': 'application/json' };
        if (hdrs) { for (var k in hdrs) h[k] = hdrs[k]; }
        var r = req(url, { method: 'post', data: body, postType: 'json', headers: h, timeout: 15000 });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function normTitle(t) {
    if (!t) return '';
    return t.replace(/<[^>]+>/g, '').replace(/[\s\p{P}]/gu, '').toLowerCase();
}

function cleanTitle(t) {
    if (!t) return '';
    return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function mergeResults(results) {
    var map = {}, order = [];
    results.forEach(function (item) {
        var key = normTitle(item.title);
        if (!key) return;
        if (!map[key]) {
            map[key] = item;
            order.push(key);
        } else {
            var oldP = map[key].url.split('__')[0];
            var newP = item.url.split('__')[0];
            var oldRank = PRIORITY[oldP] !== undefined ? PRIORITY[oldP] : 99;
            var newRank = PRIORITY[newP] !== undefined ? PRIORITY[newP] : 99;
            if (newRank < oldRank) map[key] = item;
        }
    });
    return order.map(function (k) { return map[k]; });
}

function toVod(item) {
    return {
        vod_id: item.url,
        vod_name: item.title,
        vod_pic: item.img || '',
        vod_remarks: item.desc || ''
    };
}

// ================= 分类 =================
function fetchQqCategory(chanId, pg, fl) {
    var cid = QQ_CHAN[chanId] || 100173;
    var hdrs = { 'origin': 'https://v.qq.com', 'referer': 'https://v.qq.com/' };
    // 体育/中视频/宠物 走 getPage 链式游标翻页
    if (chanId === 'sports' || chanId === 'midvideo' || chanId === 'pettv') {
        var url = 'https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010&vversion_platform=2';
        var ctx = null, html = '';
        for (var kk = 1; kk <= pg; kk++) {
            var gp = {
                page_params: { page_type: 'channel', page_id: String(cid), scene: 'channel', new_mark_label_enabled: '1' },
                page_bypass_params: { params: { platform_id: '2', caller_id: '3000010', data_mode: 'default', user_mode: 'default', page_type: 'channel', page_id: String(cid), scene: 'channel', new_mark_label_enabled: '1' }, scene: 'channel' },
                page_context: ctx
            };
            html = postJson(url, gp, hdrs);
            try {
                var pj = JSON.parse(html);
                ctx = (pj.data && pj.data.page_context) ? pj.data.page_context : null;
            } catch (e) { break; }
            if (!ctx) break;
        }
        return html;
    }
    var qqFp = 'sort=75';
    if (fl && fl.itype && fl.itype !== '-1') qqFp += '&itype=' + fl.itype;
    if (fl && fl.iarea && fl.iarea !== '-1') qqFp += '&iarea=' + fl.iarea;
    if (fl && fl.iyear && fl.iyear !== '-1') qqFp += '&iyear=' + fl.iyear;
    var body = { page_params: { channel_id: String(cid), filter_params: qqFp, page_type: 'operation', page_id: 'channel_list' } };
    if (pg > 1) {
        var m = pg - 1;
        body.page_context = {
            "_ctrl_page_index": String(m), "_ctrl_showed_module_num": String(m),
            "_ds_cli_6970df954e7a9803_poster_offset": String(m * 12),
            "_ds_cli_6970df954e7a9803_poster_size": "12", "_merger_mod_cnt": String(m),
            "page_index": String(m),
            "sdk_page_ctx": '{"page_offset":' + m + ',"page_size":5,"used_module_num":' + m + '}',
            "video_un_page_index": String(m)
        };
    }
    return postJson('https://pbaccess.video.qq.com/trpc.multi_vector_layout.mvl_controller.MVLPageHTTPService/getMVLPage?&vversion_platform=2', body, hdrs);
}

function parseQqCards(json, all) {
    var qqSeen = {};
    function collect(node) {
        if (!node) return;
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (typeof node !== 'object') return;
        var p = node.params;
        if (p && p.cid && !qqSeen[p.cid]) {
            var title = p.title || p.mz_title || '';
            if (title) {
                qqSeen[p.cid] = 1;
                var pic = p.image_url_vertical || p.new_pic_vt || p.new_pic_hz || p.pic_276x386 || p.image_url || p.ready_image_url || '';
                all.push({ title: title, img: pic, url: 'qq__' + p.cid, desc: '腾讯视频-4K' });
            }
        }
        for (var key in node) {
            if (key === 'params') continue;
            var child = node[key];
            if (child && typeof child === 'object') collect(child);
        }
    }
    collect(json.data || json);
}

function categoryContent(tid, pg, filter, extend) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    var fl = {};
    if (extend) {
        if (typeof extend === 'string') { try { fl = extend ? JSON.parse(extend) : {}; } catch (e) { fl = {}; } }
        else if (typeof extend === 'object') fl = extend;
    }
    var platforms = CATE_MAP[tid] || [];
    var all = [];

    for (var i = 0; i < platforms.length; i++) {
        var platform = platforms[i][0], chanId = platforms[i][1];
        try {
            if (platform === 'qq') {
                var html = fetchQqCategory(chanId, page, fl);
                if (html) parseQqCards(JSON.parse(html), all);
            } else if (platform === 'mgtv') {
                var url = 'https://pianku.api.mgtv.com/rider/list/pcweb/v3?platform=pcweb&channelId=' + chanId + '&pn=' + page + '&pc=20&hudong=1&_support=10000000&kind=a1&area=a1';
                if (fl.iyear && fl.iyear !== '-1') url += '&year=' + fl.iyear;
                var html2 = getText(url, { 'User-Agent': PC_UA, 'Referer': 'https://www.mgtv.com' });
                if (!html2) continue;
                var items = (JSON.parse(html2).data || {}).hitDocs || [];
                items.forEach(function (item) {
                    if (item.title && (item.playPartId || item.clipId)) {
                        var mgtvId = item.playPartId || item.clipId;
                        all.push({ title: item.title, img: item.img || '', url: 'mgtv__' + mgtvId, desc: '芒果视频-4K' });
                    }
                });
            } else if (platform === 'iqiyi') {
                var html3 = getText('https://pcw-api.iqiyi.com/search/recommend/list?channel_id=' + chanId + '&data_type=1&page_id=' + page + '&ret_num=20');
                if (!html3) continue;
                var items3 = (JSON.parse(html3).data || {}).list || [];
                items3.forEach(function (item) {
                    if (item.name && item.albumId) {
                        var pic = item.imageUrl || '';
                        if (pic.indexOf('//') === 0) pic = 'https:' + pic;
                        var remark = '';
                        var latest = item.latestOrder || 0, total = item.videoCount || 0;
                        var channel = Number(item.channelId || chanId || 0);
                        if (channel === 1) remark = item.score ? item.score + '分' : '';
                        else if (channel === 6) remark = item.period ? item.period + (String(item.period).indexOf('期') > -1 ? '' : '期') : '';
                        else if (channel === 5) remark = item.focus || '';
                        else if (latest && total) remark = Number(latest) === Number(total) ? latest + '集全' : latest + '/' + total + '集';
                        else if (latest) remark = '更新至 ' + latest + '集';
                        else if (total) remark = '共' + total + '集';
                        else remark = item.focus || item.period || item.subtitle || '';
                        if (item.score && channel !== 1) remark = item.score + '分\t' + remark;
                        all.push({ title: item.name, img: pic, url: 'iqiyi__' + item.albumId, desc: remark || '爱奇艺-2K' });
                    }
                });
            } else if (platform === 'bili') {
                var html4 = getText('https://api.bilibili.com/pgc/season/index/result?order=2&pagesize=20&type=1&season_type=' + chanId + '&page=' + page + '&season_status=-1', { 'User-Agent': PC_UA, 'Referer': 'https://www.bilibili.com' });
                if (!html4) continue;
                var items4 = (JSON.parse(html4).data || {}).list || [];
                items4.forEach(function (vod) {
                    if (vod.season_id && vod.title) {
                        var remark = (vod.new_ep && vod.new_ep.index_show) || vod.index_show || vod.badge || '';
                        all.push({ title: vod.title, img: vod.cover || '', url: 'bili__' + vod.season_id, desc: remark || '哔哩哔哩-4K' });
                    }
                });
            }
        } catch (e) { }
    }

    var merged = mergeResults(all);
    var list = merged.map(toVod);
    return { list: list, page: page, pagecount: list.length ? page + 1 : page, limit: 20, total: 0 };
}

// ================= 详情 =================
function detailMgtv(vid) {
    var VOD = { vod_play_from: '白嫖鸭' };
    var d = [];
    var epUrl = 'https://pcweb.api.mgtv.com/episode/list?page=1&size=50&video_id=' + vid;
    var epJson = null;
    try { epJson = JSON.parse(getText(epUrl, { 'User-Agent': MOBILE_UA, 'Referer': 'https://www.mgtv.com' })); } catch (e) { }
    var epList = (epJson && epJson.data) ? epJson.data.list || [] : [];
    var totalPage = (epJson && epJson.data) ? epJson.data.total_page || 1 : 1;

    // vid可能是专辑ID: 从专辑页取视频ID
    if (!epList.length) {
        var albumHtml = getText('https://www.mgtv.com/b/' + vid + '/');
        var videoId = '';
        var m1 = /\/b\/\d+\/(\d+)\.html/.exec(albumHtml);
        if (m1) videoId = m1[1];
        if (!videoId) {
            var m2 = /url=([^"'\s>]+)/i.exec(albumHtml);
            if (m2) {
                var redir = m2[1];
                if (redir.indexOf('http') !== 0) redir = 'https://www.mgtv.com' + redir;
                var html2 = getText(redir);
                var m3 = /\/b\/\d+\/(\d+)\.html/.exec(html2);
                if (m3) videoId = m3[1];
            }
        }
        if (videoId) {
            vid = videoId;
            try { epJson = JSON.parse(getText('https://pcweb.api.mgtv.com/episode/list?page=1&size=50&video_id=' + videoId, { 'User-Agent': MOBILE_UA, 'Referer': 'https://www.mgtv.com' })); } catch (e) { }
            epList = (epJson && epJson.data) ? epJson.data.list || [] : [];
            totalPage = (epJson && epJson.data) ? epJson.data.total_page || 1 : 1;
        }
    }

    for (var pi = 2; pi <= totalPage; pi++) {
        try {
            var pJson = JSON.parse(getText('https://pcweb.api.mgtv.com/episode/list?page=' + pi + '&size=50&video_id=' + vid, { 'User-Agent': MOBILE_UA, 'Referer': 'https://www.mgtv.com' }));
            if (pJson && pJson.data && pJson.data.list) epList = epList.concat(pJson.data.list);
        } catch (e) { break; }
    }

    // 详情页标题和封面
    if (epList.length) {
        var ourl = epList[0].url;
        if (ourl && ourl.indexOf('http') !== 0) ourl = 'https://www.mgtv.com' + ourl;
        if (ourl) {
            var detailHtml = getText(ourl, { 'User-Agent': MOBILE_UA });
            if (detailHtml.indexOf('302') > -1 || detailHtml.indexOf('window.location') > -1) {
                var rm = /url=([^"'\s>]+)/i.exec(detailHtml) || /href=["']([^"']+)/i.exec(detailHtml);
                if (rm) {
                    ourl = rm[1];
                    if (ourl.indexOf('http') !== 0) ourl = 'https://www.mgtv.com' + ourl;
                    detailHtml = getText(ourl, { 'User-Agent': MOBILE_UA });
                }
            }
            var tm = /<title>([^<]+)<\/title>/.exec(detailHtml);
            if (tm) {
                var t = tm[1];
                if (t && t.indexOf('302') < 0 && t.indexOf('Found') < 0 && t.indexOf('芒果TV') < 0 && t.indexOf('首页') < 0) {
                    t = t.replace(/\s*第\d+集.*$/i, '').replace(/\s*[-_]\s*芒果TV.*$/i, '').replace(/\s*[-_]\s*湖南卫视.*$/i, '').trim();
                    if (t) VOD.vod_name = t;
                }
            }
            var pm = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i.exec(detailHtml);
            if (pm) VOD.vod_pic = pm[1];
        }
    }

    for (var ei = 0; ei < epList.length; ei++) {
        var ep = epList[ei];
        if (ep.isIntact == '1' && ep.url) {
            var playUrl = ep.url;
            if (playUrl.indexOf('http') !== 0) playUrl = 'https://www.mgtv.com' + playUrl;
            d.push({ title: ep.t4 || ep.t2 || '正片', url: playUrl });
        }
    }
    if (!VOD.vod_name && epList[0]) VOD.vod_name = (epList[0].t3 || '').replace(/\s*第\d+集.*$/, '').trim();
    if (!VOD.vod_pic && epList[0]) VOD.vod_pic = epList[0].img || '';
    VOD.vod_play_url = d.map(function (it) { return it.title.replace(/\$/g, ' ') + '$' + it.url; }).join('#');
    return VOD;
}

function detailBili(vid) {
    var VOD = { vod_play_from: '白嫖鸭' };
    var d = [];
    var html = getText('https://api.bilibili.com/pgc/view/web/season?season_id=' + vid, { 'User-Agent': PC_UA, 'Referer': 'https://www.bilibili.com' });
    var result = (JSON.parse(html).result) || {};
    var episodes = result.episodes || [];
    episodes.forEach(function (ep) {
        var badge = ep.badge || '';
        if (ep.section_type === 1 || ep.badge_type === 1 || badge.indexOf('预告') > -1) return;
        var title = (ep.title || '') + ' ' + (ep.long_title || '');
        if (ep.link) d.push({ title: title.trim(), url: ep.link });
    });
    VOD.vod_name = result.title || '';
    VOD.vod_pic = result.cover || '';
    VOD.vod_play_url = d.map(function (it) { return it.title.replace(/\$/g, ' ') + '$' + it.url; }).join('#');
    return VOD;
}

function detailQq(vid) {
    var VOD = { vod_play_from: '白嫖鸭' };
    var d = [];
    var html = getText('https://node.video.qq.com/x/api/float_vinfo2?cid=' + vid);
    var json = JSON.parse(html);
    var videoIds = (json.c && json.c.video_ids) || [];
    VOD.vod_name = (json.c && json.c.title) || '';
    VOD.vod_pic = (json.c && json.c.pic) || '';

    if (videoIds.length === 1) {
        d.push({ title: '在线播放', url: 'https://v.qq.com/x/cover/' + vid + '/' + videoIds[0] + '.html' });
    } else if (videoIds.length > 1) {
        for (var i = 0; i < videoIds.length; i += 30) {
            var batch = videoIds.slice(i, i + 30);
            try {
                var oHtml = getText('https://union.video.qq.com/fcgi-bin/data?otype=json&tid=1804&appid=20001238&appkey=6c03bbe9658448a4&union_platform=1&idlist=' + batch.join(','));
                // 响应形如 QZOutputJson={...};
                var body = oHtml.substring(oHtml.indexOf('=') + 1).replace(/;\s*$/, '');
                var QZOutputJson = JSON.parse(body);
                if (QZOutputJson && QZOutputJson.results) {
                    QZOutputJson.results.forEach(function (it1) {
                        it1 = it1.fields;
                        var catStr = JSON.stringify(it1.category_map || []);
                        if (catStr.indexOf('预告') < 0 && catStr.indexOf('花絮') < 0) {
                            d.push({ title: it1.c_title_output || it1.title, url: 'https://v.qq.com/x/cover/' + vid + '/' + it1.vid + '.html' });
                        }
                    });
                }
            } catch (e) { }
        }
    }
    VOD.vod_play_url = d.map(function (it) { return it.title.replace(/\$/g, ' ') + '$' + it.url; }).join('#');
    return VOD;
}

function detailIqiyi(vid) {
    var VOD = { vod_play_from: '白嫖鸭' };
    var d = [];
    var html = getText('https://pcw-api.iqiyi.com/video/video/videoinfowithuser/' + vid + '?agent_type=1&authcookie=&subkey=' + vid + '&subscribe=1');
    var json = JSON.parse(html).data || {};
    VOD.vod_name = json.name || '';
    VOD.vod_pic = json.imageUrl || '';
    var channelId = json.channelId || 0;
    var albumId = json.albumId || vid;

    var playlists = [];
    if (channelId === 1 || channelId === 5) {
        playlists = [{ playUrl: json.playUrl, shortTitle: json.shortTitle || '正片' }];
    } else if (channelId === 6) {
        try {
            var qs = (json.period || '').split('-')[0];
            var playData = JSON.parse(getText('https://pcw-api.iqiyi.com/album/source/svlistinfo?cid=6&sourceid=' + albumId + '&timelist=' + qs)).data || {};
            if (playData[qs]) {
                playData[qs].forEach(function (it) {
                    playlists.push({ playUrl: it.playUrl, shortTitle: it.shortTitle });
                });
            }
        } catch (e) { }
    } else {
        try {
            var listData = JSON.parse(getText('https://pcw-api.iqiyi.com/albums/album/avlistinfo?aid=' + albumId + '&size=200&page=1')).data || {};
            var epsodelist = listData.epsodelist || [];
            var total = listData.total || 0;
            if (total > 200) {
                var totalPages = Math.ceil(total / 200);
                for (var page = 2; page <= totalPages; page++) {
                    try {
                        var more = (JSON.parse(getText('https://pcw-api.iqiyi.com/albums/album/avlistinfo?aid=' + albumId + '&size=200&page=' + page)).data || {}).epsodelist || [];
                        epsodelist = epsodelist.concat(more);
                    } catch (e) { break; }
                }
            }
            playlists = epsodelist;
        } catch (e) { }
    }

    playlists.forEach(function (ep) {
        var epUrl = ep.playUrl || '';
        if (epUrl.indexOf('//') === 0) epUrl = 'https:' + epUrl;
        var title = ep.shortTitle || ('第' + (ep.order || '') + '集');
        if (epUrl) d.push({ title: title, url: epUrl });
    });
    VOD.vod_play_url = d.map(function (it) { return it.title.replace(/\$/g, ' ') + '$' + it.url; }).join('#');
    return VOD;
}

function detailContent(ids) {
    var input = String(ids).split(',')[0];
    var parts = input.split('__');
    var platform = parts[0], vid = parts[1];
    var VOD = { vod_play_from: '白嫖鸭', vod_play_url: '' };
    try {
        if (platform === 'mgtv') VOD = detailMgtv(vid);
        else if (platform === 'bili') VOD = detailBili(vid);
        else if (platform === 'qq') VOD = detailQq(vid);
        else if (platform === 'iqiyi') VOD = detailIqiyi(vid);
    } catch (e) { }
    VOD.vod_id = input;
    if (!VOD.vod_play_from) VOD.vod_play_from = '白嫖鸭';
    VOD.vod_content = DESC_PREFIX + (VOD.vod_name || '');
    return { list: [VOD] };
}

// ================= 播放 =================
function playerContent(flag, id, vipFlags) {
    var playUrl = String(id || '');
    if (playUrl.indexOf('$') > -1) playUrl = playUrl.split('$')[1];
    return { parse: 1, url: playUrl, jx: 1 };
}

// ================= 搜索 =================
var FILTER_KW = ['预告', '花絮', '片花', '剪辑', '片段', '解说', '速看', '速通', '合集', '精彩', '集锦', '盘点', '回顾', 'MV', '主题曲', '插曲', '彩蛋', '特辑', '独家', '专访', '纯享', '制作', '幕后', '宣传', '反应', 'reaction', '名场面', '抢先看', '评测', 'cut', 'CUT', '音频', '原创', '深度', '解读', '看完', '分钟', '路透', '曝光', '造型', '片场', '背台词', '告别', '长文', '新剧', '公子', '呆萌', '仪态', '清冷', '温润', '仙气', '白衣', '古装', '高马尾', '蓝衣', '素衣', '青色'];

function isMainContent(title) {
    if (!title) return false;
    if (/[《》]/.test(title)) return false;
    for (var i = 0; i < FILTER_KW.length; i++) {
        if (title.indexOf(FILTER_KW[i]) > -1) return false;
    }
    return true;
}

function searchUuid() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function buildMgtvSearchUrl(keyword) {
    var params = {
        allowedRC: '1', src: 'mgtv', did: 'cf03b95969454cb6bcb388762459354d',
        timestamp: new Date().toISOString().replace(/\.\d{3}Z/, 'Z'),
        signVersion: '1', signNonce: searchUuid(),
        q: keyword, pn: '1', pc: '10', corr: '1', _support: '10000000'
    };
    var keys = Object.keys(params).sort();
    var qs = keys.map(function (k) { return k + '=' + encodeURI(String(params[k])); }).join('&');
    return 'https://mobileso.bz.mgtv.com/pc/search/v2?' + qs + '&signature=' + md5(MGTV_SALT + qs + MGTV_SALT);
}

function buildBiliSearchUrl(keyword, t) {
    var p = { appkey: BAK, build: '7000300', keyword: keyword, mobi_app: 'android', pagesize: 20, pn: 1, ts: Math.round(Date.now() / 1000), type: t };
    var ks = Object.keys(p).sort();
    var raw = ks.map(function (k) { return k + '=' + p[k]; }).join('&');
    var sg = md5(raw + BSC);
    var enc = ks.map(function (k) { return k + '=' + encodeURIComponent(p[k]); }).join('&');
    return 'https://app.bilibili.com/x/v2/search/type?' + enc + '&sign=' + sg;
}

function searchContent(key, quick, pg) {
    var keyword = String(key || '');
    var all = [];

    // 芒果搜索
    try {
        var json = JSON.parse(getText(buildMgtvSearchUrl(keyword), { 'User-Agent': PC_UA, 'Referer': 'https://www.mgtv.com' }));
        if (json.data && json.data.contents) {
            json.data.contents.forEach(function (data) {
                var d0 = data.data;
                if (!d0 || typeof d0 !== 'object' || Array.isArray(d0)) return;
                var cards = (d0.yearList && d0.yearList.length) ? d0.yearList : [d0];
                cards.forEach(function (item) {
                    var title = cleanTitle(item.hitTitle || item.title || '');
                    var img = item.pic || '';
                    var vid = '';
                    var src = (item.sourceList && item.sourceList.length) ? item.sourceList[0] : null;
                    var pageUrl = (src && src.url) || item.url || '';
                    if (pageUrl.indexOf('/s/') > -1) return;
                    if (src) {
                        if (src.source !== 'imgo') return;
                        vid = src.vid ? String(src.vid) : '';
                        if (!vid) {
                            var m = /\/b\/\d+\/(\d+)\.html/.exec(String(pageUrl));
                            if (m) vid = m[1];
                        }
                    } else if (item.vid) {
                        vid = String(item.vid);
                    }
                    if (!vid) {
                        var m2 = /\/b\/\d+\/(\d+)\.html/.exec(String(pageUrl));
                        if (m2) vid = m2[1];
                    }
                    if (!vid || !title) return;
                    if (!isMainContent(title)) return;
                    all.push({ title: title, img: img, url: 'mgtv__' + vid, desc: '芒果视频-4K' });
                });
            });
        }
    } catch (e) { }

    // 哔哩搜索 (type=7动漫, 未命中完全同名再查type=8影视)
    try {
        var seen = {};
        function biliPush(items) {
            items.forEach(function (vod) {
                var aid = vod.season_id;
                if (aid === undefined || aid === null || aid === 0) return;
                aid = String(aid).trim();
                if (seen[aid]) return;
                seen[aid] = 1;
                var title = (vod.title || '').replace(/<[^>]+>/g, '').trim();
                var remark = (vod.new_ep && vod.new_ep.index_show) || vod.index_show || vod.styles || vod.badge || vod.season_type_name || '';
                all.push({ title: title, img: (vod.cover || '').trim(), url: 'bili__' + aid, desc: remark || '哔哩哔哩-4K' });
            });
        }
        function biliAppSearch(t) {
            var text = getText(buildBiliSearchUrl(keyword, t), { 'User-Agent': PC_UA, 'Referer': 'https://www.bilibili.com' });
            var jo = JSON.parse(text);
            if (jo && jo.code === 0 && jo.data && jo.data.items) return jo.data.items;
            return [];
        }
        var biliItems7 = biliAppSearch(7);
        biliPush(biliItems7);
        var biliNormKw = normTitle(keyword);
        var hasExact = false;
        for (var bi = 0; bi < biliItems7.length; bi++) {
            if (normTitle((biliItems7[bi].title || '').replace(/<[^>]+>/g, '').trim()) === biliNormKw) { hasExact = true; break; }
        }
        if (!hasExact) biliPush(biliAppSearch(8));
    } catch (e) { }

    // 腾讯搜索
    try {
        var qqBody = {
            "version": "25042201", "clientType": 1, "filterValue": "",
            "uuid": "B1E50847-D25F-4C4B-BBA0-36F0093487F6", "retry": 0,
            "query": keyword, "pagenum": 0, "isPrefetch": true, "pagesize": 30, "queryFrom": 0,
            "searchDatakey": "", "transInfo": "", "isneedQc": true, "preQid": "", "adClientInfo": "",
            "extraInfo": { "isNewMarkLabel": "1", "multi_terminal_pc": "1", "themeType": "1", "sugRelatedIds": "{}", "appVersion": "" }
        };
        var qqJson = JSON.parse(postJson('https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2', qqBody, { 'origin': 'https://v.qq.com', 'referer': 'https://v.qq.com/' }));
        var itemList = [];
        if (qqJson.data && qqJson.data.normalList && qqJson.data.normalList.itemList) itemList = itemList.concat(qqJson.data.normalList.itemList);
        if (qqJson.data && qqJson.data.areaBoxList) {
            qqJson.data.areaBoxList.forEach(function (box) {
                if (box.itemList) itemList = itemList.concat(box.itemList);
            });
        }
        itemList.forEach(function (it) {
            if (it && it.videoInfo) {
                var cid = (it.doc && it.doc.id) || it.videoInfo.cid || it.videoInfo.coverId || '';
                if (!cid) return;
                cid = String(cid);
                var title = cleanTitle(it.videoInfo.title || '');
                if (!title || title.indexOf('<') > -1 || title.indexOf('>') > -1) return;
                if (!isMainContent(title)) return;
                var viewType = it.videoInfo.viewType;
                if (viewType !== 1 && viewType !== 25) return;
                var desc = it.videoInfo.secondLine || it.videoInfo.updateInfo || it.videoInfo.episodeUpdated || it.videoInfo.secondTitle || it.videoInfo.subTitle || '';
                all.push({ title: title, img: it.videoInfo.imgUrl || it.videoInfo.pic || '', url: 'qq__' + cid, desc: desc || '腾讯视频-4K' });
            }
        });
    } catch (e) { }

    // 爱奇艺搜索
    try {
        var iqJson = JSON.parse(getText('https://search.video.iqiyi.com/o?if=html5&key=' + encodeURIComponent(keyword) + '&pageNum=1&pos=1&pageSize=30&site=iqiyi'));
        var docinfos = iqJson.data ? iqJson.data.docinfos : [];
        var validCh = ['电影', '电视剧', '综艺', '动漫', '纪录片', '少儿', '短剧', '漫剧'];
        docinfos.forEach(function (doc) {
            var album = doc.albumDocInfo || {};
            var title = cleanTitle(album.albumTitle || '');
            var albumId = album.albumId || '';
            var pic = album.albumVImage || '';
            var channel = album.channel || '';
            if (!title || !albumId) return;
            if (!isMainContent(title)) return;
            var ok = false;
            for (var ci = 0; ci < validCh.length; ci++) { if (channel.indexOf(validCh[ci]) > -1) { ok = true; break; } }
            if (!ok) return;
            if (pic.indexOf('//') === 0) pic = 'https:' + pic;
            var remark = '';
            var latest = album.latestOrder || 0, total = album.videoCount || album.itemTotalNumber || 0;
            if (latest && total) remark = Number(latest) === Number(total) ? latest + '集全' : latest + '/' + total + '集';
            else if (latest) remark = '更新至 ' + latest + '集';
            else if (total) remark = '共' + total + '集';
            else remark = album.period || album.focus || album.albumSubtitle || album.subTitle || '';
            if (album.score) remark = album.score + '分\t' + remark;
            all.push({ title: title, img: pic, url: 'iqiyi__' + albumId, desc: remark || '爱奇艺-2K' });
        });
    } catch (e) { }

    // 匹配度排序 + 平台优先级 (不去重)
    var normKw = normTitle(keyword);
    function matchScore(title) {
        var t = normTitle(title);
        if (!t) return 0;
        if (t === normKw) return 100;
        if (t.indexOf(normKw) === 0) return 80;
        if (t.indexOf(normKw) > -1) return 60;
        return 0;
    }
    var filtered = all.filter(function (item) {
        var t = cleanTitle(item.title);
        if (!t || t.length < 2) return false;
        if (t.indexOf('<') > -1 || t.indexOf('>') > -1) return false;
        var desc = item.desc || '';
        if (desc.indexOf('全网搜') > -1 || desc.indexOf('外站') > -1) return false;
        var pf = item.url.split('__')[0];
        if (pf === 'qq' || pf === 'mgtv') {
            if (/[《》]/.test(t)) return false;
        }
        item.title = t;
        return matchScore(t) > 0;
    });
    filtered.sort(function (a, b) {
        var sa = matchScore(a.title), sb = matchScore(b.title);
        if (sb !== sa) return sb - sa;
        var pa = PRIORITY[a.url.split('__')[0]] !== undefined ? PRIORITY[a.url.split('__')[0]] : 99;
        var pb = PRIORITY[b.url.split('__')[0]] !== undefined ? PRIORITY[b.url.split('__')[0]] : 99;
        return pa - pb;
    });

    return { list: filtered.map(toVod), page: 1, pagecount: 1, limit: 20, total: filtered.length };
}

// ================= 接口 =================
function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < CLASS_IDS.length; i++) {
        classes.push({ type_id: CLASS_IDS[i], type_name: CLASS_NAMES[i] });
    }
    return { 'class': classes, filters: FILTERS };
}

function homeVideoContent() {
    return categoryContent('movie', 1, false, null);
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
