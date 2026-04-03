/**
 * 精简版订阅信息脚本
 * 格式：♾️ MM.DD HH:mm | 流量 | 重置信息⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  let args = $arguments || {}
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, getRmainingDays, normalizeFlowHeader } = flowUtils
  const sub = context.source[proxies?.[0]?._subName || proxies?.[0]?.subName]
  let subInfo
  let flowInfo
  let rawSubInfo = ''

  if (sub.source !== 'local' || ['localFirst', 'remoteFirst'].includes(sub.mergeSources)) {
    try {
      let url = `${sub.url}`.split(/[\r\n]+/)[0] || ''
      let urlArgs = {}
      let rawArgs = url.split('#')
      url = rawArgs[0]
      if (rawArgs.length > 1) {
        try {
          urlArgs = JSON.parse(decodeURIComponent(rawArgs[1]))
        } catch (e) {
          for (const pair of rawArgs[1].split('&')) {
            const [key, value] = pair.split('=')
            urlArgs[key] = value == null || value === '' ? true : decodeURIComponent(value)
          }
        }
      }
      if (!urlArgs.noFlow && /^https?/.test(url)) {
        flowInfo = await getFlowHeaders(
          urlArgs?.insecure ? `${url}#insecure` : url,
          urlArgs.flowUserAgent,
          undefined,
          sub.proxy,
          urlArgs.flowUrl
        )
        if (flowInfo) {
          const headers = normalizeFlowHeader(flowInfo, true)
          if (headers?.['subscription-userinfo']) {
            subInfo = headers['subscription-userinfo']
          }
        }
      }
      args = { ...urlArgs, ...args }
    } catch (err) {
      $.error(`获取流量错误: ${err.message}`)
    }
  }

  if (sub.subUserinfo) {
    let subUserInfo
    if (/^https?:\/\//.test(sub.subUserinfo)) {
      try {
        subUserInfo = await getFlowHeaders(undefined, undefined, undefined, sub.proxy, sub.subUserinfo)
      } catch (e) {
        $.error(`自定义链接错误: ${e.message}`)
      }
    } else {
      subUserInfo = sub.subUserinfo
    }
    const parts = [subUserInfo, flowInfo].filter(i => i != null).map(i => (typeof i === 'string' ? i : JSON.stringify(i)))
    const headers = normalizeFlowHeader(parts.join(';'), true)
    if (headers?.['subscription-userinfo']) {
      subInfo = headers['subscription-userinfo']
      rawSubInfo = parts.join(';')
    }
  }

  function parseExtendedFields(raw = '') {
    const result = {}
    for (const segment of raw.split(/[;,]/)) {
      const eqIdx = segment.indexOf('=')
      if (eqIdx === -1) continue
      const key = segment.slice(0, eqIdx).trim()
      let value = segment.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
      try { value = decodeURIComponent(value) } catch (e) {}
      result[key] = value
    }
    return result
  }

  function formatResetTime(extFields) {
    const nextUpdateStr = extFields['next_update']
    const resetHourStr = extFields['reset_hour']
    const resetDayStr = extFields['reset_day']

    if (nextUpdateStr) {
      const nextTime = new Date(nextUpdateStr.replace(' ', 'T'))
      if (!isNaN(nextTime.getTime()) && nextTime.getTime() - Date.now() <= 0) return '更新'
    }

    if (resetDayStr != null && resetDayStr !== '') {
      const days = parseInt(resetDayStr, 10)
      if (!isNaN(days) && days > 0) return `${days}d⏰`
    }

    if (resetHourStr != null && resetHourStr !== '') {
      const hour = parseInt(resetHourStr, 10)
      if (!isNaN(hour)) {
        if (nextUpdateStr) {
          const nextTime = new Date(nextUpdateStr.replace(' ', 'T'))
          if (!isNaN(nextTime.getTime())) {
            const remHours = Math.ceil((nextTime.getTime() - Date.now()) / 3600000)
            if (remHours > 0) return remHours === 1 ? `1h⏰` : `${hour}⏰`
          }
        }
        return `${hour}⏰`
      }
    }
    return ''
  }

  if (subInfo) {
    let { expires, total, usage: { upload, download } } = parseFlowHeaders(subInfo)
    const extFields = parseExtendedFields(rawSubInfo)
    const lastUpdate = extFields['last_update']
    const date = expires ? new Date(expires * 1000).toLocaleDateString('sv') : ''
    let show = upload + download
    if (args.showRemaining) show = total - show
    const showT = flowTransfer(Math.abs(show))
    const totalT = flowTransfer(total)
    let name

    if (args.showLastUpdate && lastUpdate) {
      const shortTime = lastUpdate.slice(5, 16).replace('-', '.')
      name = `${shortTime} | ${showT.value} ${showT.unit}`
      const resetStr = formatResetTime(extFields)
      if (resetStr) name = `${name} | ${resetStr}`
    } else {
      let remainingDays
      try {
        remainingDays = getRmainingDays({ resetDay: args.resetDay, startDate: args.startDate, cycleDays: args.cycleDays })
      } catch (e) {}
      name = `${showT.value} ${showT.unit} / ${totalT.value} ${totalT.unit}`
      if (remainingDays) name = `${name} | ${remainingDays}d`
      if (date) name = `${name} | ${date}`
    }

    const COMPATIBLE_TYPES = new Set(['ss', 'trojan', 'vmess', 'vless'])
    const lastProxy = proxies[proxies.length - 1]
    const node = lastProxy && COMPATIBLE_TYPES.has(lastProxy.type?.toLowerCase())
    const dummyNode = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

    proxies.unshift({
      ...(node ? lastProxy : dummyNode),
      name: `♾️ ${name}`,
    })
  }

  return proxies
}
