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
    short: 'Vote for a player',
    usage: 'vote <player>',
    example: 'vote @username1',
  },
  unvote: {
    short: 'Remove your current vote',
    usage: 'unvote',
  },
  tally: {
    short: 'Show current vote tally',
    usage: 'tally',
  },
  endWithDraw: {
    short:
      '(mod only) Force the current "day" to end on draw, like when there is no possibility of reaching a majority vote anymore',
    usage: 'endWithDraw',
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
    const example = KEYWORDS[cmd].example ? ` Example: \`${command} ${KEYWORDS[cmd].example}\`` : '';
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
        const parseUserId = u => u.replace(/[<@>]/g, '').split('|')[0];
        const players = rawPlayerTags.map(p => parseUserId(p));

        const votee = parseUserId(payload);

        const isInitialTally = day => day.dayId === 1 && day.currentTally.votes.length === 0;
        const majorityVote = n => (n % 2 === 0 ? n / 2 + 1 : Math.ceil(n / 2));
        const lynchThresholdMessage = n => `With ${n} alive, it takes ${majorityVote(n)} to lynch.`;
        const renderPlayerList = playerList => playerList.map(player => `<@${player}>`).join(', ');
        const renderVotee = v => (v.toLowerCase() === 'no lynch' ? 'No Lynch' : `<@${v}>`);
        const renderTally = tally => `${tally.votes.map(
          vote => `[*${renderVotee(vote.votee)}*] (${vote.voters.length}) - ${renderPlayerList(vote.voters)}`,
        )}
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
            if (!game.currentDay.players.includes(votee)) {
              console.log('You can only vote for players still part of the game');
              console.log(`${votee} not in ${game.currentDay.players}`);
              respond({
                response_type: 'ephemeral',
                text: 'You can only vote for players still part of the game',
              });
              return;
            }
            // if voter already voted, error
            if (!game.currentDay.currentTally.notVoting.includes(userId)) {
              console.log('You already voted - You must unvote first');
              respond({
                response_type: 'ephemeral',
                text: 'You already voted - You must unvote first',
              });
              return;
            }
            // else capture vote
            console.log('Capturing vote...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            // votee has no votes yet
            if (!game.currentDay.currentTally.votes.some(vote => vote.votee === votee)) {
              game.currentDay.currentTally.votes.push({
                votee,
                voters: [userId],
              });
            } else {
              game.currentDay.currentTally.votes = game.currentDay.currentTally.votes.map(
                vote =>
                  vote.votee === votee
                    ? {
                        votee,
                        voters: vote.voters.concat([userId]),
                      }
                    : vote,
              );
            }
            game.currentDay.currentTally.notVoting = game.currentDay.currentTally.notVoting.filter(p => p !== userId);
            // auto-end day on majority vote
            if (
              game.currentDay.currentTally.votes.some(
                vote => vote.voters.length >= majorityVote(game.currentDay.players.length),
              )
            ) {
              game.currentDay.votingClosed = true;
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
              if (game.currentDay.votingClosed) {
                respond({
                  response_type: 'ephemeral',
                  text: `A majority vote has been reached for Day ${game.currentDay.dayId}

${renderTally(game.currentDay.currentTally)}

Voting is now closed
`,
                });
              }
            });
            /* eslint-enable */
            break;
          case 'unvote':
            // if voting is closed, error
            if (game.currentDay === null || game.currentDay.votingClosed) {
              console.log('Cannot unvote - Day has not yet begun');
              respond({
                response_type: 'ephemeral',
                text: `Day has not yet begun`,
              });
              return;
            }
            // if unvoter has not voted yet, error
            if (game.currentDay.currentTally.notVoting.includes(userId)) {
              console.log('You have not voted yet');
              respond({
                response_type: 'ephemeral',
                text: 'You have not voted yet',
              });
              return;
            }
            // else register unvote
            console.log('Registering unvote...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            game.currentDay.currentTally.votes = game.currentDay.currentTally.votes
              .map(
                vote =>
                  vote.voters.includes(userId)
                    ? {
                        votee,
                        voters: vote.voters.filter(v => v !== userId),
                      }
                    : vote,
              )
              .filter(vote => vote.voters.length > 0);
            game.currentDay.currentTally.notVoting.push(userId);
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error registering unvote');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error registering unvote',
                });
                return;
              }
              respond({
                response_type: 'ephemeral',
                text: 'Your vote has been removed',
              });
            });
            /* eslint-enable */
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
                isInitialTally(game.currentDay)
                  ? `*Alive:*
${renderPlayerList(game.currentDay.players)}
`
                  : renderTally(game.currentDay.currentTally)
              }

_${lynchThresholdMessage(game.currentDay.players.length)}_
`,
            });
            break;
          case 'endWithDraw':
            if (game.currentDay === null || game.currentDay.votingClosed) {
              console.log('Cannot end the day with a draw - Day has not yet begun');
              respond({
                response_type: 'ephemeral',
                text: `Day has not yet begun`,
              });
              return;
            }
            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else end day
            console.log('Ending the day with a draw...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            game.currentDay.votingClosed = true;
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error ending the day with a draw');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error ending the day with a draw',
                });
                return;
              }
              respond({
                response_type: 'in_channel',
                text: `
Day ${game.currentDay.dayId} has ended with a draw

Voting is now closed
`,
              });
            });
            /* eslint-enable */
            break;
          case 'forceDayEnd':
            if (game.currentDay === null || game.currentDay.votingClosed) {
              console.log('Cannot force end the day - Day has not yet begun');
              respond({
                response_type: 'ephemeral',
                text: `Day has not yet begun`,
              });
              return;
            }
            // if you are not the mod, error
            if (notMod) {
              notModResponse();
              return;
            }
            // else end day
            console.log('Ending the day...');
            console.log(`Current day is Day ${game.currentDay.dayId}`);
            /* eslint-disable no-param-reassign */
            game.currentDay.votingClosed = true;
            game.save(saveErr => {
              if (saveErr) {
                console.log('Error force ending the day');
                respond({
                  response_type: 'ephemeral',
                  text: 'Error force ending the day',
                });
                return;
              }
              respond({
                response_type: 'in_channel',
                text: `
Day ${game.currentDay.dayId} has been forcefully ended by the mod

Voting is now closed
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
