// Emoji Reactions for VibeRoom
class EmojiReactions {
  constructor(container, socket, room, username) {
    this.container = container;
    this.socket = socket;
    this.room = room;
    this.username = username;
    this.emojis = ["👍", "❤️", "😂", "😮", "😢", "👏", "🔥", "🎵", "🎸", "🎧"];

    this.init();
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "emoji-reactions";
      document.body.appendChild(this.container);
    }

    // Style container
    this.container.style.display = "flex";
    this.container.style.flexWrap = "wrap";
    this.container.style.justifyContent = "center";
    this.container.style.gap = "10px";
    this.container.style.padding = "10px";
    this.container.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    this.container.style.borderRadius = "8px";
    this.container.style.marginTop = "10px";

    // Create emoji buttons
    this.createEmojiButtons();

    // Listen for emoji reactions from other users
    this.listenForReactions();
  }

  createEmojiButtons() {
    this.emojis.forEach((emoji) => {
      const button = document.createElement("button");
      button.className = "emoji-button";
      button.textContent = emoji;
      button.style.fontSize = "24px";
      button.style.width = "40px";
      button.style.height = "40px";
      button.style.borderRadius = "50%";
      button.style.border = "none";
      button.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
      button.style.cursor = "pointer";
      button.style.transition = "transform 0.2s ease";

      button.addEventListener("mouseover", () => {
        button.style.transform = "scale(1.1)";
      });

      button.addEventListener("mouseout", () => {
        button.style.transform = "scale(1)";
      });

      button.addEventListener("click", () => {
        this.sendReaction(emoji);
      });

      this.container.appendChild(button);
    });
  }

  sendReaction(emoji) {
    // Send reaction to server
    this.socket.emit("emoji-reaction", {
      room: this.room,
      username: this.username,
      emoji: emoji,
    });

    // Show reaction locally
    this.showReaction(emoji, this.username);
  }

  listenForReactions() {
    this.socket.on("emoji-reaction", ({ username, emoji }) => {
      if (username !== this.username) {
        this.showReaction(emoji, username);
      }
    });
  }

  showReaction(emoji, username) {
    // Create floating emoji element
    const reaction = document.createElement("div");
    reaction.className = "floating-emoji";
    reaction.textContent = emoji;
    reaction.style.position = "absolute";
    reaction.style.fontSize = "32px";
    reaction.style.userSelect = "none";
    reaction.style.pointerEvents = "none";
    reaction.style.zIndex = "1000";
    reaction.style.opacity = "1";
    reaction.style.transition = "opacity 0.5s ease";

    // Add username below emoji
    const usernameSpan = document.createElement("span");
    usernameSpan.textContent = username;
    usernameSpan.style.fontSize = "12px";
    usernameSpan.style.display = "block";
    usernameSpan.style.textAlign = "center";
    usernameSpan.style.marginTop = "5px";
    usernameSpan.style.color = "white";
    usernameSpan.style.textShadow = "0 0 2px rgba(0,0,0,0.5)";

    reaction.appendChild(usernameSpan);

    // Position randomly over the video player
    const videoContainer = document.querySelector(".video-container");
    const rect = videoContainer.getBoundingClientRect();

    const x = Math.random() * (rect.width - 50) + rect.left;
    const y = Math.random() * (rect.height - 100) + rect.top;

    reaction.style.left = `${x}px`;
    reaction.style.top = `${y}px`;

    // Add to document
    document.body.appendChild(reaction);

    // Animate
    const animationDuration = 3000; // 3 seconds

    // Float up
    let startTime = null;

    function animate(timestamp) {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;

      if (progress < animationDuration) {
        // Move up
        reaction.style.top = `${y - (progress / animationDuration) * 100}px`;

        // Fade out towards the end
        if (progress > animationDuration * 0.7) {
          const opacity =
            1 -
            (progress - animationDuration * 0.7) / (animationDuration * 0.3);
          reaction.style.opacity = opacity.toString();
        }

        requestAnimationFrame(animate);
      } else {
        // Remove element when animation is done
        document.body.removeChild(reaction);
      }
    }

    requestAnimationFrame(animate);
  }
}

// Export for use in other files
window.EmojiReactions = EmojiReactions;
