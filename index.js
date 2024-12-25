const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const UserModel = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const QRCode = require("qrcode");
const Event = require("./models/Event");
const Ticket = require("./models/Ticket");
const connectToMongoDB = require("./connectdb.js");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development, adjust in production
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);

  // Emit event on socket connection
  socket.emit('welcome', { message: 'Welcome to the event ticketing system!' });

  // Listen for events sent from the client
  socket.on('purchaseTicket', (ticketData) => {
    console.log('Ticket purchase initiated:', ticketData);
    io.emit('ticketPurchased', ticketData);  // Broadcast to all clients
  });

  // Handle socket disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected: ' + socket.id);
  });
});


const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET;

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173", // Local development URL
  "https://event-management-frontend-liart.vercel.app" // Replace with your production frontend URL
];
app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

// Connect to MongoDB
connectToMongoDB();

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "uploads/");
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   },
// });

// const upload = multer({ storage });

//make forgot password apis to send otp to email and verify otp and reset password
const otpMap = new Map();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  otpMap.set(email, otp);

  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Password Reset OTP",
    text: `Your OTP for password reset is ${otp}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }
    res.json({ message: "OTP sent to email" });
  });
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  const storedOtp = otpMap.get(email);

  if (storedOtp === otp) {
    otpMap.delete(email);
    res.json({ message: "OTP verified" });
  } else {
    res.status(400).json({ error: "Invalid OTP" });
  }
});

app.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await UserModel.findOne({ email });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  user.password = bcrypt.hashSync(newPassword, bcryptSalt);
  await user.save();
  res.json({ message: "Password reset successful" });
});

app.get("/test", (req, res) => {
  res.json("test ok");
});

const roleCheck = (roles) => {
  return async (req, res, next) => {
    try {
      const { token } = req.cookies;
      if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) return res.status(401).json({ message: "Invalid token" });
        console.log(userData)
        const user = await UserModel.findById(userData.id);
        console.log(user);
        console.log(roles);
        if (!user || !roles.includes(user.role)) {
          return res.status(403).json({ message: "Forbidden" });
        }
        req.user = user;
        next();
      });
    } catch (error) {
      console.error("Middleware error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
};


app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userDoc = await UserModel.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
      role,
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const userDoc = await UserModel.findOne({ email });

  if (!userDoc) {
    return res.status(404).json({ error: "User not found" });
  }

  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (!passOk) {
    return res.status(401).json({ error: "Invalid password" });
  }

  jwt.sign(
    {
      email: userDoc.email,
      id: userDoc._id,
    },
    jwtSecret,
    {},
    (err, token) => {
      if (err) {
        return res.status(500).json({ error: "Failed to generate token" });
      }
      res.cookie("token", token).json(userDoc);
    }
  );
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await UserModel.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post(
  "/createEvent",
  roleCheck(["admin", "organizer"]),
  // upload.single("image"),
  async (req, res) => {
    try {
      const eventData = req.body;
      // eventData.image = req.file ? req.file.path : "";
      const newEvent = new Event(eventData);
      await newEvent.save();
      res.status(201).json(newEvent);
    } catch (error) {
      res.status(500).json({ error: "Failed to save the event to MongoDB" });
    }
  }
);

app.get("/createEvent", async (req, res) => {
  try {
    const events = await Event.find();
    res.status(200).json(events);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch events from MongoDB" });
  }
});

app.get("/event/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findById(id);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event from MongoDB" });
  }
});

app.post("/event/:eventId", (req, res) => {
  const eventId = req.params.eventId;

  Event.findById(eventId)
    .then((event) => {
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      event.likes += 1;
      return event.save();
    })
    .then((updatedEvent) => {
      res.json(updatedEvent);
    })
    .catch((error) => {
      console.error("Error liking the event:", error);
      res.status(500).json({ message: "Server error" });
    });
});

app.get("/events", (req, res) => {
  Event.find()
    .then((events) => {
      res.json(events);
    })
    .catch((error) => {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Server error" });
    });
});

app.get("/event/:id/ordersummary", async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findById(id);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event from MongoDB" });
  }
});

app.get("/event/:id/ordersummary/paymentsummary", async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findById(id);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch event from MongoDB" });
  }
});

app.post("/tickets", async (req, res) => {
  try {
    const ticketDetails = req.body;
    // Generate QR code for ticket validation using the ticket details id and email
    const qrCodeData = await QRCode.toDataURL(
      JSON.stringify({
        ticketId: req.body.ticketDetails.ticketId,
        email: ticketDetails.ticketDetails.email,
      })
    );
    const newTicket = new Ticket({
      ...ticketDetails,
      ticketDetails: {
        ...ticketDetails.ticketDetails,
        qr: qrCodeData,
      },
    });
    await newTicket.save();
    return res.status(201).json({ ticket: newTicket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return res.status(500).json({ error: "Failed to create ticket" });
  }
});

app.get("/tickets/:id", async (req, res) => {
  try {
    const tickets = await Ticket.find();
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

app.get("/tickets/user/:userId", (req, res) => {
  const userId = req.params.userId;

  Ticket.find({ userid: userId })
    .then((tickets) => {
      res.json(tickets);
    })
    .catch((error) => {
      console.error("Error fetching user tickets:", error);
      res.status(500).json({ error: "Failed to fetch user tickets" });
    });
});

app.delete("/tickets/:id", async (req, res) => {
  try {
    const ticketId = req.params.id;
    await Ticket.findByIdAndDelete(ticketId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
