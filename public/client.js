// Global variables
let player
let localStream
let peerConnection
let isSyncing = false
let autoPlayEnabled = false
const isCallActive = false
let videoQueue = []
let currentVideoIndex = -1
let isDragging = false
let progressUpdateInterval
let isTheaterMode = false
let isFullscreen = false
let unreadMessages = 0
const userColors = {}
const userInitials = {}

// Get room and username from URL
const urlParams = new URLSearchParams(window.location.search)
const username = urlParams.get("username") || `User${Math.floor(Math.random() * 1000)}`
const room = urlParams.get("room") || "default-room"

// WebRTC configuration
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
}

const deployedServerUrl = window.location.origin // Use current origin for socket connection

// Initialize socket connection with explicit URL and logging
const socket = io(deployedServerUrl, {
  transports: ["websocket"],
  secure: true,
  reconnectionAttempts: 5,
  timeout: 10000,
})

socket.on("connect", () => {
  console.log("[Socket.IO] Connected to server:", socket.id)
})

socket.on("connect_error", (error) => {
  console.error("[Socket.IO] Connection error:", error)
})

socket.on("disconnect", (reason) => {
  console.warn("[Socket.IO] Disconnected:", reason)
})

socket.on("reconnect_attempt", (attempt) => {
  console.log("[Socket.IO] Reconnect attempt:", attempt)
})

socket.on("reconnect_failed", () => {
  console.error("[Socket.IO] Reconnect failed")
})

// Wrap RTCPeerConnection to add logging for ICE connection state changes
const originalRTCPeerConnection = window.RTCPeerConnection
window.RTCPeerConnection = (config) => {
  const pc = new originalRTCPeerConnection(config)

  pc.addEventListener("iceconnectionstatechange", () => {
    console.log("[WebRTC] ICE connection state:", pc.iceConnectionState)
  })

  pc.addEventListener("icecandidateerror", (event) => {
    console.error("[WebRTC] ICE candidate error:", event)
  })

  return pc
}

// DOM Elements
const volumeSlider = document.getElementById("volumeSlider")
const autoPlayToggle = document.getElementById("autoPlayToggle")
const searchButton = document.getElementById("searchButton")
const searchInput = document.getElementById("youtubeSearchInput")
const searchResults = document.getElementById("searchResults")
const queueList = document.getElementById("youtubeResults")
const videoOverlay = document.getElementById("videoOverlay")
const currentTitle = document.getElementById("currentTitle")
const currentThumbnail = document.getElementById("currentThumbnail")
const syncIndicator = document.getElementById("syncIndicator")
const syncStatus = document.getElementById("syncStatus")
const roomNameElement = document.getElementById("roomName")
const userNameElement = document.getElementById("userName")
const userAvatarElement = document.getElementById("userAvatar")
const onlineCountElement = document.getElementById("onlineCount")
const activeUsersElement = document.getElementById("activeUsers")
const queueCountElement = document.getElementById("queueCount")
const clearQueueBtn = document.getElementById("clearQueueBtn")
const leaveRoomBtn = document.getElementById("leaveRoomBtn")
const startCallBtn = document.getElementById("startCallBtn")
const endCallBtn = document.getElementById("endCallBtn")
const progressBar = document.querySelector(".progress-bar")
const progressBarFill = document.querySelector(".progress-bar-fill")
const progressBarHandle = document.querySelector(".progress-bar-handle")
const currentTimeDisplay = document.querySelector(".current-time")
const totalTimeDisplay = document.querySelector(".total-time")
const chatMessages = document.getElementById("chatMessages")
const chatInput = document.getElementById("chatInput")
const sendMessageBtn = document.getElementById("sendMessageBtn")
const emojiButtons = document.querySelectorAll(".emoji-button")
const theaterModeBtn = document.getElementById("theaterModeBtn")
const fullscreenBtn = document.getElementById("fullscreenBtn")
const unreadBadge = document.getElementById("unreadBadge")
const themeSelect = document.getElementById("themeSelect")
const autoplayToggle = document.getElementById("autoplayToggle")
const qualitySelect = document.getElementById("qualitySelect")

// Initialize the application
function initApp() {
  // Set room and user information
  roomNameElement.textContent = room
  userNameElement.textContent = username

  // Generate user avatar with initials
  const initials = getInitials(username)
  userInitials[username] = initials
  userAvatarElement.textContent = initials

  // Generate a random color for the user
  const userColor = getRandomColor()
  userColors[username] = userColor
  userAvatarElement.style.backgroundColor = userColor

  // Join the room
  socket.emit("join-room", { room, username })

  // Setup event listeners
  setupEventListeners()

  // Initialize theme
  initializeTheme()

  // Initialize sidebar navigation
  initSidebarNavigation()

  // Show notification
  showNotification("Welcome to VibeRoom", `You've joined room "${room}"`, "fa-music")
}

