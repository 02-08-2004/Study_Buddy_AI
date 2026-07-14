const axios = require('axios');
const { query } = require('./db');

/**
 * Refresh a user's Google access token using their stored refresh token.
 * Updates the DB with the new token and expiry.
 * Returns the new access token, or null on failure.
 */
const refreshGoogleToken = async (userId, refreshToken) => {
  if (!refreshToken) return null;

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const { access_token, expires_in } = response.data;
    // expires_in is in seconds (typically 3600 = 1 hour)
    const expiry = new Date(Date.now() + expires_in * 1000);

    await query(
      `UPDATE users
       SET access_token = $1, access_token_expiry = $2, updated_at = NOW()
       WHERE id = $3`,
      [access_token, expiry, userId]
    );

    console.log(`🔑 Token refreshed for user ${userId}, expires at ${expiry.toISOString()}`);
    return access_token;
  } catch (err) {
    console.error(`🔑 Token refresh failed for user ${userId}:`, err.response?.data || err.message);
    return null;
  }
};

module.exports = { refreshGoogleToken };
