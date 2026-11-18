# -*- coding: utf-8 -*-
#   在源 ext 填 {"parse":1,"jx":0} 改走壳嗅探/官方解析；填 {"parse":0,"jx":1} 恢复默认。

import json
import base64
import gzip
import ssl
import urllib.parse
import urllib.request

try:
    from base.spider import Spider as _BaseSpider
except Exception:
    class _BaseSpider:
        pass

_CTX = ssl._create_unverified_context()
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
_HEADERS = {'User-Agent': UA, 'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9'}

_HOST = 'https://www.youku.com'
_CAT_API = 'https://www.youku.com/category/data'
_SEARCH_API = 'https://search.youku.com/api/search'
_EPISODE_API = 'https://search.youku.com/api/search?appScene=show_episode&showIds='

CHANNELS = ['电视剧', '电影', '综艺', '动漫', '少儿', '纪录片', '文化',
            '亲子', '教育', '搞笑', '生活', '体育', '音乐', '游戏']

_META = {}
_SESS = {}
_PLAY = {'parse': 0, 'jx': 1}


def _fetch(url, ref=None, timeout=6):
    try:
        h = dict(_HEADERS)
        if ref:
            h['Referer'] = ref
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
            raw = r.read()
            if r.headers.get('Content-Encoding') == 'gzip':
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            return raw.decode('utf-8', 'replace')
    except Exception:
        return ''


def _https(u):
    u = (u or '').strip()
    if u.startswith('//'):
        return 'https:' + u
    if u.startswith('http://'):
        return 'https://' + u[7:]
    return u


def _vid_of(u):
    try:
        return base64.urlsafe_b64encode(u.encode('utf-8')).decode('ascii').rstrip('=')
    except Exception:
        return u


def _url_of(v):
    s = str(v or '').strip()
    if s.startswith('http'):
        return s
    try:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)).decode('utf-8')
    except Exception:
        return ''


def _q(s):
    return urllib.parse.quote(s, safe='')


def _cat_url(typ, pg, sess=''):
    params = _q(json.dumps({'type': typ, 'filter': {}},
                           ensure_ascii=False, separators=(',', ':')))
    if pg > 1 and sess:
        return '%s?session=%s&pageNo=%s&params=%s' % (_CAT_API, _q(sess), pg, params)
    return '%s?optionRefresh=1&pageNo=%s&params=%s' % (_CAT_API, pg, params)


def _category_list(typ, pg):
    sess = _SESS.get(typ, '')
    if pg > 1 and not sess:
        _category_list(typ, 1)
        sess = _SESS.get(typ, '')
    txt = _fetch(_cat_url(typ, pg, sess), _HOST + '/')
    out = []
    if not txt or txt.lstrip()[:1] != '{':
        return out, sess
    try:
        j = json.loads(txt)
        fd = ((j.get('data') or {}).get('filterData') or {})
        s = fd.get('session')
        if s:
            sess = json.dumps(s, ensure_ascii=False, separators=(',', ':'))
            _SESS[typ] = sess
        for it in (fd.get('listData') or []):
            vl = str(it.get('videoLink') or '')
            if 'id_' not in vl:
                continue
            sid = vl.split('id_', 1)[1].split('.html', 1)[0]
            if not sid:
                continue
            name = str(it.get('title') or '').strip()
            if not name:
                continue
            pic = _https(it.get('img') or '')
            desc = str(it.get('summary') or it.get('subTitle') or '').strip()
            remark = str(it.get('rightTagText') or it.get('subTitle') or '').strip()
            _META[sid] = {'vod_name': name, 'vod_pic': pic,
                          'vod_content': desc, 'vod_remarks': remark}
            out.append({'vod_id': sid, 'vod_name': name,
                        'vod_pic': pic, 'vod_remarks': remark})
    except Exception:
        pass
    return out, sess


def _search_list(kw, pg):
    txt = _fetch('%s?pg=%s&keyword=%s' % (_SEARCH_API, pg, _q(kw)), _HOST + '/')
    out = []
    if not txt or txt.lstrip()[:1] != '{':
        return out
    try:
        j = json.loads(txt)
        for comp in (j.get('pageComponentList') or []):
            cd = comp.get('commonData') or {}
            if not cd:
                continue
            sid = str(cd.get('showId') or cd.get('realShowId') or '')
            if not sid:
                continue
            name = str((cd.get('titleDTO') or {}).get('displayName')
                       or cd.get('title') or '').strip()
            if not name:
                continue
            pic = _https((cd.get('posterDTO') or {}).get('vThumbUrl')
                         or cd.get('sourceImg') or '')
            desc = str(cd.get('stripeBottom') or '').strip()
            content = '%s %s' % (cd.get('updateNotice') or '', cd.get('feature') or '')
            _META[sid] = {'vod_name': name, 'vod_pic': pic,
                          'vod_content': content.strip(), 'vod_remarks': desc}
            out.append({'vod_id': sid, 'vod_name': name,
                        'vod_pic': pic, 'vod_remarks': desc})
        if not out and j.get('showId'):
            sid = str(j.get('showId'))
            _META[sid] = {'vod_name': kw, 'vod_pic': '',
                          'vod_content': str(j.get('sourceName') or '优酷'),
                          'vod_remarks': ''}
            out.append({'vod_id': sid, 'vod_name': kw,
                        'vod_pic': '', 'vod_remarks': str(j.get('sourceName') or '优酷')})
    except Exception:
        pass
    return out


