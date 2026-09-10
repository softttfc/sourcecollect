/*!
 * @name 酷我音乐·车机版
 * @version 1.0.0
 * @author 竹佀
 * @description 基于酷我音乐车机版API
 */

const QUALITY_MAP = {
  "128k": "128kmp3",
  "320k": "320kmp3",
  "flac": "2000kflac",
  "flac24bit": "4000kflac"
};

const API_CONFIG = {
  baseUrl: "http://mobi.kuwo.cn/mobi.s",
  source: "kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk"
};

const { EVENT_NAMES, request, on, send } = globalThis.lx;

const httpRequest = (url, options) => {
  return new Promise((resolve, reject) => {
    request(url, options, (err, resp, body) => {
      if (err) return reject(err);
      resolve({ resp, body });
    });
  });
};

const getMusicUrl = async (musicInfo, quality) => {
  const rid = musicInfo.rid || musicInfo.hash || musicInfo.songId || musicInfo.id || musicInfo.songmid;
  if (!rid) throw new Error("缺少歌曲ID");
  
  const br = QUALITY_MAP[quality];
  const params = {
    f: "web", user: "0", source: API_CONFIG.source,
    type: "convert_url_with_sign", br: br, sig: "0", rid: rid
  };
  
  const queryString = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
  const { body } = await httpRequest(`${API_CONFIG.baseUrl}?${queryString}`, {
    method: "GET", timeout: 15000,
    headers: { "User-Agent": "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36" }
  });
  
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (data.code === 200 && data.data?.url) return data.data.url;
  throw new Error(data.msg || `获取失败 (code: ${data.code})`);
};

on(EVENT_NAMES.request, ({ action, info }) => {
  if (action === "musicUrl") return getMusicUrl(info.musicInfo, info.type);
  return Promise.reject("action not support");
});

send(EVENT_NAMES.inited, {
  status: true,
  sources: {
    kw: { name: "酷我音乐", type: "music", actions: ["musicUrl"], qualitys: ["128k", "320k", "flac", "flac24bit"] }
  }
});