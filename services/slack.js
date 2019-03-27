const request = require('request-promise');

module.exports = {
  postMessage({ asUser, channel, text }) {
    request({
      method: 'POST',
      uri: 'https://slack.com/api/chat.postMessage',
      headers: {
        Authorization: process.env.SLACK_BOT_TOKEN ? `Bearer ${process.env.SLACK_BOT_TOKEN}` : undefined,
      },
      body: {
        as_user: asUser,
        channel,
        text,
      },
      json: true,
    })
      .then(() => {
        console.log(`Successfully posted Slack message to channel ${channel}: ${text}`);
      })
      .catch(() => {
        console.log(`Failed to post Slack message to channel ${channel}: ${text}`);
      });
  },
};
