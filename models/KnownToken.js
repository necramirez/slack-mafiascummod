const { connection: db, Schema } = require('../services/mongoose');

const KnownTokenSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = db.model('KnownToken', KnownTokenSchema);
