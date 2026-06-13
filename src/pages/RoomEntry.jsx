import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref as dbRef, get, set } from 'firebase/database';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import QRScanner from '../components/QRScanner';

export default function RoomEntry() {
  const [roomCode, setRoomCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();
  const { refereeId, setLoggedIn } = useStore();

  async function joinRoom(code) {
    const roomCode = (code || '').trim().toUpperCase();
    if (!roomCode) {
      alert('Please enter a room code.');
      return;
    }

    try {
      const refereesSnap = await get(dbRef(db, `rooms/${roomCode}/referees`));
      const referees = refereesSnap.val() || {};
      const refereeCount = Object.keys(referees).length;

      if (refereeCount >= 4 && !referees[refereeId]) {
        alert('Maximum of 4 referees allowed in this room.');
        return;
      }

      const roomSnap = await get(dbRef(db, `rooms/${roomCode}`));
      if (!roomSnap.exists()) {
        alert('Invalid room code. Please try again.');
        return;
      }

      let myName;
      if (referees[refereeId]) {
        myName = referees[refereeId].name;
      } else {
        myName = `Referee ${refereeCount + 1}`;
      }

      await set(dbRef(db, `rooms/${roomCode}/referees/${refereeId}`), {
        joined: Date.now(),
        name: myName,
      });

      setLoggedIn(roomCode, myName);

      requestFullscreen();
      navigate('/scoring');
    } catch (err) {
      console.error('Error joining room:', err);
      alert('Error joining room. Please try again.');
    }
  }

  function handleJoin() {
    joinRoom(roomCode);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleJoin();
  }

  function handleScan(scannedCode) {
    setShowScanner(false);
    setRoomCode(scannedCode);
    joinRoom(scannedCode);
  }

  return (
    <div id="roomEntry">
      <h2>Enter Room Code</h2>
      <input
        type="text"
        placeholder="e.g., 3F6XKP"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
      />
      <button onClick={handleJoin}>Join Room</button>
      <button onClick={() => setShowScanner(true)}>Scan QR Code</button>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function requestFullscreen() {
  const docEl = document.documentElement;
  if (docEl.requestFullscreen) {
    docEl.requestFullscreen();
  } else if (docEl.webkitRequestFullscreen) {
    docEl.webkitRequestFullscreen();
  } else if (docEl.msRequestFullscreen) {
    docEl.msRequestFullscreen();
  }
}
