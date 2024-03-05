const axios = require("axios");
const checkActiveBettors = async (bet) => {
  try {
  const userId  =bet?.userId
  // const url = `https://production.1obet.net/api/active-bettors`
  const url = `'http://127.0.0.1:4000/api/active-bettors'`

  const activeBettorsRes = await axios.get(url)
  const activeBettors = new Map(Object.entries(activeBettorsRes?.data?.results));
    console.log('checkActiveBettors: ', userId)
  return activeBettors.has(`${userId}`)
  } catch (error) {
    console.error('checkActiveBettors: ', userId, error?.data || error.message || error)
    return false
  }
}

module.exports = { checkActiveBettors }
