// 飞快 TVBox QuickJS 爬虫（琉芸JS版）
// 站点：https://feikuai.tv（苹果CMS mxpro 模板，网盘 push:// 推送线路特色）
// 播放链：播放页 player_aaaa（encrypt 0/1/2）→ m3u8 直链 parse:0，失败回退 parse:1 内置嗅探；网盘线路 push:// 直推
const HOST = 'https://feikuai.tv';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

function fetchText(url, referer) {
  const headers = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };
  if (referer) headers['Referer'] = referer;
  for (let i = 0; i < 3; i++) {
    try {
      const r = req(url, { headers: headers, timeout: 20000 });
      if (r && r.content && r.content.length > 200) return r.content;
    } catch (e) {}
  }
  return '';
}

function abs(u) {
  if (!u) return '';
  if (u.indexOf('http') === 0) return u;
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.charAt(0) === '/') return HOST + u;
  return HOST + '/' + u;
}

// QuickJS 无 atob，内置 base64 解码（输出 Latin-1 字节串，供 decodeURIComponent 还原 UTF-8）
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64decode(s) {
  s = String(s).replace(/[^A-Za-z0-9+/]/g, '');
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const c1 = s.charAt(i), c2 = s.charAt(i + 1), c3 = s.charAt(i + 2), c4 = s.charAt(i + 3);
    if (!c1 || !c2) break;
    const e1 = B64.indexOf(c1), e2 = B64.indexOf(c2);
    const e3 = c3 ? B64.indexOf(c3) : 64;
    const e4 = c4 ? B64.indexOf(c4) : 64;
    const n = (e1 << 18) | (e2 << 12) | ((e3 & 63) << 6) | (e4 & 63);
    out += String.fromCharCode((n >> 16) & 255);
    if (e3 !== 64) out += String.fromCharCode((n >> 8) & 255);
    if (e4 !== 64) out += String.fromCharCode(n & 255);
  }
  return out;
}

// player_aaaa url 解密：encrypt 0 原样 / 1 unquote / 2 base64+unquote，附带 %uXXXX 处理
function decodeStr(raw, encrypt) {
  if (!raw) return '';
  let t = String(raw);
  try {
    const e = String(encrypt || '0');
    if (e === '1') {
      t = decodeURIComponent(t);
    } else if (e === '2') {
      try {
        t = decodeURIComponent(b64decode(t));
      } catch (e2) {
        t = decodeURIComponent(t);
      }
    }
    t = t.replace(/%u([0-9a-fA-F]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); });
  } catch (e3) { return String(raw); }
  return t;
}

// 分类页卡片：module-poster-item（实测 40 条/页）
function parseCards(html) {
  const list = [];
  const seen = {};
  const re = /<a href="\/voddetail\/(\d+)\.html" title="([^"]*)" class="module-poster-item module-item">[\s\S]*?<div class="module-item-note">([^<]*)<\/div>[\s\S]*?data-original="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (seen[m[1]]) continue;
    seen[m[1]] = 1;
    list.push({ vod_id: m[1], vod_name: m[2].trim(), vod_remarks: m[3].trim(), vod_pic: abs(m[4]) });
  }
  return list;
}

// 首页/搜索宽松卡片：任意 /voddetail/ a 标签，就近提取图与备注
function parseCardsLoose(html, limit) {
  const list = [];
  const seen = {};
  const re = /<a href="\/voddetail\/(\d+)\.html"([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (seen[id]) continue;
    const attrs = m[2];
    const inner = m[3];
    let name = '';
    const tm = attrs.match(/title="([^"]*)"/);
    if (tm) name = tm[1].trim();
    if (!name) {
      const sm = inner.match(/<strong>([^<]*)<\/strong>/) || inner.match(/module-poster-item-title">([^<]*)</) || inner.match(/module-card-item-title[^>]*>[\s\S]*?([^<]+)</);
      if (sm) name = sm[1].trim();
    }
    if (!name) continue;
    let pic = '';
    const pm = inner.match(/data-original="([^"]*)"/);
    if (pm) pic = pm[1];
    let remark = '';
    const rm = inner.match(/<div class="module-item-note">([^<]*)<\/div>/);
    if (rm) remark = rm[1].trim();
    seen[id] = 1;
    list.push({ vod_id: id, vod_name: name, vod_remarks: remark, vod_pic: abs(pic) });
    if (limit && list.length >= limit) break;
  }
  return list;
}

function pgNum(pg) {
  const v = parseInt(String(pg || '1'), 10);
  return (isNaN(v) || v < 1) ? 1 : v;
}

