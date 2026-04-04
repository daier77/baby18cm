/**
 * 多订阅流量已用版（订阅名配对版）
 * 逻辑：直接遍历 context.source，匹配订阅名，显示已用流量
 * 格式：♾️ MM.DD HH:mm | Y已用 L已用 P已用 | 重置⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  
  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''

  // 1. 获取所有订阅源的 key
  const sourceKeys = Object.keys(context.source)
  
  for (const key of sourceKeys) {
    const sub = context.source[key]
    if (!sub || !sub.url) continue

    try {
      // 2. 识别分类 (根据你在订阅源列表里的名字)
      let type = ''
      const name = key.toLowerCase()
      if (name.includes('ykk')) type = 'ykk'
      else if (name.includes('良心')) type = 'lx'
      else if (name.includes('赔钱')) type = 'pq'
      
      if (!type) continue

      // 3. 抓取该订阅流量
      const flowInfo = await getFlowHeaders(sub.url, undefined, undefined, sub.proxy, sub.subUserinfo)
      if (flowInfo) {
        const headers = normalizeFlowHeader(flowInfo, true)
        const info = headers?.['subscription-userinfo']
        
        if (info) {
          const { usage } = parseFlowHeaders(info)
          stats[type] += (usage.upload + usage.download)
          
          const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
          const ext = parseFields(raw)
          if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
          if (!resetDisplay) resetDisplay = formatReset(ext)
        }
      }
    } catch (e) {
      $.error(`抓取 ${key} 失败`)
    }
  }

  // 4. 流量单位转换
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    return `${t.value}${t.unit.charAt(0).toUpperCase()}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  // 5. 格式化日期 (去除转义干扰)
  const now = new Date()
  const timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  const finalName = `♾️ ${timeStr.trim()} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '⏰'}`

  // 6. 插入伪节点
  const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless', 'hysteria2'])
  const lastNode = proxies.find(p => TYPES.has(p.type?.toLowerCase()))
  const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

  proxies.unshift({
    ...(lastNode || dummy),
    name: finalName
  })

  return proxies

  function parseFields(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  function formatReset(ext) {
    if (ext.reset_day && parseInt(ext.reset_day) > 0) return `${ext.reset_day}d⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