// Setup event listeners
function setupEventListeners() {
  // Volume slider
  volumeSlider.addEventListener("input", () => {
    if (player) {
      player.setVolume(volumeSlider.value)
    }
  })

  // Auto play toggle
  autoPlayToggle.addEventListener("change", () => {
    autoPlayEnabled = autoPlayToggle.checked
    autoplayToggle.checked = autoPlayToggle.checked
  })

  // Settings autoplay toggle
  autoplayToggle.addEventListener("change", () => {
    autoPlayEnabled = autoplayToggle.checked
    autoPlayToggle.checked = autoplayToggle.checked
  })

  // Search button
  searchButton.addEventListener("click", () => {
    const query = searchInput.value.trim()
    if (query) {
      performSearch(query)
    }
  })

  // Search input (Enter key)
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim()
      if (query) {
        performSearch(query)
      }
    }
  })

  // Clear queue button
  clearQueueBtn.addEventListener("click", () => {
    if (videoQueue.length > 0) {
      if (confirm("Are you sure you want to clear the queue?")) {
        socket.emit("queue-update", { room, queue: [], currentVideoIndex: -1 })
      }
    }
  })

  // Leave room button
  leaveRoomBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to leave this room?")) {
      endCall()
      window.location.href = "/"
    }
  })

  // Progress bar events
  progressBar.addEventListener("mousedown", startSeeking)
  document.addEventListener("mousemove", seeking)
  document.addEventListener("mouseup", endSeeking)

  // Touch events for mobile
  progressBar.addEventListener("touchstart", startSeeking)
  document.addEventListener("touchmove", seeking)
  document.addEventListener("touchend", endSeeking)

  // Chat input
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  })

  // Send message button
  sendMessageBtn.addEventListener("click", sendChatMessage)

  // Emoji reactions
  emojiButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const emoji = button.getAttribute("data-emoji")
      sendEmojiReaction(emoji)
    })
  })

  // Theater mode button
  theaterModeBtn.addEventListener("click", toggleTheaterMode)

  // Fullscreen button
  fullscreenBtn.addEventListener("click", toggleFullscreen)

  // Theme selector
  themeSelect.addEventListener("change", () => {
    setTheme(themeSelect.value)
  })

  // Quality selector
  qualitySelect.addEventListener("change", () => {
    if (player) {
      const quality = qualitySelect.value
      if (quality === "hd") {
        player.setPlaybackQuality("hd720")
      } else if (quality === "fullhd") {
        player.setPlaybackQuality("hd1080")
      } else {
        player.setPlaybackQuality("auto")
      }
    }
  })

  // Keyboard shortcuts
  document.addEventListener("keydown", handleKeyboardShortcuts)
}

// Initialize sidebar navigation
function initSidebarNavigation() {
  // Create sidebar navigation elements if they don't exist
  if (!document.querySelector(".sidebar-navigation")) {
    const sidebarNavigation = document.createElement("div")
    sidebarNavigation.className = "sidebar-navigation"

    // Create arrow button
    const arrowButton = document.createElement("button")
    arrowButton.id = "sidebarArrowBtn"
    arrowButton.className = "sidebar-arrow-button"
    arrowButton.innerHTML = '<i class="fas fa-chevron-right"></i>'

    // Create dropdown menu
    const dropdown = document.createElement("div")
    dropdown.className = "sidebar-dropdown"

    // Add dropdown items
    const panels = ["queue", "chat", "settings"]
    const icons = ["fa-music", "fa-comment", "fa-cog"]
    const labels = ["Queue", "Chat", "Settings"]

    panels.forEach((panel, index) => {
      const item = document.createElement("div")
      item.className = "dropdown-item"
      item.dataset.panel = panel
      item.innerHTML = `<i class="fas ${icons[index]}"></i><span>${labels[index]}</span>`
      dropdown.appendChild(item)
    })

    // Append dropdown to sidebar navigation
    sidebarNavigation.appendChild(dropdown)

    // Append sidebar navigation to body
    document.body.appendChild(sidebarNavigation)

    // Append arrow button directly to body (outside sidebar container)
    document.body.appendChild(arrowButton)

    // Add event listeners
    setupSidebarNavigationEvents()
  }
}

// Setup sidebar navigation events
function setupSidebarNavigationEvents() {
  const sidebarArrowBtn = document.getElementById("sidebarArrowBtn")
  const sidebarDropdown = document.querySelector(".sidebar-dropdown")
  const dropdownItems = document.querySelectorAll(".dropdown-item")
  const sidebarContainer = document.querySelector(".sidebar-container")

  // Show dropdown on hover
  sidebarArrowBtn.addEventListener("mouseenter", () => {
    sidebarDropdown.classList.add("show")
  })

  // Hide dropdown when mouse leaves the navigation area
  document.querySelector(".sidebar-navigation").addEventListener("mouseleave", () => {
    sidebarDropdown.classList.remove("show")
  })

  // Toggle sidebar on arrow button click
  sidebarArrowBtn.addEventListener("click", () => {
    const isCollapsed = document.body.classList.contains("sidebar-collapsed")
    toggleSidebar(!isCollapsed)
  })

  // Handle dropdown item clicks
  dropdownItems.forEach((item) => {
    item.addEventListener("click", () => {
      const panelId = item.dataset.panel

      // Show the selected panel
      document.querySelectorAll(".sidebar-panel").forEach((panel) => {
        panel.classList.remove("active")
      })

      document.getElementById(`${panelId}Panel`).classList.add("active")

      // Update active state in dropdown
      dropdownItems.forEach((dropItem) => {
        dropItem.classList.remove("active")
      })
      item.classList.add("active")

      // Expand sidebar if collapsed
      if (document.body.classList.contains("sidebar-collapsed")) {
        toggleSidebar(true)
      }

      // Reset unread count if chat panel
      if (panelId === "chat") {
        resetUnreadCount()
      }

      // Hide dropdown after selection
      sidebarDropdown.classList.remove("show")
    })
  })

  // Make sure sidebar panels have the correct data-panel attributes
  document.querySelectorAll(".sidebar-panel").forEach((panel, index) => {
    if (index === 0) panel.dataset.panel = "queue"
    if (index === 1) panel.dataset.panel = "chat"
    if (index === 2) panel.dataset.panel = "settings"
  })
}

