/**
 * @name 极速稳定音源
 * @description 超快响应，多平台高速获取播放链接
 * @version 1.1.0
 * @author assistant
 * @homepage https://lxmusic.toside.cn/mobile/custom-source
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const QUALITY_MAP = {
  wy: { '128k': 'standard', '320k': 'exhigh', 'flac': 'lossless', 'flac24bit': 'lossless' },
  tx: { '128k': '128k', '320k': '320k', 'flac': 'flac', 'flac24bit': 'flac' },
  kw: { '128k': '128k', '320k': '320k', 'flac': 'lossless', 'flac24bit': 'lossless' }
};

// 极速接口（延迟最低）
const FAST_API = {
  wy: (id) => `https://api.injahow.cn/meting/api/?server=wy&type=url&id=${id}`,
  tx: (id) => `https://api.injahow.cn/meting/api/?server=tx&type=url&id=${id}`,
  kw: (id) => `https://api.injahow.cn/meting/api/?server=kw&type=url&id=${id}`
};

const http = (url) => new Promise((resolve, reject) => {
  request(url, { method: 'GET', timeout: 5000 }, (err, _, body) => {
    if (err) return reject(err);
    resolve(body);
  });
});

const getMusicUrl = async (source, musicInfo) => {
  const id = (musicInfo.id || musicInfo.hash || musicInfo.songmid || '').trim();
  if (!id) throw new Error('无歌曲ID');

  const res = await http(FAST_API[source](id));
  const url = typeof res === 'string' ? res : res?.url || res?.data?.url;

  if (!url || url.includes('404') || url.includes('error')) throw new Error('链接无效');
  return url;
};

on(EVENT_NAMES.request, (params) => {
  const { source, action, info } = params;
  if (action === 'musicUrl') {
    return getMusicUrl(source, info.musicInfo).catch(e => Promise.reject(e.message));
  }
  return Promise.reject('不支持');
});

send(EVENT_NAMES.inited, {
  sources: {
    wy: { name: '🚀 网易云极速', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac'] },
    tx: { name: '🚀 QQ音乐极速', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac'] },
    kw: { name: '🚀 酷狗极速', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac'] }
  }
});
