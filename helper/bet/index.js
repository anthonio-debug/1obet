const checkActiveBettors = (bet) => {
  const userId  =bet?.userId
  return global.ActiveBettors.has(userId)
}

module.exports = { checkActiveBettors }
