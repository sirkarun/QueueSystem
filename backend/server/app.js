const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Import cors middleware
const app = express();
const server = http.createServer(app);

const queueHandler = require('./sockets/queueHandler'); // Import queueHandler
const io = new Server(server, {
  cors: {
    origin: '*', // อนุญาตการเชื่อมต่อจากทุก Origin (สำหรับการพัฒนา)
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// ใช้ cors middleware กับ Express App ทั้งหมด
app.use(cors());
app.use(express.json()); 

// เรียกใช้งาน queueHandler โดยส่ง io instance ไป และรับ rooms object และ waitingQueue กลับมา
const { rooms, waitingQueue } = queueHandler(io); // Include waitingQueue for accurate data

// API Endpoint สำหรับเพิ่ม Room
app.post('/api/rooms', (req, res) => {
    let { roomId, capacity = 5 } = req.body; // รับ roomId และ capacity จาก Request Body
    roomId = roomId.trim(); // ตัดช่องว่างที่ไม่จำเป็นออกจาก roomId
    roomId = roomId.toUpperCase();
    if (roomId && !rooms[roomId]) {
       
      rooms[roomId] =  {roomId:roomId,  name: roomId, available: true, availableSlots: capacity };
      res.status(201).json({ message: `Room "${roomId}" created successfully.`, rooms });
    } else if (rooms[roomId]) {
      res.status(409).json({ error: `Room "${roomId}" already exists.` });
    } else {
      res.status(400).json({ error: 'Missing roomId in request body.' });
    }
  });

// Route สำหรับ API ดึงข้อมูลห้อง
app.get('/rooms', (req, res) => {
  const roomsData = Object.keys(rooms).reduce((acc, roomId) => {
    acc[roomId] = {
      roomId: rooms[roomId].roomId,
      name: rooms[roomId].name,
      available: rooms[roomId].available,
      availableSlots: rooms[roomId].availableSlots,
      activeCount: io.sockets.adapter.rooms.get(roomId)?.size || 0,
      waitingCount: waitingQueue[roomId]?.length || 0 // Use waitingQueue for accurate data
    };
    return acc;
  }, {});
  res.json(roomsData);
});

// API Endpoint สำหรับ search และ filter ห้อง
app.get('/api/rooms/search', (req, res) => {
  const { search, available } = req.query; // รับ query parameters

  let filteredRooms = Object.values(rooms);

  // กรองห้องตาม search keyword
  if (search) {
    const searchLower = search.toLowerCase();
    filteredRooms = filteredRooms.filter(room =>
      room.roomId.toLowerCase().includes(searchLower) ||
      room.name.toLowerCase().includes(searchLower)
    );
  }

  // กรองห้องตามสถานะ available
  if (available !== undefined) {
    const isAvailable = available === 'true';
    filteredRooms = filteredRooms.filter(room => room.available === isAvailable);
  }

  res.json(filteredRooms);
});

// เรียกใช้งาน queueHandler โดยส่ง io instance ไป
queueHandler(io);


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});