// Toggle sidebar function
function toggleSidebar(open) {
  const sidebarContainer = document.querySelector(".sidebar-container")
  const arrowBtn = document.getElementById("sidebarArrowBtn")

  if (open) {
    document.body.classList.remove("sidebar-collapsed")
    if (arrowBtn) {
      arrowBtn.querySelector("i").classList.remove("fa-chevron-right")
      arrowBtn.querySelector("i").classList.add("fa-chevron-left")
    }
  } else {
    document.body.classList.add("sidebar-collapsed")
    if (arrowBtn) {
      arrowBtn.querySelector("i").classList.remove("fa-chevron-left")
      arrowBtn.querySelector("i").classList.add("fa-chevron-right")
    }
  }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Only handle shortcuts if not typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return
  }

  switch (e.key) {
    case " ": // Space bar
      e.preventDefault()
      if (player) {
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
          pauseSong()
        } else {
          playSong()
        }
      }
      break
    case "ArrowRight": // Right arrow
      if (player) {
        const currentTime = player.getCurrentTime()
        player.seekTo(currentTime + 10, true)
        socket.emit("seek", { room, username, time: currentTime + 10 })
      }
      break
    case "ArrowLeft": // Left arrow
      if (player) {
        const currentTime = player.getCurrentTime()
        player.seekTo(currentTime - 10, true)
        socket.emit("seek", { room, username, time: currentTime - 10 })
      }
      break
    case "f": // Fullscreen
    case "F":
      toggleFullscreen()
      break
    case "t": // Theater mode
    case "T":
      toggleTheaterMode()
      break
    case "m": // Mute
    case "M":
      if (player) {
        if (player.isMuted()) {
          player.unMute()
          volumeSlider.value = player.getVolume()
        } else {
          player.mute()
          volumeSlider.value = 0
        }
      }
      break
    case "b": // Toggle sidebar
    case "B":
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const isCollapsed = document.body.classList.contains("sidebar-collapsed")
        toggleSidebar(!isCollapsed)
      }
      break
  }
}

// Theme functions
function initializeTheme() {
  // Check for saved theme
  const savedTheme = localStorage.getItem("vibeRoomTheme") || "light"
  themeSelect.value = savedTheme
  setTheme(savedTheme)
}

function setTheme(theme) {
  if (theme === "system") {
    // Check system preference
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.body.classList.add("dark-theme")
    } else {
      document.body.classList.remove("dark-theme")
    }

    // Listen for changes in system preference
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (themeSelect.value === "system") {
        if (e.matches) {
          document.body.classList.add("dark-theme")
        } else {
          document.body.classList.remove("dark-theme")
        }
      }
    })
  } else if (theme === "dark") {
    document.body.classList.add("dark-theme")
  } else {
    document.body.classList.remove("dark-theme")
  }

  // Save preference
  localStorage.setItem("vibeRoomTheme", theme)
}

// Theater mode and fullscreen functions
function toggleTheaterMode() {
  isTheaterMode = !isTheaterMode
  document.body.classList.toggle("theater-mode", isTheaterMode)

  if (isTheaterMode) {
    theaterModeBtn.innerHTML = '<i class="fas fa-compress"></i>'
    theaterModeBtn.title = "Exit Theater Mode"
  } else {
    theaterModeBtn.innerHTML = '<i class="fas fa-tv"></i>'
    theaterModeBtn.title = "Theater Mode"
  }
}

function toggleFullscreen() {
  const videoContainer = document.querySelector(".video-container")

  if (!isFullscreen) {
    if (videoContainer.requestFullscreen) {
      videoContainer.requestFullscreen()
    } else if (videoContainer.webkitRequestFullscreen) {
      videoContainer.webkitRequestFullscreen()
    } else if (videoContainer.msRequestFullscreen) {
      videoContainer.msRequestFullscreen()
    }

    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>'
    fullscreenBtn.title = "Exit Fullscreen"
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }

    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>'
    fullscreenBtn.title = "Fullscreen"
  }

  isFullscreen = !isFullscreen
}

// Handle fullscreen change
document.addEventListener("fullscreenchange", handleFullscreenChange)
document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
document.addEventListener("mozfullscreenchange", handleFullscreenChange)
document.addEventListener("MSFullscreenChange", handleFullscreenChange)

function handleFullscreenChange() {
  isFullscreen = !!document.fullscreenElement

  if (isFullscreen) {
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>'
    fullscreenBtn.title = "Exit Fullscreen"
  } else {
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>'
    fullscreenBtn.title = "Fullscreen"
  }
}