class Spider(_BaseSpider):

    def getName(self):
        return '优酷视频'

    def init(self, extend=""):
        try:
            ext = (extend or '').strip()
            if ext.startswith('{'):
                c = json.loads(ext)
                if 'parse' in c:
                    _PLAY['parse'] = 1 if str(c.get('parse')) == '1' else 0
                if 'jx' in c:
                    _PLAY['jx'] = 1 if str(c.get('jx')) == '1' else 0
        except Exception:
            pass
        return None

    def _classes(self):
        return [{'type_id': n, 'type_name': n} for n in CHANNELS]

    def homeContent(self, filter=False):
        try:
            lst, _ = _category_list('电视剧', 1)
            return {'class': self._classes(), 'list': lst}
        except Exception:
            return {'class': self._classes(), 'list': []}

    def homeVideoContent(self):
        return self.homeContent()

    def categoryContent(self, tid='电视剧', pg='1', filter=False, extend=None):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        typ = str(tid or '电视剧')
        if typ not in CHANNELS:
            typ = '电视剧'
        lst, _ = _category_list(typ, p)
        return {'list': lst, 'page': p, 'pagecount': 99999,
                'limit': 20, 'total': 999999}

    def detailContent(self, ids):
        sid = str(ids[0]) if isinstance(ids, (list, tuple)) and ids else str(ids)
        if not sid:
            return {'list': []}
        txt = _fetch(_EPISODE_API + _q(sid), _HOST + '/')
        eps = []
        source = ''
        if txt and txt.lstrip()[:1] == '{':
            try:
                j = json.loads(txt)
                source = str(j.get('sourceName') or '')
                for it in (j.get('serisesList') or []):
                    page = ''
                    if '优酷' in source or str(j.get('isYouku') or '') == '1':
                        v = str(it.get('videoId') or '')
                        if v:
                            page = 'https://v.youku.com/v_show/id_%s.html' % v
                    if not page:
                        page = str(it.get('url') or '')
                    if not page.startswith('http'):
                        continue
                    stage = str(it.get('showVideoStage') or '').replace('期', '集')
                    dn = str(it.get('displayName') or '')
                    if not stage and dn.isdigit():
                        stage = '第%s集' % dn
                    title = (stage or dn or str(it.get('title') or '') or '正片').strip()
                    eps.append((title, page))
            except Exception:
                pass
        if not eps:
            eps = [('正片', 'https://v.youku.com/v_show/id_%s.html' % sid)]
        m = _META.get(sid, {})
        name = m.get('vod_name') or (eps[0][0] if eps else '优酷')
        play_from = '优酷' if (not source or '优酷' in source) else source
        return {'list': [{
            'vod_id': sid,
            'vod_name': name,
            'vod_pic': m.get('vod_pic') or '',
            'vod_content': m.get('vod_content') or '优酷官网播放页，由壳解析播放',
            'vod_remarks': m.get('vod_remarks') or source,
            'type_name': source,
            'vod_play_from': play_from,
            'vod_play_url': '#'.join('%s$%s' % (t, _vid_of(u)) for t, u in eps),
        }]}

    def searchContent(self, key='', quick=False, pg='1'):
        try:
            p = int(pg or 1)
        except Exception:
            p = 1
        kw = str(key or '').strip()
        out = _search_list(kw, p) if kw else []
        return {'list': out, 'page': p, 'pagecount': 99999,
                'limit': len(out), 'total': 999999}

    def playerContent(self, flag='', id='', vipFlags=None):
        try:
            page = _url_of(id)
            if not page.startswith('http'):
                return {'parse': 0, 'url': '', 'jx': 0}
            return {'parse': _PLAY['parse'], 'jx': _PLAY['jx'], 'url': page,
                    'header': {'User-Agent': UA, 'Referer': 'https://v.youku.com/'}}
        except Exception:
            return {'parse': 0, 'url': '', 'jx': 0}

    def manualVideoCheck(self):
        return None

    def isVideoFormat(self, url):
        return False

    def destroy(self):
        return None

    def close(self):
        return None

    def getDependence(self):
        return []

    def proxy(self, param):
        return None

    def localProxy(self, param):
        return None