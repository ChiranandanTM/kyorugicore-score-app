import { create } from 'zustand';

const generateRefereeId = () => Math.random().toString(36).substr(2, 8);

const storedRefereeId = sessionStorage.getItem('refereeId') || generateRefereeId();
if (!sessionStorage.getItem('refereeId')) {
  sessionStorage.setItem('refereeId', storedRefereeId);
}

export const useStore = create((set) => ({
  refereeId: storedRefereeId,
  myName: sessionStorage.getItem('myName') || null,
  currentRoomId: sessionStorage.getItem('currentRoomId') || null,
  isLoggedIn: sessionStorage.getItem('isLoggedIn') === 'true',

  setLoggedIn: (roomId, name) => {
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('currentRoomId', roomId);
    sessionStorage.setItem('myName', name);
    set({ isLoggedIn: true, currentRoomId: roomId, myName: name });
  },

  logout: () => {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('currentRoomId');
    sessionStorage.removeItem('myName');
    set({ isLoggedIn: false, currentRoomId: null, myName: null });
  },
}));
