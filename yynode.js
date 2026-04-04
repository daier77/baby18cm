/**
 * 多订阅流量已用版（增强兼容）
 * 逻辑：直接遍历订阅源对象，规避 URL 转义问题
 * 格式：♾️ MM.DD HH:mm | Y已用 L已用 P已用 | ⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  
  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''

  // 1. 直接从 context.source 获取所有已识别的订阅源
  const sourceNames = Object.keys(context.source)
  
  for (const name of sourceNames) {
    const sub = context.source[name]
    if (!sub || !sub.url) continue

    try {
      // 请求流量头
      const flowInfo = await getFlowHeaders(sub.url, undefined, undefined, sub.proxy, sub.subUserinfo)
      
      if (flowInfo) {
        const headers = normalizeFlowHeader(flowInfo, true)
        const info = headers?.['subscription-userinfo']
        
        if (info) {
          const { usage } = parseFlowHeaders(info)
          const usedVal = usage.upload + usage.download
          const ext = parseFields(typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo))

          // 2. 匹配逻辑：检查订阅名或 URL 锚点
          const identify = (name + sub.url).toLowerCase()
          if (identify.includes('ykk')) stats.ykk += usedVal
          else if (identify.includes('良心')) stats.lx += usedVal
          else if (identify.includes('赔钱')) stats.pq += usedVal

          if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
          if (!resetDisplay) resetDisplay = formatReset(ext)
        }
      }
    } catch (e) {
      $.error(`订阅 ${name} 抓取失败`)
    }
  }

  // 3. 转换已用流量格式 (如 82.3G)
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    const unit = t.unit.charAt(0).toUpperCase()
    return `${t.value}${unit}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  // 4. 处理日期（移除转义符号）
  const now = new Date()
  const timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  // 5. 拼接最终名称
  const finalName = `♾️ ${timeStr.trim()} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '0⏰'}`

  // 6. 插入信息节点
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