// Socket event listeners
function setupSocketListeners() {
  // Room users update
  socket.on("room-users", ({ users }) => {
    updateActiveUsers(users)
    onlineCountElement.textContent = users.length
  })

  // Queue update
  socket.on("queue-update", ({ queue, currentVideoIndex: newIndex }) => {
    const previousIndex = currentVideoIndex
    videoQueue = queue
    currentVideoIndex = newIndex
    updateQueueUI()

    if (currentVideoIndex >= 0 && currentVideoIndex < videoQueue.length) {
      // Always play video at current index to ensure playback starts
      playVideoAtIndex(currentVideoIndex, true)
      hideVideoOverlay()
    } else {
      // Queue is empty or invalid index, stop player and clear video section
      if (player) {
        player.stopVideo()
      }
      // Stop visualizer animation when queue is empty
      stopVisualizer()
      // Reset ytplayer div content to empty with style user-select: auto
      const ytPlayer = document.getElementById("ytplayer")
      if (ytPlayer) {
        ytPlayer.innerHTML = ""
        ytPlayer.style.userSelect = "auto"
      }
      showVideoOverlay()
      updateNowPlayingInfo(null)
    }
  })

  // Play event
  socket.on("play", ({ username: sender, time }) => {
    if (sender !== username && player) {
      showSyncStatus(true, `Syncing with ${sender}...`)
      player.seekTo(time, true)
      player.playVideo()
      updateControlButtons()
      setTimeout(() => {
        showSyncStatus(false, "Synchronized")
      }, 1000)
    }
  })

  // Pause event
  socket.on("pause", ({ username: sender, time }) => {
    if (sender !== username && player) {
      showSyncStatus(true, `Syncing with ${sender}...`)
      player.seekTo(time, true)
      player.pauseVideo()
      updateControlButtons()
      setTimeout(() => {
        showSyncStatus(false, "Synchronized")
      }, 1000)
    }
  })

  // Seek event
  socket.on("seek", ({ time, username: sender }) => {
    if (sender !== username && player) {
      isSyncing = true
      showSyncStatus(true, `Syncing with ${sender}...`)
      player.seekTo(time, true)
      setTimeout(() => {
        isSyncing = false
        showSyncStatus(false, "Synchronized")
      }, 1000)
    }
  })

  // User joined notification
  socket.on("user-joined", ({ username: joinedUser }) => {
    if (joinedUser !== username) {
      showNotification("User Joined", `${joinedUser} has joined the room`, "fa-user-plus")
      addSystemMessage(`${joinedUser} has joined the room`)
    }
  })

  // User left notification
  socket.on("user-left", ({ username: leftUser }) => {
    showNotification("User Left", `${leftUser} has left the room`, "fa-user-minus")
    addSystemMessage(`${leftUser} has left the room`)
  })

  // Chat message
  socket.on("chat-message", ({ username: sender, message, timestamp }) => {
    addChatMessage(sender, message, timestamp)

    // Increment unread count if not on chat tab
    if (!document.querySelector('.sidebar-panel[data-panel="chat"]').classList.contains("active")) {
      incrementUnreadCount()
    }
  })

  // Emoji reaction
  socket.on("emoji-reaction", ({ username: sender, emoji }) => {
    showEmojiReaction(emoji, sender)
  })

  // WebRTC signaling
  socket.on("offer", async ({ offer, sender }) => {
    try {
      showNotification("Voice Chat", `${sender} is calling...`, "fa-phone")
      await handleIncomingCall(offer)
    } catch (err) {
      console.error("Error handling offer:", err)
    }
  })

  socket.on("answer", async ({ answer }) => {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
    } catch (err) {
      console.error("Error setting answer:", err)
    }
  })

  socket.on("ice-candidate", async ({ candidate }) => {
    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (err) {
      console.error("Error adding ICE candidate:", err)
    }
  })
}

// Unread messages functions
function incrementUnreadCount() {
  unreadMessages++
  updateUnreadBadge()
}

function resetUnreadCount() {
  unreadMessages = 0
  updateUnreadBadge()
}

function updateUnreadBadge() {
  unreadBadge.textContent = unreadMessages

  if (unreadMessages > 0) {
    unreadBadge.classList.add("visible")
  } else {
    unreadBadge.classList.remove("visible")
  }
}

// Video progress bar functions
function startSeeking(e) {
  e.preventDefault()
  if (!player) return

  isDragging = true
  seeking(e)
}

function seeking(e) {
  if (!isDragging || !player) return

  e.preventDefault()

  const progressBarRect = progressBar.getBoundingClientRect()
  let clientX

  if (e.type.startsWith("touch")) {
    clientX = e.touches[0].clientX
  } else {
    clientX = e.clientX
  }

  const clickPosition = (clientX - progressBarRect.left) / progressBarRect.width
  const seekTime = player.getDuration() * Math.max(0, Math.min(1, clickPosition))

  // Update UI
  updateProgressBar(seekTime, player.getDuration())
}

function endSeeking(e) {
  if (!isDragging || !player) return

  e.preventDefault()

  const progressBarRect = progressBar.getBoundingClientRect()
  let clientX

  if (e.type.startsWith("touch")) {
    clientX = e.changedTouches[0].clientX
  } else {
    clientX = e.clientX
  }

  const clickPosition = (clientX - progressBarRect.left) / progressBarRect.width
  const seekTime = player.getDuration() * Math.max(0, Math.min(1, clickPosition))

  // Seek to position
  player.seekTo(seekTime, true)

  // Emit seek event to sync with others
  socket.emit("seek", { room, username, time: seekTime })

  isDragging = false
}

function updateProgressBar(currentTime, duration) {
  if (!progressBarFill || !progressBarHandle) return

  const percent = (currentTime / duration) * 100
  progressBarFill.style.width = `${percent}%`
  progressBarHandle.style.left = `${percent}%`

  // Update time displays
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(currentTime)
  }

  if (totalTimeDisplay) {
    totalTimeDisplay.textContent = formatTime(duration)
  }
}

function formatTime(seconds) {
  seconds = Math.floor(seconds)
  const minutes = Math.floor(seconds / 60)
  seconds = seconds % 60
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
}

function startProgressUpdater() {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval)
  }

  progressUpdateInterval = setInterval(() => {
    if (player && !isDragging) {
      const currentTime = player.getCurrentTime() || 0
      const duration = player.getDuration() || 0
      updateProgressBar(currentTime, duration)
    }
  }, 100)
}

