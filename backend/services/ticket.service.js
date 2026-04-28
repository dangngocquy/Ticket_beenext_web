const { getDb } = require("../db");
const { ObjectId } = require("mongodb");
const { ticketNumberQueue, ticketUpdateQueue, ticketDeleteQueue } = require("../utils/queue");

class TicketService {
  /**
   * Lấy next ticket number bằng queue + atomic counter (thread-safe)
   * Ensures sequential ticket numbers without duplication when multiple requests arrive simultaneously
   */
  async getNextTicketNumber() {
    return ticketNumberQueue.enqueue(() => this._generateNextTicketNumber());
  }

  /**
   * Internal: lấy next ticket number bằng atomic counter (called from queue)
   */
  async _generateNextTicketNumber() {
    const db = await getDb();
    const tickets = db.collection("tickets");
    const counters = db.collection("counters");

    // Lấy ngày hiện tại
    const now = new Date();
    const datePrefix = String(now.getDate()).padStart(2, "0") + String(now.getMonth() + 1).padStart(2, "0"); // DDMM
    const yearSuffix = String(now.getFullYear()).slice(-2); // YY
    const dateKey = `${datePrefix}/${yearSuffix}`; // same format as history.service

    // Nếu chưa có counter cho ngày này, khởi tạo bằng giá trị lớn nhất đã có trong collection tickets
    let existingCounter = await counters.findOne({ _id: dateKey });

    if (!existingCounter) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const existingTickets = await tickets
        .find({
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          ticketNumber: { $regex: `^${datePrefix}\\d+/${yearSuffix}$` },
        })
        .toArray();

      let maxNumber = 0;
      existingTickets.forEach((doc) => {
        const tnum = doc.ticketNumber;
        if (tnum) {
          const match = tnum.match(/^(\d{4})(\d+)\/(\d{2})$/);
          if (match && match[1] === datePrefix && match[3] === yearSuffix) {
            const num = parseInt(match[2], 10);
            if (num > maxNumber) maxNumber = num;
          }
        }
      });

      const initResult = await counters.findOneAndUpdate(
        { _id: dateKey },
        {
          $setOnInsert: {
            _id: dateKey,
            seq: maxNumber,
            date: `${datePrefix}/${yearSuffix}`,
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      existingCounter = initResult || (await counters.findOne({ _id: dateKey }));
    }

    // Tăng counter (atomic)
    const result = await counters.findOneAndUpdate(
      { _id: dateKey },
      { $inc: { seq: 1 } },
      { returnDocument: "after" }
    );

    let seq = 1;
    if (result && typeof result.seq === "number") {
      seq = result.seq;
    } else if (result && result.value && typeof result.value.seq === "number") {
      seq = result.value.seq;
    } else {
      const doc = await counters.findOne({ _id: dateKey });
      seq = (doc && doc.seq) ? doc.seq : 1;
    }

    if (seq < 1) seq = 1;

    const seqStr = String(seq).padStart(3, "0");
    return `${datePrefix}${seqStr}/${yearSuffix}`;
  }

  /**
   * Tạo phiếu mới
   * @param {Object} ticketData - Dữ liệu phiếu (bao gồm createdBy - người tạo)
   */
  async createTicket(ticketData) {
    const db = await getDb();
    const tickets = db.collection("tickets");
    
    // Lấy số phiếu tiếp theo (atomic, thread-safe qua queue)
    const ticketNumber = await this.getNextTicketNumber();
    
    // Lưu người tạo (createdBy) - chỉ người này mới có quyền chỉnh sửa
    const newTicket = {
      ...ticketData,
      ticketNumber,
      createdBy: ticketData.createdBy, // Người tạo phiếu
      status: ticketData.status || "đang xử lý", // Trạng thái mặc định
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const result = await tickets.insertOne(newTicket);
    
    return {
      _id: result.insertedId,
      ...newTicket,
    };
  }

  /**
   * Lấy danh sách tất cả phiếu
   */
  async getAllTickets(filter = {}) {
    const db = await getDb();
    const tickets = db.collection("tickets");
    
    return await tickets.find(filter).sort({ createdAt: -1 }).toArray();
  }

  /**
   * Lấy phiếu theo ID
   */
  async getTicketById(id) {
    const db = await getDb();
    const tickets = db.collection("tickets");
    
    return await tickets.findOne({ _id: new ObjectId(id) });
  }

  /**
   * Cập nhật phiếu - chỉ người tạo phiếu mới có quyền chỉnh sửa
   * Sử dụng queue để tránh race condition khi nhiều người cùng update
   * @param {string} id - ID của phiếu
   * @param {Object} updateData - Dữ liệu cập nhật
   * @param {string} currentUser - Người yêu cầu cập nhật (từ request)
   * @throws {Error} Nếu người yêu cầu không phải là người tạo phiếu
   */
  async updateTicket(id, updateData, currentUser) {
    return ticketUpdateQueue.enqueue(() => 
      this._performUpdateTicket(id, updateData, currentUser)
    );
  }

  /**
   * Internal: Thực hiện cập nhật phiếu (gọi từ queue)
   */
  async _performUpdateTicket(id, updateData, currentUser) {
    const db = await getDb();
    const tickets = db.collection("tickets");
    
    // Lấy phiếu hiện tại để kiểm tra quyền
    const currentTicket = await tickets.findOne({ _id: new ObjectId(id) });
    
    if (!currentTicket) {
      throw new Error("Ticket not found");
    }
    
    // Kiểm tra quyền: chỉ người tạo mới có quyền chỉnh sửa
    if (currentTicket.createdBy !== currentUser) {
      throw new Error("Unauthorized: Only the ticket creator can edit this ticket");
    }
    
    const result = await tickets.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    
    return result; // MongoDB v6.x returns document directly
  }

  /**
   * Xóa phiếu
   * Sử dụng queue để tránh race condition
   */
  async deleteTicket(id) {
    return ticketDeleteQueue.enqueue(() => this._performDeleteTicket(id));
  }

  /**
   * Internal: Thực hiện xóa phiếu (gọi từ queue)
   */
  async _performDeleteTicket(id) {
    const db = await getDb();
    const tickets = db.collection("tickets");
    
    const result = await tickets.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Khởi tạo indexes + reset counter cho hôm nay (chạy một lần khi start server)
   */
  async initializeIndexes() {
    const db = await getDb();
    const tickets = db.collection("tickets");
    const counters = db.collection("counters");
    
    try {
      // Drop existing unique indexes that might have duplicates
      await tickets.dropIndex("ticketNumber_1").catch(() => {});
    } catch (e) {
      // Ignore if index doesn't exist
    }
    
    // Tạo sparse unique index cho ticketNumber to allow null values
    await tickets.createIndex({ ticketNumber: 1 }, { unique: true, sparse: true });
    
    // Index cho createdAt để sort nhanh
    await tickets.createIndex({ createdAt: -1 });
    
    // Reset counter cho hôm nay (force khởi tạo lại từ max trong tickets)
    const now = new Date();
    const datePrefix = String(now.getDate()).padStart(2, "0") + String(now.getMonth() + 1).padStart(2, "0");
    const yearSuffix = String(now.getFullYear()).slice(-2);
    const dateKey = `${datePrefix}/${yearSuffix}`;
    
    // Xóa counter cũ của hôm nay để tự khởi tạo lại
    await counters.deleteOne({ _id: dateKey });
    
    console.log("✓ Ticket indexes initialized");
  }
}

module.exports = new TicketService();
