// backend/routes/videos.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const auth = require('../services/authMiddleware'); // verifies token and sets req.user
const ensureCreator = require('../services/ensureCreator'); // ensures req.user.role === 'creator'
const cosmos = require('../services/cosmosService'); // DB helpers (getCollection, saveVideoMetadata, etc.)
const { convertToMp4 } = require('../services/ffmpegService');
const { uploadFile } = require('../services/blobService');

const router = express.Router();

/**
 * Setup uploads dir + multer
 */
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

/**
 * GET /api/videos
 * List videos, supports query params: search, sort (latest|popular), creator, limit, skip
 * Public endpoint (no auth required)
 */
router.get('/', async (req, res) => {
  try {
    const { search, sort, creator, limit = 20, skip = 0 } = req.query;
    const col = await cosmos.getCollection('videos');

    const filter = {};
    if (search) filter.title = { $regex: search, $options: 'i' };
    if (creator) filter.creatorId = creator;

    let cursor = col.find(filter);

    // default sort: newest first
    if (sort === 'popular') {
      // NOTE: popular sort requires denormalized field like `likeCount` or aggregation.
      // For now, fall back to createdAt desc (you can change to aggregate later).
      cursor = cursor.sort({ createdAt: -1 });
    } else {
      cursor = cursor.sort({ createdAt: -1 });
    }

    const results = await cursor.skip(parseInt(skip, 10)).limit(parseInt(limit, 10)).toArray();
    res.json(results);
  } catch (err) {
    console.error('Search videos error', err);
    res.status(500).json({ error: 'Could not search videos' });
  }
});

/**
 * POST /api/videos/upload
 * Upload video (creator only). Order: auth -> ensureCreator -> multer -> handler
 */
router.post('/upload', auth, ensureCreator, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inputPath = req.file.path;
    const mp4Path = await convertToMp4(inputPath);

    // delete original upload
    try { fs.unlinkSync(inputPath); } catch (e) { /* ignore */ }

    const blobName = `${req.user.uid}_${Date.now()}.mp4`;
    const url = await uploadFile(mp4Path, blobName);

    // cleanup converted file
    try { fs.unlinkSync(mp4Path); } catch (e) { /* ignore */ }

    const metadata = {
      title: req?.body?.title || 'Untitled',
      uploaderName: req?.body?.uploaderName || 'Unnamed',
      genre: req?.body?.genre || 'Uncategorized',
      creatorId: req?.user?.uid,
      url,
      createdAt: new Date(),
    };

    const insertedId = await cosmos.saveVideoMetadata(metadata);

    res.json({ success: true, videoId: insertedId, url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * GET /api/videos/:id/ratings
 * Returns { likes, dislikes }
 */
router.get('/:id/ratings', async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await cosmos.getRatingSummary(id);
    return res.json(summary);
  } catch (err) {
    console.error('Get ratings error:', err);
    return res.status(500).json({ error: 'Could not load ratings' });
  }
});

/**
 * POST /api/videos/:id/like
 * POST /api/videos/:id/dislike
 * Both require auth
 */
router.post('/:id/like', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    await cosmos.upsertRating({ videoId: id, uid, value: 1 });
    const summary = await cosmos.getRatingSummary(id);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('Like error:', err);
    return res.status(500).json({ error: 'Could not save like' });
  }
});

router.post('/:id/dislike', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    await cosmos.upsertRating({ videoId: id, uid, value: -1 });
    const summary = await cosmos.getRatingSummary(id);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('Dislike error:', err);
    return res.status(500).json({ error: 'Could not save dislike' });
  }
});

/**
 * POST /api/videos/:id/rate
 * Generic rating endpoint that accepts { value: 1 | -1 | 0 } in the body
 */
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    const value = Number(req.body.value);
    if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'Invalid rating' });

    await cosmos.upsertRating({ videoId: id, uid, value });
    const summary = await cosmos.getRatingSummary(id);
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('Rate error:', err);
    return res.status(500).json({ error: 'Could not save rating' });
  }
});


router.get('/:id/comments', async (req, res) => {
  const { id } = req.params;
  console.log(`[DEBUG] GET /api/videos/${id}/comments - handler entered`);
  try {
    const list = await cosmos.getComments(id);
    console.log(`[DEBUG] getComments returned type=${Array.isArray(list) ? 'array' : typeof list} length=${Array.isArray(list) ? list.length : 'N/A'}`);
    return res.json(list);
  } catch (err) {
    console.error(`[DEBUG] Get comments error for video ${id}:`, err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Could not load comments', detail: String(err && err.message ? err.message : err) });
  }
});


/**
 * POST /api/videos/:id/comments
 * Auth required: create a new comment
 * Body: { text: "..." }
 */
// inside backend/routes/videos.js (or wherever your POST /:id/comments lives)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;           // video id
    const { text } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ error: 'Empty comment' });

    // get user profile to fetch name
    const profile = await require('../services/cosmosService').getUserProfile(uid);
    const userName = (profile && (profile.name || profile.displayName)) || null;

    const insertedId = await require('../services/cosmosService').addComment({
      videoId: id,
      uid,
      text: text.trim(),
      userName
    });

    return res.json({ success: true, id: insertedId });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Could not add comment' });
  }
});


/**
 * GET /api/videos/:id
 * Fetch a single video document (metadata)
 * Keep this near the bottom so other /:id/xxx routes match first.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await cosmos.getVideoById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    return res.json(video);
  } catch (err) {
    console.error('Get video error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;