// 好听轻音乐 (www.htqyy.com) - TVBox QuickJS, HTML+AJAX分页
var HOST = 'http://www.htqyy.com';
var IMG_HOST = 'http://i.htqyy.com';
var PLAY_PATH = 'http://s1.htqyy.com/play9/';
var AUDIO_CODE = '1';
var UA = 'Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';
var DEFAULT_PIC = 'https://pic.rmb.bdstatic.com/bjh/user/default.png';
var PAGE_SIZE = 20;

var GENRES = [
    ['1', '纯音乐'], ['2', '新世纪'], ['3', '钢琴曲'], ['4', '减压放松'],
    ['5', '中国音乐'], ['6', '天籁之音'], ['7', '影视原声'], ['8', '电子乐'],
    ['9', '背景音乐'], ['10', '手机铃声'], ['12', '胎教音乐'], ['13', '佛乐']
];

var FILTERS = {};
(function () {
    for (var i = 0; i < GENRES.length; i++) {
        FILTERS[GENRES[i][0]] = [{
            key: 'order', name: '排序', value: [
                { n: '播放最多', v: 'hot' },
                { n: '最新发布', v: 'new' },
                { n: '评分最高', v: 'rating' }
            ]
        }];
    }
})();

var _genreCounts = {};

function fetchHtml(url, referer, timeout) {
    try {
        var r = req(url, {
            headers: {
                'User-Agent': UA,
                'Referer': referer || (HOST + '/'),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            timeout: timeout || 15000
        });
        return (r && r.content) || '';
    } catch (e) {
        return '';
    }
}

// 解析 <li class="mItem"> 列表 (分类页+AJAX通用)
function parseMusicList(html) {
    var videos = [], seen = {};
    if (!html) return videos;
    var boxes = html.split('<li class="mItem">');
    for (var i = 1; i < boxes.length; i++) {
        var box = boxes[i];
        var m = /value="(\d+)"/.exec(box);
        if (!m) continue;
        var sid = m[1];
        if (seen[sid]) continue;
        seen[sid] = 1;

        var name = '';
        m = /<a href="\/play\/\d+"[^>]*title="([^"]*)"/.exec(box);
        if (m) name = m[1].replace(/^\s+|\s+$/g, '');
        if (!name) {
            m = /<a href="\/play\/\d+"[^>]*>([^<]+)<\/a>/.exec(box);
            if (m) name = m[1].replace(/^\s+|\s+$/g, '');
        }
        if (!name) continue;

        var artist = '';
        m = /<a href="\/artist\/\d+"[^>]*title="([^"]*)"/.exec(box);
        if (m) artist = m[1].replace(/^\s+|\s+$/g, '');

        var albumId = '';
        m = /<a href="\/album\/(\d+)"/.exec(box);
        if (m) albumId = m[1];

        var remarks = artist;
        m = /<span class="playCount">(\d+)人听过<\/span>/.exec(box);
        if (m) remarks = m[1] + '次播放';

        var pic = DEFAULT_PIC;
        if (albumId) pic = IMG_HOST + '/img8/ZJ/' + albumId + '.jpg';

        videos.push({
            vod_id: sid,
            vod_name: name.slice(0, 200),
            vod_pic: pic,
            vod_remarks: remarks.slice(0, 60)
        });
    }
    return videos;
}

// 解析搜索结果 <ul class="list"><li> 列表
function parseSearchList(html) {
    var videos = [], seen = {};
    if (!html) return videos;
    var lis = html.split('<li>');
    for (var i = 1; i < lis.length; i++) {
        var li = lis[i];
        if (li.indexOf('data-id=') === -1 && li.indexOf('/m/play/') === -1) continue;

        var sid = '';
        var m = /data-id="(\d+)"/.exec(li);
        if (m) sid = m[1];
        else {
            m = /<a href="\/m\/play\/(\d+)"/.exec(li);
            if (m) sid = m[1];
        }
        if (!sid || seen[sid]) continue;
        seen[sid] = 1;

        var name = '';
        m = /<a href="\/m\/play\/\d+">([^<]+)<\/a>/.exec(li);
        if (m) name = m[1].replace(/^\s+|\s+$/g, '');

        var artist = '';
        m = /<em>([^<]*)<\/em>/.exec(li);
        if (m) artist = m[1].replace(/^\s+|\s+$/g, '');

        var pic = DEFAULT_PIC;
        m = /data-pic="([^"]+)"/.exec(li);
        if (m) pic = m[1].split('?')[0].replace(/^\s+|\s+$/g, '');
        else {
            m = /<img src="([^"]+)"/.exec(li);
            if (m) pic = m[1].split('?')[0].replace(/^\s+|\s+$/g, '');
        }
        if (!name) continue;

        videos.push({
            vod_id: sid,
            vod_name: name.slice(0, 200),
            vod_pic: pic.indexOf('http') === 0 ? pic : DEFAULT_PIC,
            vod_remarks: artist.slice(0, 60)
        });
    }
    return videos;
}

