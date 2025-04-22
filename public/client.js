let player;
let localStream;
let peerConnection;
let isSyncing = false;
let autoPlayEnabled = false;

const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

// Dynamically add Auto Play toggle button to UI
window.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.container');
  if (container) {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.margin = '10px 0';
    label.style.fontWeight = 'bold';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'autoPlayToggle';

    checkbox.addEventListener('change', (e) => {
      autoPlayEnabled = e.target.checked;
      console.log(`Auto Play is now ${autoPlayEnabled ? 'enabled' : 'disabled'}`);
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' Auto Play'));

    container.insertBefore(label, container.firstChild);
  }
});

// Get room and username from URL
const urlParams = new URLSearchParams(window.location.search);
const username = urlParams.get('username') || `User${Math.floor(Math.random() * 1000)}`;
const room = urlParams.get('room');

const socket = io();

if (room && username) {
  socket.emit('join-room', { room, username });
}


let videoQueue = [];
let currentVideoIndex = -1;

const popularSearches = [
  "Music",
  "News",
  "Gaming",
  "Sports",
  "Movies",
  "Technology",
  "Comedy",
  "Education",
  "Live",
  "Trending"
];

const youtubeSearchInput = document.getElementById('youtubeSearchInput');
const autocompleteList = document.createElement('ul');
autocompleteList.style.position = 'absolute';
autocompleteList.style.backgroundColor = 'white';
autocompleteList.style.border = '1px solid #ccc';
autocompleteList.style.listStyle = 'none';
autocompleteList.style.padding = '0';
autocompleteList.style.margin = '0';
autocompleteList.style.maxHeight = '150px';
autocompleteList.style.overflowY = 'auto';
autocompleteList.style.width = youtubeSearchInput.offsetWidth + 'px';
autocompleteList.style.zIndex = '1000';
youtubeSearchInput.parentNode.style.position = 'relative';
youtubeSearchInput.parentNode.appendChild(autocompleteList);

youtubeSearchInput.addEventListener('input', () => {
  const query = youtubeSearchInput.value.toLowerCase();
  autocompleteList.innerHTML = '';
  if (!query) {
    autocompleteList.style.display = 'none';
    return;
  }
  const filtered = popularSearches.filter(item => item.toLowerCase().startsWith(query));
  if (filtered.length === 0) {
    autocompleteList.style.display = 'none';
    return;
  }
  filtered.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    li.style.padding = '5px 10px';
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      youtubeSearchInput.value = item;
      autocompleteList.style.display = 'none';
      performSearch(item);
    });
    autocompleteList.appendChild(li);
  });
  autocompleteList.style.display = 'block';
});

youtubeSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    autocompleteList.style.display = 'none';
    const query = youtubeSearchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  }
});


async function performSearch(query) {
  try {
    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      // Instead of replacing the queue, emit the new queue to the server
      const newQueue = [];
      data.items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const thumbnail = item.snippet.thumbnails.default.url;
        if (!newQueue.find(v => v.videoId === videoId)) {
          newQueue.push({ videoId, title, thumbnail });
        }
      });
      // Emit queue update to server with new queue and reset currentVideoIndex to 0
      socket.emit('queue-update', { room, queue: newQueue, currentVideoIndex: 0 });
    } else {
      const resultsList = document.getElementById('youtubeResults');
      resultsList.innerHTML = '<li>No YouTube videos found</li>';
    }
  } catch (error) {
    console.error('Error searching YouTube:', error);
    alert('Failed to search YouTube.');
  }
}

// Listen for queue updates from server
socket.on('queue-update', ({ queue, currentVideoIndex: newIndex }) => {
  videoQueue = queue;
  currentVideoIndex = newIndex;
  updateQueueUI();
  playVideoAtIndex(currentVideoIndex, true); // Sync playback
});


// Listen for video change events from server
socket.on('video-change', ({ videoId, username: sender }) => {
  if (sender !== username) {
    const index = videoQueue.findIndex(v => v.videoId === videoId);
    if (index !== -1 && index !== currentVideoIndex) {
      currentVideoIndex = index;
      playVideoAtIndex(currentVideoIndex);
      console.log(`[${username}] Synced video change from ${sender} to videoId ${videoId}`);
    }
  }
});

