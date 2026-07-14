const jwt = require('jsonwebtoken');
const { query } = require('../utils/db');
const { refreshGoogleToken } = require('../utils/tokenRefresh');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      'SELECT id, name, email, google_account_id, avatar_url, access_token, refresh_token, access_token_expiry FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }

    let user = result.rows[0];

    // Proactively refresh Google token if it expires within the next 5 minutes
    if (user.refresh_token && user.access_token_expiry) {
      const expiresAt = new Date(user.access_token_expiry);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      if (expiresAt < fiveMinutesFromNow) {
        const newToken = await refreshGoogleToken(user.id, user.refresh_token);
        if (newToken) {
          user = { ...user, access_token: newToken };
        }
      }
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authenticate };