function getGenreCount(tid) {
    tid = String(tid);
    if (_genreCounts[tid]) return _genreCounts[tid];
    var html = fetchHtml(HOST + '/genre/' + tid);
    var m = /PageData\.totalCount\s*=\s*(\d+)/.exec(html);
    if (m) {
        _genreCounts[tid] = parseInt(m[1], 10);
        return _genreCounts[tid];
    }
    return 0;
}

// ================= 接口 =================
function homeContent(filter) {
    var classes = [];
    for (var i = 0; i < GENRES.length; i++) {
        classes.push({ type_id: GENRES[i][0], type_name: GENRES[i][1] });
    }
    // 首页推荐: 纯音乐热门第1页
    var videos = [];
    var html = fetchHtml(HOST + '/genre/musicList/1?pageIndex=0&pageSize=' + PAGE_SIZE + '&order=hot', HOST + '/genre/1');
    if (html) videos = parseMusicList(html);
    if (!videos.length) {
        html = fetchHtml(HOST + '/genre/1');
        videos = parseMusicList(html);
    }
    return { 'class': classes, filters: FILTERS, list: videos.slice(0, 20) };
}

function homeVideoContent() {
    return categoryContent('1', 1, false, null);
}

function categoryContent(tid, pg, filter, extend) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    try {
        var order = 'hot';
        if (extend) {
            if (typeof extend === 'string') {
                try { extend = extend ? JSON.parse(extend) : null; } catch (e) { extend = null; }
            }
            if (extend && typeof extend === 'object' && extend.order) order = String(extend.order);
        }

        var url = HOST + '/genre/musicList/' + tid + '?pageIndex=' + (page - 1) + '&pageSize=' + PAGE_SIZE + '&order=' + order;
        var html = fetchHtml(url, HOST + '/genre/' + tid);
        var videos = parseMusicList(html);

        var pagecount = 1;
        var total = getGenreCount(tid);
        if (total > 0) pagecount = Math.ceil(total / PAGE_SIZE);
        else if (videos.length >= PAGE_SIZE) pagecount = page + 1;
        if (pagecount < page) pagecount = page;

        return { list: videos, page: page, pagecount: pagecount, limit: PAGE_SIZE, total: total > 0 ? total : pagecount * PAGE_SIZE };
    } catch (e) {
        return { list: [], page: page, pagecount: 1, limit: PAGE_SIZE, total: 0 };
    }
}

