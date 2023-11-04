const express = require("express");
let config = require("config");
const axios = require("axios");
const loginRouter = express.Router();
const router = express.Router();

async function liveTv(req, res) {
  const eventId = req.params.eventId;
  const url = `${config.liveTvUrl}/get_live_tv_url/${eventId}`;
  // console.log('url', url);
  try {
    const response = await axios.get(url);
    // console.log('response', response.data);
    const fancyData = response.data;

    res.status(200).json({
      success: true,
      message: "Live Tv Streaming",
      fancyData: fancyData,
    });
  } catch (error) {
    console.error(error);
    res.status(200).json({
      success: false,
      message: "Failed to get live tv streaming",
      error: error.message,
    });
  }
}

async function liveDrateTp20(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/teen20`;
  try {
    const response = await axios.get(url);
    const liveTp20Data = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen20 dRate",
      liveTp20Data: liveTp20Data,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen20 dRate",
      error: err.message,
    });
  }
}

async function liveLresultTp20(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/teen20`;
  try {
    const response = await axios.get(url);
    const liveTp20lResultData = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen20 lResult",
      liveTp20lResultData: liveTp20lResultData,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen20 lResult",
      error: err.message,
    });
  }
}

async function liveRresultTp20(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/teen20/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveTp20lResultData = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen20 rResult",
      liveTp20lResultData: liveTp20lResultData,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen20 rResult",
      error: err.message,
    });
  }
}

async function liveDrateTp9(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/teen9`;
  try {
    const response = await axios.get(url);
    const liveTp9dRateData = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen9 dRate",
      liveTp9dRateData: liveTp9dRateData,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen9 dRate",
      error: err.message,
    });
  }
}

async function liveLresultTp9(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/teen9`;
  try {
    const response = await axios.get(url);
    const liveTp9lResultData = response.data;
    res.status(200).json({
      success: true,
      message: "Live Tv Streaming for teen9 lResult",
      liveTp9lResultData: liveTp9lResultData,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get live Tv Streaming for teen9 lResult",
      error: err.message,
    });
  }
}

async function tpRoundResult(req, res) {
  const url = `${config.roundResultUrl}/?r=tp2020`;
  try {
    const response = await axios.get(url);
    const tp2020RoundResult = response.data;
    res.status(200).json({
      success: true,
      message: "Round Result in TP2020",
      tp2020RoundResult: tp2020RoundResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get tp2020 Round Result",
      error: err.message,
    });
  }
}

async function liveDrateLucky7(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/lucky7`;
  try {
    const response = await axios.get(url);
    const liveDrateLucky7Result = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-A Live Tv drate",
      liveDrateLucky7Result: liveDrateLucky7Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-A Live Tv drate",
      error: err.message,
    });
  }
}

async function liveLresultLucky7(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/lucky7`;
  try {
    const response = await axios.get(url);
    const liveLresultLucky7Result = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-A Live Tv l Result",
      liveLresultLucky7Result: liveLresultLucky7Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-A Live Tv l Result",
      error: err.message,
    });
  }
}

async function liveRresultLucky7(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/lucky7/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultLucky7Result = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-A Live Tv R Result",
      liveRresultLucky7Result: liveRresultLucky7Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-A Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrateLucky7EU(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/lucky7eu`;
  try {
    const response = await axios.get(url);
    const liveDrateLucky7EUResult = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-EU Live Tv drate",
      liveDrateLucky7EUResult: liveDrateLucky7EUResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-EU Live Tv drate",
      error: err.message,
    });
  }
}

async function liveLresultLucky7EU(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/lucky7eu`;
  try {
    const response = await axios.get(url);
    const liveLresultLucky7EUResult = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-EU Live Tv l Result",
      liveLresultLucky7EUResult: liveLresultLucky7EUResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-EU Live Tv l Result",
      error: err.message,
    });
  }
}

