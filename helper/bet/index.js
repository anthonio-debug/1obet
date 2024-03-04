const axios = require("axios");
const checkActiveBettors = async (bet) => {
  const userId  =bet?.userId
  // const activeBettors = await axios.get('http://localhost:4000/active-bettors')
  return false
  // return global.ActiveBettors.has(userId)
}

module.exports = { checkActiveBettors }