function detailContent(ids) {
    var sid = String(ids).split(',')[0];
    var m = /(\d+)/.exec(sid);
    if (!m) return { list: [] };
    sid = m[1];

    var html = fetchHtml(HOST + '/m/play/' + sid, HOST + '/');
    if (!html) return { list: [] };

    var info = {
        vod_id: sid,
        vod_name: '',
        vod_pic: DEFAULT_PIC,
        vod_class: '',
        vod_year: '',
        vod_area: '',
        vod_actor: '',
        vod_director: '',
        vod_remarks: '',
        vod_content: ''
    };

    // 标题: <h1 class="mt ...">清晨 - 班得瑞</h1>
    m = /<h1 class="mt[^"]*"[^>]*>([^<]+)<\/h1>/.exec(html);
    if (m) {
        var title = m[1].replace(/^\s+|\s+$/g, '');
        if (title.indexOf(' - ') !== -1) {
            var parts = title.split(' - ');
            info.vod_actor = parts.pop().replace(/^\s+|\s+$/g, '');
            info.vod_name = parts.join(' - ').replace(/^\s+|\s+$/g, '');
        } else {
            info.vod_name = title;
        }
    }

    // 艺术家
    m = /艺术家：<\/span><a[^>]*>([^<]+)<\/a>/.exec(html);
    if (m) info.vod_actor = m[1].replace(/^\s+|\s+$/g, '');

    // 播放次数
    m = /播放次数：<\/span><span>([^<]+)<\/span>/.exec(html);
    if (m) info.vod_remarks = m[1].replace(/^\s+|\s+$/g, '') + '次播放';

    // 发布时间
    m = /发布时间：<\/span><span>([^<]+)<\/span>/.exec(html);
    if (m) {
        var dateStr = m[1].replace(/^\s+|\s+$/g, '');
        var ym = /(\d{4})/.exec(dateStr);
        if (ym) info.vod_year = ym[1];
        info.vod_remarks = dateStr;
    }

    // 所属专辑
    m = /所属专辑：<\/span><a[^>]*href="\/m\/album\/(\d+)"[^>]*title="([^"]*)"/.exec(html);
    if (m) {
        info.vod_class = m[2].replace(/^\s+|\s+$/g, '');
        info.vod_pic = IMG_HOST + '/img8/ZJ/' + m[1] + '.jpg';
    }

    // 封面: media2.pic 优先
    m = /media2\.pic\s*=\s*"([^"]+)"/.exec(html);
    if (m) {
        var pic = m[1].replace(/^\s+|\s+$/g, '').split('?')[0];
        if (pic.indexOf('http') === 0) info.vod_pic = pic;
    } else {
        m = /<img class="shadow"[^>]*src="([^"]+)"/.exec(html);
        if (m) {
            var pic2 = m[1].replace(/^\s+|\s+$/g, '');
            if (pic2.indexOf('http') === 0) info.vod_pic = pic2;
        }
    }

    // 简介
    m = /<div class="destWrap">([\s\S]*?)<\/div>/.exec(html);
    if (m) {
        info.vod_content = m[1].replace(/<[^>]+>/g, '').replace(/^\s+|\s+$/g, '').slice(0, 2000);
    }

    // 格式
    var fmt = 'mp3';
    m = /fmt:\s*"(\w+)"/.exec(html);
    if (m) fmt = m[1];

    var audioUrl = PLAY_PATH + sid + '/' + fmt + '/' + AUDIO_CODE;
    info.vod_play_from = '酷鱼专线';
    // 封面随播放地址传递 (&&拼接), 供play返回pic/cover
    info.vod_play_url = '播放$' + audioUrl + '&&' + info.vod_pic;
    info.vod_play_pic = info.vod_pic;
    info.vod_play_pic_ratio = 1.0;
    return { list: [info] };
}

function playerContent(flag, id, vipFlags) {
    var playPath = String(id || '');
    if (playPath.indexOf('$') !== -1) playPath = playPath.split('$').slice(1).join('$');

    // 拆出随地址携带的封面
    var pic = '';
    if (playPath.indexOf('&&') !== -1) {
        var parts = playPath.split('&&');
        playPath = parts[0];
        pic = parts[1] || '';
    }

    var referer = HOST + '/';
    var m = /\/play\d+\/(\d+)\//.exec(playPath);
    if (m) referer = HOST + '/m/play/' + m[1];

    return {
        parse: 0,
        url: playPath,
        music_player: 1,
        pic: pic,
        cover: pic,
        height: 720,
        header: { 'User-Agent': UA, 'Referer': referer }
    };
}

function searchContent(key, quick, pg) {
    var page = parseInt(pg, 10) > 0 ? parseInt(pg, 10) : 1;
    try {
        var url = HOST + '/m/searchResult?id=' + encodeURIComponent(String(key || ''));
        var html = fetchHtml(url, HOST + '/m/search');
        var videos = parseSearchList(html);
        return { list: videos, page: page, pagecount: 1, limit: videos.length, total: videos.length };
    } catch (e) {
        return { list: [], page: page, pagecount: 1, limit: 0, total: 0 };
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