async function liveRresultLucky7EU(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/lucky7eu/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultLucky7EUResult = response.data;
    res.status(200).json({
      success: true,
      message: "Lucky 7-EU Live Tv R Result",
      liveRresultLucky7EUResult: liveRresultLucky7EUResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Lucky 7-EU Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrate32CardA(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/card32`;
  try {
    const response = await axios.get(url);
    const liveDrate32CardAResult = response.data;
    res.status(200).json({
      success: true,
      message: "Card32-A Live Tv Drate Result",
      liveDrate32CardAResult: liveDrate32CardAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-A Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresult32CardA(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/card32`;
  try {
    const response = await axios.get(url);
    const liveLresult32CardAResult = response.data;
    res.status(200).json({
      success: true,
      message: "Card32-A Live Tv Lresult",
      liveLresult32CardAResult: liveLresult32CardAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-A Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresult32CardA(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/card32/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresult32CardAResult = response.data;

    res.status(200).json({
      success: true,
      message: "Card32-A Live Tv Rresult",
      liveRresult32CardAResult: liveRresult32CardAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-A Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrate32CardB(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/card32eu`;
  try {
    const response = await axios.get(url);
    const liveDrate32CardBResult = response.data;
    res.status(200).json({
      success: true,
      message: "Card32-B Live Tv Drate Result",
      liveDrate32CardBResult: liveDrate32CardBResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-B Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresult32CardB(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/card32eu`;
  try {
    const response = await axios.get(url);
    const liveLresult32CardBResult = response.data;
    res.status(200).json({
      success: true,
      message: "Card32-B Live Tv Lresult",
      liveLresult32CardBResult: liveLresult32CardBResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-B Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresult32CardB(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/card32eu/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresult32CardBResult = response.data;

    res.status(200).json({
      success: true,
      message: "Card32-B Live Tv Rresult",
      liveRresult32CardBResult: liveRresult32CardBResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Card32-B Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrateAAA(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/aaa`;
  try {
    const response = await axios.get(url);
    const liveDrateAAAResult = response.data;
    res.status(200).json({
      success: true,
      message: "AAA Live Tv Drate Result",
      liveDrateAAAResult: liveDrateAAAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AAA Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresultAAA(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/aaa`;
  try {
    const response = await axios.get(url);
    const liveLresultAAAResult = response.data;
    res.status(200).json({
      success: true,
      message: "AAA Live Tv Lresult",
      liveLresultAAAResult: liveLresultAAAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AAA Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresultAAA(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/aaa/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultAAAResult = response.data;

    res.status(200).json({
      success: true,
      message: "AAA Live Tv Rresult",
      liveRresultAAAResult: liveRresultAAAResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AAA Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrateAB20(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/ab20`;
  try {
    const response = await axios.get(url);
    const liveDrateAB20Result = response.data;
    res.status(200).json({
      success: true,
      message: "AB20 Live Tv Drate Result",
      liveDrateAB20Result: liveDrateAB20Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AB20 Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresultAB20(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/ab20`;
  try {
    const response = await axios.get(url);
    const liveLresultAB20Result = response.data;
    res.status(200).json({
      success: true,
      message: "AB20 Live Tv Lresult",
      liveLresultAB20Result: liveLresultAB20Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AB20 Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresultAB20(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/ab20/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultAB20Result = response.data;

    res.status(200).json({
      success: true,
      message: "AB20 Live Tv Rresult",
      liveRresultAB20Result: liveRresultAB20Result,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get AB20 Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrateABJ(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/abj`;
  try {
    const response = await axios.get(url);
    const liveDrateABJResult = response.data;
    res.status(200).json({
      success: true,
      message: "ABJ Live Tv Drate Result",
      liveDrateABJResult: liveDrateABJResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get ABJ Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresultABJ(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/abj`;
  try {
    const response = await axios.get(url);
    const liveLresultABJResult = response.data;
    res.status(200).json({
      success: true,
      message: "ABJ Live Tv Lresult",
      liveLresultABJResult: liveLresultABJResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get ABJ Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresultABJ(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/abj/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultABJResult = response.data;

    res.status(200).json({
      success: true,
      message: "ABJ Live Tv Rresult",
      liveRresultABJResult: liveRresultABJResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get ABJ Live Tv R Result",
      error: err.message,
    });
  }
}

async function liveDrateWorli(req, res) {
  const url = `${config.liveBetTvUrl}/d_rate/worli`;
  try {
    const response = await axios.get(url);
    const liveDrateWorliResult = response.data;
    res.status(200).json({
      success: true,
      message: "Worli Live Tv Drate Result",
      liveDrateWorliResult: liveDrateWorliResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Worli Live Tv Drate Result",
      error: err.message,
    });
  }
}

async function liveLresultWorli(req, res) {
  const url = `${config.liveBetTvUrl}/l_result/worli`;
  try {
    const response = await axios.get(url);
    const liveLresultWorliResult = response.data;
    res.status(200).json({
      success: true,
      message: "Worli Live Tv Lresult",
      liveLresultWorliResult: liveLresultWorliResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Worli Live Tv L Result",
      error: err.message,
    });
  }
}

async function liveRresultWorli(req, res) {
  const roundId = req.params.roundId;
  const url = `${config.liveBetTvUrl}/r_result/worli/${roundId}`;
  try {
    const response = await axios.get(url);
    const liveRresultWorliResult = response.data;

    res.status(200).json({
      success: true,
      message: "Worli Live Tv Rresult",
      liveRresultWorliResult: liveRresultWorliResult,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to get Worli Live Tv R Result",
      error: err.message,
    });
  }
}

// Define the route for the API
loginRouter.get("/liveTv/:eventId", liveTv);

//Teen Patti 2020(TP2020)
router.get("/liveTv/d_rate/teen20", liveDrateTp20);
router.get("/liveTv/l_result/teen20", liveLresultTp20);
router.get("/liveTv/r_result/teen20/:roundId", liveRresultTp20);

//TEST TEENPATTI(TEST TEENPATTI)
router.get("/liveTv/d_rate/teen9", liveDrateTp9);
router.get("/liveTv/l_result/teen9", liveLresultTp9);
router.get("/round/result/tp2020", tpRoundResult);

//LUCKY 7-A
router.get("/liveTv/d_rate/lucky7", liveDrateLucky7);
router.get("/liveTv/l_result/lucky7", liveLresultLucky7);
router.get("/liveTv/r_result/lucky7/:roundId", liveRresultLucky7);

//LUCKY 7-B
router.get("/liveTv/r_result/lucky7eu", liveDrateLucky7EU);
router.get("/liveTv/l_result/lucky7eu", liveLresultLucky7EU);
router.get("/liveTv/r_result/lucky7eu/:roundId", liveRresultLucky7EU);

//32 CARD-A(32 CARD-A)
router.get("/liveTv/d_rate/card32", liveDrate32CardA);
router.get("/liveTv/l_result/card32", liveLresult32CardA);
router.get("/liveTv/r_result/card32/:roundId", liveRresult32CardA);

//32 CARD-B
router.get("/liveTv/d_rate/card32eu", liveDrate32CardB);
router.get("/liveTv/l_result/card32eu", liveLresult32CardB);
router.get("/liveTv/r_result/card32eu/:roundId", liveRresult32CardB);

//AMAR AKBAR ANTHONY(AAA)
router.get("/liveTv/d_rate/aaa", liveDrateAAA);
router.get("/liveTv/l_result/aaa", liveLresultAAA);
router.get("/liveTv/r_result/aaa/:roundId", liveRresultAAA);

//ANDAR BAHAR
router.get("/liveTv/d_rate/ab20", liveDrateAB20);
router.get("/liveTv/l_result/ab20", liveLresultAB20);
router.get("/liveTv/r_result/ab20/:roundId", liveRresultAB20);

//ANDAR BAHAR 2
router.get("/liveTv/d_rate/abj", liveDrateABJ);
router.get("/liveTv/l_result/abj", liveLresultABJ);
router.get("/liveTv/r_result/abj/:roundId", liveRresultABJ);

//WORLI MATKA
router.get("/liveTv/d_rate/worli", liveDrateWorli);
router.get("/liveTv/l_result/worli", liveLresultWorli);
router.get("/liveTv/r_result/worli/:roundId", liveRresultWorli);

module.exports = { loginRouter, router };
