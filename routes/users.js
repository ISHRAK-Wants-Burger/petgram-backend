// backend/routes/users.js
const express = require('express');
const admin = require('../firebaseAdmin');          // Firebase Admin SDK
const auth = require('../services/authMiddleware'); // Verifies token, sets req.user
const { upsertUserProfile, getCollection } = require('../services/cosmosService');

const router = express.Router();

/**
 * POST /api/users
 * Save a new user profile (called after signup)
 */
router.post('/', async (req, res) => {
  const { uid, email, name, dob, role } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: 'Missing uid or email' });
  }

  try {
    await upsertUserProfile({
      uid,
      email,
      name: name || null,
      dob: dob || null,
      role: role || 'consumer'
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('Error saving user profile:', err);
    return res.status(500).json({ error: 'Failed to save user profile' });
  }
});

/**
 * POST /api/users/promote
 * Promote a user to creator
 */
router.post('/promote', auth, async (req, res) => {
  try {
    const uid = req.user.uid; // decoded token set in auth middleware
    if (!uid) return res.status(400).json({ error: 'Invalid user' });

    // Set custom claim - this is persistent until changed
    await admin.auth().setCustomUserClaims(uid, { role: 'creator' });

    // Optionally: upsert user profile in DB with role
    await upsertUserProfile({ uid, email: req.user.email || null, role: 'creator' });

    // Inform the client to refresh token
    return res.json({ success: true, message: 'Promoted to creator. Please refresh your auth token.' });
  } catch (err) {
    console.error('Promote error:', err);
    return res.status(500).json({ error: 'Could not promote user' });
  }
});

module.exports = router;
