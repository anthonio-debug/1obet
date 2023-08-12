const axios = require('axios');


async function eventsBySupportJobs() {
  const url = `https://streamingtv.fun:3440/api/listEventsBySport/4`;
  try {
    const response = await axios.get(url);
    console.log("=========", response);

  } catch (error) {
    console.error(error);
    return({
      success: false,
      message: 'Failed to get or save events',
      error: error.message,
    });
  }
}

eventsBySupportJobs()