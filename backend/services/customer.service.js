const { getDb } = require("../db");
const { ObjectId } = require("mongodb");
const { customerUpdateQueue, customerDeleteQueue } = require("../utils/queue");

class CustomerService {
  /**
   * Lấy tất cả khách hàng
   */
  async getAllCustomers() {
    const db = await getDb();
    const customers = db.collection("customers");
    return await customers.find({}).toArray();
  }

  /**
   * Thêm khách hàng
   */
  async createCustomer(customerData) {
    const db = await getDb();
    const customers = db.collection("customers");
    
    // Validate contacts array if provided
    if (customerData.contacts && Array.isArray(customerData.contacts)) {
      const validContacts = customerData.contacts.filter((c) => c.name && String(c.name).trim());
      if (customerData.contacts.length > 0 && validContacts.length === 0) {
        throw new Error("Phải có ít nhất một người liên hệ với tên hợp lệ");
      }
      customerData.contacts = validContacts;
    }
    
    // Validate company name
    if (!customerData.companyName || !String(customerData.companyName).trim()) {
      throw new Error("Tên công ty không được để trống");
    }
    
    // Generate ObjectId and store as ObjectId for consistency
    const recordId = new ObjectId();
    
    const result = await customers.insertOne({
      _id: recordId,
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return {
      _id: recordId.toString(),  // Return as string for frontend
      ...customerData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Cập nhật khách hàng
   * Sử dụng queue để tránh race condition
   */
  async updateCustomer(id, updateData) {
    return customerUpdateQueue.enqueue(() => this._performUpdateCustomer(id, updateData));
  }

  /**
   * Internal: Thực hiện update customer (gọi từ queue)
   */
  async _performUpdateCustomer(id, updateData) {
    const db = await getDb();
    const customers = db.collection("customers");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    // Validate contacts array if provided
    if (updateData.contacts && Array.isArray(updateData.contacts)) {
      const validContacts = updateData.contacts.filter((c) => c.name && String(c.name).trim());
      if (updateData.contacts.length > 0 && validContacts.length === 0) {
        throw new Error("Phải có ít nhất một người liên hệ với tên hợp lệ");
      }
      updateData.contacts = validContacts;
    }
    
    try {
      const idStr = String(id).trim();
      
      const updatePayload = {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      };

      let result = null;

      // Thử string format trước (vì database có thể lưu _id dưới dạng string)
      result = await customers.findOneAndUpdate(
        { _id: idStr },
        updatePayload,
        { returnDocument: "after" }
      );

      // MongoDB v6.x returns document directly, not in result.value
      if (result) {
        console.log(`[customer.service] ✓ Updated customer id: ${idStr}`);
        return result;
      }

      // Nếu không match, thử ObjectId format
      if (ObjectId.isValid(idStr)) {
        result = await customers.findOneAndUpdate(
          { _id: new ObjectId(idStr) },
          updatePayload,
          { returnDocument: "after" }
        );

        // MongoDB v6.x returns document directly
        if (result) {
          console.log(`[customer.service] ✓ Updated customer id: ${idStr}`);
          return result;
        }
      }

      // Không tìm thấy
      console.error(`[customer.service] ✗ No record found for id="${idStr}"`);
      return null;
    } catch (err) {
      console.error(`[customer.service] updateCustomer error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Xóa khách hàng
   * Sử dụng queue để tránh race condition
   */
  async deleteCustomer(id) {
    return customerDeleteQueue.enqueue(() => this._performDeleteCustomer(id));
  }

  /**
   * Internal: Thực hiện delete customer (gọi từ queue)
   */
  async _performDeleteCustomer(id) {
    const db = await getDb();
    const customers = db.collection("customers");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    try {
      const idStr = String(id).trim();
      
      // Thử string format trước
      let result = await customers.deleteOne({ _id: idStr });
      if (result && result.deletedCount > 0) return true;

      // Nếu không match, thử ObjectId format
      if (ObjectId.isValid(idStr)) {
        result = await customers.deleteOne({ _id: new ObjectId(idStr) });
        if (result && result.deletedCount > 0) return true;
      }

      return false;
    } catch (err) {
      console.error(`[customer.service] deleteCustomer error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Khởi tạo indexes
   */
  async initializeIndexes() {
    const db = await getDb();
    const customers = db.collection("customers");
    
    await customers.createIndex({ companyName: 1 });
    await customers.createIndex({ name: 1 });
    
    console.log("✓ Customer indexes initialized");
  }
}

module.exports = new CustomerService();
