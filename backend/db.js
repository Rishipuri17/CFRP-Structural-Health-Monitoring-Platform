/**
 * db.js — MongoDB connection via Mongoose
 * Non-fatal: API works without MongoDB (ML inference still runs via Python).
 * MongoDB is used for caching panel metadata and prediction history.
 */
const mongoose = require("mongoose");

const connect = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/cfrp_shm";
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[MongoDB] Connected → ${uri}`);
  } catch (err) {
    console.warn(`[MongoDB] Not available (${err.message})`);
    console.warn("[MongoDB] Running without persistence — ML inference still works.");
    // Disconnect so Mongoose doesn't keep retrying
    mongoose.connection.close().catch(() => {});
  }
};

module.exports = { connect };

