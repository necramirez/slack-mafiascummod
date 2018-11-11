const { createLogger, format, transports } = require('winston');

const { printf } = format;

const logger = createLogger({
  format: printf(info => info.message.trim()),
  transports: [new transports.Console()],
});

module.exports = logger;
