import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref as dbRef, get, set, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import QRScanner from '../components/QRScanner';

export default function RoomEntry() {
  const [roomCode, setRoomCode] = useState('');
  const [refereeName, setRefereeName] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();
  const { refereeId, setLoggedIn } = useStore();

  async function joinRoom(code) {
    const trimmedCode = (code || '').trim().toUpperCase();
    if (!trimmedCode) {
      alert('Please enter a room code.');
      return;
    }

    try {
      const roomSnap = await get(dbRef(db, `rooms/${trimmedCode}`));
      if (!roomSnap.exists()) {
        alert('Invalid room code. Please try again.');
        return;
      }

      const referees = roomSnap.val()?.referees || {};

      // Already in room: update name if changed, then proceed
      if (referees[refereeId]) {
        const myName = refereeName.trim() || referees[refereeId].name;
        await set(dbRef(db, `rooms/${trimmedCode}/referees/${refereeId}`), {
          ...referees[refereeId],
          name: myName,
        });
        setLoggedIn(trimmedCode, myName);
        requestFullscreen();
        navigate('/scoring');
        return;
      }

      // New referee: enforce max 4
      if (Object.keys(referees).length >= 4) {
        alert('Maximum of 4 referees allowed in this room.');
        return;
      }

      // Atomically claim the next sequential number
      const counterResult = await runTransaction(
        dbRef(db, `rooms/${trimmedCode}/refereeCounter`),
        (current) => (current || 0) + 1,
      );

      if (!counterResult.committed) {
        throw new Error('Failed to claim referee number');
      }

      const assignedNumber = counterResult.snapshot.val();
      const myName = refereeName.trim() || `Referee ${assignedNumber}`;

      await set(dbRef(db, `rooms/${trimmedCode}/referees/${refereeId}`), {
        joined: Date.now(),
        name: myName,
        number: assignedNumber,
      });

      setLoggedIn(trimmedCode, myName);
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
        placeholder="Your name (optional)"
        value={refereeName}
        onChange={(e) => setRefereeName(e.target.value)}
      />
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
