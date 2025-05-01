const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// YouTube API endpoint
app.get("/api/youtube/search", async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter q" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "YouTube API key not configured" });
  }

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
    query
  )}&key=${apiKey}`;

  try {
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("YouTube API error:", error.message);
    res.status(500).json({ error: "Failed to fetch YouTube videos" });
  }
});

// Room Management
const rooms = {}; // { roomId: { users: [], queue: [], currentVideoIndex: 0 } }

io.on("connection", (socket) => {
  console.log("[Server] A user connected");

  socket.on("join-room", ({ room, username }) => {
    if (!room || !username) return;

    socket.join(room);
    socket.room = room;
    socket.username = username;

    if (!rooms[room]) {
      rooms[room] = {
        users: [],
        queue: [],
        currentVideoIndex: -1,
        currentTime: 0,
        isPlaying: false,
      };
    }

    // Add user to room
    rooms[room].users.push(username);

    console.log(`[${username}] joined room: ${room}`);

    // Send current queue, current video index, current time, and play state to the new user
    socket.emit("queue-update", {
      queue: rooms[room].queue,
      currentVideoIndex: rooms[room].currentVideoIndex,
      currentTime: rooms[room].currentTime,
      isPlaying: rooms[room].isPlaying,
    });

    // Broadcast updated user list to all clients in the room
    io.in(room).emit("room-users", {
      users: rooms[room].users,
    });

    // Notify others that a new user joined
    socket.to(room).emit("user-joined", { username });
  });

  socket.on("queue-update", ({ room, queue, currentVideoIndex }) => {
    if (!room || queue == null || currentVideoIndex == null) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], queue: [], currentVideoIndex: -1, isPlaying: false };
    }

    rooms[room].queue = queue;
    rooms[room].currentVideoIndex = currentVideoIndex;

    // If queue is not empty and isPlaying is false, set isPlaying to true to enable autoplay on reload
    if (queue.length > 0 && !rooms[room].isPlaying) {
      rooms[room].isPlaying = true;
    }

    io.in(room).emit("queue-update", { queue, currentVideoIndex, isPlaying: rooms[room].isPlaying });
  });

  socket.on("video-change", ({ room, videoId, username }) => {
    if (!room || !videoId || !username) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], queue: [], currentVideoIndex: 0 };
    }
    // Update currentVideoIndex based on videoId in queue
    const index = rooms[room].queue.findIndex((v) => v.videoId === videoId);
    if (index !== -1) {
      rooms[room].currentVideoIndex = index;
      // Broadcast updated queue and currentVideoIndex to all clients including sender
      io.in(room).emit("queue-update", {
        queue: rooms[room].queue,
        currentVideoIndex: rooms[room].currentVideoIndex,
      });
    }
  });

  socket.on("play", ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], queue: [], currentVideoIndex: -1, currentTime: 0, isPlaying: false };
    }

    rooms[room].currentTime = time;
    rooms[room].isPlaying = true;

    console.log(`[${username}] PLAY in room ${room} at ${time.toFixed(2)}s`);
    socket.to(room).emit("play", { time, username });
  });

  socket.on("pause", ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], queue: [], currentVideoIndex: -1, currentTime: 0, isPlaying: false };
    }

    rooms[room].currentTime = time;
    rooms[room].isPlaying = false;

    console.log(`[${username}] PAUSE in room ${room} at ${time.toFixed(2)}s`);
    socket.to(room).emit("pause", { time, username });
  });

  socket.on("sync-response", ({ room, time, username }) => {
    if (!room || time == null || !username) return;

    console.log(
      `[${username}] SYNC-RESPONSE to room ${room} at ${time.toFixed(2)}s`
    );
    socket.to(room).emit("sync-response", { time, username });
  });

  // Chat messages
  socket.on("chat-message", ({ room, username, message, timestamp }) => {
    if (!room || !username || !message) return;

    console.log(`[${username}] MESSAGE in room ${room}: ${message}`);
    socket.to(room).emit("chat-message", { username, message, timestamp });
  });

  // Emoji reactions
  socket.on("emoji-reaction", ({ room, username, emoji }) => {
    if (!room || !username || !emoji) return;

    console.log(`[${username}] EMOJI in room ${room}: ${emoji}`);
    socket.to(room).emit("emoji-reaction", { username, emoji });
  });

  // WebRTC signaling
  socket.on("offer", ({ offer, room, sender }) => {
    if (!offer || !room) return;
    socket.to(room).emit("offer", { offer, sender });
  });

  socket.on("answer", ({ answer, room }) => {
    if (!answer || !room) return;
    socket.to(room).emit("answer", { answer });
  });

  socket.on("ice-candidate", ({ candidate, room }) => {
    if (!candidate || !room) return;
    socket.to(room).emit("ice-candidate", { candidate });
  });

  socket.on("seek", ({ time, username, room }) => {
    if (!room || time == null || !username) return;

    if (!rooms[room]) {
      rooms[room] = { users: [], queue: [], currentVideoIndex: -1, currentTime: 0, isPlaying: false };
    }

    rooms[room].currentTime = time;

    console.log(`[${username}] SEEK to ${time.toFixed(2)}s in room ${room}`);
    socket.to(room).emit("seek", { time, username });
  });

  socket.on("client-log", (message) => {
    console.log(`[Client Log]: ${message}`);
  });

  socket.on("disconnect", () => {
    const { room, username } = socket;
    if (room && username && rooms[room]) {
      console.log(`[${username}] disconnected from room ${room}`);

      // Remove user from room
      rooms[room].users = rooms[room].users.filter((user) => user !== username);

      // Notify others that user left
      socket.to(room).emit("user-left", { username });

      // Update user list for remaining users
      io.in(room).emit("room-users", {
        users: rooms[room].users,
      });

      // Optional cleanup: delete room if empty
      if (rooms[room].users.length === 0) {
        delete rooms[room];
      }
    }
  });
});

// Start Server
server.listen(port, () => {
  console.log(`VibeRoom server running at http://localhost:${port}`);
  console.log(`Make sure to set your YOUTUBE_API_KEY in the .env file`);
});