// /vodshow/{tid}-{area}--{cls}-----{pg}---{year}.html（pg=1 时为空）
function buildUrl(tid, pg, ext) {
  ext = ext || {};
  const area = ext.area || ext['1'] || '';
  const cls = ext['class'] || ext['3'] || '';
  const year = ext.year || ext['11'] || '';
  const p = pg > 1 ? String(pg) : '';
  return HOST + '/vodshow/' + tid + '-' + encodeURIComponent(area) + '--' + encodeURIComponent(cls) + '-----' + p + '---' + encodeURIComponent(year) + '.html';
}

const PAN_NAMES = { '百度网盘': '百度网盘', '夸克网盘': '夸克网盘', '迅雷云盘': '迅雷云盘', '阿里云盘': '阿里云盘', '天翼云盘': '天翼云盘', 'UC网盘': 'UC网盘', '115网盘': '115网盘', '移动云盘': '移动云盘' };

const spider = {
  init: function (ext) {},

  home: function (filter) {
    const classes = [
      { type_id: '1', type_name: '电影' },
      { type_id: '2', type_name: '剧集' },
      { type_id: '3', type_name: '综艺' },
      { type_id: '4', type_name: '动漫' },
    ];
    return JSON.stringify({ 'class': classes, filters: {} });
  },

  homeVod: function () {
    const html = fetchText(HOST + '/');
    if (!html) return JSON.stringify({ list: [] });
    let list = parseCards(html);
    if (!list.length) list = parseCardsLoose(html, 30);
    return JSON.stringify({ list: list.slice(0, 30) });
  },

  category: function (tid, pg, filter, extend) {
    const page = pgNum(pg);
    const url = buildUrl(tid, page, extend);
    const html = fetchText(url, HOST + '/vodtype/' + tid + '.html');
    const list = html ? parseCards(html) : [];
    let pagecount = 9999;
    if (html) {
      const lm = html.match(/<a href="\/vodshow\/\d+-+(\d+)-+\.html"[^>]*title="尾页"/);
      if (lm) pagecount = parseInt(lm[1], 10) || 9999;
    }
    return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: 90, total: 999999 });
  },

  detail: function (ids) {
    const vid = String(Array.isArray(ids) ? ids[0] : ids).trim();
    if (!vid) return JSON.stringify({ list: [] });
    const html = fetchText(HOST + '/voddetail/' + vid + '.html');
    if (!html) return JSON.stringify({ list: [] });

    let title = '';
    const tm = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (tm) title = tm[1].replace(/<[^>]+>/g, '').trim();

    let pic = '';
    const pm = html.match(/class="[^"]*lazyload[^"]*"[^>]*data-original="([^"]*)"/) || html.match(/data-original="([^"]*)"[^>]*class="[^"]*lazyload/) || html.match(/video-cover[\s\S]*?data-original="([^"]*)"/);
    if (pm) pic = abs(pm[1]);

    let desc = '';
    const dm = html.match(/module-info-introduction-content[^>]*>([\s\S]*?)<\/div>/);
    if (dm) desc = dm[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    desc = PREFIX + desc;

    // 附加信息（年份/地区/主演/导演/备注）：锚定 module-info-item-title span 精确配对
    function infoOf(label) {
      const im = html.match(new RegExp('module-info-item-title">' + label + '：?</span>\\s*<div class="module-info-item-content">([\\s\\S]*?)</div>'));
      if (!im) return '';
      return im[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const year = infoOf('年份') || (infoOf('上映').match(/\d{4}/) || [''])[0];
    const area = infoOf('地区');
    const actor = infoOf('主演');
    const director = infoOf('导演');
    const remarks = infoOf('更新') || infoOf('状态');

    const playFrom = [];
    const playList = [];

    // 普通线路：y-playList 区间 tab 名 ↔ his-tab-list panel 按 DOM 序配对
    const yi = html.indexOf('id="y-playList"');
    let di = html.indexOf('id="y-downList"');
    if (di < 0) di = html.length;
    if (yi > -1) {
      const zone = html.slice(yi, di);
      const names = [];
      const nRe = /data-dropdown-value="([^"]*)"/g;
      let nm;
      while ((nm = nRe.exec(zone)) !== null) names.push(nm[1].trim());
      // panel 块：module-list ... his-tab-list 起，到下一个 his-tab-list 或区间尾
      const pRe = /<div class="module-list sort-list tab-list his-tab-list"[\s\S]*?(?=<div class="module-list sort-list tab-list his-tab-list"|$)/g;
      const panels = zone.match(pRe) || [];
      for (let i = 0; i < panels.length; i++) {
        const eps = [];
        const eRe = /<a class="module-play-list-link" href="\/vodplay\/(\d+)-(\d+)-(\d+)\.html"[^>]*>[\s\S]*?<span>([^<]*)<\/span>/g;
        let em;
        while ((em = eRe.exec(panels[i])) !== null) {
          if (em[1] !== vid) continue;
          eps.push(em[4].trim() + '$' + em[1] + '-' + em[2] + '-' + em[3]);
        }
        if (eps.length) {
          playFrom.push(names[i] || ('线路' + (i + 1)));
          playList.push(eps.join('#'));
        }
      }
    }

    // 网盘线路：y-downList tab-item(data-index) → tab-content-{index} 内真实 pan 链接 → push://
    if (di > -1 && di < html.length) {
      const dzone = html.slice(di);
      const tRe = /<div class="module-tab-item[^"]*"[^>]*data-index="(\d+)"[^>]*>[\s\S]*?<span>([^<]*)<\/span>/g;
      let tm2;
      while ((tm2 = tRe.exec(dzone)) !== null) {
        const idx = tm2[1];
        const rawName = tm2[2].trim();
        if (!rawName || rawName === '磁力链接') continue;
        const lineName = PAN_NAMES[rawName] || rawName;
        const cm = dzone.match(new RegExp('id="tab-content-' + idx + '"([\\s\\S]*?)(?=id="tab-content-|$)'));
        if (!cm) continue;
        const eps = [];
        const lRe = /<div class="module-row-info">[\s\S]*?<a[^>]*href="([^"]*)"[\s\S]*?<h4>([^<]*)<\/h4>/g;
        let lm2;
        let n = 0;
        while ((lm2 = lRe.exec(cm[1])) !== null) {
          n++;
          let u = lm2[1].trim();
          if (!u || u.indexOf('javascript') === 0) continue;
          if (u.indexOf('//') === 0) u = 'https:' + u;
          else if (u.charAt(0) === '/') u = HOST + u;
          else if (u.indexOf('http') !== 0) continue;
          let epName = lm2[2].trim().replace(/@一键搜片-\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/, '').trim();
          if (!epName) epName = '资源' + n;
          eps.push(epName + '$push://' + u);
        }
        if (eps.length) {
          playFrom.push(lineName);
          playList.push(eps.join('#'));
        }
      }
    }

    if (!playFrom.length) {
      playFrom.push('飞快');
      playList.push('暂无播放源$' + HOST + '/voddetail/' + vid + '.html');
    }

    const vod = {
      vod_id: vid,
      vod_name: title,
      vod_pic: pic,
      vod_year: year,
      vod_area: area,
      vod_remarks: remarks,
      vod_actor: actor,
      vod_director: director,
      vod_content: desc,
      vod_play_from: playFrom.join('$$$'),
      vod_play_url: playList.join('$$$'),
    };
    return JSON.stringify({ list: [vod] });
  },

  play: function (flag, id, vipFlags) {
    const pid = String(id || '').trim();
    if (!pid) return JSON.stringify({ parse: 0, url: '' });
    // 网盘推送直返
    if (pid.indexOf('push://') === 0) {
      return JSON.stringify({ parse: 0, url: pid });
    }
    const playUrl = HOST + '/vodplay/' + pid + '.html';
    const header = { 'User-Agent': UA, 'Referer': HOST + '/' };
    const html = fetchText(playUrl);
    if (html) {
      const m = html.match(/player_aaaa=(\{[\s\S]*?\})<\/script>/);
      if (m) {
        let j = null;
        try { j = JSON.parse(m[1]); } catch (e) { j = null; }
        if (j && j.url) {
          let u = decodeStr(j.url, j.encrypt);
          if (u.indexOf('//') === 0) u = 'https:' + u;
          if (/\.m3u8|\.mp4|\.m4v|\.flv|\.webm|\.ts(\?|$)/i.test(u)) {
            return JSON.stringify({ parse: 0, url: u, header: header });
          }
        }
      }
    }
    // 失败回退：播放页交 TVBox 内置嗅探
    return JSON.stringify({ parse: 1, url: playUrl, header: header });
  },

  search: function (key, quick, pg) {
    const page = pgNum(pg);
    const kw = encodeURIComponent(key);
    let url, headers = {
      'User-Agent': UA,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': HOST + '/vodsearch/-------------.html?wd=' + kw,
    };
    if (page <= 1) {
      url = HOST + '/vodsearch/-------------.html?wd=' + kw;
    } else {
      url = HOST + '/label/search_ajax.html?wd=' + kw + '&by=time&order=desc&page=' + page;
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['Accept'] = '*/*';
    }
    let html = '';
    for (let i = 0; i < 3 && !html; i++) {
      try {
        const r = req(url, { headers: headers, timeout: 20000 });
        if (r && r.content && r.content.length > 100) html = r.content;
      } catch (e) {}
    }
    if (!html) return JSON.stringify({ list: [] });
    let list = parseCards(html);
    if (!list.length) list = parseCardsLoose(html, 0);
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 24, total: 999999 });
  },
};

export default spider;
