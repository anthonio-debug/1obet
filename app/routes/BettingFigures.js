const   express              = require('express');
const  {validationResult }   = require('express-validator');
const  BettingFigure         = require('../models/BettingFigure');
const  Event                 = require('../models/events');
const  {default: axios }     = require('axios');
const  loginRouter           = express.Router();

async function getBettingFigures(req, res) {
    try {
        BettingFigure.find({}, (error, figures)=>{
            res.status(200).json({
                success: true,
                message: 'All Figures Data List',
                data: figures,
            });
        })

    } catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}

async function UpdateBettingFigures(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).send({ errors: errors.errors });
    }
    try {
        req.body.figures.forEach((figure) => {
            console.log("figure: ", figure);
            BettingFigure.findByIdAndUpdate(
                figure._id,
                { $set: { amount: figure.amount } },
                (err, updatedFigure) => {
                    if (err) {
                        console.log("Error updating figure:", err);
                    } else {
                        console.log("Updated figure:", updatedFigure);
                    }
                }
            );
        });
        res.status(200).json({
            success: true,
            message: 'Saved Successfully'
        });


    }catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to save fancy data',
            error: error.message,
        });
    }
}

async function liveScore(id) {
    try {
      const apiResponse =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
      const data = apiResponse.data;
      const response = {};
      if(typeof(data[0]) == "string"){
        const type          = await Event.findOne({Id: id}, {_id: 0,matchType:1}).matchType;
        const scoreInfo     = JSON.parse(data).score
        let score           = scoreInfo.score1;
        let played          = scoreInfo.score2;
        if(scoreInfo.activenation1 == 1){
            response.team   =  scoreInfo.spnnation1
            response.crr    = scoreInfo.spnrunrate1.substring(scoreInfo.spnrunrate1.indexOf(' ') + 1).trim()

        }
        else if(scoreInfo.activenation2 == 1){
            response.team    = scoreInfo.spnnation2;
            response.crr     = scoreInfo.spnrunrate2.substring(scoreInfo.spnrunrate2.indexOf(' ') + 1).trim()
            score            = scoreInfo.score2;
            played           = scoreInfo.score1;
        }
          
        response.type   =  type
        response.balls  = scoreInfo.balls
  
        if(type == "TEST"){
            score = score.split('&');
            score = score[score.length - 1].trim()
            played = played.split('&');
            played = played[played.length - 1].trim();
        }
        played = played.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        played = played.filter(element => element != 0).length;
        if(played > 0){
            response.secondInnings  = 1;
            response.spnmessage =  scoreInfo.spnmessage
            const target = scoreInfo.score2 ? scoreInfo.score2 : scoreInfo.score1
            response.target  = (parseInt(target.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',')[0]) + 1).toString();
            if(scoreInfo.spnreqrate1 != null && scoreInfo.spnreqrate1 != "" ){
                response.rrr = scoreInfo.spnreqrate;
            }
            else if(scoreInfo.spnreqrate2 != null && scoreInfo.spnreqrate2 != ""){
                response.rrr = scoreInfo.spnreqrate2;
            }
        }
        [response.score, response.wickets, response.overs] = score.replaceAll(/[\s-]/g, ',').replaceAll(/[())]/g, '').split(',');
        return response
      }else{
        return data[0]
      }
    } catch (error) {
        console.error(error);
        return {
            success: false,
            message: 'Failed to get data',
            error: error.message,
        };
    }
}

async function livesportscore(req, res) {
    try {
        const score = await liveScore(req.params.id)
        res.status(200).json({
            success: true,
            message: 'Live Score ',
            score:  score
        });
    }
    catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}

async function placeFigureBets(req, res) {
    try {
        const score = await liveScore(req.body.id)
        let currentOver = score.overs;
        let totalSessions = 0;
        let currentSessionOver = 1
        let secondInnings = score.overs; 

        switch (type) {
            case 'T20':
                totalSessions = 8;
                currentSessionOver = currentOver%5;
                // secondInnings ? 
                break;
            case 'T10':
                totalSessions = 4;
                currentSessionOver = currentOver%5;
                break;
            case 'OD':
                totalSessions = 20;
                currentSessionOver = currentOver%5;
                break;
            case 'TEST':
                totalSessions = 18;
                currentSessionOver = currentOver % 10;
                break;
            default:
                break;
        }




        if(currentSessionOver > 3){
            res.status(200).json({
                success: false,
                message: 'betting not Allowed in 4th over',
            });
        }else if(currentSession == totalSessions){
            res.status(200).json({
                success: false,
                message: 'betting not Allowed in last Session',
            });
        }else {

        }
    } catch (error) {
        console.error(error);
        res.status(200).json({
            success: false,
            message: 'Failed to get data',
            error: error.message,
        });
    }
}


  

loginRouter.get('/getBettingFigures', getBettingFigures);
loginRouter.post('/UpdateBettingFigures', UpdateBettingFigures);
loginRouter.get('/livesportscore/:id', livesportscore);
loginRouter.post('/placeFigureBets', placeFigureBets);

module.exports = { loginRouter };


  