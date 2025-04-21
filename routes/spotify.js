const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

let accessToken = '';
let tokenExpiry = 0;

// Get Spotify Access Token
async function getSpotifyToken() {
  if (Date.now() < tokenExpiry && accessToken) {
    return accessToken;
  }

  const resp = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
    }
  );

  accessToken = resp.data.access_token;
  tokenExpiry = Date.now() + resp.data.expires_in * 1000;
  return accessToken;
}

// Search Route
router.get('/search', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    const query = req.query.q;
    const search = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const tracks = search.data.tracks.items.map((item) => ({
      name: item.name,
      artists: item.artists.map((a) => a.name).join(', '),
      url: item.external_urls.spotify,
      preview_url: item.preview_url,
    }));

    res.json({ tracks });
  } catch (err) {
    console.error('Spotify Search Error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to search Spotify' });
  }
});

module.exports = router;
