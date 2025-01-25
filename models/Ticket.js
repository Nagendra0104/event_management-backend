const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  userid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  eventid: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
   },
  ticketDetails: {
    name: { type: String, required: true },
    email: { type: String, require: true },
    eventname: { type: String, require: true },
    eventdate: { type: Date, require: true },
    eventtime: { type: String, require: true },
    ticketprice: { type: Number, require: true },
    ticketId: { type: String, require: true },
    bookeddate: { type: Date, require: true },
    qr: { type: String, require: true },
  },
  count: { type: Number, default: 0 },
  isValid: { type: Boolean, default: true },
}, { timestamps: true });

const TicketModel = mongoose.model(`Ticket`, ticketSchema);
module.exports = TicketModel;
