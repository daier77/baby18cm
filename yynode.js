/**
 * 合并订阅流量已用版
 * 格式：♾️ MM.DD HH:mm | Y已用 L已用 P已用 | 重置⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  const sub = context.source[proxies?.[0]?._subName || proxies?.[0]?.subName]
  
  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''

  if (sub && sub.url) {
    // 拆分合并订阅中的所有链接
    const urls = sub.url.split(/[\r\n]+/).map(u => u.trim()).filter(u => u.length > 0)
    
    for (const fullUrl of urls) {
      try {
        const [baseUrl, tag] = fullUrl.split('#')
        // 核心：逐一请求每个子订阅的 Headers
        const flowInfo = await getFlowHeaders(baseUrl, undefined, undefined, sub.proxy)
        
        if (flowInfo) {
          const headers = normalizeFlowHeader(flowInfo, true)
          const info = headers?.['subscription-userinfo']
          
          if (info) {
            const { usage } = parseFlowHeaders(info)
            const usedVal = usage.upload + usage.download
            const ext = parseFields(typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo))

            // 根据 URL 后的 # 标签归类已用流量
            const label = decodeURIComponent(tag || '').toLowerCase()
            if (label.includes('ykk')) stats.ykk += usedVal
            else if (label.includes('良心')) stats.lx += usedVal
            else if (label.includes('赔钱')) stats.pq += usedVal

            // 提取公共显示信息
            if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
            if (!resetDisplay) resetDisplay = formatReset(ext)
          }
        }
      } catch (e) {
        $.error(`抓取失败: ${fullUrl}`)
      }
    }
  }

  // 格式化已用流量 (显示为 82.3G 这种形式)
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    return `${t.value}${t.unit.charAt(0).toUpperCase()}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  // 处理时间
  const now = new Date()
  const timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  // 最终拼接
  const finalName = `♾️ ${timeStr} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '0⏰'}`

  const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless', 'hysteria2'])
  const lastNode = proxies.find(p => TYPES.has(p.type?.toLowerCase()))
  const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

  proxies.unshift({
    ...(lastNode || dummy),
    name: finalName
  })

  return proxies

  // 解析字段工具
  function parseFields(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  // 格式化重置时间
  function formatReset(ext) {
    if (ext.reset_day && parseInt(ext.reset_day) > 0) return `${ext.reset_day}d⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
