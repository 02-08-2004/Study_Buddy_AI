const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('../utils/db');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const googleId = profile.id;
    const avatarUrl = profile.photos[0]?.value;

    // Google access tokens expire after 1 hour
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Upsert user
    const result = await query(
      `INSERT INTO users (name, email, google_account_id, avatar_url, access_token, refresh_token, access_token_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (google_account_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         avatar_url = EXCLUDED.avatar_url,
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
         access_token_expiry = EXCLUDED.access_token_expiry,
         updated_at = NOW()
       RETURNING *`,
      [name, email, googleId, avatarUrl, accessToken, refreshToken, tokenExpiry]
    );

    return done(null, result.rows[0]);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});
