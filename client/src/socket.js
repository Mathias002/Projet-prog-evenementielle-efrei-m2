import { io } from "socket.io-client";

export const socket = io({
  // Important : Autoriser les deux méthodes
  transports: ["websocket", "polling"],

  // C'est la clé magique pour Ngrok gratuit :
  extraHeaders: {
    "ngrok-skip-browser-warning": "true",
  },
});
