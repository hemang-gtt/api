const { postReq } = require('../api');

const Win = require('../models/winModel');
const Player = require('../models/playerModel');
const { redisClient: redis, redisDb } = require('../DB/redis');
const { logErrorMessage } = require('../logs');

const winRequest = async (transactionId, player, amount, gameId, winObj, key, gameCount) => {
  let win = {
    type: 'REAL',
    playerId: player.playerId,
    productId: player.productId,
    txId: transactionId,
    roundId: gameId.toString(), // this should be the _id of game model
    roundClosed: true,
    amount: parseFloat(amount),
    currency: player.currency,
    // side split is optional
  };

  try {
    let res = await postReq(player, win, 'win', player._id);

    logger.info(`Response of win api is -------${JSON.stringify(res)}`);

    win.responseTransactionId = res.processedTxId;
    win.responseBalance = res.balance;
    win.balanceDetails = res.balanceDetails;
    win.alreadyProcessed = res.alreadyProcessed;
    win.createdAt = res.createdAt;
    win.txDetails = res.txDetails;

    logger.info(`Win data saved in model--------${JSON.stringify(win)}`);
    const winInstance = await Win(process.env.DbName + `-${player?.consumerId}`);
    const newWin = new winInstance(win);
    await newWin.save();
    const playerInstance = await Player(`${process.env.DbName}-${process.env.CONSUMER_ID}`);
    let playerData = await playerInstance.findOneAndUpdate(
      { _id: player._id },
      { $set: { balance: res.balance } },
      { new: true }
    );

    logger.info(`Updated balance is -----------${playerData.balance}`);
    winObj.api = 'SUCCESS'; // ! not needed to save

    await redis.hdel(`${redisDb}:{room-${gameCount}}-cashout`, key);
    await redis.hdel(`${redisDb}:{room-${gameCount}}`, key);

    // set
  } catch (error) {
    logger.info(`Error is ---------${JSON.stringify(error)}`);
    winObj.api = 'ERROR';
    logger.info(`error came is -----------${error?.response?.data}`);
    logErrorMessage(`WIN, ${JSON.stringify(error?.response?.data)}, data: ${JSON.stringify(win)}`);
    return error?.response?.data;
  }
};

module.exports = { winRequest };
