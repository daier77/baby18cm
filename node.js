  function formatResetTime(extFields) {
    const nextUpdateStr = extFields['next_update']
    const resetHourStr = extFields['reset_hour']
    const resetDayStr = extFields['reset_day']

    if (nextUpdateStr) {
      const nextTime = new Date(nextUpdateStr.replace(' ', 'T'))
      if (!isNaN(nextTime.getTime())) {
        const remainingMs = nextTime.getTime() - Date.now()
        if (remainingMs <= 0) return '更新' // 极其简短
      }
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
            const remainingHours = Math.ceil((nextTime.getTime() - Date.now()) / 3_600_000)
            if (remainingHours > 0) {
              return remainingHours === 1 ? `1h⏰` : `${hour}⏰`
            }
          }
        }
        return `${hour}⏰`
      }
    }
    return ''
  }
