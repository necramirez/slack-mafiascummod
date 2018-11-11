const express = require('express');
const request = require('request-promise');
const Game = require('../models/Game');

const router = express.Router();

router.post('/event', (req, res) => {
  const {
    body: {
      challenge,
      event: { type: eventType },
      type,
    },
  } = req;
  switch (type) {
    case 'url_verification':
      console.log('Verifying event request URL...');
      if (challenge) {
        console.log('Challenge accepted!');
        res.send(challenge);
      } else {
        console.log('No challenge token');
        res.sendStatus(400).send('No challenge token');
      }
      break;
    default:
      console.log('OK: Unknown callback type', eventType);
      res.send('OK');
  }
});

const KEYWORDS = {
  setup: {
    short: 'Create a game in the current channel with you as moderator (a.k.a. mod)',
    usage: 'setup',
  },
  begin: {
    short: '(mod only) Begin a "day" in the current game',
    usage: 'begin <player list>',
    example: 'begin @username1 @username2 ...',
  },
  vote: {
    short: 'Create a game in the current channel with you as mod',
    usage: 'vote <player>',
    example: 'vote @username1',
  },
  tally: {
    short: 'Show current vote tally',
    usage: 'tally',
  },
  end: {
    short: '(mod only) Force the current "day" to end, even if there is no majority vote yet',
    usage: 'end',
  },
  teardown: {
    short: '(mod only) Force the current game to end',
    usage: 'teardown',
  },
};

router.post('/slash', (req, res) => {
  const {
    body: { channel_id: channelId, command, response_url: responseUrl, text: rawText, user_id: userId },
  } = req;
  const buildCommandHelp = cmd => {
    const example = KEYWORDS[cmd].example ? ` Example: \`/${command} ${KEYWORDS[cmd].example}\`` : '';
    return `\`${KEYWORDS[cmd].usage}\` - ${KEYWORDS[cmd].short}.${example}`;
  };

  const text = rawText.trim();
  const endOfKeywordIndex = text.indexOf(' ');
  const keyword = endOfKeywordIndex > -1 ? text.substring(0, endOfKeywordIndex) : text;

  if (!text || text === 'help') {
    res.send(
      Object.keys(KEYWORDS)
        .map(buildCommandHelp)
        .join('\n'),
    );
    return;
  }

  if (!KEYWORDS[keyword]) {
    res.send(`Invalid keyword "${keyword}"`);
    return;
  }

  const payload = endOfKeywordIndex > -1 ? text.substring(endOfKeywordIndex + 1) : '';
  if (/^help\b/.test(payload)) {
    res.send(buildCommandHelp(keyword));
    return;
  }

  const respond = body =>
    request({
      method: 'POST',
      uri: responseUrl,
      body,
      json: true,
    });

  switch (command) {
    case '/mafiascummod':
    default:
      console.log(`Handling ${command}...`);
      res.send('Please wait a moment...');

      // get ongoing game
      Game.findOne({ channelId, endedAt: { $eq: null } }, (err, game) => {
        if (err) {
          console.log('Error loading game');
          respond({
            response_type: 'ephemeral',
            text: 'Error loading game',
          });
          return;
        }

        // if there is no ongoing game
        if (!game) {
          // if keyword == setup, create game
          if (keyword === KEYWORDS.setup) {
            Game.create({ channelId, modUserId: userId }, gameErr => {
              if (gameErr) {
                console.log('Error creating game');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error creating game',
                });
                return;
              }

              respond({
                response_type: 'ephemeral',
                text: 'Game created - You are now mod',
              });
            });
          } else {
            respond({
              response_type: 'ephemeral',
              text: 'There is no ongoing game',
            });
            return;
          }
        }

        const notMod = game.modUserId !== userId;
        const notModResponse = () => {
          respond({
            response_type: 'ephemeral',
            text: 'You cannot do that - You are not the mod',
          });
        };

        const players = payload.split(' ').filter(v => !!v);

        switch (keyword) {
          case KEYWORDS.begin:
            if (!players.every(v => /<@\w+>/.test(v))) {
              respond({
                response_type: 'ephemeral',
                text: 'Invalid username found',
              });
              return;
            }
            if (game.currentDay && game.currentDay.votingClosed === false) {
              respond({
                response_type: 'ephemeral',
                text: `Current day has not yet ended`,
              });
              return;
            }

            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else begin day
            if (game.currentDay === null) {
              /* eslint-disable no-param-reassign */
              game.currentDay = {
                dayId: 1,
                players,
                currentTally: {
                  votes: [],
                  notVoting: players,
                },
                votingClosed: false,
              };
              game.startedAt = new Date().toISOString();
              game.save();
              /* eslint-enable */
            }
            break;
          case KEYWORDS.vote:
            // if voting is closed, error
            // else capture vote
            break;
          case KEYWORDS.tally:
            // else show tally
            break;
          case KEYWORDS.end:
            if (game.currentDay === null || game.currentDay.votingClosed) {
              respond({
                response_type: 'ephemeral',
                text: `Day has not yet begun`,
              });
              return;
            }
            // if you are not the mod, error
            if (notMod) {
              notModResponse();
            }
            // else end day
            // eslint-disable-next-line no-param-reassign
            game.save();
            break;
          case KEYWORDS.teardown:
            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else end game
            // eslint-disable-next-line no-param-reassign
            game.endedAt = new Date();
            game.save();
            break;
          default:
          // noop - invalid keyword already handled above
        }
      });
  }
});

module.exports = router;
