const cron = require('node-cron');
const axios = require('axios');
const Bets = require('../app/models/bets');
const CricketMatch = require('../app/models/cricketMatches');
const User = require('../app/models/user');
let runningJob;

const cronJob = () => {
  runningJob = cron.schedule('*/5 * * * * *', async () => {
    try {
      const endedMatches = await getEndedMatches();
      console.log('endedMatches', endedMatches);

      for (const match of endedMatches) {
        const matchId = match.id;
        const sportsId = match.sportsId;
        const bets = await getAllBets({ sportsId: sportsId, matchId });
        console.log('bets', bets);

        for (const bet of bets) {
          console.log('in here');
          if (bet.team === match.winningTeam) {
            await Bets.findByIdAndUpdate(bet._id, { status: 'win' });
            console.log(`Bet ${bet._id} won!`);
            // handleWinningBet(bet);
          } else {
            await Bets.findByIdAndUpdate(bet._id, { status: 'lost' });
            console.log(`Bet ${bet._id} lost.`);
          }
        }
      }

      if (endedMatches.length >= 1) {
        console.log('Stopping cron job');
        runningJob.stop();
      }
    } catch (err) {
      console.error(err);
    }
  });
};

async function getAllBets(req, res) {
  try {
    const allBets = await Bets.find({});
    return allBets;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function getEndedMatches() {
  try {
    sportsId = '38d3bc03-8a59-4551-85cf-a35298f75124';
    id = '64458338-704e-4d0f-b4fa-6af920ab467d';
    const endedMatches = await CricketMatch.find({
      sportsId,
      id,
      matchEnded: true,
    });
    return endedMatches;
  } catch (err) {
    console.error(err);
    return [];
  }
}

function handleWinningBet(bet) {
  console.log(`Bet ${bet._id} won!`);
  const userId = bet.userId;
  const amountWon = bet.winngingAmount;
  User.findByIdAndUpdate(
    userId,
    { $inc: { balance: amountWon } },
    (err, user) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`User ${userId} won ${amountWon}!`);
      }
    }
  );
}

function handleLosingBet(bet) {
  console.log(`Bet ${bet._id} lost.`);
}

function handlePendingBet(bet) {
  console.log(`Bet ${bet._id} is pending.`);
}

module.exports = cronJob;
