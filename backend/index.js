require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const redis = require("./redis");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3000;

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);
  
  socket.on("join-room", (room) => {
    console.log(\`User \${socket.id} joined room \${room}\`);
    // Handle room join logic with Redis here
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Handle leaving queue here
  });
});

app.get("/", (req, res) => res.send("Queue system backend is running"));

server.listen(PORT, () => console.log("Server running on port", PORT));
