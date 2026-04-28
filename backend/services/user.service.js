const { getDb } = require("../db");
const crypto = require("crypto");
const { ObjectId } = require("mongodb");
const { userUpdateQueue, userDeleteQueue } = require("../utils/queue");

class UserService {
  async generateUniqueUserKey(usersCollection) {
    for (let i = 0; i < 10; i += 1) {
      const candidate = `U${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const exists = await usersCollection.findOne({ key: candidate }, { projection: { _id: 1 } });
      if (!exists) return candidate;
    }
    throw new Error("Không thể tạo key duy nhất cho user");
  }
  /**
   * Lấy tất cả users
   */
  async getAllUsers() {
    const db = await getDb();
    const users = db.collection("users");
    // Không trả về password
    return await users.find({}, { projection: { password: 0 } }).toArray();
  }

  /**
   * Lấy user theo ID / key / username
   */
  async getUserById(id) {
    const db = await getDb();
    const users = db.collection("users");
    const idStr = String(id || "").trim();
    if (!idStr) return null;

    let user = await users.findOne({ _id: idStr }, { projection: { password: 0 } });
    if (user) return user;

    if (ObjectId.isValid(idStr)) {
      user = await users.findOne({ _id: new ObjectId(idStr) }, { projection: { password: 0 } });
      if (user) return user;
    }

    user = await users.findOne(
      { $or: [{ key: idStr }, { username: idStr }] },
      { projection: { password: 0 } }
    );
    return user;
  }

  /**
   * Lấy user theo username (cho login)
   */
  async getUserByUsername(username) {
    const db = await getDb();
    const users = db.collection("users");
    return await users.findOne({ username });
  }

  /**
   * Lấy user theo key hoặc username (cho login - kiểm tra cả users và customer_accounts)
   */
  async getUserByKeyOrUsername(identifier) {
    const db = await getDb();
    const users = db.collection("users");
    const customerAccounts = db.collection("customer_accounts");
    
    const value = String(identifier || "").trim();
    if (!value) return null;
    
    // Try users collection first
    let user = await users.findOne({
      $or: [{ key: value }, { username: value }],
    });
    
    if (user) {
      user.collection = "users";
      return user;
    }
    
    // Try customer_accounts collection
    user = await customerAccounts.findOne({
      $or: [{ key: value }, { username: value }],
    });
    
    if (user) {
      user.collection = "customer_accounts";
      return user;
    }
    
    return null;
  }

  /**
   * Tạo user
   */
  async createUser(userData) {
    const db = await getDb();
    const users = db.collection("users");
    
    // Hash password
    const hashedPassword = this.hashPassword(userData.password);
    
    // Generate ObjectId and store as ObjectId for consistency
    const recordId = new ObjectId();
    
    const userKey = await this.generateUniqueUserKey(users);

    const result = await users.insertOne({
      _id: recordId,
      ...userData,
      key: userKey,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return {
      _id: recordId.toString(),  // Return as string for frontend
      ...userData,
      key: userKey,
      password: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Cập nhật user
   * Sử dụng queue để tránh race condition
   */
  async updateUser(id, updateData) {
    return userUpdateQueue.enqueue(() => this._performUpdateUser(id, updateData));
  }

  /**
   * Internal: Thực hiện update user (gọi từ queue)
   */
  async _performUpdateUser(id, updateData) {
    const db = await getDb();
    const users = db.collection("users");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    try {
      const dataToUpdate = { ...updateData };
      if (dataToUpdate.password) {
        dataToUpdate.password = this.hashPassword(dataToUpdate.password);
      }

      const idStr = String(id).trim();
      
      const updatePayload = {
        $set: {
          ...dataToUpdate,
          updatedAt: new Date(),
        },
      };

      let result = null;
      let updatedUser = null;

      // Thử string format trước (vì database có thể lưu _id dưới dạng string)
      result = await users.findOneAndUpdate(
        { _id: idStr },
        updatePayload,
        { returnDocument: "after" }
      );

      if (result) {
        if (result.value !== undefined) {
          updatedUser = result.value;
        } else if (result._id !== undefined || result.username !== undefined || result.key !== undefined) {
          updatedUser = result;
        }
      }

      if (updatedUser) {
        console.log(`[user.service] ✓ Updated user id: ${idStr}`);
        delete updatedUser.password;
        return updatedUser;
      }

      // Nếu không match, thử ObjectId format
      if (ObjectId.isValid(idStr)) {
        result = await users.findOneAndUpdate(
          { _id: new ObjectId(idStr) },
          updatePayload,
          { returnDocument: "after" }
        );

        if (result) {
          if (result.value !== undefined) {
            updatedUser = result.value;
          } else if (result._id !== undefined || result.username !== undefined || result.key !== undefined) {
            updatedUser = result;
          }
        }

        if (updatedUser) {
          console.log(`[user.service] ✓ Updated user id: ${idStr}`);
          delete updatedUser.password;
          return updatedUser;
        }
      }

      // Nếu vẫn chưa match, thử lookup theo key hoặc username
      result = await users.findOneAndUpdate(
        { $or: [{ key: idStr }, { username: idStr }] },
        updatePayload,
        { returnDocument: "after" }
      );

      if (result) {
        if (result.value !== undefined) {
          updatedUser = result.value;
        } else if (result._id !== undefined || result.username !== undefined || result.key !== undefined) {
          updatedUser = result;
        }
      }

      if (updatedUser) {
        console.log(`[user.service] ✓ Updated user by key/username: ${idStr}`);
        delete updatedUser.password;
        return updatedUser;
      }

      // Không tìm thấy
      console.error(`[user.service] ✗ No record found for id="${idStr}"`);
      return null;
    } catch (err) {
      console.error(`[user.service] updateUser error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Xóa user
   * Sử dụng queue để tránh race condition
   */
  async deleteUser(id) {
    return userDeleteQueue.enqueue(() => this._performDeleteUser(id));
  }

  /**
   * Internal: Thực hiện delete user (gọi từ queue)
   */
  async _performDeleteUser(id) {
    const db = await getDb();
    const users = db.collection("users");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    try {
      const idStr = String(id).trim();
      
      // Thử string format trước
      let result = await users.deleteOne({ _id: idStr });
      if (result && result.deletedCount > 0) return true;

      // Nếu không match, thử ObjectId format
      if (ObjectId.isValid(idStr)) {
        result = await users.deleteOne({ _id: new ObjectId(idStr) });
        if (result && result.deletedCount > 0) return true;
      }

      return false;
    } catch (err) {
      console.error(`[user.service] deleteUser error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Hash password
   */
  hashPassword(password) {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  /**
   * Verify password
   */
  verifyPassword(password, hash) {
    return this.hashPassword(password) === hash;
  }

  /**
   * Đổi mật khẩu người dùng
   */
  async changePassword(id, oldPassword, newPassword) {
    const db = await getDb();
    const users = db.collection("users");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    try {
      const idStr = String(id).trim();
      
      // Tìm user
      let user = await users.findOne({ _id: idStr });
      
      // Nếu không match, thử ObjectId format
      if (!user && ObjectId.isValid(idStr)) {
        user = await users.findOne({ _id: new ObjectId(idStr) });
      }
      
      if (!user) {
        return null;
      }
      
      // Kiểm tra mật khẩu cũ
      if (!this.verifyPassword(oldPassword, user.password)) {
        return null;
      }
      
      // Hash mật khẩu mới
      const hashedNewPassword = this.hashPassword(newPassword);
      
      // Cập nhật mật khẩu
      let result = await users.findOneAndUpdate(
        { _id: idStr },
        {
          $set: {
            password: hashedNewPassword,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      // MongoDB v6.x returns document directly
      if (result) {
        console.log(`[user.service] ✓ Changed password for user id: ${idStr}`);
        delete result.password;
        return result;
      }

      // Nếu không match, thử ObjectId format
      if (ObjectId.isValid(idStr)) {
        result = await users.findOneAndUpdate(
          { _id: new ObjectId(idStr) },
          {
            $set: {
              password: hashedNewPassword,
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

        if (result) {
          console.log(`[user.service] ✓ Changed password for user id: ${idStr}`);
          delete result.password;
          return result;
        }
      }

      return null;
    } catch (err) {
      console.error(`[user.service] changePassword error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Khởi tạo indexes
   */
  async initializeIndexes() {
    const db = await getDb();
    const users = db.collection("users");
    
    // Drop existing indexes on 'key' to avoid duplicate key errors
    try {
      await users.dropIndex("key_1");
    } catch (err) {
      // Index might not exist yet, that's fine
      if (err.code !== 27) { // 27 = index not found
        console.warn("Warning: Error dropping existing key index:", err.message);
      }
    }

    // Remove duplicate empty key documents (keep only first one)
    try {
      const emptyKeyDocs = await users.find({ key: { $in: ["", null, undefined] } }).toArray();
      if (emptyKeyDocs.length > 1) {
        console.log(`Found ${emptyKeyDocs.length} documents with empty/null key. Cleaning up...`);
        // Keep the first one, remove the rest
        const idsToRemove = emptyKeyDocs.slice(1).map(doc => doc._id);
        if (idsToRemove.length > 0) {
          await users.deleteMany({ _id: { $in: idsToRemove } });
          console.log(`✓ Removed ${idsToRemove.length} duplicate empty key documents`);
        }
      }
    } catch (err) {
      console.warn("Warning: Error cleaning up empty key documents:", err.message);
    }

    // Now create the indexes
    await users.createIndex({ username: 1 }, { unique: true });
    await users.createIndex({ key: 1 }, { unique: true, sparse: true });

    // Migrate any existing plaintext passwords to SHA-256 hashes.
    // Some older installations stored passwords in plaintext. We detect
    // non-hashed passwords (not matching 64-hex chars) and replace them
    // with their SHA-256 hash so login works with current code.
    try {
      const cursor = users.find({}, { projection: { _id: 1, password: 1, username: 1 } });
      const toUpdate = [];
      const hex64 = /^[a-f0-9]{64}$/i;
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const pw = doc && doc.password;
        if (typeof pw === "string" && !hex64.test(pw)) {
          // looks like a plaintext password; schedule for re-hash
          const hashed = this.hashPassword(pw);
          toUpdate.push({ id: doc._id, hashed });
        }
      }

      if (toUpdate.length) {
        console.log(`Found ${toUpdate.length} user(s) with plaintext passwords. Migrating to hashed passwords...`);
        for (const u of toUpdate) {
          await users.updateOne({ _id: u.id }, { $set: { password: u.hashed, updatedAt: new Date() } });
          console.log(`  - Migrated user id=${u.id}`);
        }
        console.log('✓ Password migration completed');
      }
    } catch (err) {
      console.error('Error during password migration:', err && err.message ? err.message : err);
    }

    // Ensure all existing users have a unique key.
    try {
      const cursor = users.find(
        {
          $or: [{ key: { $exists: false } }, { key: null }, { key: "" }],
        },
        { projection: { _id: 1 } }
      );
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const generatedKey = await this.generateUniqueUserKey(users);
        await users.updateOne(
          { _id: doc._id },
          { $set: { key: generatedKey, updatedAt: new Date() } }
        );
      }
    } catch (err) {
      console.error("Error during user key migration:", err && err.message ? err.message : err);
    }

    console.log("✓ User indexes initialized");
  }
}

module.exports = new UserService();
