import { io } from "socket.io-client";

const USER_ID_KEY = "gameUserId";

/**
 * Génère un ID aléatoire unique
 */
function generateUserId() {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Récupère ou crée un userId permanent pour cet utilisateur
 * @returns {string} L'userId permanent
 */
export function getUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    // Première visite : on crée un nouvel ID
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
    console.log("🆕 Nouvel utilisateur créé:", userId);
  } else {
    console.log("👤 Utilisateur existant:", userId);
  }

  return userId;
}

let sessionID = getUserId();

// CONNEXION : On envoie l'ID dans l'objet 'auth'
export const socket = io("http://localhost:3001", {
  auth: {
    sessionID: sessionID, // C'est ici que la magie opère
  },
});

socket.sessionID = sessionID;

socket.on("connect", () => {
  console.log(`Connecté avec le socket ID temporaire : ${socket.id}`);
});