function addVideoToQueue(videoId) {
  if (!videoQueue.includes(videoId)) {
    videoQueue.push(videoId);
    updateQueueUI();
    updateControlButtons();
  }
}

function playVideoAtIndex(index, autoplay = true) {
  if (index < 0 || index >= videoQueue.length) return;
  currentVideoIndex = index;
  const videoId = videoQueue[index].videoId;
  if (player) {
    player.loadVideoById(videoId);
    if (autoplay) {
      player.playVideo();
    } else {
      player.pauseVideo();
    }
    player.setVolume(document.getElementById('volumeSlider').value);
  } else {
    onYouTubeIframeAPIReady(videoId);
  }
  updateQueueUI();
  updateControlButtons();
  // Removed socket.emit('video-change') to unify state management
}

function updateQueueUI() {
  const resultsList = document.getElementById('youtubeResults');
  resultsList.innerHTML = '';
  videoQueue.forEach(({ videoId, title, thumbnail }, index) => {
    const li = document.createElement('li');
    li.style.padding = '8px';
    li.style.borderBottom = '1px solid #ccc';
    li.style.cursor = 'pointer';
    li.style.backgroundColor = index === currentVideoIndex ? '#d3d3d3' : 'transparent';

    const img = document.createElement('img');
    img.src = thumbnail;
    img.alt = title;
    img.style.width = '60px';
    img.style.height = '45px';
    img.style.objectFit = 'cover';
    img.style.marginRight = '10px';
    img.style.verticalAlign = 'middle';

    const span = document.createElement('span');
    span.textContent = title;

    li.appendChild(img);
    li.appendChild(span);

    // 🔁 This emits to everyone in the room to sync the clicked video
    li.onclick = () => {
      socket.emit('queue-update', {
        room,
        queue: videoQueue,
        currentVideoIndex: index
      });
    };

    resultsList.appendChild(li);
  });
}


function playNext() {
  if (currentVideoIndex + 1 < videoQueue.length) {
    currentVideoIndex = currentVideoIndex + 1;
    socket.emit('queue-update', { room, queue: videoQueue, currentVideoIndex });
  }
}

// Add YouTube player error handling to skip unavailable videos
function onPlayerError(event) {
  console.warn(`YouTube Player Error: ${event.data}`);
  // Error codes: 2, 5, 100, 101, 150
  // Skip to next video on error
  if (currentVideoIndex + 1 < videoQueue.length) {
    currentVideoIndex = currentVideoIndex + 1;
    socket.emit('queue-update', { room, queue: videoQueue, currentVideoIndex });
  } else {
    console.log('No more videos to skip to.');
  }
}

function playPrevious() {
  if (currentVideoIndex - 1 >= 0) {
    currentVideoIndex = currentVideoIndex - 1;
    socket.emit('queue-update', { room, queue: videoQueue, currentVideoIndex });
  }
}


// --- YOUTUBE API SETUP ---
function onYouTubeIframeAPIReady(videoId) {
  if (!videoId) {
    // Do not load default video
    return;
  }
  player = new YT.Player('ytplayer', {
    height: '315',
    width: '560',
    videoId: videoId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      modestbranding: 1
    },
    events: {
      onReady: (event) => {
        player.setVolume(30);
        console.log(`[${username}] YouTube Player ready`);
        updateControlButtons();
      },
      onStateChange: onPlayerStateChange
    }
  });
}

function updateControlButtons() {
  const playBtn = document.querySelector('button[onclick="playSong()"]');
  const pauseBtn = document.querySelector('button[onclick="pauseSong()"]');
  const prevBtn = document.querySelector('button[onclick="playPrevious()"]');
  const nextBtn = document.querySelector('button[onclick="playNext()"]');

  if (videoQueue.length === 0) {
    playBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    return;
  }

  // Show play and pause if a video is loaded
  playBtn.style.display = 'inline-block';
  pauseBtn.style.display = 'inline-block';

  // Show prev if there is a previous video
  if (currentVideoIndex > 0) {
    prevBtn.style.display = 'inline-block';
  } else {
    prevBtn.style.display = 'none';
  }

  // Show next if there is a next video
  if (currentVideoIndex < videoQueue.length - 1) {
    nextBtn.style.display = 'inline-block';
  } else {
    nextBtn.style.display = 'none';
  }
}

