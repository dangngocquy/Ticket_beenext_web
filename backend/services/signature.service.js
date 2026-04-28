const { getDb } = require("../db");
const { ObjectId } = require("mongodb");

class SignatureService {
  /**
   * Save or update user signature
   */
  async saveSignature(userId, signatureDataUrl) {
    const db = await getDb();
    const signatures = db.collection("signatures");
    
    if (!userId) {
      throw new Error("userId is required");
    }
    
    // If signatureDataUrl is null, delete the signature
    if (signatureDataUrl === null) {
      const result = await signatures.deleteOne({ userId: String(userId) });
      return { userId: String(userId), signatureDataUrl: null, deleted: true };
    }
    
    // Validate it's a data URL
    if (!signatureDataUrl.startsWith("data:image")) {
      throw new Error("Invalid signature format");
    }
    
    // Validate size (max 500KB)
    if (signatureDataUrl.length > 500 * 1024) {
      throw new Error("Chữ ký quá lớn (tối đa 500KB)");
    }
    
    const userIdStr = String(userId);
    const timestamp = new Date();
    
    const result = await signatures.findOneAndUpdate(
      { userId: userIdStr },
      {
        $set: {
          userId: userIdStr,
          signatureDataUrl,
          updatedAt: timestamp,
        },
        $setOnInsert: {
          createdAt: timestamp,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    
    console.log(`[signature.service] ✓ Signature saved for user: ${userIdStr}`);
    
    return result;
  }

  /**
   * Get user signature
   */
  async getSignature(userId) {
    const db = await getDb();
    const signatures = db.collection("signatures");
    
    if (!userId) {
      throw new Error("userId is required");
    }
    
    const userIdStr = String(userId);
    const signature = await signatures.findOne({ userId: userIdStr });
    
    if (!signature) {
      return null;
    }
    
    return {
      userId: signature.userId,
      signatureDataUrl: signature.signatureDataUrl,
      createdAt: signature.createdAt,
      updatedAt: signature.updatedAt,
    };
  }

  /**
   * Get multiple signatures by user IDs
   */
  async getSignaturesByUserIds(userIds) {
    const db = await getDb();
    const signatures = db.collection("signatures");
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }
    
    const userIdStrs = userIds.map((id) => String(id));
    const results = await signatures
      .find({ userId: { $in: userIdStrs } })
      .toArray();
    
    return results;
  }

  /**
   * Delete user signature
   */
  async deleteSignature(userId) {
    const db = await getDb();
    const signatures = db.collection("signatures");
    
    if (!userId) {
      throw new Error("userId is required");
    }
    
    const userIdStr = String(userId);
    const result = await signatures.deleteOne({ userId: userIdStr });
    
    console.log(`[signature.service] ✓ Signature deleted for user: ${userIdStr}`);
    
    return result.deletedCount > 0;
  }
}

module.exports = new SignatureService();
