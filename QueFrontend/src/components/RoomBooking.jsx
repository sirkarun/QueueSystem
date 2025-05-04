// RoomBookingApp.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client'; // Import socket.io-client
import { v4 as uuidv4 } from 'uuid'; // Import UUID library
import './RoomBooking.css';

const socket = io('https://queuesystem-production-3045.up.railway.app'); // เชื่อมต่อกับ backend

const RoomBookingApp = () => {
  const [userId, setUserId] = useState(() => {
    // Generate or retrieve a unique userId for the session
    const storedUserId = sessionStorage.getItem('userId'); // Use sessionStorage instead of localStorage
    if (storedUserId) return storedUserId;
    const newUserId = uuidv4();
    sessionStorage.setItem('userId', newUserId); // Store userId in sessionStorage
    return newUserId;
  });

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [currentView, setCurrentView] = useState('index');
  const [rooms, setRooms] = useState([]);
  const [isWaiting, setIsWaiting] = useState(false); // Add state to track waiting status
  const [queuePosition, setQueuePosition] = useState(null); // Add state to track queue position

  useEffect(() => {
    fetch('https://queuesystem-production-3045.up.railway.app/rooms')
      .then(response => response.json())
      .then(data => {
        const roomsArray = Object.values(data);
        setRooms(roomsArray);
      })
      .catch(error => console.error('Error fetching rooms:', error));
  }, []);

  useEffect(() => {
    // Listen for room updates
    socket.on('roomUpdate', (data) => {
      console.log(`Room update received:`, data);
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.roomId === data.roomId
            ? { ...room, available: data.available, activeCount: data.activeCount, waitingCount: data.waitingCount }
            : room
        )
      );
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('roomUpdate');
    };
  }, []);

  useEffect(() => {
    // Listen for queue updates
    socket.on('queueUpdate', (data) => {
      if (data.roomId === selectedRoom?.roomId) {
        console.log(`Queue length: ${data.queue}`);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('queueUpdate');
    };
  }, [selectedRoom]);

  useEffect(() => {
    // Listen for room status updates
    socket.on('room_status', (data) => {
      console.log(`Room status updated:`, data);
      if (data.status === 'waiting') {
        setIsWaiting(true); // Set waiting status to true
        setQueuePosition(data.queuePosition); // Update queue position
      } else if (data.status === 'in-room') {
        setIsWaiting(false); // Reset waiting status
        setQueuePosition(null); // Clear queue position
      }

      if (data.roomId === selectedRoom?.roomId) {
        setSelectedRoom((prevRoom) => ({
          ...prevRoom,
          status: data.status,
        }));
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('room_status');
    };
  }, [selectedRoom]);

  useEffect(() => {
    // Listen for user updates
    socket.on('user_update', (data) => {
      console.log(`User update received:`, data);
      setRooms((prevRooms) =>
        prevRooms.map((room) =>
          room.roomId === data.roomId
            ? { ...room, activeCount: data.activeCount, waitingCount: data.waitingCount }
            : room
        )
      );
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('user_update');
    };
  }, [selectedRoom]);

  useEffect(() => {
    // Reconnect logic
    const storedRoomId = sessionStorage.getItem('selectedRoomId'); // Use sessionStorage to retrieve the room ID
    if (storedRoomId) {
      const storedRoom = rooms.find((room) => room.roomId === storedRoomId);
      if (storedRoom) {
        setSelectedRoom(storedRoom);
        socket.emit('join_room', { roomId: storedRoomId, userId }); // Rejoin the room or queue
      } else {
        // If the room is not found in the current list, fetch it again
        fetch('https://queuesystem-production-3045.up.railway.app/rooms')
          .then((response) => response.json())
          .then((data) => {
            const room = Object.values(data).find((room) => room.roomId === storedRoomId);
            if (room) {
              setSelectedRoom(room);
              socket.emit('join_room', { roomId: storedRoomId, userId }); // Rejoin the room or queue
            }
          })
          .catch((error) => console.error('Error fetching rooms during reconnect:', error));
      }
    }
  }, [rooms]);

  // ข้อมูลช่วงเวลา
  const timeSlots = [
    { id: 1, name: '1', booked: false },
    { id: 2, name: '2', booked: true },
    { id: 3, name: '3', booked: false },
    { id: 4, name: '4', booked: true },
    { id: 5, name: '5', booked: false }
  ];

  // เลือกห้อง
  const handleRoomSelect = (room) => {
    console.log(`Selected room: ${room.roomId}`);
    setSelectedRoom(room);
    sessionStorage.setItem('selectedRoomId', room.roomId); // Save selected room to sessionStorage
    socket.emit('join_room', { roomId: room.roomId, userId }); // Send userId with join_room event
  };

  // เลือกเวลา
  const handleTimeSelect = (timeSlot) => {
    if (!timeSlot.booked) {
      setSelectedTimeSlot(timeSlot);
    }
  };

  // ยืนยันการเลือก
  const handleDone = () => {
    if (selectedTimeSlot) {
      setCurrentView('submit');
    }
  };

  const handleSubmit = () => {
    if (selectedRoom) {
      console.log(`Submitting for room: ${selectedRoom.roomId}`);
      socket.emit('submit', { roomId: selectedRoom.roomId }); // Emit submit event
      setSelectedRoom(null);
      setSelectedTimeSlot(null);
      sessionStorage.removeItem('selectedRoomId'); // Clear selected room from localStorage
      
    }
  };

  // ย้อนกลับ
  const handleBack = () => {
    if (currentView === 'room') {
      setCurrentView('index');
      setSelectedRoom(null);
      setSelectedTimeSlot(null);
    } else if (currentView === 'submit') {
      setCurrentView('room');
      setSelectedTimeSlot(null);
    }
  };

  return (
    <div className="container">
   

      <div className="section">
        <div className="card">
          <h2 className="header">Index</h2>
          
          <div className="header-box">
            <h3 className="header-text">Please Select Room</h3>
          </div>
          
          <div className="grid">
            {rooms && rooms.map((room) => (
              <div key={room.roomId} className="room-box">
                <div 
                  className="room-header"
                  onClick={() => handleRoomSelect(room)}
                >
                  <h3 className="room-label">ROOM</h3>
                  <h3 className="room-label">{room.roomId}</h3>
                </div>
                <div 
                  className={`status-bar ${room.available ? 'available' : 'locked'}`}
                >
                  {room.available 
                    ? `Available (${room.activeCount}/${room.availableSlots})`
                    : `Locked (${room.activeCount}/${room.availableSlots})`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="section">
        <div className="card">
          <h2 className="header">ROOM</h2>
          {isWaiting ? (
            <div className="waiting-indicator">
              <p>You are in the queue. Your position: {queuePosition}</p>
            </div>
          ) : selectedRoom && (
            <div>
              <div className="header-box">
                <h3 className="header-text">ROOM {selectedRoom.roomId}</h3>
              </div>
              
              <div className="grid">
                {timeSlots.map(timeSlot => (
                  <div key={timeSlot.id} className="room-box">
                    <div 
                      className={`room-header ${timeSlot.booked ? 'booked-slot' : ''}`}
                      onClick={() => !timeSlot.booked && handleTimeSelect(timeSlot)}
                    >
                      <h3 className="room-label">TIME</h3>
                      <h3 className="room-label">{timeSlot.name}</h3>
                    </div>
                    <div 
                      className={
                        timeSlot.booked 
                          ? 'booked-bar'
                          : timeSlot.id === selectedTimeSlot?.id 
                            ? 'selected-bar'
                            : 'select-bar'
                      }
                    >
                      {timeSlot.booked 
                        ? 'Booked' 
                        : timeSlot.id === selectedTimeSlot?.id 
                          ? 'Selected'
                          : 'Select'
                      }
                    </div>
                  </div>
                ))}
              </div>
      
              <div className="button-container">
              
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="section">
        <div className="card">
          <h2 className="header">Submit</h2>
          
          {selectedRoom && selectedTimeSlot && (
            <>
              <div className="header-box">
                <h3  onClick={handleSubmit} className="header-text">Done</h3>
              </div>
              
              <div className="centered-content">
                <div className="room-header half-width" style={{marginBottom: '2px'}}>
                  <h3 className="room-label">TIME</h3>
                  <h3 className="room-label">{selectedTimeSlot.name}</h3>
                </div>
                <div className="select-bar half-width">
                  Selected
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomBookingApp;