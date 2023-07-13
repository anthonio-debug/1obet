const   express              = require('express');
const  {validationResult }   = require('express-validator');
const  BettingFigure         = require('../models/BettingFigure');
const  Event                 = require('../models/eventsBySport');
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

async function livesportscore(req, res) {
    try {
        const id = req.params.id;
        console.log(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
        const response =  await   axios.get(`https://livesportscore.xyz:3440/api/bf_scores/${id}`);
        const data = response.data;
        if(typeof(data[0]) == "string"){
            const type = await Event.findOne({Id: id}, {_id: 0,match_type:1});
            const scoreInfo = JSON.parse(data)
            switch (type) {
                case 'T20':

                    break;
                case 'T10':

                    break;
                case 'OD':

                    break;
                case 'TEST':
                    break;
                default:
                    break;
            }
            const response = {
                balls: scoreInfo.balls
            }
            
            res.json({
                status: true,
                msg: "Records",
                data : eventName
            })
        }else{
            res.json({
                status: false,
                msg : "no information found",
                data : data[0]
            })
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
module.exports = { loginRouter };


  