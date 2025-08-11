// backend/routes/videos.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const auth = require('../services/authMiddleware'); // must export a function
const { convertToMp4 } = require('../services/ffmpegService');
const { uploadFile } = require('../services/blobService');
const { saveVideoMetadata, getAllVideos } = require('../services/cosmosService');
const ensureCreator = require('../services/ensureCreator');

const router = express.Router();

// create uploads directory path and multer instance BEFORE using it
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

console.log('auth type:', typeof auth);               
console.log('upload single type:', typeof upload.single); 






// uploading video to the server=======================================================================================
router.post('/upload', auth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inputPath = req.file.path;
    const mp4Path = await convertToMp4(inputPath);
    try { fs.unlinkSync(inputPath); } catch (e) { /* ignore */ }

    const blobName = `${req.user.uid}_${Date.now()}.mp4`;
    const url = await uploadFile(mp4Path, blobName);

    try { fs.unlinkSync(mp4Path); } catch (e) { /* ignore */ }

    const metadata = {
      title: req.body.title || 'Untitled',
      creatorId: req.user.uid,
      url,
      createdAt: new Date(),
    };
    const videoId = await saveVideoMetadata(metadata);

    res.json({ videoId, url });
  } catch (err) {
    console.error('Upload route error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});
// fetching all videos from database
router.get('/', auth, async (req, res) => {
  try {
    const list = await getAllVideos();
    res.json(list);
  } catch (err) {
    console.error('Get videos error:', err);
    res.status(500).json({ error: 'Could not fetch videos' });
  }
});


// make sures the user is a creator before allowing video uploads
router.post('/upload', auth, ensureCreator, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const inputPath = req.file.path;
    const mp4Path = await convertToMp4(inputPath);
    // delete original upload if desired
    fs.unlinkSync(inputPath);

    const blobName = `${req.user.uid}_${Date.now()}.mp4`;
    const url = await uploadFile(mp4Path, blobName);

    try { fs.unlinkSync(mp4Path); } catch (e) {}

    const metadata = {
      title: req.body.title || 'Untitled',
      creatorId: req.user.uid,
      url,
      createdAt: new Date()
    };
    const insertedId = await saveVideoMetadata(metadata);

    res.json({ success: true, videoId: insertedId, url });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});


// GET /api/videos/:id; gets a video by ID =============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await require('../services/cosmosService').getVideoById(id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    console.error('Get video error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// gets all the comments===============================================================================================
router.get('/:id/comments', async (req, res) => {
  try {
    const list = await require('../services/cosmosService').getComments(req.params.id);
    res.json(list);
  } catch (err) { res.status(500).json({ error: 'Could not load comments' }); }
});
// POST comment (auth required)
router.post('/:id/comments', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const text = req.body.text;
    if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Empty comment' });
    const id = await require('../services/cosmosService').addComment({ videoId: req.params.id, uid, text: text.trim() });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add comment' });
  }
});


// POST /api/videos/:id/rate  { value: 1 | -1 | 0 } requires auth ========================================================
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const value = parseInt(req.body.value, 10);
    if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'Invalid rating' });
    await require('../services/cosmosService').upsertRating({ videoId: req.params.id, uid, value });
    const summary = await require('../services/cosmosService').getRatingSummary(req.params.id);
    res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Rating failed' });
  }
});
// GET /api/videos/:id/rating-summary
router.get('/:id/rating-summary', async (req, res) => {
  try {
    const summary = await require('../services/cosmosService').getRatingSummary(req.params.id);
    res.json(summary);
  } catch (err) { res.status(500).json({ error: 'Could not load rating' }); }
});

module.exports = router;
