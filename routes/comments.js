const express = require('express');
const auth = require('../services/authMiddleware'); // If you want authenticated comments
const { addComment, getComments } = require('../services/cosmosService');

const router = express.Router();

/**
 * POST /api/comments
 * Add a new comment to a video (requires authentication)
 */
router.post('/', auth, async (req, res) => {
  const { videoId, text } = req.body;
  const uid = req.user.uid;

  if (!videoId || !text) {
    return res.status(400).json({ error: 'Missing videoId or text' });
  }

  try {
    const commentId = await addComment({ videoId, uid, text });
    res.status(201).json({ commentId });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/comments/:videoId
 * Get comments for a given video
 */
router.get('/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  try {
    const comments = await getComments(videoId);
    res.json(comments);
  } catch (err) {
    console.error('Error getting comments:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

module.exports = router;
