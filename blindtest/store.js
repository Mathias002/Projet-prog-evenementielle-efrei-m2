const Redis = require("ioredis");

// Configuration Redis (Docker)
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
});

const EXPIRATION_ROOM = 86400; // nettoyage auto des vieilles rooms après 24H

redis.on("connect", () => {
  console.log("✅ Tentative de connexion à Redis...");
});

redis.on("ready", () => {
  console.log("✅ Redis est prêt et connecté !");
});

redis.on("error", (err) => {
  console.error("❌ Erreur de connexion Redis :", err.message);
});

module.exports = {
  redis,

  // --- GESTION DES ROOMS ---
  
  async getRoom(roomCode) {
    const data = await redis.get(`room:${roomCode}`);
    return data ? JSON.parse(data) : null;
  },

  async saveRoom(roomCode, roomData) {
    await redis.set(`room:${roomCode}`, JSON.stringify(roomData), "EX", EXPIRATION_ROOM);
  },

  async deleteRoom(roomCode) {
    await redis.del(`room:${roomCode}`);
  },

  async roomExists(roomCode) {
    return (await redis.exists(`room:${roomCode}`)) === 1;
  },

  // --- GESTION USER -> ROOMS (Remplacement de userRooms) ---

  async addUserToRoomList(sessionID, roomCode) {
    // SADD = Set Add (Ajoute à une liste sans doublon)
    await redis.sadd(`user:rooms:${sessionID}`, roomCode);
    // expiration sur la session utilisateur (ex: 48h)
    await redis.expire(`user:rooms:${sessionID}`, 172800);
  },

  async getUserRooms(sessionID) {
    // SMEMBERS = Récupère tout le Set
    return await redis.smembers(`user:rooms:${sessionID}`);
  },

  async removeUserFromRoomList(sessionID, roomCode) {
    await redis.srem(`user:rooms:${sessionID}`, roomCode);
  },
  
  async deleteUserRooms(sessionID) {
      await redis.del(`user:rooms:${sessionID}`);
  },

  // --- GESTION SESSION -> SOCKET (Remplacement de activeUsers) ---
  
  async saveSessionSocket(sessionID, socketID) {
      await redis.set(`session:${sessionID}`, socketID, "EX", 172800);
  },
  
  async deleteSessionSocket(sessionID) {
      await redis.del(`session:${sessionID}`);
  }
};