const axios = require("axios");
const checkActiveBettors = async (bet) => {
  const userId  =bet?.userId
  const activeBettorsRes = await axios.get('http://localhost:4000/api/active-bettors')
  const activeBettors = new Map(Object.entries(activeBettorsRes?.data?.results));
  return activeBettors.has(`${userId}`)
  // return false
}

module.exports = { checkActiveBettors }
