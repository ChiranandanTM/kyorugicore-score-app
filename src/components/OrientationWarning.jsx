import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

export default function OrientationWarning() {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const [show, setShow] = useState(false);

  useEffect(() => {
    function check() {
      if (window.innerWidth <= 768 && isLoggedIn) {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches;
        setShow(isPortrait);
      } else {
        setShow(false);
      }
    }

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [isLoggedIn]);

  if (!show) return null;

  return (
    <div
      id="orientationWarning"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000',
        color: 'white',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '20px',
      }}
    >
      <div>
        <h2>Please rotate your device</h2>
        <p>This app works best in landscape mode.</p>
      </div>
    </div>
  );
}
