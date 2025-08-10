// backend/routes/users.js
const express = require('express');
const admin = require('../firebaseAdmin');          // CommonJS admin export
const auth = require('../services/authMiddleware'); // verifies token, sets req.user
const { upsertUserProfile } = require('../services/cosmosService');

const router = express.Router();

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
