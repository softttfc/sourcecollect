const DOMAIN_CFG = 'http://osstexll.oss-rg-china-mainland.aliyuncs.com/domainPath.json';
const UA = 'okhttp/4.12.0';
const PLAY_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
const DEVICE_ID = '2d590b9842d064a1';
const PREFIX = '【琉🔹璃❤广告勿信👉剧情】📢';

let host = '';
let userid = '';
let token = '';

function str(value) {
    return value === null || value === undefined ? '' : String(value);
}

function baseHeaders() {
    return {
        'User-Agent': UA,
        'Connection': 'Keep-Alive',
        'Content-Type': 'application/json;charset=UTF-8',
        'Cache-Control': 'no-cache',
        'token': token,
        'deviceId': DEVICE_ID,
        'client': 'app',
        'deviceType': 'Android'
    };
}

async function httpReq(url, method, data, headers) {
    try {
        const options = { method, headers: headers || baseHeaders(), timeout: 15000 };
        if (data !== null && data !== undefined) options.data = data;
        const r = await req(url, options);
        return r && r.content ? r.content : '';
    } catch (e) {
        return '';
    }
}

async function httpGet(path, headers) {
    const url = /^https?:\/\//.test(path) ? path : host + path;
    return httpReq(url, 'GET', null, headers);
}

async function httpPost(path, data) {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return httpReq(host + path, 'POST', body, baseHeaders());
}

function json(text) {
    return JSON.parse(text);
}

async function init(cfg) {
    host = '';
    userid = '';
    token = '';
    try {
        const headers = { 'User-Agent': UA, 'Connection': 'Keep-Alive' };
        const config = json(await httpGet(DOMAIN_CFG, headers));
        const status = Number(config.status || 0);
        if (status === 400 || status === 401 || status === 403) return;
        if (!Array.isArray(config.url) || !config.url.length) return;
        host = str(config.url[0]).replace(/\/+$/, '');
        const info = json(await httpGet('/api/v1/app/user/visitorInfo')).data;
        userid = str(info.id);
        token = str(info.token);
    } catch (e) {}
}

async function home(filter) {
    try {
        const data = json(await httpPost('/api/v1/app/screen/screenType', '')).data || [];
        const classes = data.map(item => ({ type_id: item.id, type_name: str(item.name) }));
        return JSON.stringify({ class: classes });
    } catch (e) {
        return JSON.stringify({ class: [] });
    }
}

