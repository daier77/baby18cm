/**
 * 多订阅流量合并精简版
 * 格式：♾️ MM.DD HH:mm | Y**m L**m P**m | 12⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  let args = $arguments || {}
  
  // 初始化各分类流量统计
  const stats = {
    ykk: { total: 0, used: 0 },
    lx: { total: 0, used: 0 },
    pq: { total: 0, used: 0 }
  }
  
  let lastUpdateTime = ''
  let resetDisplay = ''

  // 遍历当前上下文中的所有订阅来源
  const sources = Object.keys(context.source)
  for (const sourceName of sources) {
    const sub = context.source[sourceName]
    let subInfo = ''
    let rawSubInfo = ''

    try {
      // 获取订阅流量信息
      const flowInfo = await getFlowHeaders(sub.url, undefined, undefined, sub.proxy, sub.subUserinfo)
      if (flowInfo) {
        const headers = normalizeFlowHeader(flowInfo, true)
        subInfo = headers?.['subscription-userinfo']
        rawSubInfo = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
      }

      if (subInfo) {
        const { total, usage } = parseFlowHeaders(subInfo)
        const used = usage.upload + usage.download
        const ext = parseFields(rawSubInfo)
        
        // 提取时间信息
        if (!lastUpdateTime && ext.last_update) lastUpdateTime = ext.last_update
        if (!resetDisplay) resetDisplay = formatResetTime(ext)

        // 根据名称关键字归类累加
        const nameLower = sourceName.toLowerCase()
        if (nameLower.includes('ykk')) {
          stats.ykk.total += total; stats.ykk.used += used
        } else if (nameLower.includes('良心')) {
          stats.lx.total += total; stats.lx.used += used
        } else if (nameLower.includes('赔钱')) {
          stats.pq.total += total; stats.pq.used += used
        }
      }
    } catch (e) {
      $.error(`解析订阅 [${sourceName}] 失败: ${e.message}`)
    }
  }

  // 流量格式化辅助函数 (计算剩余)
  const formatRem = (s) => {
    const rem = s.total - s.used
    if (s.total === 0) return '0M'
    const t = flowTransfer(Math.abs(rem))
    // 强制截取单位首字母并转大写 (G/M)
    const unit = t.unit.charAt(0).toUpperCase()
    return `${t.value}${unit}`
  }

  const yStr = formatRem(stats.ykk)
  const lStr = formatRem(stats.lx)
  const pStr = formatRem(stats.pq)

  // 处理时间显示
  const timeStr = lastUpdateTime ? lastUpdateTime.slice(5, 16).replace(/-/g, '.') : '00.00 00:00'
  const finalName = `♾️ ${timeStr} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '00⏰'}`

  // 节点兼容性处理
  const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless'])
  const last = proxies[proxies.length - 1]
  const isNode = last && TYPES.has(last.type?.toLowerCase())
  const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

  // 插入置顶信息节点
  proxies.unshift({
    ...(isNode ? last : dummy),
    name: finalName
  })

  return proxies

  // --- 内部工具函数 ---
  function parseFields(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  function formatResetTime(ext) {
    if (ext.reset_day && parseInt(ext.reset_day) > 0) return `${ext.reset_day}d⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
