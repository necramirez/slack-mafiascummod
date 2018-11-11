require('dotenv').config();

const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const http = require('http');
const methodOverride = require('method-override');

const slackApi = require('./api/slack');
const logger = require('./logger');
const mongoose = require('./services/mongoose');

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required');
}

mongoose
  .connect(
    process.env.MONGODB_URI,
    {
      useNewUrlParser: true,
    },
  )
  .then(() => {
    logger.info('Successfully connected to MongoDB');
  })
  .catch(error => {
    logger.error('Failed to connect to MongoDB!');
    logger.error(error.message);
    process.exit(1);
  });

const app = express();
const server = http.createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(cors());

app.use(slackApi);

app.use((req, res) => {
  res.send('OK');
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  logger.info(`Server started on port ${port}`);
});
