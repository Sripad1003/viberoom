# VibeRoom

VibeRoom is a real-time music sharing and vibing web application that allows users to join virtual rooms, share YouTube videos, chat, and enjoy synchronized music playback together. It provides a seamless and interactive experience for friends and communities to vibe together regardless of their location.

## Features

- Create or join music rooms with friends
- Search and add YouTube videos to the shared queue
- Synchronized video playback for all participants
- Real-time chat with emoji reactions
- Voice chat support
- Responsive design with mobile-friendly sidebar and portrait view
- Theme customization (Light, Dark, System Default)
- Keyboard shortcuts for easy control

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Sripad1003/viberoom.git
   cd viberoom
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   node server.js
   ```

4. Open your browser and navigate to:

   ```
   http://localhost:3000
   ```

## Usage

- Enter a room name to create or join a music room.
- Use the search bar to find YouTube videos and add them to the queue.
- Control playback with the player controls.
- Chat with other users in the room.
- Use the sidebar tabs to switch between queue, chat, and settings.
- On mobile devices, use the portrait view for optimal experience.

## Flow Steps for Vibing into the Room

1. **Enter Room Name:** On the landing page, enter a unique room name to create or join a room.
2. **Join the Room:** Click the join button to enter the room.
3. **Search for Music:** Use the search input in the sidebar to find YouTube videos by song, artist, or video title.
4. **Add to Queue:** Select videos from the search results to add them to the shared queue.
5. **Enjoy Synchronized Playback:** Videos play in sync for all users in the room.
6. **Interact with Others:** Use the chat tab to send messages and emoji reactions.
7. **Voice Chat:** Optionally start a voice chat with other participants.
8. **Customize Settings:** Adjust theme, autoplay, and video quality in the settings tab.
9. **Leave Room:** Click the leave button to exit the room.

## Technologies Used

- Node.js and Express for the backend server
- Socket.io for real-time communication
- YouTube IFrame API for video playback
- HTML, CSS, and JavaScript for the frontend
- Font Awesome for icons
- Poppins font from Google Fonts

## Contributing

Contributions are welcome! Please fork the repository and submit pull requests for any improvements or bug fixes.

## License

This project is licensed under the MIT License.