function stopProgressUpdater() {
  if (progressUpdateInterval) {
    clearInterval(progressUpdateInterval)
    progressUpdateInterval = null
  }
}

// YouTube API functions
function onYouTubeIframeAPIReady() {
  // YouTube API is ready, but we'll create the player when a video is selected
  console.log("YouTube API ready")
}

function createYouTubePlayer(videoId) {
  if (player) {
    player.loadVideoById(videoId)
    return
  }

  player = new YT.Player("ytplayer", {
    height: "100%",
    width: "100%",
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      controls: 0, // We'll use our custom controls
      rel: 0,
      modestbranding: 1,
      fs: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  })
}

function onPlayerReady(event) {
  event.target.setVolume(volumeSlider.value)
  updateControlButtons()
  startProgressUpdater()

  // Set quality if specified
  const quality = qualitySelect.value
  if (quality === "hd") {
    player.setPlaybackQuality("hd720")
  } else if (quality === "fullhd") {
    player.setPlaybackQuality("hd1080")
  }
}

let lastSentTime = 0
function onPlayerStateChange(event) {
  updateControlButtons()

  if (event.data === YT.PlayerState.PLAYING) {
    const currentTime = player.getCurrentTime()
    const diff = Math.abs(currentTime - lastSentTime)

    if (diff > 0.5 && !isSyncing) {
      socket.emit("seek", { room, username, time: currentTime })
      lastSentTime = currentTime
    }

    // Start visualizer animation
    startVisualizer()
    startProgressUpdater()
  } else if (event.data === YT.PlayerState.PAUSED) {
    // Stop visualizer animation
    stopVisualizer()
  } else if (event.data === YT.PlayerState.ENDED) {
    stopVisualizer()
    stopProgressUpdater()

    // Auto play next video if enabled
    if (autoPlayEnabled && currentVideoIndex + 1 < videoQueue.length) {
      currentVideoIndex = currentVideoIndex + 1
      socket.emit("queue-update", {
        room,
        queue: videoQueue,
        currentVideoIndex,
      })
    }
  }
}

function onPlayerError(event) {
  console.warn(`YouTube Player Error: ${event.data}`)
  showNotification(
    "Playback Error",
    "There was an error playing this video. Skipping to next...",
    "fa-exclamation-triangle",
  )

  // Skip to next video on error
  if (currentVideoIndex + 1 < videoQueue.length) {
    currentVideoIndex = currentVideoIndex + 1
    socket.emit("queue-update", { room, queue: videoQueue, currentVideoIndex })
  } else {
    showVideoOverlay()
  }
}

// Video control functions
function playSong() {
  if (!player) return
  const currentTime = player.getCurrentTime()
  player.playVideo()
  socket.emit("play", { room, username, time: currentTime })
  showNotification("Playback", `${username} started playback`, "fa-play")
}

function pauseSong() {
  if (!player) return
  const currentTime = player.getCurrentTime()
  player.pauseVideo()
  socket.emit("pause", { room, username, time: currentTime })
  showNotification("Playback", `${username} paused playback`, "fa-pause")
}

function playNext() {
  if (currentVideoIndex + 1 < videoQueue.length) {
    currentVideoIndex = currentVideoIndex + 1
    socket.emit("queue-update", { room, queue: videoQueue, currentVideoIndex })
    showNotification("Playback", `${username} skipped to next song`, "fa-step-forward")
  }
}

function playPrevious() {
  if (currentVideoIndex - 1 >= 0) {
    currentVideoIndex = currentVideoIndex - 1
    socket.emit("queue-update", { room, queue: videoQueue, currentVideoIndex })
    showNotification("Playback", `${username} went to previous song`, "fa-step-backward")
  }
}

function playVideoAtIndex(index, autoplay = true) {
  if (index < 0 || index >= videoQueue.length) return

  const newVideoId = videoQueue[index].videoId
  currentVideoIndex = index

  if (player) {
    player.loadVideoById(newVideoId)
    if (autoplay) {
      player.playVideo()
    } else {
      player.pauseVideo()
    }
  } else {
    createYouTubePlayer(newVideoId)
  }

  updateQueueUI()
  updateControlButtons()
  updateNowPlayingInfo(videoQueue[index])
  hideVideoOverlay()
}

// Search and queue functions
async function performSearch(query) {
  try {
    // Show loading state
    searchResults.innerHTML = '<div class="search-loading">Searching...</div>'
    searchResults.classList.add("active")

    const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      displaySearchResults(data.items)
    } else {
      searchResults.innerHTML = '<div class="empty-search">No results found</div>'
    }
  } catch (error) {
    console.error("Error searching YouTube:", error)
    searchResults.innerHTML = '<div class="search-error">Failed to search YouTube</div>'
  }
}

function displaySearchResults(items) {
  searchResults.innerHTML = ""

  items.forEach((item) => {
    const videoId = item.id.videoId
    const title = item.snippet.title
    const thumbnail = item.snippet.thumbnails.medium.url
    const channelTitle = item.snippet.channelTitle

    const resultItem = document.createElement("div")
    resultItem.className = "search-result-item"
    resultItem.innerHTML = `
      <div class="search-result-thumbnail">
        <img src="${thumbnail}" alt="${title}">
      </div>
      <div class="search-result-info">
        <div class="search-result-title">${title}</div>
        <div class="search-result-channel">${channelTitle}</div>
      </div>
    `

    resultItem.addEventListener("click", () => {
      addVideoToQueue(videoId, title, thumbnail, channelTitle)
      searchResults.classList.remove("active")
    })

    searchResults.appendChild(resultItem)
  })
}

