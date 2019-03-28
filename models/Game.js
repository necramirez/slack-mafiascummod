const { connection: db, Schema } = require('../services/mongoose');

const TallyEntry = new Schema(
  {
    votee: {
      type: String,
      required: true,
    },
    voters: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const Tally = new Schema(
  {
    votes: {
      type: [TallyEntry],
      default: [],
    },
    notVoting: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const Day = new Schema(
  {
    dayId: {
      type: Number,
      required: true,
    },
    players: {
      type: [String],
      default: [],
    },
    currentTally: {
      type: Tally,
      default: null,
    },
    votingClosed: {
      type: Boolean,
      default: false,
    },
    votingDeadline: {
      type: Date,
      default: false,
    },
  },
  { _id: false },
);

const GameSchema = new Schema(
  {
    channelId: {
      type: String,
      required: true,
    },
    modUserId: {
      type: String,
      required: true,
    },
    currentDay: {
      type: Day,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastTallyRequestedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = db.model('Game', GameSchema);
