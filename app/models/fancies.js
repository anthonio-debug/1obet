const mongoose = require("mongoose");
mongoose.set("debug", true);

let Global = require("../global/settings");
const fanciesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  teamId: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  winner: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Number,
  },
  updatedAt: {
    type: Number,
  },
});
fanciesSchema.pre("save", function (next) {
  var now = new Date().getTime() / 1000;
  if (!this.createdAt) {
    this.createdAt = now;
  } else {
    this.updatedAt = now;
  }
  next();
});

fanciesSchema.plugin(Global.paginate);
fanciesSchema.plugin(Global.aggregatePaginate);

module.exports = mongoose.model("fancies", fanciesSchema);
