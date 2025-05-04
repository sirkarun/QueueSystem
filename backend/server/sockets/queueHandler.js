const activeUsers = {}; // { roomId: Set(socket.id) }
const waitingQueue = {}; // { roomId: [socket.id, ...] }
const rooms = {}; // { roomId: { roomId, name, available, availableSlots } }
const userSocketMap = {}; // { userId: socket.id }
const MAX_USERS = 5;

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_room', ({ roomId, userId }) => {
      console.log(`User ${userId} joined room: ${roomId}`);
      userSocketMap[userId] = socket.id; // Map userId to socket.id

      if (!activeUsers[roomId]) activeUsers[roomId] = new Set();
      if (!waitingQueue[roomId]) waitingQueue[roomId] = [];

      const activeSet = activeUsers[roomId];

      // Check if user is already in the room
      const existingSocketId = [...activeSet].find((id) => userSocketMap[userId] === id);
      if (existingSocketId) {
        activeSet.delete(existingSocketId); // Remove old socket ID
        activeSet.add(socket.id); // Add new socket ID
        socket.join(roomId);
        socket.emit('room_status', { status: 'in-room', roomId });
        return;
      }

      // Check if userId is already in the queue
      const queueIndex = waitingQueue[roomId].findIndex((id) => userSocketMap[userId] === id);
      if (queueIndex !== -1) {
        waitingQueue[roomId][queueIndex] = socket.id; // Update socket ID in the queue
        socket.emit('room_status', { status: 'waiting', roomId, queuePosition: queueIndex + 1 });
        return;
      }

      if (activeSet.size < MAX_USERS) {
        activeSet.add(socket.id);
        socket.join(roomId);
        socket.emit('room_status', { status: 'in-room', roomId });

        // Update room availability if full
        if (activeSet.size === MAX_USERS) {
          if (rooms[roomId]) {
            rooms[roomId].available = false;
            io.emit('roomUpdate', {
              roomId,
              available: rooms[roomId].available,
              activeCount: activeSet.size,
              waitingCount: waitingQueue[roomId]?.length || 0,
            });
          }
        }

        // Emit roomUpdate event to notify all clients
        io.emit('roomUpdate', {
          roomId,
          available: rooms[roomId]?.available,
          activeCount: activeSet.size,
          waitingCount: waitingQueue[roomId]?.length || 0,
        });
      } else {
        // Add user to the waiting queue if the room is full
        waitingQueue[roomId].push(socket.id);
        const queuePosition = waitingQueue[roomId].length;
        socket.emit('room_status', { status: 'waiting', roomId, queuePosition });

        // Emit roomUpdate event to notify all clients
        if (rooms[roomId]) {
          rooms[roomId].available = false;
        }
        io.emit('roomUpdate', {
          roomId,
          available: rooms[roomId]?.available,
          activeCount: activeSet.size,
          waitingCount: waitingQueue[roomId].length,
        });
      }
    });

    socket.on('submit', ({ roomId }) => {
      const activeSet = activeUsers[roomId];
      if (activeSet && activeSet.has(socket.id)) {
        activeSet.delete(socket.id);
        socket.leave(roomId);

        // Promote next user
        const nextSocketId = waitingQueue[roomId]?.shift();
        if (nextSocketId) {
          activeSet.add(nextSocketId);
          io.sockets.sockets.get(nextSocketId)?.join(roomId);
          io.to(nextSocketId).emit('room_status', { status: 'in-room', roomId });
        }

        // Update room availability to true if not full
        if (rooms[roomId] && activeSet.size < MAX_USERS) {
          rooms[roomId].available = true;

          // Emit roomUpdate event to notify all clients
          io.emit('roomUpdate', {
            roomId,
            available: rooms[roomId].available,
            activeCount: activeSet.size,
            waitingCount: waitingQueue[roomId]?.length || 0,
          });
        }

        io.to(roomId).emit('user_update', {
          roomId,
          activeCount: activeSet.size,
          waitingCount: waitingQueue[roomId]?.length || 0,
        });
          // Emit updated queue positions to all clients
          waitingQueue[roomId]?.forEach((socketId, index) => {
            io.to(socketId).emit('room_status', {
              status: 'waiting',
              roomId,
              queuePosition: index + 1,
            });
          });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      for (const roomId in activeUsers) {
        if (activeUsers[roomId].delete(socket.id)) {
          const nextSocketId = waitingQueue[roomId]?.shift();
          if (nextSocketId) {
            activeUsers[roomId].add(nextSocketId);
            io.sockets.sockets.get(nextSocketId)?.join(roomId);
            io.to(nextSocketId).emit('room_status', { status: 'in-room', roomId });
          }

          // Emit updated queue positions to all clients
          waitingQueue[roomId]?.forEach((socketId, index) => {
            io.to(socketId).emit('room_status', {
              status: 'waiting',
              roomId,
              queuePosition: index + 1,
            });
          });

          io.to(roomId).emit('user_update', {
            roomId,
            activeCount: activeUsers[roomId].size,
            waitingCount: waitingQueue[roomId]?.length || 0,
          });
        } else {
          const idx = waitingQueue[roomId]?.indexOf(socket.id);
          if (idx !== -1) waitingQueue[roomId].splice(idx, 1);

          // Emit updated queue positions to all clients
          waitingQueue[roomId]?.forEach((socketId, index) => {
            io.to(socketId).emit('room_status', {
              status: 'waiting',
              roomId,
              queuePosition: index + 1,
            });
          });
        }
      }

      // Remove userId from userSocketMap
      const userId = Object.keys(userSocketMap).find((key) => userSocketMap[key] === socket.id);
      if (userId) delete userSocketMap[userId];
    });
  });

  // Ensure rooms and waitingQueue are properly initialized and returned
  return { rooms, waitingQueue };
};
