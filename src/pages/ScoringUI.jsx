import { useEffect, useRef } from 'react';
import {
  ref as dbRef,
  set,
  push,
  remove,
  runTransaction,
  onValue,
} from 'firebase/database';
import { db } from '../firebase';
import { useStore } from '../store/useStore';

const SECTION_CONFIGS = [
  { cls: 'red-head',  player: 'red',  clickPoints: 3, swipePoints: 5, clickAction: 'head-click',  swipeAction: 'head-swipe'  },
  { cls: 'blue-head', player: 'blue', clickPoints: 3, swipePoints: 5, clickAction: 'head-click',  swipeAction: 'head-swipe'  },
  { cls: 'red-punch', player: 'red',  clickPoints: 1,                 clickAction: 'punch-click'                             },
  { cls: 'blue-punch',player: 'blue', clickPoints: 1,                 clickAction: 'punch-click'                             },
  { cls: 'red-body',  player: 'red',  clickPoints: 2, swipePoints: 4, clickAction: 'body-click',  swipeAction: 'body-swipe'  },
  { cls: 'blue-body', player: 'blue', clickPoints: 2, swipePoints: 4, clickAction: 'body-click',  swipeAction: 'body-swipe'  },
];

export default function ScoringUI() {
  const { refereeId, myName, currentRoomId, setName } = useStore();
  const containerRef = useRef(null);

  // Keep mutable refs so event handlers always have latest values
  const roomIdRef = useRef(currentRoomId);
  const refereeIdRef = useRef(refereeId);
  const myNameRef = useRef(myName);
  const setNameRef = useRef(setName);
  useEffect(() => { roomIdRef.current = currentRoomId; }, [currentRoomId]);
  useEffect(() => { refereeIdRef.current = refereeId; }, [refereeId]);
  useEffect(() => { myNameRef.current = myName; }, [myName]);
  useEffect(() => { setNameRef.current = setName; }, [setName]);

  // In-memory cache of room data and submissions — updated by onValue listeners
  const roomDataRef = useRef(null);
  const subsDataRef = useRef({});
  const lastVibratedAwardRef = useRef(0);

  // Persistent real-time listeners: one WebSocket connection, zero polling reads
  useEffect(() => {
    if (!currentRoomId) return;

    const unsubRoom = onValue(dbRef(db, `rooms/${currentRoomId}`), (snap) => {
      roomDataRef.current = snap.val();
      const val = snap.val();

      // Sync name if scoreboard renamed this referee
      const liveNameFromDB = val?.referees?.[refereeId]?.name;
      if (liveNameFromDB && liveNameFromDB !== myNameRef.current) {
        setNameRef.current(liveNameFromDB);
      }

      // Vibrate only when THIS referee's submission was accepted and awarded
      const lastAward = val?.lastAwardedReferees;
      if (lastAward?.ids?.includes(refereeIdRef.current)) {
        const awardTime = lastAward.timestamp || 0;
        if (awardTime > lastVibratedAwardRef.current && Date.now() - awardTime < 2000) {
          lastVibratedAwardRef.current = awardTime;
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }
    });

    const unsubSubs = onValue(dbRef(db, `rooms/${currentRoomId}/submissions`), (snap) => {
      subsDataRef.current = snap.val() || {};
    });

    return () => {
      unsubRoom();
      unsubSubs();
    };
  }, [currentRoomId]);

  // Validation interval — reads from in-memory cache, no network calls
  const validateRef = useRef(null);
  validateRef.current = () =>
    validateSubmissions(
      roomIdRef.current,
      refereeIdRef.current,
      roomDataRef.current,
      subsDataRef.current,
    );

  useEffect(() => {
    if (!currentRoomId) return;
    const id = setInterval(() => validateRef.current(), 300);
    return () => clearInterval(id);
  }, [currentRoomId]);

  // Touch / click event listeners on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function findConfig(target) {
      return SECTION_CONFIGS.find((c) => target.classList.contains(c.cls));
    }

    function onTouchStart(e) {
      const target = e.target.closest('.section');
      if (!target) return;
      e.preventDefault();
      target.dataset.touchStartX = e.touches[0].clientX;
      target.dataset.touchStartY = e.touches[0].clientY;
      target.dataset.touchStartTime = Date.now();
      target.classList.add('pressed');
    }

    function onTouchEnd(e) {
      const target = e.target.closest('.section');
      if (!target) return;
      e.preventDefault();

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const startX = parseFloat(target.dataset.touchStartX) || endX;
      const startY = parseFloat(target.dataset.touchStartY) || endY;
      const startTime = parseFloat(target.dataset.touchStartTime) || Date.now();
      const dx = Math.abs(endX - startX);
      const dy = Math.abs(endY - startY);
      const duration = Date.now() - startTime;

      setTimeout(() => target.classList.remove('pressed'), 300);

      if (dx < 30 && dy < 30 && duration < 400) {
        const cfg = findConfig(target);
        if (cfg) {
          submitPoints(roomIdRef.current, refereeIdRef.current, myNameRef.current, target, cfg.player, cfg.clickPoints, cfg.clickAction);
          target.classList.add('click-animation');
          setTimeout(() => target.classList.remove('click-animation'), 200);
        }
        return;
      }

      // Require: 130px+ horizontal, clearly more horizontal than vertical (2.5x),
      // fast enough to be intentional (not slow finger drift), and within 500ms
      const speed = dx / (duration || 1)
      if (dx > 130 && dx > dy * 2.5 && speed > 0.3 && duration < 500) {
        const cfg = SECTION_CONFIGS.find((c) => target.classList.contains(c.cls) && c.swipePoints);
        if (cfg) {
          submitPoints(roomIdRef.current, refereeIdRef.current, myNameRef.current, target, cfg.player, cfg.swipePoints, cfg.swipeAction);
          const animCls = startX - endX > 0 ? 'swipe-animation-left' : 'swipe-animation-right';
          target.classList.add(animCls);
          setTimeout(() => target.classList.remove('swipe-animation-left', 'swipe-animation-right'), 300);
        }
      }
    }

    function onClick(e) {
      const target = e.target.closest('.section');
      if (!target) return;
      e.preventDefault();
      const cfg = findConfig(target);
      if (cfg) {
        target.classList.add('pressed');
        setTimeout(() => target.classList.remove('pressed'), 300);
        submitPoints(roomIdRef.current, refereeIdRef.current, myNameRef.current, target, cfg.player, cfg.clickPoints, cfg.clickAction);
        target.classList.add('click-animation');
        setTimeout(() => target.classList.remove('click-animation'), 500);
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: false });
    container.addEventListener('click', onClick, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('click', onClick);
    };
  }, []);

  // Fullscreen + orientation lock on mount
  useEffect(() => {
    requestFullscreen();

    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      if (window.screen.orientation?.lock) {
        window.screen.orientation.lock('landscape').catch((err) =>
          console.warn('Orientation lock failed:', err)
        );
      }
    }
  }, []);

  return (
    <div id="scoringUI">
      <div className="container" ref={containerRef}>
        {/* Red Head Kick */}
        <div className="section red red-head">
          <img
            src="/D_NQ_NP_2X_793353-MLA71300815159_082023-F-removebg-preview.png"
            alt="Head Kick"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Head+Kick'; }}
          />
          <div className="text">Spinning kick to the head</div>
          <div className="label">Hong Head Kick</div>
        </div>

        {/* Blue Head Kick */}
        <div className="section blue blue-head">
          <img
            src="/D_NQ_NP_2X_730871-MLA71258941722_082023-F-removebg-preview.png"
            alt="Head Kick"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Head+Kick'; }}
          />
          <div className="text">Spinning kick to the head</div>
          <div className="label">Chong Head Kick</div>
        </div>

        {/* Red Punch */}
        <div className="section red red-punch">
          <img
            src="/istockphoto-1468209328-612x612-removebg-preview.png"
            alt="Punch"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Punch'; }}
          />
          <div className="text">Punch</div>
          <div className="label">Hong Punch</div>
        </div>

        {/* Blue Punch */}
        <div className="section blue blue-punch">
          <img
            src="/istockphoto-1468209328-612x612-removebg-preview.png"
            alt="Punch"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Punch'; }}
          />
          <div className="text">Punch</div>
          <div className="label">Chong Punch</div>
        </div>

        {/* Red Body Kick */}
        <div className="section red red-body">
          <img
            src="/taekwondo-chest-guard-daedo--1000x1000-removebg-preview.png"
            alt="Body Kick"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Body+Kick'; }}
          />
          <div className="text">Turning kick to the trunk</div>
          <div className="label">Hong Body Kick</div>
        </div>

        {/* Blue Body Kick */}
        <div className="section blue blue-body">
          <img
            src="/new-taekwondo-body-protector-reversible.jpg"
            alt="Body Kick"
            onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Body+Kick'; }}
          />
          <div className="text">Turning kick to the trunk</div>
          <div className="label">Chong Body Kick</div>
        </div>
      </div>
    </div>
  );
}

