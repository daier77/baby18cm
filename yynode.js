/**
 * 逻辑重组版：通过节点特征反向抓取流量
 * 格式：♾️ MM.DD HH:mm | Y已用 L已用 P已用 | 重置⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  
  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''
  
  // 建立订阅源与分类的映射表，避免重复请求
  const subMap = new Map()

  // 1. 遍历节点，识别出所有参与合并的订阅源
  for (const p of proxies) {
    const sName = p._subName || p.subName
    const pName = (p.name || '').toLowerCase()
    
    let type = ''
    if (pName.includes('ykk')) type = 'ykk'
    else if (pName.includes('良心')) type = 'lx'
    else if (pName.includes('赔钱')) type = 'pq'
    
    if (type && sName && !subMap.has(sName)) {
      subMap.set(sName, type)
    }
  }

  // 2. 针对识别出的订阅源发起流量请求
  for (const [sName, type] of subMap.entries()) {
    const sub = context.source[sName]
    if (!sub || !sub.url) continue

    try {
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
    } catch (e) {}
  }

  // 3. 流量单位转换
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    return `${t.value}${t.unit.charAt(0).toUpperCase()}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  // 4. 强制清理时间字符串，防止转义干扰
  const now = new Date()
  let timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  // 核心：彻底过滤掉可能存在的 URL 编码字符
  timeStr = decodeURIComponent(timeStr).replace(/%20/g, ' ')

  const finalName = `♾️ ${timeStr} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '⏰'}`

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
