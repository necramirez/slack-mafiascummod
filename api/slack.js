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

const SLASH_COMMANDS = {
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
    body: { channel_id: channelId, command, response_url: responseUrl, text = 'help', token, user_id: userId },
  } = req;
  const buildCommandHelp = cmd => {
    const example = SLASH_COMMANDS[cmd].example ? ` Example: \`/${command} ${SLASH_COMMANDS[cmd].example}\`` : '';
    return `\`${SLASH_COMMANDS[cmd].usage}\` - ${SLASH_COMMANDS[cmd].short}.${example}`;
  };

  if (text === 'help') {
    res.send(
      Object.keys(SLASH_COMMANDS)
        .map(buildCommandHelp)
        .join('\n'),
    );
    return;
  }

  const endOfKeywordIndex = text.indexOf(' ');

  const keyword = text.substring(0, endOfKeywordIndex);
  if (!SLASH_COMMANDS[keyword]) {
    res.send(`Invalid command "${keyword}"`);
    return;
  }

  const value = text.substring(endOfKeywordIndex + 1);
  if (/^help\b/.test(value)) {
    res.send(buildCommandHelp(keyword));
    return;
  }

  switch (command) {
    case 'mafiascummod':
    default:
      console.log('Handling /mafiascummod...');

      res.sendStatus(200);

      Game.findOne({ channelId, modUserId: userId, workspaceToken: token }, err => {
        if (err) {
          console.log('Error loading game');
          res.sendStatus(400).send('Error loading game');
          return;
        }

        request({
          method: 'POST',
          uri: responseUrl,
          body: {
            response_type: 'in_channel',
            text: 'OK',
          },
          json: true,
        });
      });
  }
});

module.exports = router;
