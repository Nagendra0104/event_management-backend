const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const connectToMongoDB = async () => {
  const mongoUri = process.env.MONGO_URL;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in the environment variables");
  }

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
};

module.exports = connectToMongoDB;
