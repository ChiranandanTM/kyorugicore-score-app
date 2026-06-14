import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref as dbRef, get, set, runTransaction } from 'firebase/database';
import { db } from '../firebase';
import { useStore } from '../store/useStore';
import QRScanner from '../components/QRScanner';

export default function RoomEntry() {
  const [roomCode, setRoomCode] = useState('');
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

      // Already in room — rejoin with existing name
      if (referees[refereeId]) {
        const finalName = referees[refereeId].name;
        await set(dbRef(db, `rooms/${trimmedCode}/referees/${refereeId}`), {
          ...referees[refereeId],
          name: finalName,
        });
        setLoggedIn(trimmedCode, finalName);
        requestFullscreen();
        navigate('/scoring');
        return;
      }

      if (Object.keys(referees).length >= 4) {
        alert('Maximum of 4 referees allowed in this room.');
        return;
      }

      // Atomically claim next sequential referee number
      const counterResult = await runTransaction(
        dbRef(db, `rooms/${trimmedCode}/refereeCounter`),
        (current) => (current || 0) + 1,
      );

      if (!counterResult.committed) throw new Error('Failed to claim referee number');

      const assignedNumber = counterResult.snapshot.val();
      const finalName = `Referee ${assignedNumber}`;

      await set(dbRef(db, `rooms/${trimmedCode}/referees/${refereeId}`), {
        joined: Date.now(),
        name: finalName,
        number: assignedNumber,
      });

      setLoggedIn(trimmedCode, finalName);
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
      <div className="login-card">
        <div className="login-brand">KYORUGI CORE</div>
        <h2>Referee Login</h2>
        <p className="login-sub">Enter your room code to join</p>

        <input
          type="text"
          placeholder="e.g., 3F6XKP"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
        />
        <button className="btn-join" onClick={handleJoin}>Join Room</button>
        <button className="btn-scan" onClick={() => setShowScanner(true)}>
          <span className="scan-icon">&#x1F4F7;</span> Scan QR Code
        </button>
      </div>

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
