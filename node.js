/**
 * 合并订阅流量统计全量版
 * 格式：♾️ MM.DD HH:mm | Y** L** P** | 12⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  const sub = context.source[proxies?.[0]?._subName || proxies?.[0]?.subName]
  
  const stats = {
    ykk: { total: 0, used: 0 },
    lx: { total: 0, used: 0 },
    pq: { total: 0, used: 0 }
  }
  
  let lastUpdate = ''
  let resetDisplay = ''

  if (sub && sub.url) {
    // 拆分合并订阅中的所有子链接
    const urls = sub.url.split(/[\r\n]+/).map(u => u.trim()).filter(u => u.length > 0)
    
    for (const fullUrl of urls) {
      try {
        const [baseUrl, rawTag] = fullUrl.split('#')
        // 请求子订阅流量头
        const flowInfo = await getFlowHeaders(baseUrl, undefined, undefined, sub.proxy)
        
        if (flowInfo) {
          const headers = normalizeFlowHeader(flowInfo, true)
          const info = headers?.['subscription-userinfo']
          
          if (info) {
            const { total, usage } = parseFlowHeaders(info)
            const used = usage.upload + usage.download
            const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
            const ext = parseFields(raw)

            // 根据 URL 后的 # 标签进行匹配
            const tag = rawTag ? decodeURIComponent(rawTag).toLowerCase() : ''
            if (tag.includes('ykk')) {
              stats.ykk.total += total; stats.ykk.used += used
            } else if (tag.includes('良心')) {
              stats.lx.total += total; stats.lx.used += used
            } else if (tag.includes('赔钱')) {
              stats.pq.total += total; stats.pq.used += used
            }

            // 提取更新时间和重置时间
            if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
            if (!resetDisplay) resetDisplay = formatReset(ext)
          }
        }
      } catch (e) {
        $.error(`子链接请求失败: ${fullUrl}`)
      }
    }
  }

  // 流量单位精简处理
  const getStr = (s) => {
    const rem = s.total - s.used
    if (s.total === 0) return '0M'
    const t = flowTransfer(Math.abs(rem))
    const unit = t.unit.charAt(0).toUpperCase()
    return `${t.value}${unit}`
  }

  const yStr = getStr(stats.ykk)
  const lStr = getStr(stats.lx)
  const pStr = getStr(stats.pq)

  // 处理时间格式
  const timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : '00.00 00:00'
  const finalName = `♾️ ${timeStr} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '12⏰'}`

  // 节点兼容逻辑
  const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless', 'hysteria2'])
  const lastNode = proxies.find(p => TYPES.has(p.type?.toLowerCase()))
  const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

  // 插入信息节点
  proxies.unshift({
    ...(lastNode || dummy),
    name: finalName
  })

  return proxies

  // 字段解析工具
  function parseFields(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  // 重置时间格式化
  function formatReset(ext) {
    if (ext.reset_day && parseInt(ext.reset_day) > 0) return `${ext.reset_day}d⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