// ─── Firebase helpers (pure functions, no hooks) ─────────────────────────────

function submitPoints(currentRoomId, refereeId, myName, sectionEl, player, points, action) {
  if (!currentRoomId) {
    console.warn('No room ID set, cannot submit points');
    return;
  }

  const imgSrc = sectionEl?.querySelector('img')?.src || '';
  const submission = {
    refereeId,
    player,
    points,
    action,
    timestamp: Date.now(),
    image: imgSrc,
  };

  push(dbRef(db, `rooms/${currentRoomId}/submissions`), submission)
    .catch((err) => console.error('Error submitting points:', err));

  const teamKey = player === 'red' ? 'hong' : 'chong';
  set(dbRef(db, `rooms/${currentRoomId}/lastPressedAction/${teamKey}`), {
    action,
    points,
    refereeName: myName,
    refereeId,
    timestamp: Date.now(),
  }).catch(console.error);
}

let isValidating = false;

async function validateSubmissions(currentRoomId, refereeId, data, subsRaw) {
  if (!currentRoomId || !data) return;
  if (isValidating) return;

  const referees = data.referees || {};
  const refereeIds = Object.keys(referees).sort();
  const leaderId = refereeIds[0];
  const refereeCount = refereeIds.length;
  const now = Date.now();
  const SYNC_WINDOW_MS = 5000;
  const isTimerRunning = !!(data.timer && data.timer.running);

  if (refereeId !== leaderId) return;

  const subs = Object.entries(subsRaw).map(([key, v]) => ({ key, ...v }));
  if (subs.length === 0) return;

  isValidating = true;
  try {
    // Group by player + points + action
    const groups = {};
    subs.forEach((s) => {
      if (!s.player || !s.action || typeof s.points === 'undefined' || !s.refereeId) return;
      const groupKey = `${s.player}__${s.points}__${s.action}`;
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(s);
    });

    for (const [, groupSubs] of Object.entries(groups)) {
      groupSubs.sort((a, b) => a.timestamp - b.timestamp);

      const earliest = groupSubs[0];
      const sampleImage = earliest.image || '';
      const sampleRefName = (data.referees?.[earliest.refereeId]?.name) || earliest.refereeId || '';

      const teamKey = earliest.player === 'red' ? 'hong' : 'chong';
      set(dbRef(db, `rooms/${currentRoomId}/lastAction/${teamKey}`), {
        image: sampleImage,
        refereeName: sampleRefName,
        timestamp: Date.now(),
        sourceTeam: earliest.player,
      }).catch(console.error);

      // Clean stale submissions regardless of award
      groupSubs.forEach((s) => {
        if (now - s.timestamp > SYNC_WINDOW_MS * 2) {
          remove(dbRef(db, `rooms/${currentRoomId}/submissions/${s.key}`)).catch(console.error);
        }
      });

      if (!isTimerRunning) continue;

      const uniqueRefereeIds = [...new Set(groupSubs.map((s) => s.refereeId))];
      const uniqueCount = uniqueRefereeIds.length;
      const spread = groupSubs[groupSubs.length - 1].timestamp - groupSubs[0].timestamp;

      let shouldAward = false;
      if (refereeCount <= 1) {
        if (uniqueCount >= 1) shouldAward = true;
      } else if (refereeCount === 2) {
        if (uniqueCount === 2 && spread <= SYNC_WINDOW_MS) shouldAward = true;
      } else {
        if (uniqueCount >= 2 && spread <= SYNC_WINDOW_MS) shouldAward = true;
      }

      if (!shouldAward) continue;

      // Atomically claim ALL submissions in this group (including any extra 3rd referee).
      // If the scoreboard already claimed them, the transaction aborts and we skip.
      const allKeys = groupSubs.map((s) => s.key);
      const sentinelKey = earliest.key;
      try {
        const result = await runTransaction(dbRef(db, `rooms/${currentRoomId}/submissions`), (currentSubs) => {
          if (!currentSubs) return currentSubs;
          if (currentSubs[sentinelKey] === undefined) return undefined; // already claimed — abort
          allKeys.forEach((k) => { delete currentSubs[k]; });
          return currentSubs;
        });
        if (result.committed) {
          awardPoints(currentRoomId, earliest.player, earliest.points, uniqueRefereeIds);
        }
      } catch (err) {
        console.error('Submission claim transaction error:', err);
      }
    }
  } finally {
    isValidating = false;
  }
}

