const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  owner: String,
  title: String,
  organizerEmail: String,
  description: String,
  organizedBy: String,
  eventDate: Date,
  eventTime: String,
  location: String,
  Participants: Number,
  Count: Number,
  Income: Number,
  ticketPrice: Number,
  Quantity: Number,
  image: String,
  likes: Number,
  ticketCount: Number,
  outDated: Boolean,
  Comment: [String],
});

const Event = mongoose.model("Event", eventSchema);
module.exports = Event;