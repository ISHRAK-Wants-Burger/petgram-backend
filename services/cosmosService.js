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

async function getCollection(name = 'videos') {
  const db = await getDb();
  return db.collection(name);
}

async function saveVideoMetadata(metadata = {}) {
  const collection = await getCollection('videos');
  const result = await collection.insertOne(metadata);
  return result.insertedId;
}


async function getAllVideos() {
  const collection = await getCollection('videos');
  return collection.find().sort({ createdAt: -1 }).toArray();
}

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

async function getUserProfile(uid) {
  if (!uid) return null;
  const usersCol = await getCollection('users');
  return usersCol.findOne({ uid });
}

async function closeConnection() {
  if (client && client.isConnected && client.isConnected()) {
    await client.close();
    dbInstance = null;
  }
}


async function getVideoById(videoId) {
  if (!videoId) return null;
  const collection = await getCollection('videos');
  return collection.findOne({ _id: new ObjectId(videoId) });
}


// comments functions =================================================================================
async function addComment({ videoId, uid, text }) {
  if (!videoId || !uid || !text) throw new Error('missing data');
  const comments = await getCollection('comments');
  const doc = { videoId, uid, text, createdAt: new Date() };
  const r = await comments.insertOne(doc);
  return r.insertedId;
}

async function getComments(videoId, limit = 50) {
  const comments = await getCollection('comments');
  return comments.find({ videoId }).sort({ createdAt: -1 }).limit(limit).toArray();
}


// rating functions =================================================================================
async function upsertRating({ videoId, uid, value }) {
  // value: 1 (like) or -1 (dislike) or 0 remove
  const ratings = await getCollection('ratings');
  if (value === 0) {
    return ratings.deleteOne({ videoId, uid });
  }
  const update = { $set: { videoId, uid, value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } };
  return ratings.updateOne({ videoId, uid }, update, { upsert: true });
}
async function getRatingSummary(videoId) {
  const ratings = await getCollection('ratings');
  // aggregate counts
  const pipeline = [
    { $match: { videoId } },
    { $group: { _id: '$videoId', likes: { $sum: { $cond: [{ $eq: ['$value', 1] }, 1, 0] } }, dislikes: { $sum: { $cond: [{ $eq: ['$value', -1] }, 1, 0] } } } }
  ];
  const [res] = await ratings.aggregate(pipeline).toArray();
  return res || { likes: 0, dislikes: 0 };
}


module.exports = {
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
};