function awardPoints(currentRoomId, player, points, refereeIds = []) {
  if (!currentRoomId) return;

  const teamKey = player === 'red' ? 'teamA' : 'teamB';
  runTransaction(dbRef(db, `rooms/${currentRoomId}`), (room) => {
    if (!room) return room;

    if (!room[teamKey]) room[teamKey] = { score: 0 };
    room[teamKey].score = (room[teamKey].score || 0) + points;

    const hongScore = room.teamA?.score || 0;
    const chongScore = room.teamB?.score || 0;

    const pointGap = room.settings?.pointGap ?? 12
    if (Math.abs(hongScore - chongScore) >= pointGap && !room.roundDeclared) {
      const winner = hongScore > chongScore ? 'hong' : 'chong';
      const currentRoundsWon = room[winner + 'RoundsWon'] || 0;

      if (room.timer?.running) {
        room.timer = {
          ...room.timer,
          running: false,
          stoppedTime: {
            minutes: room.timer.minutes,
            seconds: room.timer.seconds,
          },
          playStopSound: true,
        };
      }

      room.roundDeclared = true;
      room[winner + 'RoundsWon'] = currentRoundsWon + 1;
      room.redBlinkClass = winner === 'hong' ? 'blink-white' : '';
      room.blueBlinkClass = winner === 'chong' ? 'blink-white' : '';

      if (room[winner + 'RoundsWon'] >= 2) {
        room.matchWinnerDeclared = true;
        room.redBlinkClass = winner === 'hong' ? 'blink-yellow' : '';
        room.blueBlinkClass = winner === 'chong' ? 'blink-yellow' : '';
        room.breakActive = false;
      } else {
        room.breakActive = true;
      }
    }

    return room;
  })
  .then((result) => {
    if (result.committed && refereeIds.length > 0) {
      set(dbRef(db, `rooms/${currentRoomId}/lastAwardedReferees`), {
        ids: refereeIds,
        timestamp: Date.now(),
      }).catch(console.error);
    }
  })
  .catch((err) => console.error('Transaction error:', err));
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
