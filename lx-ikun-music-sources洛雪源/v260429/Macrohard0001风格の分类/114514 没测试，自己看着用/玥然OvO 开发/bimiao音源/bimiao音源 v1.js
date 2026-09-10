/*!
 * @name bimiao音源
 * @description 仅网易，全音质，具体自测
 * @version v1
 * @author 玥然OvO
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

const API_BASE = 'https://www.cunyuapi.top'

const QUALITY_MAP = {
    '128k': 'standard',
    '320k': 'standard',
    'flac': 'lossless',
    'hires': 'hires',
    'atmos': 'jyeffect',
    'atmos_plus': 'sky',
    'master': 'jymaster'
}

const QUALITY_NAMES = {
    '128k': '标准音质',
    '320k': '标准音质',
    'flac': '无损音质',
    'hires': 'Hi-Res',
    'atmos': '高清环绕声',
    'atmos_plus': '沉浸环绕声',
    'master': '超清母带'
}

const getAudioUrl = (musicInfo, quality = '128k') => {
    return new Promise((resolve, reject) => {
        const id = musicInfo.songmid || musicInfo.id || musicInfo.mid
        if (!id) return reject(new Error('缺少歌曲ID'))
        
        const apiUrl = `${API_BASE}/163music_play?id=${id}&quality=${QUALITY_MAP[quality] || 'standard'}`
        
        request(apiUrl, { method: 'GET', timeout: 10000 }, (err, resp) => {
            if (err) return reject(new Error('网络请求失败'))
            
            try {
                let data = resp.body
                if (typeof data === 'string') data = JSON.parse(data.trim())
                if (data.status !== 200 || !data.song_file_url) return reject(new Error('获取音频地址失败'))
                
                const fileType = quality.includes('flac') || quality === 'hires' || quality === 'master' ? 'flac' : 'mp3'
                
                resolve({
                    url: data.song_file_url,
                    type: fileType
                })
            } catch {
                reject(new Error('解析响应数据失败'))
            }
        })
    })
}

const searchMusic = (keyword, limit = 20) => {
    return new Promise((resolve) => {
        const searchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&limit=${limit}`
        
        request(searchUrl, {
            method: 'GET',
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://music.163.com'
            }
        }, (err, resp) => {
            if (err) return resolve([])
            
            try {
                let data = resp.body
                if (typeof data === 'string') data = JSON.parse(data.trim())
                if (data.code !== 200 || !data.result?.songs) return resolve([])
                
                const results = data.result.songs.map(song => ({
                    songmid: song.id.toString(),
                    name: song.name,
                    singer: song.artists?.map(a => a.name).join('/') || '未知',
                    albumName: song.album?.name || '',
                    source: 'wy',
                    interval: '03:00',
                    img: song.album?.picUrl || ''
                }))
                
                resolve(results)
            } catch {
                resolve([])
            }
        })
    })
}

on(EVENT_NAMES.request, ({ action, info }) => {
    switch (action) {
        case 'musicUrl':
            return getAudioUrl(info.musicInfo, info.type || '128k').then(res => res.url)
            
        case 'download':
            return getAudioUrl(info.musicInfo, info.type || '128k')
            
        case 'search':
            return searchMusic(info.keyword, info.limit || 20).then(results => ({
                list: results,
                total: results.length,
                page: info.page || 1,
                limit: info.limit || 20,
                source: 'wy',
                allPage: 1
            }))
            
        default:
            return Promise.reject(new Error('不支持的操作'))
    }
})

send(EVENT_NAMES.inited, {
    openDevTools: false,
    sources: {
        wy: {
            name: '网易云音乐',
            type: 'music',
            actions: ['musicUrl', 'search', 'download'],
            qualitys: ['128k', '320k', 'flac', 'hires', 'atmos', 'atmos_plus', 'master'],
            qualityName: QUALITY_NAMES
        }
    }
})