function addVideoToQueue(videoId, title, thumbnail, channelTitle) {
  // Check if video is already in queue
  if (videoQueue.some((item) => item.videoId === videoId)) {
    showNotification("Queue", "This video is already in the queue", "fa-info-circle")
    return
  }

  // Limit queue length to 10 videos
  if (videoQueue.length >= 10) {
    showNotification("Queue Limit", "You can only add up to 10 videos in the queue", "fa-exclamation-triangle")
    return
  }

  const newVideo = {
    videoId,
    title,
    thumbnail,
    channelTitle,
    addedBy: username,
  }

  const wasEmpty = videoQueue.length === 0
  const newQueue = [...videoQueue, newVideo]
  let newIndex = currentVideoIndex

  // If this is the first video, set index to 0
  if (newQueue.length === 1) {
    newIndex = 0
  }

  // If a video is currently playing, keep currentVideoIndex unchanged to avoid restarting
  // Only update currentVideoIndex if no video is playing (currentVideoIndex === -1)
  if (currentVideoIndex === -1) {
    newIndex = 0
  } else {
    newIndex = currentVideoIndex
  }

  socket.emit("queue-update", {
    room,
    queue: newQueue,
    currentVideoIndex: newIndex,
  })
  showNotification("Queue", `Added "${title}" to queue`, "fa-plus")

  // Hide overlay if this is the first video added
  if (newQueue.length === 1) {
    hideVideoOverlay()
  }

  // If queue was empty before adding, play the new video and update now playing info
  if (wasEmpty) {
    playVideoAtIndex(newIndex, true)
    updateNowPlayingInfo(newVideo)
  }
}

function updateQueueUI() {
  queueList.innerHTML = ""
  queueCountElement.textContent = videoQueue.length

  if (videoQueue.length === 0) {
    queueList.innerHTML = `
      <li class="empty-queue">
        <p>Your queue is empty. Search for videos to add.</p>
      </li>
    `
    return
  }

  videoQueue.forEach((video, index) => {
    const isActive = index === currentVideoIndex
    const queueItem = document.createElement("li")
    queueItem.className = `queue-item ${isActive ? "active" : ""}`

    queueItem.innerHTML = `
      <div class="queue-item-number">${index + 1}</div>
      <div class="queue-thumbnail">
        <img src="${video.thumbnail}" alt="${video.title}">
      </div>
      <div class="queue-info">
        <div class="queue-title">${video.title}</div>
        <div class="queue-added-by">Added by ${video.addedBy || "Unknown"}</div>
      </div>
      <div class="queue-actions">
        <button class="queue-action-button remove-btn" title="Remove from queue">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `

    // Play this video when clicked
    queueItem.addEventListener("click", (e) => {
      if (!e.target.closest(".queue-actions")) {
        // Update UI immediately
        playVideoAtIndex(index, true)
        // Emit socket event to sync with others
        socket.emit("queue-update", {
          room,
          queue: videoQueue,
          currentVideoIndex: index,
        })
        // Ensure now playing info updates even if index is same
        updateNowPlayingInfo(videoQueue[index])
      }
    })

    // Remove button
    const removeBtn = queueItem.querySelector(".remove-btn")
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        removeFromQueue(index)
      })
    }

    queueList.appendChild(queueItem)
  })
}

function removeFromQueue(index) {
  const newQueue = [...videoQueue]
  newQueue.splice(index, 1)

  let newIndex = currentVideoIndex

  // Adjust current index if needed
  if (newQueue.length === 0) {
    newIndex = -1
  } else if (index === currentVideoIndex) {
    // If removing current playing video, play the next one or previous if last
    newIndex = Math.min(index, newQueue.length - 1)
  } else if (index < currentVideoIndex) {
    // If removing a video before current, adjust index
    newIndex--
  }

  socket.emit("queue-update", {
    room,
    queue: newQueue,
    currentVideoIndex: newIndex,
  })
}

// Chat functions
function sendChatMessage() {
  const message = chatInput.value.trim()
  if (!message) return

  const timestamp = new Date().toISOString()
  socket.emit("chat-message", { room, username, message, timestamp })

  // Add message to UI
  addChatMessage(username, message, timestamp, true)

  // Clear input
  chatInput.value = ""
}

