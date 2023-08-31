
const cron    = require("node-cron");
const Events  = require('../../app/models/events');
const axios   = require('axios');
const config  = require('config');
require('../../db');

const sessionCalc = () => {
    cron.schedule('*/5 * * * * *', async () => {
        try {
            // const eventsIds = await Events.distinct("Id", { sportsId: "4", inplay: true, status: { $in:['OPEN', 'open'  ] }, isShowed: true });
            // console.log('eventsIds ===== ', eventsIds);
            const  eventsIds = [32593292]

            for (let Id of eventsIds){
                const event = await Events.findOne({ Id: Id }, { _id: 0, matchType: 1, sportsId: 1 });
                const type  = event.matchType;
                console.log("event", event);
                const score           = await cricketLiveScore(Id);
                const currentScore    = Number(score.score)
                const sessionLength   = type == "TEST" ? 10 : 5;
                console.log(' only  score  ============= ', score );
                config.balls.includes(score.balls[0]) ? currentScore = currentScore - Number(score.balls[0]) : ''

                let currentOver = score.overs;
                let ball        = currentOver.split('.')[1]
                let inning      = score.inning;  
                console.log("ball   ===================== ", ball);
                console.log("inning ===================== ", inning);


                if((currentOver % sessionLength < 1  && ball == 1)  || (currentOver % sessionLength < 1 && ball == 1)){
                  console.log(" conditional ball  ===================== ", ball)
                  console.log(" conditional over ===================== ", score.overs % 5);
                  let sessionToResult      = Math.floor(currentOver/sessionLength);

                  console.log(" sessionToResult ======= ", sessionToResult);

                }
                else {
                    console.log(" ========= else Non conditional  ");
                } 

                let currentSessionOver  = Math.ceil(currentOver%5);
                
                console.log(" currentSession = ",currentSession, " currentSessionOver =",currentSessionOver, " currentOver =",currentOver );
                
                switch (eventDetail.matchType) {
                    case 'T10':
                    totalSessions       = 2;
                    break;
                    case 'T20':
                    totalSessions       = 4;
                    break;
                    case 'ODI':
                    totalSessions       = 10;
                    break;
                    case 'TEST':
                    totalSessions       = 9;
                    currentSessionOver  = Math.ceil(currentOver%10);
                    currentSession      = Math.ceil(currentOver/10);
                    break;
                    default:
                    return res.json(404, {
                        success : false,
                        message : `Match Type is not defined : ${eventDetail.matchType}`,
                    });
                    break;
                }
                
            }
        } catch (error) {
            console.error('Error running odds cron job:', error);
        }
    });
};

sessionCalc()

async function cricketLiveScore(id) {
  try {
      const apiResponse   =  await axios.get(`${config.sportsLiveScore}${id}`);
      const response = {};
      const data          = apiResponse.data;
      if(data[0]?.score != null ){
        const event         = await Events.findOne({ Id: id }, { _id: 0, matchType: 1, sportsId: 1 });
        const type          = event ? event?.matchType : null;
        // const scoreInfo     = JSON.parse(data).score
        const scoreInfo        = data[0].score

        let score           = 0;
        let inning          = 1;
        if(scoreInfo.activenation1 == 1){
          score  = scoreInfo.score1;
          played = scoreInfo.score2;
        }
        else if(scoreInfo.activenation2 == 1){
            score   = scoreInfo.score2;
            played  = scoreInfo.score1;
        }
        if(type == "TEST"){
          score = score.split('&');
          score = score[score.length - 1].trim()
          played = played.split('&');
          played = played[played.length - 1].trim();
        }

        played = played?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if(played > 0){
          inning  = 2;
        }

        [response.score, response.wickets, response.overs] = score?.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        response.inning = inning;
        response.balls  = scoreInfo.balls;
        return response
      }
  } 
  catch (error) {
      console.error(error);
      return {
          success: false,
          message: 'Failed to get data',
          error: error.message,
      };
  }
}




// 4.0 
// No Session Ends Yet 
// Nothing  to Do 



// 5.0 
// No Session Ends Yet 
// Nothing  to Do 

// 5.1

// GET DISTINCT MATCH IDS FROM BETS TABLE  WITH STATUS 1 & TYPE = [2, 3, 4 ]
//  1 ,2 ,4 
//  GET SESSION FROM DB 
//  FOR LOOP 
//  GET SCORE API 
// 5, 1  > CHECK  BET FOR  SESSION  75
// 5, 2




// Pak NIP 
// 5  end of First Session 
// 10 end of 2nd Session 
// 15 end of 3rd Session 











/**
 [

      {
        "score": {
              "activenation1": 1,
              "activenation2": "0",
              "balls": [
                    "w",
                    "0",
                    "ww",
                    "1",
                    "1",
                    "ww"
              ],
              "dayno": "",
              "isfinished": "0",
              "score1": "3-2 (0.5)",
              "score2": "0-0 (0.0)",
              "spnballrunningstatus": "",
              "spnmessage": "",
              "spnnation1": "HT",
              "spnnation2": "MW",
              "spnreqrate1": "",
              "spnreqrate2": "",
              "spnrunrate1": "CRR 3.60 ",
              "spnrunrate2": ""
        },
        "eventId": "1808290412"
      }

]
 * */ 

