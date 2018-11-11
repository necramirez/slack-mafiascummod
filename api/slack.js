const express = require('express');
const Game = require('../models/Game');
const KnownToken = require('../models/KnownToken');

const router = express.Router();

router.post('/event', (req, res) => {
  const {
    body: {
      challenge,
      event: { type: eventType },
      team_id: teamId,
      token,
      type,
    },
  } = req;
  switch (type) {
    case 'url_verification':
      console.log('Verifying event request URL...');
      if (challenge) {
        console.log('Challenge accepted!');
        KnownToken.findOneAndUpdate(
          {
            token,
          },
          {
            token,
          },
          {
            upsert: true,
          },
        );
        res.send(challenge);
      } else {
        console.log('No challenge token');
        res.sendStatus(400).send('No challenge token');
      }
      break;
    case 'app_uninstalled':
      console.log('Clearing app tokens...');
      if (token) {
        console.log('Token found in payload');
        KnownToken.findOneAndDelete({
          token,
        });
        res.send(`Uninstalled app from workspace ${teamId}`);
      } else {
        console.log('No app token');
        res.sendStatus(400).send('No app token');
      }
      break;
    default:
      console.log('OK: Unknown callback type', eventType);
      res.send('OK');
  }
});

router.post('/slash', (req, res) => {
  const {
    body: { channel_id: channelId, command, response_uri: responseUri, text, token, user_id: userId },
  } = req;
  switch (command) {
    case 'mafiascummod':
    default:
      console.log('Handling /mafiascummod...');
      KnownToken.findOne({ token }, tokenErr => {
        if (tokenErr) {
          console.log('Invalid app token');
          res.sendStatus(400).send('Invalid app token');
        } else {
          Game.findOne({ channelId, modUserId: userId, workspaceToken: token }, err => {
            if (err) {
              console.log('Game not found');
              res.sendStatus(400).send('Game not found');
            } else {
              console.log(responseUri, text);
              res.send('OK');
            }
          });
        }
      });
  }
});

module.exports = router;