function addChatMessage(sender, message, timestamp, isOwnMessage = false) {
  const messageElement = document.createElement("div")
  messageElement.className = `chat-message ${isOwnMessage ? "own-message" : ""}`

  // Get or create user color and initials
  if (!userColors[sender]) {
    userColors[sender] = getRandomColor()
  }

  if (!userInitials[sender]) {
    userInitials[sender] = getInitials(sender)
  }

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  messageElement.innerHTML = `
    <div class="message-avatar" style="background-color: ${userColors[sender]}">
      ${userInitials[sender]}
    </div>
    <div class="message-content">
      <div class="message-bubble">
        ${message}
      </div>
      <div class="message-info">
        <span class="message-sender">${sender}</span>
        <span class="message-time">${formattedTime}</span>
      </div>
    </div>
  `

  chatMessages.appendChild(messageElement)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function addSystemMessage(message) {
  const messageElement = document.createElement("div")
  messageElement.className = "system-message"

  messageElement.innerHTML = `
    <div class="system-message-content">
      ${message}
    </div>
  `

  chatMessages.appendChild(messageElement)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// Emoji reactions
function sendEmojiReaction(emoji) {
  socket.emit("emoji-reaction", { room, username, emoji })
  showEmojiReaction(emoji, username)
}

function showEmojiReaction(emoji, sender) {
  // Create floating emoji element
  const reaction = document.createElement("div")
  reaction.className = "floating-emoji"
  reaction.textContent = emoji

  // Add username below emoji
  const usernameSpan = document.createElement("span")
  usernameSpan.textContent = sender
  usernameSpan.style.fontSize = "12px"
  usernameSpan.style.display = "block"
  usernameSpan.style.textAlign = "center"
  usernameSpan.style.marginTop = "5px"
  usernameSpan.style.color = "white"
  usernameSpan.style.textShadow = "0 0 2px rgba(0,0,0,0.5)"

  reaction.appendChild(usernameSpan)

  // Position randomly over the video player
  const videoContainer = document.querySelector(".video-container")
  const rect = videoContainer.getBoundingClientRect()

  const x = Math.random() * (rect.width - 50) + rect.left
  const y = Math.random() * (rect.height - 100) + rect.top

  reaction.style.position = "absolute"
  reaction.style.left = `${x}px`
  reaction.style.top = `${y}px`
  reaction.style.fontSize = "32px"
  reaction.style.zIndex = "1000"

  // Add to document
  document.body.appendChild(reaction)

  // Animate and remove after animation
  setTimeout(() => {
    reaction.remove()
  }, 3000)
}

// UI update functions
function updateControlButtons() {
  const playBtn = document.getElementById("playButton");
  const pauseBtn = document.getElementById("pauseButton");
  const prevBtn = document.getElementById("prevButton");
  const nextBtn = document.getElementById("nextButton");

  if (!player || videoQueue.length === 0) {
    playBtn.disabled = true;
    pauseBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  // Update play/pause buttons based on player state
  const playerState = player.getPlayerState();
  if (playerState === YT.PlayerState.PLAYING) {
    playBtn.style.display = "none";
    pauseBtn.style.display = "inline-block";
  } else {
    playBtn.style.display = "inline-block";
    pauseBtn.style.display = "none";
  }

  // Update prev/next buttons
  prevBtn.disabled = currentVideoIndex <= 0;
  nextBtn.disabled = currentVideoIndex >= videoQueue.length - 1;
}

function updateNowPlayingInfo(video) {
  if (!video) {
    currentTitle.textContent = "Nothing playing";
    // Clear thumbnail image and show neutral icon
    currentThumbnail.innerHTML = '<i class="fas fa-music"></i>';
    // Also clear the video player iframe src to remove thumbnail image
    const ytPlayer = document.getElementById("ytplayer");
    if (ytPlayer) {
      ytPlayer.innerHTML = "";
    }
    return;
  }

  currentTitle.textContent = video.title;
  currentThumbnail.innerHTML = `<img src="${video.thumbnail}" alt="${video.title}">`;
}

function showSyncStatus(isSyncing, message) {
  syncStatus.textContent = message;

  if (isSyncing) {
    syncIndicator.classList.add("syncing");
  } else {
    syncIndicator.classList.remove("syncing");
  }
}

function updateActiveUsers(users) {
  activeUsersElement.innerHTML = "";

  users.forEach((user) => {
    if (!userInitials[user]) {
      userInitials[user] = getInitials(user);
    }

    if (!userColors[user]) {
      userColors[user] = getRandomColor();
    }

    const userElement = document.createElement("div");
    userElement.className = "user-indicator";
    userElement.textContent = userInitials[user];
    userElement.style.backgroundColor = userColors[user];
    userElement.title = user;

    activeUsersElement.appendChild(userElement);
  });
}

function showVideoOverlay() {
  if (videoOverlay) {
    videoOverlay.style.display = "flex";
  }
}

function hideVideoOverlay() {
  if (videoOverlay) {
    videoOverlay.style.display = "none";
  }
}

// Voice chat functions
async function startCall() {
  if (isCallActive) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", { room, candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = new MediaStream([event.track]);
      document.getElementById("remoteAudio").srcObject = remoteStream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", { room, offer, sender: username });

    isCallActive = true;
    updateCallButtons(true);
    showNotification("Voice Chat", "Voice chat started", "fa-microphone");
  } catch (err) {
    console.error("Error starting call:", err);
    showNotification("Voice Chat Error", err.message, "fa-exclamation-circle");
  }
}

async function handleIncomingCall(offer) {
  if (isCallActive) return;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("ice-candidate", { room, candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteStream = new MediaStream([event.track]);
      document.getElementById("remoteAudio").srcObject = remoteStream;
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { room, answer });

    isCallActive = true;
    updateCallButtons(true);
  } catch (err) {
    console.error("Error handling incoming call:", err);
    showNotification("Voice Chat Error", err.message, "fa-exclamation-circle");
  }
}

function endCall() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  document.getElementById("remoteAudio").srcObject = null;
  isCallActive = false;
  updateCallButtons(false);
  showNotification("Voice Chat", "Voice chat ended", "fa-microphone-slash");
}

function updateCallButtons(isActive) {
  if (isActive) {
    startCallBtn.classList.add("disabled");
    endCallBtn.classList.remove("disabled");
  } else {
    startCallBtn.classList.remove("disabled");
    endCallBtn.classList.add("disabled");
  }
}

// Utility functions
function showNotification(title, message, icon) {
  const notificationsContainer = document.getElementById(
    "notificationsContainer"
  );

  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">
        <i class="fas ${icon}"></i>
      </div>
      <div class="notification-message">
        <div class="notification-title">${title}</div>
        <div class="notification-text">${message}</div>
      </div>
    </div>
  `;

  notificationsContainer.appendChild(notification);

  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getRandomColor() {
  const colors = [
    "#8e44ad",
    "#9b59b6",
    "#2980b9",
    "#3498db",
    "#16a085",
    "#27ae60",
    "#f39c12",
    "#e67e22",
    "#c0392b",
    "#e74c3c",
    "#1abc9c",
    "#2ecc71",
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}

// Music visualizer
let visualizerContainer;
const visualizerBars = [];
let visualizerAnimationId;

function createVisualizer() {
  if (visualizerContainer) return;

  visualizerContainer = document.createElement("div");
  visualizerContainer.className = "visualizer-container";

  // Create bars
  for (let i = 0; i < 50; i++) {
    const bar = document.createElement("div");
    bar.className = "visualizer-bar";
    visualizerContainer.appendChild(bar);
    visualizerBars.push(bar);
  }

  document.querySelector(".video-container").appendChild(visualizerContainer);
}

function startVisualizer() {
  if (!visualizerContainer) {
    createVisualizer();
  }

  visualizerContainer.style.display = "flex";
  animateVisualizer();
}

function stopVisualizer() {
  if (visualizerAnimationId) {
    cancelAnimationFrame(visualizerAnimationId);
    visualizerAnimationId = null;
  }

  if (visualizerContainer) {
    visualizerContainer.style.display = "none";
  }
}

function animateVisualizer() {
  visualizerBars.forEach((bar) => {
    const height = Math.floor(Math.random() * 30) + 5;
    bar.style.height = `${height}px`;
  });

  visualizerAnimationId = requestAnimationFrame(animateVisualizer);
}

// Document ready
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupSocketListeners();

  // Close search results when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !e.target.closest("#youtubeSearchInput") &&
      !e.target.closest("#searchButton")
    ) {
      searchResults.classList.remove("active");
    }
  });

  // Create mobile sidebar toggle for small screens
  if (window.innerWidth <= 768) {
    const mobileSidebarToggle = document.createElement("button");
    mobileSidebarToggle.className = "mobile-sidebar-toggle";
    mobileSidebarToggle.innerHTML = '<i class="fas fa-bars"></i>';
    mobileSidebarToggle.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar-container");
      sidebar.classList.toggle("active");
    });
    document.body.appendChild(mobileSidebarToggle);
  }

  // Define the missing initOrientationFeatures function
  window.initOrientationFeatures = function() {
    function enhanceOrientationExperience() {
      const isLandscape = window.innerWidth > window.innerHeight;

      // Adjust UI elements based on orientation
      if (isLandscape) {
        // Landscape optimizations
        const playerControls = document.querySelector('.player-controls');
        if (playerControls) {
          playerControls.style.display = 'flex';
          playerControls.style.justifyContent = 'center';
          playerControls.style.marginTop = '12px';
        }

        const visualizer = document.querySelector('.visualizer-container');
        if (visualizer) {
          visualizer.style.height = '120px';
        }
      } else {
        // Portrait optimizations
        const playerControls = document.querySelector('.player-controls');
        if (playerControls) {
          playerControls.style.display = '';
          playerControls.style.justifyContent = '';
          playerControls.style.marginTop = '';
        }

        const visualizer = document.querySelector('.visualizer-container');
        if (visualizer) {
          visualizer.style.height = '80px';
        }
      }
    }

    // Run on load and orientation change
    enhanceOrientationExperience();
    window.addEventListener('orientationchange', enhanceOrientationExperience);
    window.addEventListener('resize', enhanceOrientationExperience);
  };
});

document.addEventListener("DOMContentLoaded", () => {
  const emojiToggleBtn = document.getElementById("emojiToggleBtn");
  const emojiPopup = document.getElementById("emojiPopup");
  const videoOverlay = document.querySelector(".video-overlay");
  const roomContent = document.querySelector(".room-content");
  const chatSidebarTab = document.querySelector('.sidebar-tab[data-tab="queue"]');

  // Toggle emoji popup visibility
  emojiToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    emojiPopup.classList.toggle("hidden");
  });

  // Hide emoji popup when clicking outside
  document.addEventListener("click", () => {
    if (!emojiPopup.classList.contains("hidden")) {
      emojiPopup.classList.add("hidden");
    }
  });

  // Handle emoji button clicks
  emojiPopup.querySelectorAll(".emoji-button").forEach((button) => {
    button.addEventListener("click", (e) => {
      const emoji = e.currentTarget.getAttribute("data-emoji");
      sendEmojiReaction(emoji);

      // Hide popup after selection
      emojiPopup.classList.add("hidden");
    });
  });

  // Function to toggle sidebar collapsed and video overlay shrunk
  function toggleSidebar() {
    if (roomContent) {
      roomContent.classList.toggle("sidebar-collapsed");
    }
    if (videoOverlay) {
      videoOverlay.classList.toggle("shrunk");
      const overlayMessage = videoOverlay.querySelector(".overlay-message");
      if (overlayMessage) {
        overlayMessage.classList.toggle("shrunk");
      }
    }
  }

  // Add click listeners to chat sidebar tab and toggle sidebar button
  if (chatSidebarTab) {
    chatSidebarTab.addEventListener("click", () => {
      toggleSidebar();
    });
  }

});

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".room-header");
  let lastScrollTop = 0;

  window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop && scrollTop > 50) {
      // Scrolling down
      header.classList.add("scrolled-up");
    } else {
      // Scrolling up
      header.classList.remove("scrolled-up");
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  });
});