function playSong() {
  if (!player) return;
  const currentTime = player.getCurrentTime();
  player.playVideo();
  socket.emit('play', { room, username, time: currentTime });
}

function pauseSong() {
  if (!player) return;
  const currentTime = player.getCurrentTime();
  player.pauseVideo();
  socket.emit('pause', { room, username, time: currentTime });
}

let lastSentTime = 0;

// Custom Player State Change Handler
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    const currentTime = player.getCurrentTime();
    const diff = Math.abs(currentTime - lastSentTime);

    if (diff > 1.0) {
      socket.emit('seek', { room, username, time: currentTime });
      lastSentTime = currentTime;
    }
  } else if (event.data === YT.PlayerState.ENDED) {
    // Auto play next video if enabled
    if (autoPlayEnabled && currentVideoIndex + 1 < videoQueue.length) {
      currentVideoIndex = currentVideoIndex + 1;
      socket.emit('queue-update', { room, queue: videoQueue, currentVideoIndex });
    }
  }
}

// Fast Seek Sync: every 0.5 sec
setInterval(() => {
  if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
    const currentTime = player.getCurrentTime();
    const diff = Math.abs(currentTime - lastSentTime);
    if (!isSyncing && diff > 0.5) {
      socket.emit('seek', { room, username, time: currentTime });
      lastSentTime = currentTime;
    }
  }
}, 500);

// --- SYNC EVENTS FROM SERVER ---
socket.on('play', ({ username: sender, time }) => {
  if (sender !== username) {
    player.seekTo(time, true);
    player.playVideo();
    console.log(`[${username}] Synced play from ${sender} at ${time}s`);
  }
});

socket.on('pause', ({ username: sender, time }) => {
  if (sender !== username) {
    player.seekTo(time, true);
    player.pauseVideo();
    console.log(`[${username}] Synced pause from ${sender} at ${time}s`);
  }
});

socket.on("seek", ({ time, username: sender }) => {
  if (sender !== username && player) {
    isSyncing = true;
    player.seekTo(time, true);
    console.log(`🔄 Synced to ${time}s from ${sender}`);
    setTimeout(() => (isSyncing = false), 500);
  }
});

// --- VOICE CALL ---
async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice-candidate', { room, candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = new MediaStream([event.track]);
      document.getElementById('remoteAudio').srcObject = remoteStream;
      console.log(`[${username}] Receiving audio from peer`);
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { room, offer });

    console.log(`[${username}] Sent offer`);
  } catch (err) {
    console.error(`[${username}] Error in startCall:`, err);
    alert('Error starting voice call: ' + err.message + '. Please check microphone permissions and try again.');
  }
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  document.getElementById('remoteAudio').srcObject = null;
  console.log(`[${username}] Call ended`);
}

socket.on('offer', async ({ offer }) => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('ice-candidate', { room, candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = new MediaStream([event.track]);
      document.getElementById('remoteAudio').srcObject = remoteStream;
      console.log(`[${username}] Receiving audio from peer`);
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { room, answer });

    console.log(`[${username}] Sent answer`);
  } catch (err) {
    console.error(`[${username}] Error handling offer:`, err);
  }
});

socket.on('answer', async ({ answer }) => {
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log(`[${username}] Received answer`);
  } catch (err) {
    console.error(`[${username}] Error setting answer:`, err);
  }
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(`[${username}] Added ICE candidate`);
  } catch (err) {
    console.error(`[${username}] Error adding ICE candidate`, err);
  }
});

// --- JOIN ROOM HANDLER ---
function joinRoom() {
  const roomId = document.getElementById('roomInput').value;
  if (roomId) {
    const user = prompt("Enter your name:");
    window.location.href = `/room.html?room=${roomId}&username=${user}`;
  }
}
