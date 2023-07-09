const   express         = require('express');
const { validationResult } = require('express-validator');
const   BettingFigure  = require('../models/BettingFigure');
const   loginRouter     = express.Router();

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
  
loginRouter.get('/getBettingFigures', getBettingFigures);
loginRouter.post('/UpdateBettingFigures', UpdateBettingFigures);
  module.exports = { loginRouter };


  