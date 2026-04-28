const { getDb } = require("../db");

class NotificationService {
  async createNotification(payload) {
    const db = await getDb();
    const notifications = db.collection("notifications");
    const doc = {
      type: String(payload?.type || "generic"),
      userKey: String(payload?.userKey || "").trim().toLowerCase(),
      title: String(payload?.title || ""),
      message: String(payload?.message || ""),
      ticketId: payload?.ticketId ? String(payload.ticketId) : "",
      soPhieu: payload?.soPhieu ? String(payload.soPhieu) : "",
      actor: payload?.actor ? String(payload.actor) : "",
      actorName: payload?.actorName ? String(payload.actorName) : "",
      assignedBy: payload?.assignedBy ? String(payload.assignedBy) : "",
      assignedByName: payload?.assignedByName ? String(payload.assignedByName) : "",
      status: payload?.status ? String(payload.status) : "",
      read: false,
      createdAt: new Date(),
      readAt: null,
    };
    if (!doc.userKey) return null;
    const result = await notifications.insertOne(doc);
    return { _id: String(result.insertedId), ...doc };
  }

  async listByUserKey(userKey, { page = 1, pageSize = 50 } = {}) {
    const db = await getDb();
    const notifications = db.collection("notifications");
    const key = String(userKey || "").trim().toLowerCase();
    if (!key) return { data: [], total: 0 };
    const skip = (Math.max(1, Number(page) || 1) - 1) * (Math.max(1, Number(pageSize) || 50));
    const limit = Math.max(1, Number(pageSize) || 50);
    const [data, total] = await Promise.all([
      notifications.find({ userKey: key }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      notifications.countDocuments({ userKey: key }),
    ]);
    return {
      data: (data || []).map((d) => ({ ...d, _id: String(d._id) })),
      total,
      page: Math.max(1, Number(page) || 1),
      pageSize: limit,
    };
  }

  async markAsRead(id, userKey) {
    const db = await getDb();
    const notifications = db.collection("notifications");
    const { ObjectId } = require("mongodb");
    const key = String(userKey || "").trim().toLowerCase();
    if (!id || !key) return null;
    const filter = { userKey: key };
    if (ObjectId.isValid(String(id))) filter._id = new ObjectId(String(id));
    else filter._id = String(id);
    const updated = await notifications.findOneAndUpdate(
      filter,
      { $set: { read: true, readAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!updated) return null;
    return { ...updated, _id: String(updated._id) };
  }

  async initializeIndexes() {
    const db = await getDb();
    const notifications = db.collection("notifications");
    await notifications.createIndex({ userKey: 1, createdAt: -1 });
    await notifications.createIndex({ read: 1 });
    console.log("✓ Notification indexes initialized");
  }
}

module.exports = new NotificationService();

