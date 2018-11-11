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
  beginDay: {
    short: '(mod only) Begin a "day" in the current game',
    usage: 'beginDay <player list>',
    example: 'beginDay @username1 @username2 ...',
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
  forceDayEnd: {
    short: '(mod only) Force the current "day" to end, even if there is no majority vote yet',
    usage: 'forceDayEnd',
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
      console.log(`Handling ${command} with keyword ${keyword}...`);
      res.send(`Processing your request \`${rawText}\`...`);

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
          // if keyword == 'setup', create game
          if (keyword === 'setup') {
            console.log(`Handling keyword ${keyword}...`);
            console.log('Creating game...');
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
            return;
          }
          respond({
            response_type: 'ephemeral',
            text: 'There is no ongoing game',
          });
          return;
        }

        const notMod = game.modUserId !== userId;
        const notModResponse = () => {
          console.log('Not the mod');
          respond({
            response_type: 'ephemeral',
            text: 'You cannot do that - You are not the mod',
          });
        };

        const rawPlayerTags = payload.split(' ').filter(v => !!v);
        const invalidUsernameFound = !rawPlayerTags.every(v => /<@[\w|]+>/.test(v));
        const players = rawPlayerTags.map(p => p.replace(/[<@>]/g, '').split('|')[0]);

        const isInitialTally = game.currentDay.dayId === 1 && game.currentDay.currentTally.votes.length === 0;
        const lynchThreshold = n => `With ${n} alive, it takes ${Math.ceil(n / 2)} to lynch.`;
        const renderPlayerList = playerList => playerList.map(player => `<@${player}>`).join(', ');
        const renderVotee = votee => (votee.toLowerCase() === 'no lynch' ? 'No Lynch' : `<@${votee}>`);
        const renderTally = tally => `
${tally.votes.map(vote => `[*${renderVotee(vote.votee)}*] (${vote.voters.length}) - ${renderPlayerList(vote.voters)}`)}
${tally.notVoting.length > 0 &&
          `
Not voting: ${renderPlayerList(tally.notVoting)}`}
`;

        console.log(`Handling keyword ${keyword}...`);
        switch (keyword) {
          case 'beginDay':
            if (invalidUsernameFound) {
              console.log('Invalid username found');
              console.log(rawPlayerTags);
              console.log(players);
              respond({
                response_type: 'ephemeral',
                text: 'Invalid username found',
              });
              return;
            }
            if (game.currentDay && game.currentDay.votingClosed === false) {
              console.log('Current day has not yet ended');
              respond({
                response_type: 'ephemeral',
                text: 'Current day has not yet ended',
              });
              return;
            }

            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else begin day
            console.log('Beginning the day...');
            console.log(`Current day is Day ${game.currentDay ? game.currentDay.dayId : 0}`);
            /* eslint-disable no-param-reassign */
            game.currentDay = {
              dayId: (game.currentDay ? game.currentDay.dayId : 0) + 1,
              players,
              currentTally: {
                votes: [],
                notVoting: players,
              },
              votingClosed: false,
            };
            game.startedAt = new Date().toISOString();
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error beginning the day');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error beginning the day',
                });
                return;
              }
              respond({
                response_type: 'in_channel',
                text: `Day ${game.currentDay.dayId}

Players:
${players.map((player, index) => `${index + 1}. <@${player}>`).join('\n')}
`,
              });
            });
            /* eslint-enable */
            break;
          case 'vote':
            // if voting is closed, error
            if (game.currentDay === null || game.currentDay.votingClosed) {
              console.log('Cannot vote yet - Day has not yet begun');
              respond({
                response_type: 'ephemeral',
                text: `Day has not yet begun`,
              });
              return;
            }
            // if votee is not in player list, error
            if (!game.currentDay.players.includes(payload)) {
              console.log('You can only vote for players still part of the game');
              respond({
                response_type: 'ephemeral',
                text: 'You can only vote for players still part of the game',
              });
              return;
            }
            // else capture vote
            // auto-end day on majority vote?
            console.log('Capturing vote...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            // votee has no votes yet
            if (!game.currentDay.currentTally.votes.some(vote => vote.votee === payload)) {
              game.currentDay.currentTally.votes.push({
                votee: payload,
                voters: [userId],
              });
            } else {
              game.currentDay.currentTally.votes = game.currentDay.currentTally.votes.map(
                vote =>
                  vote.votee === payload
                    ? {
                        votee: payload,
                        voters: vote.voters.concat([userId]),
                      }
                    : vote,
              );
            }
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error capturing vote');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error capturing vote',
                });
                return;
              }
              respond({
                response_type: 'ephemeral',
                text: 'Your vote has been counted',
              });
            });
            /* eslint-enable */
            // auto-end day on majority vote?
            break;
          case 'tally':
            if (game.currentDay === null) {
              console.log('Cannot show tally - Game has not yet begun');
              respond({
                response_type: 'ephemeral',
                text: `Game has not yet begun`,
              });
              return;
            }
            console.log('Generating tally...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            respond({
              response_type: 'in_channel',
              text: `
Day ${game.currentDay.dayId}

${
                isInitialTally
                  ? `*Alive:*
${renderPlayerList(game.currentDay.players)}
`
                  : renderTally(game.currentDay.currentTally)
              }

_${lynchThreshold(game.currentDay.players.length)}_
`,
            });
            break;
          case 'forceDayEnd':
            if (game.currentDay === null || game.currentDay.votingClosed) {
              console.log('Cannot end the day - Day has not yet begun');
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
            console.log('Ending the day...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            game.currentDay.votingClosed = true;
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error ending the day');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error ending the day',
                });
                return;
              }
              respond({
                response_type: 'in_channel',
                text: `
Day ${game.currentDay.dayId} has been forcefully ended by the mod

Voting is closed
`,
              });
            });
            /* eslint-enable */
            break;
          case 'teardown':
            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else end game
            console.log('Ending the game...');
            /* eslint-disable no-param-reassign */
            game.endedAt = new Date().toISOString();
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error ending the game');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error ending the game',
                });
                return;
              }
              respond({
                response_type: 'ephemeral',
                text: 'Game has ended',
              });
            });
            /* eslint-enable */
            break;
          default:
            // noop - invalid keyword already handled above
            break;
        }
      });
  }
});

module.exports = router;
