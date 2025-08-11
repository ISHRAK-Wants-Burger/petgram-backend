// backend/services/cosmosService.js
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

if (!process.env.COSMOS_CONN) {
  throw new Error('COSMOS_CONN not set in environment');
}

const client = new MongoClient(process.env.COSMOS_CONN, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db('videoshare'); // database name
  }
  return dbInstance;
}

/**
 * Return a collection object. Default 'videos'.
 */
async function getCollection(name = 'videos') {
  const db = await getDb();
  return db.collection(name);
}

/**
 * Save a video metadata document into the 'videos' collection.
 * Returns the insertedId (ObjectId).
 */
async function saveVideoMetadata(metadata = {}) {
  const collection = await getCollection('videos');
  const result = await collection.insertOne(metadata);
  return result.insertedId;
}

/**
 * Return all videos (sorted newest first).
 */
async function getAllVideos() {
  const collection = await getCollection('videos');
  return collection.find().sort({ createdAt: -1 }).toArray();
}

/**
 * Upsert a user profile into 'users' collection.
 */
async function upsertUserProfile({ uid, email = null, role = 'consumer' } = {}) {
  if (!uid) throw new Error('uid is required for upsertUserProfile');
  const usersCol = await getCollection('users');
  const update = {
    $set: {
      uid,
      email,
      role,
      updatedAt: new Date(),
    },
    $setOnInsert: {
      createdAt: new Date(),
    },
  };
  const result = await usersCol.updateOne({ uid }, update, { upsert: true });
  return result;
}

/**
 * Get a user profile by uid.
 */
async function getUserProfile(uid) {
  if (!uid) return null;
  const usersCol = await getCollection('users');
  return usersCol.findOne({ uid });
}

/**
 * Close the Mongo client connection (useful for scripts/tests).
 */
async function closeConnection() {
  try {
    if (client) {
      await client.close();
    }
  } finally {
    dbInstance = null;
  }
}

/**
 * Get a single video by its ObjectId string.
 */
async function getVideoById(videoId) {
  if (!videoId) return null;
  const collection = await getCollection('videos');
  try {
    return collection.findOne({ _id: new ObjectId(videoId) });
  } catch (err) {
    // Invalid ObjectId string -> return null
    return null;
  }
}

/* ------------------ Comments ------------------ */
/**
 * Add a comment doc to 'comments' collection.
 * doc: { videoId (string), uid, text, createdAt }
 */
async function addComment({ videoId, uid, text }) {
  if (!videoId || !uid || !text) throw new Error('missing data');
  const comments = await getCollection('comments');
  const doc = { videoId: String(videoId), uid, text, createdAt: new Date() };
  const r = await comments.insertOne(doc);
  return r.insertedId;
}

/**
 * Get comments for a videoId (most recent first)
 */
async function getComments(videoId, limit = 100) {
  const comments = await getCollection('comments');

  // fetch all matching docs (no server-side sort)
  const docs = await comments.find({ videoId: String(videoId) }).toArray();

  // sort in-memory by createdAt descending (newest first)
  docs.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt) : 0;
    const tb = b.createdAt ? new Date(b.createdAt) : 0;
    return tb - ta;
  });

  // return up to `limit` items
  return docs.slice(0, limit);
}

/* ------------------ Ratings ------------------ */
/**
 * Upsert a user's rating for a video.
 * value: 1 (like), -1 (dislike), 0 (remove)
 */
async function upsertRating({ videoId, uid, value }) {
  const ratings = await getCollection('ratings');
  const filter = { videoId: String(videoId), uid };
  if (value === 0) {
    return ratings.deleteOne(filter);
  }
  const update = {
    $set: { videoId: String(videoId), uid, value, updatedAt: new Date() },
    $setOnInsert: { createdAt: new Date() },
  };
  return ratings.updateOne(filter, update, { upsert: true });
}

/**
 * Returns { likes: number, dislikes: number } for a videoId
 */
async function getRatingSummary(videoId) {
  const ratings = await getCollection('ratings');
  const pipeline = [
    { $match: { videoId: String(videoId) } },
    {
      $group: {
        _id: '$videoId',
        likes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } },
        dislikes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } },
      },
    },
  ];
  const arr = await ratings.aggregate(pipeline).toArray();
  if (!arr || arr.length === 0) return { likes: 0, dislikes: 0 };
  return { likes: arr[0].likes || 0, dislikes: arr[0].dislikes || 0 };
}

/* ------------------ exports ------------------ */
module.exports = {
  getCollection,
  saveVideoMetadata,
  getAllVideos,
  upsertUserProfile,
  getUserProfile,
  closeConnection,
  getVideoById,
  addComment,
  getComments,
  upsertRating,
  getRatingSummary,
  ObjectId,
};
