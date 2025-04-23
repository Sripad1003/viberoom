// Audio Visualizer for VibeRoom
class AudioVisualizer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      barCount: options.barCount || 64,
      barColor: options.barColor || "#8e44ad",
      barSpacing: options.barSpacing || 2,
      responsive: options.responsive !== false,
      ...options,
    };

    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.source = null;
    this.animationId = null;
    this.bars = [];

    this.init();
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "audio-visualizer";
      document.body.appendChild(this.container);
    }

    // Style container
    this.container.style.display = "flex";
    this.container.style.alignItems = "flex-end";
    this.container.style.justifyContent = "center";
    this.container.style.height = "100px";
    this.container.style.width = "100%";
    this.container.style.gap = `${this.options.barSpacing}px`;
    this.container.style.padding = "0";
    this.container.style.overflow = "hidden";

    // Create bars
    this.createBars();

    // Handle window resize
    if (this.options.responsive) {
      window.addEventListener("resize", () => {
        this.createBars();
      });
    }
  }

  createBars() {
    // Clear existing bars
    this.container.innerHTML = "";
    this.bars = [];

    // Calculate bar width based on container width
    const containerWidth = this.container.clientWidth;
    const totalBars = Math.min(
      this.options.barCount,
      Math.floor(containerWidth / (3 + this.options.barSpacing))
    );

    for (let i = 0; i < totalBars; i++) {
      const bar = document.createElement("div");
      bar.className = "visualizer-bar";
      bar.style.backgroundColor = this.options.barColor;
      bar.style.height = "2px";
      bar.style.flex = "1";
      bar.style.maxWidth = "4px";
      bar.style.borderRadius = "2px 2px 0 0";
      bar.style.transition = "height 0.05s ease";

      this.container.appendChild(bar);
      this.bars.push(bar);
    }
  }

  connectAudio(audioElement) {
    if (!audioElement) return;

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();

      // Connect audio element to analyser
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Configure analyser
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      console.log("Audio visualizer connected successfully");
    } catch (error) {
      console.error("Error connecting audio to visualizer:", error);
    }
  }

  start() {
    if (!this.analyser) return;

    const renderFrame = () => {
      this.animationId = requestAnimationFrame(renderFrame);

      // Get frequency data
      this.analyser.getByteFrequencyData(this.dataArray);

      // Update bars
      const barCount = this.bars.length;
      const step = Math.floor(this.dataArray.length / barCount);

      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * step;
        let value = this.dataArray[dataIndex] / 255;

        // Apply some smoothing and amplification
        value = Math.pow(value, 1.5) * 100;

        // Set bar height
        this.bars[i].style.height = `${Math.max(2, value)}px`;
      }
    };

    renderFrame();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Reset bars
    this.bars.forEach((bar) => {
      bar.style.height = "2px";
    });
  }

  disconnect() {
    this.stop();

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export for use in other files
window.AudioVisualizer = AudioVisualizer;
