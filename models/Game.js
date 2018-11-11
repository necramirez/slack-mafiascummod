const { connection: db, Schema } = require('../services/mongoose');

const TallyEntry = new Schema({
  votee: String,
  voters: [String],
});

const Tally = new Schema({
  votes: [TallyEntry],
  notVoting: [String],
});

const Day = new Schema({
  dayId: Number,
  players: [String],
  currentTally: Tally,
  votingClosed: Boolean,
});

const GameSchema = new Schema(
  {
    workspaceToken: {
      type: String,
      required: true,
    },
    channelId: {
      type: String,
      required: true,
    },
    modUserId: {
      type: String,
      required: true,
    },
    currentDay: Day,
    startedAt: Date,
    endedAt: Date,
    lastTallyRequestedAt: Date,
  },
  {
    timestamps: true,
  },
);

module.exports = db.model('Game', GameSchema);
