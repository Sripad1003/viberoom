const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const spotifyRoutes = require('./routes/spotify');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);


const port = process.env.PORT || 3000;



app.use('/api/spotify', spotifyRoutes);
// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const axios = require('axios');

app.get('/api/youtube/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'YouTube API key not configured' });
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(query)}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('YouTube API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch YouTube videos' });
  }
});

// ------------------------
// Room Management
// ------------------------
const rooms = {}; // { roomId: { users: [], currentVideo: '' } }

io.on('connection', (socket) => {
  console.log('[Server] A user connected');

  socket.on('join-room', ({ room, username }) => {
    if (!room || !username) return;

    socket.join(room);
    socket.room = room;
    socket.username = username;

    if (!rooms[room]) rooms[room] = { users: [], currentVideo: null };
    rooms[room].users.push(username);

    console.log(`[${username}] joined room: ${room}`);

    // Ask others to send sync data to the new user
    socket.to(room).emit('sync-request');

    // Send current video if exists
    if (rooms[room].currentVideo) {
      socket.emit('video-change', {
        videoId: rooms[room].currentVideo,
        username: 'System'
      });
    }
  });

  socket.on('video-change', ({ room, videoId, username }) => {
    if (!room || !videoId || !username) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], currentVideo: null };
    }
    rooms[room].currentVideo = videoId;
    socket.to(room).emit('video-change', { videoId, username });
  });

  socket.on('play', ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    console.log(`[${username}] PLAY in room ${room} at ${time.toFixed(2)}s`);
    socket.to(room).emit('play', { time, username });
  });

  socket.on('pause', ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    console.log(`[${username}] PAUSE in room ${room} at ${time.toFixed(2)}s`);
    socket.to(room).emit('pause', { time, username });
  });

  socket.on('sync-response', ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    console.log(`[${username}] SYNC-RESPONSE to room ${room} at ${time.toFixed(2)}s`);
    socket.to(room).emit('sync-response', { time, username });
  });

  // WebRTC signaling
  socket.on('offer', ({ offer, room }) => {
    if (!offer || !room) return;
    socket.to(room).emit('offer', { offer });
  });

  socket.on('answer', ({ answer, room }) => {
    if (!answer || !room) return;
    socket.to(room).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, room }) => {
    if (!candidate || !room) return;
    socket.to(room).emit('ice-candidate', { candidate });
  });

  socket.on('seek', ({ time, username, room }) => {
    if (!room || time == null || !username) return;
    console.log(`[${username}] SEEK to ${time.toFixed(2)}s in room ${room}`);
    socket.to(room).emit('seek', { time, username });
  });

  socket.on('client-log', (message) => {
    console.log(`[Client Log]: ${message}`);
  });

  socket.on('disconnect', () => {
    const { room, username } = socket;
    if (room && username && rooms[room]) {
      console.log(`[${username}] disconnected from room ${room}`);
      rooms[room].users = rooms[room].users.filter(user => user !== username);
      // Optional cleanup: delete room if empty
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
    }
  });
});

// ------------------------
// Start Server
// ------------------------
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
