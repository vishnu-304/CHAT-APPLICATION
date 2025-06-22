import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Store connected users and chat rooms
const users = new Map();
const rooms = new Map();

// Serve static files
app.use(express.static(__dirname));

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle user joining
  socket.on('user:join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar,
      joinedAt: new Date()
    };
    
    users.set(socket.id, user);
    socket.username = userData.username;
    
    // Join default room
    socket.join('general');
    
    // Notify others about new user
    socket.to('general').emit('user:joined', {
      user,
      message: `${user.username} joined the chat`
    });
    
    // Send current users list to the new user
    const roomUsers = Array.from(users.values()).filter(u => u.id !== socket.id);
    socket.emit('users:list', roomUsers);
    
    // Send user list update to all users
    io.to('general').emit('users:update', Array.from(users.values()));
  });

  // Handle sending messages
  socket.on('message:send', (messageData) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now() + Math.random(),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      content: messageData.content,
      timestamp: new Date(),
      room: messageData.room || 'general'
    };

    // Broadcast message to all users in the room
    io.to(message.room).emit('message:received', message);
  });

  // Handle typing indicators
  socket.on('typing:start', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    socket.to(data.room || 'general').emit('typing:user', {
      userId: socket.id,
      username: user.username,
      isTyping: true
    });
  });

  socket.on('typing:stop', (data) => {
    const user = users.get(socket.id);
    if (!user) return;
    
    socket.to(data.room || 'general').emit('typing:user', {
      userId: socket.id,
      username: user.username,
      isTyping: false
    });
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      
      // Notify others about user leaving
      socket.to('general').emit('user:left', {
        user,
        message: `${user.username} left the chat`
      });
      
      // Update users list
      io.to('general').emit('users:update', Array.from(users.values()));
    }
    
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Chat server running at http://localhost:${PORT}`);
});