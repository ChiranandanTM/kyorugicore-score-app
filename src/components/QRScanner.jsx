import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader-modal');
    scannerRef.current = scanner;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    const handleDecode = (decodedText) => {
      const code = decodedText.trim().toUpperCase();
      if (code) {
        scanner.stop().then(() => {
          startedRef.current = false;
          onScan(code);
        }).catch(console.error);
      }
    };

    const tryStart = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const rearCameras = devices.filter(
          (d) =>
            d.kind === 'videoinput' &&
            (d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear'))
        );

        if (rearCameras.length > 0) {
          await scanner.start(
            rearCameras[rearCameras.length - 1].deviceId,
            config,
            handleDecode,
            () => {}
          );
        } else {
          try {
            await scanner.start({ facingMode: 'environment' }, config, handleDecode, () => {});
          } catch {
            await scanner.start({ facingMode: 'user' }, config, handleDecode, () => {});
          }
        }
        startedRef.current = true;
      } catch (err) {
        console.error('Camera error:', err);
        alert('Camera permission denied. Please allow camera access and try again.');
        onClose();
      }
    };

    tryStart();

    return () => {
      if (startedRef.current && scanner) {
        scanner.stop().catch(() => {});
        startedRef.current = false;
      }
    };
  }, []);

  const handleClose = () => {
    if (startedRef.current && scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      startedRef.current = false;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '300px',
        height: '300px',
        backgroundColor: '#000',
        zIndex: 9999,
        padding: '10px',
        borderRadius: '10px',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={handleClose}
        style={{
          position: 'absolute',
          right: '10px',
          top: '10px',
          backgroundColor: '#ff4444',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: '30px',
          height: '30px',
          fontSize: '16px',
          cursor: 'pointer',
          zIndex: 10000,
          lineHeight: '30px',
          textAlign: 'center',
        }}
      >
        ✕
      </button>
      <p style={{ color: '#fff', textAlign: 'center', margin: '0 0 8px 0', fontSize: '14px' }}>
        Scanning for QR code...
      </p>
      <div id="qr-reader-modal" style={{ width: '100%' }} />
    </div>
  );
}
