const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const connectToMongoDB = async () => {
  const mongoUri = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME;

  if (!mongoUri) {
    throw new Error("MONGO_URL is not defined in the environment variables");
  }

  if (!dbName) {
    throw new Error("DB_NAME is not defined in the environment variables");
  }

  const fullUri = mongoUri.endsWith("/")
    ? `${mongoUri}${dbName}`
    : `${mongoUri}/${dbName}`;

  try {
    await mongoose.connect(fullUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Connected to MongoDB: ${dbName}`);
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
};

module.exports = connectToMongoDB;