async function homeVod() {
    try {
        const sections = json(await httpPost('/api/v1/app/recommend/recommendList', '')).data || [];
        const tasks = sections.map(section => httpPost('/api/v1/app/recommend/recommendSubList', {
            condition: str(section.id),
            pageNum: 1,
            pageSize: 6
        }));
        const responses = await Promise.all(tasks);
        const list = [];
        for (const text of responses) {
            try {
                const records = json(text).data.records || [];
                for (const item of records) {
                    list.push({ vod_id: item.id, vod_name: str(item.name), vod_pic: str(item.cover) });
                }
            } catch (e) {}
        }
        return JSON.stringify({ list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const body = {
            condition: {
                classify: '',
                region: '',
                sreecnTypeEnum: 'NEWEST',
                typeId: tid,
                year: ''
            },
            pageNum: str(pg),
            pageSize: 40
        };
        const records = json(await httpPost('/api/v1/app/screen/screenMovie', body)).data.records || [];
        const list = records.map(item => ({
            vod_id: item.id,
            vod_name: str(item.name),
            vod_pic: str(item.cover),
            vod_remarks: str(item.area),
            vod_year: str(item.year)
        }));
        return JSON.stringify({ list, page: str(pg) });
    } catch (e) {
        return JSON.stringify({ list: [], page: str(pg) });
    }
}

async function detail(id) {
    try {
        id = str(Array.isArray(id) ? id[0] : id);
        const data = json(await httpPost('/api/v1/app/play/movieDetails', {
            id,
            source: 0,
            typeId: 'M17',
            userId: userid
        })).data;
        const mainPlayerId = str(data.playerId);
        const playUrls = [];
        const playFrom = [];
        const episodes = data.episodeList;
        if (Array.isArray(episodes)) {
            playUrls.push(episodes.map(item => str(item.episode) + '$' + id + '@' + mainPlayerId + '@' + str(item.id) + '@episode').join('#'));
        }
        const players = data.moviePlayerList;
        if (Array.isArray(players)) {
            for (const player of players) {
                const playerId = str(player.id);
                if (playerId === mainPlayerId) continue;
                if (player.episodeTotal === null || player.episodeTotal === undefined) continue;
                const total = Number(player.episodeTotal) || 0;
                if (total <= 0) continue;
                const items = [];
                for (let i = 1; i <= total; i++) {
                    items.push('第' + i + '集$' + i + '@' + playerId + '@' + id + '@virtual');
                }
                playUrls.push(items.join('#'));
                const name = str(player.moviePlayerName);
                if (!playFrom.includes(name)) playFrom.push(name);
            }
            for (const player of players) {
                if (str(player.id) === mainPlayerId) {
                    const name = str(player.moviePlayerName);
                    const index = playFrom.indexOf(name);
                    if (index >= 0) playFrom.splice(index, 1);
                    playFrom.unshift(name);
                    break;
                }
            }
        }
        const desc = json(await httpPost('/api/v1/app/play/movieDesc', { id, typeId: 'M17' })).data;
        return JSON.stringify({
            list: [{
                vod_id: desc.id,
                vod_name: str(desc.name),
                vod_pic: str(desc.cover),
                vod_content: PREFIX + str(desc.introduce),
                vod_year: str(desc.year),
                vod_area: str(desc.area),
                vod_remarks: '',
                vod_score: desc.score,
                type_name: str(desc.classify),
                vod_director: str(desc.director),
                vod_play_from: playFrom.join('$$$'),
                vod_play_url: playUrls.join('$$$')
            }]
        });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

function encodePlayerUrl(url) {
    return encodeURIComponent(url).replace(/[!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

async function play(flag, id, flags) {
    try {
        const parts = String(id).split('@');
        if (parts.length < 4) return '';
        const body = {
            playerId: parts[1],
            source: 0,
            typeId: 'M16',
            userId: userid
        };
        if (parts[3] === 'virtual') {
            body.episodeIndex = str(parseInt(parts[0], 10) - 1);
            body.id = parseInt(parts[2], 10);
        } else {
            body.episodeId = parts[2];
            body.id = parts[0];
        }
        const data = json(await httpPost('/api/v1/app/play/movieDetails', body)).data;
        const playerUrl = str(data.url);
        const playerId = str(data.playerId);
        const analysis = json(await httpGet('/api/v1/app/play/analysisMovieUrl?playerUrl=' + encodePlayerUrl(playerUrl) + '&playerId=' + playerId));
        return JSON.stringify({
            jx: '0',
            parse: '0',
            url: str(analysis.data),
            header: { 'User-Agent': PLAY_UA }
        });
    } catch (e) {
        return '';
    }
}

async function search(wd, quick, pg = 1) {
    try {
        const body = { condition: { value: wd }, pageNum: str(pg), pageSize: 40 };
        const records = json(await httpPost('/api/v1/app/search/searchMovie', body)).data.records || [];
        const list = records.map(item => ({
            vod_id: item.id,
            vod_name: str(item.name),
            vod_pic: str(item.cover),
            vod_remarks: str(item.area),
            vod_year: str(item.year),
            vod_area: str(item.area),
            vod_content: str(item.desc)
        }));
        return JSON.stringify({ list, page: str(pg) });
    } catch (e) {
        return JSON.stringify({ list: [], page: str(pg) });
    }
}

export default { init, home, homeVod, category, detail, play, search };
