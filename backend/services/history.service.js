const { getDb } = require("../db");
const dayjs = require("dayjs");
const { ObjectId } = require("mongodb");
const { ticketNumberQueue, historyUpdateQueue, historyDeleteQueue } = require("../utils/queue");

class HistoryService {
  _buildProjection(fieldsParam) {
    if (!fieldsParam) return null;
    const raw = Array.isArray(fieldsParam) ? fieldsParam.join(",") : String(fieldsParam);
    const fields = raw
      .split(",")
      .map((s) => String(s || "").trim())
      .filter(Boolean);
    if (fields.length === 0) return null;
    const projection = {};
    fields.forEach((f) => {
      if (f === "_id") return;
      projection[f] = 1;
    });
    // Always include _id to keep client logic stable
    projection._id = 1;
    return projection;
  }

  _normalizeFollowers(followers, nguoiThucHien) {
    const base = Array.isArray(followers) ? followers : followers ? [followers] : [];
    const merged = [...base, nguoiThucHien].filter(Boolean);
    const cleaned = merged
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);
    // unique, keep order
    return Array.from(new Set(cleaned));
  }

  /**
   * Lấy next ticket number bằng queue + atomic counter
   * Ensures sequential ticket numbers without duplication when multiple requests arrive simultaneously
   */
  async getNextTicketNumber(dateStr) {
    // Enqueue the actual ticket number generation to ensure sequential processing
    return ticketNumberQueue.enqueue(() => this._generateNextTicketNumber(dateStr));
  }

  /**
   * Internal: lấy next ticket number bằng atomic counter (called from queue)
   */
  async _generateNextTicketNumber(dateStr) {
    const db = await getDb();
    const history = db.collection("print_history");
    const counters = db.collection("counters");
    
    // Use current date for ticket numbering regardless of provided date
    const t = dayjs();
    
    const datePrefix = t.format("DDMM");
    const yearSuffix = t.format("YY");
    const dateKey = `${datePrefix}/${yearSuffix}`;
    
    // Kiểm tra xem counter đã tồn tại chưa
    let existingCounter = await counters.findOne({ 
      _id: dateKey 
    });
    
    // Nếu chưa có counter, cần sync với số phiếu lớn nhất trong database
    if (!existingCounter) {
      // Compute max sequence robustly using aggregation on `soPhieu` string
      // This avoids relying on `createdAt` which may be inconsistent and prevents gaps.
      const agg = await history
        .aggregate([
          { $match: { soPhieu: { $regex: `^${datePrefix}\\d{3}/${yearSuffix}$` } } },
          { $project: { seqStr: { $substrBytes: ["$soPhieu", 4, 3] } } },
          { $project: { seq: { $toInt: "$seqStr" } } },
          { $group: { _id: null, maxSeq: { $max: "$seq" } } },
        ])
        .toArray();

      const maxNumber = agg && agg[0] && agg[0].maxSeq ? agg[0].maxSeq : 0;

      const initResult = await counters.findOneAndUpdate(
        { _id: dateKey },
        {
          $setOnInsert: {
            _id: dateKey,
            seq: maxNumber,
            date: t.format("DD/MM/YYYY"),
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      existingCounter = initResult && initResult.value ? initResult.value : (await counters.findOne({ _id: dateKey }));
    }
    
    // Sử dụng findOneAndUpdate với $inc để tăng counter (atomic)
    const result = await counters.findOneAndUpdate(
      { _id: dateKey },
      { 
        $inc: { seq: 1 }
      },
      { 
        returnDocument: "after"
      }
    );
    let counter = 1;
    if (result && result.value && typeof result.value.seq === "number") {
      counter = result.value.seq;
    } else {
      const doc = await counters.findOne({ _id: dateKey });
      counter = doc && typeof doc.seq === "number" ? doc.seq : 1;
    }
    
    if (counter < 1) {
      counter = 1;
    }
    
    const ticketNumber = `${datePrefix}${counter.toString().padStart(3, "0")}/${yearSuffix}`;
    return ticketNumber;
  }

  /**
   * Thêm record vào history
   */
  async addHistory(data) {
    const db = await getDb();
    const history = db.collection("print_history");
    
    const recordData = {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      followers: this._normalizeFollowers(data?.followers, data?.nguoiThucHien),
      printed: false,
    };
    
    const result = await history.insertOne(recordData);
    const dbTimeline = db.collection("timeline");
    await dbTimeline.insertOne({
      historyId: result.insertedId,
      type: "created",
      by: recordData.createdBy || "unknown",
      timestamp: new Date(),
      changes: [],
    });
    
    // Return document with _id as string
    return {
      _id: result.insertedId.toString(),
      ...recordData,
    };
  }

  /**
   * Lấy số phiếu tiếp theo + lưu vào history trong 1 atomic operation
   * Tránh race condition khi nhiều người cùng nhấn
   * Đảm bảo mỗi phiếu có số unique
   */
  async createHistoryWithNextTicketNumber(data, dateStr) {
    // Enqueue để đảm bảo sequence khi nhiều request đồng thời
    return ticketNumberQueue.enqueue(async () => {
      const db = await getDb();
      const history = db.collection("print_history");
      
      let ticketNumber;
      if (data.soPhieu) {
        // Kiểm tra nếu soPhieu đã tồn tại
        const existing = await history.findOne({ soPhieu: data.soPhieu });
        if (!existing) {
          ticketNumber = data.soPhieu;
        } else {
          // Nếu đã tồn tại, generate mới
          ticketNumber = await this._generateNextTicketNumber(dateStr);
        }
      } else {
        // Không có soPhieu, generate mới
        ticketNumber = await this._generateNextTicketNumber(dateStr);
      }
      
      // Bước 2: Lưu vào database với số phiếu đã được generate
      const recordData = {
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
        soPhieu: ticketNumber,  // Gán số phiếu đã được lấy
        followers: this._normalizeFollowers(data?.followers, data?.nguoiThucHien),
        printed: false,
      };
      
      const result = await history.insertOne(recordData);
      const dbTimeline = db.collection("timeline");
      await dbTimeline.insertOne({
        historyId: result.insertedId,
        type: "created",
        by: recordData.createdBy || "unknown",
        timestamp: new Date(),
        changes: [],
      });
      
      return {
        _id: result.insertedId.toString(),
        ...recordData,
      };
    });
  }

  /**
   * Lấy timeline của phiếu theo historyId
   */
  async getTimelineByHistoryId(id) {
    const db = await getDb();
    const timeline = db.collection("timeline");
    if (!id) return [];

    const idStr = String(id).trim();
    const query = [];

    if (ObjectId.isValid(idStr)) {
      query.push({ historyId: new ObjectId(idStr) });
    }
    query.push({ historyId: idStr });

    const entries = await timeline
      .find({ $or: query })
      .sort({ timestamp: 1 })
      .toArray();

    if (entries.length > 0) return entries;

    // Fallback for old records that still store auditTrail inside history documents
    const historyRecord = await this.getHistoryById(idStr);
    if (!historyRecord) return [];

    const fallbackEntries = [];
    if (historyRecord.createdBy) {
      fallbackEntries.push({
        historyId: historyRecord._id,
        type: "created",
        by: historyRecord.createdBy,
        timestamp: historyRecord.createdAt || new Date(),
        changes: [],
      });
    }
    if (Array.isArray(historyRecord.auditTrail)) {
      historyRecord.auditTrail
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .forEach((item) => {
          fallbackEntries.push({
            historyId: historyRecord._id,
            type: "updated",
            by: item.updatedBy || historyRecord.updatedBy || historyRecord.createdBy || "unknown",
            timestamp: item.timestamp || historyRecord.updatedAt || new Date(),
            changes: item.changes || [],
          });
        });
    }

    return fallbackEntries;
  }

  /**
   * Tìm kiếm history
  /**
   * Tìm kiếm history
   */
  async searchHistory(
    { keyword = "", from, to, company, printed, loaiPhieu, nguoiThucHien, createdBy, status, page = 1, pageSize = 15 },
    { fields } = {}
  ) {
    const db = await getDb();
    const history = db.collection("print_history");
    const andConditions = [];
    const escapeRegexValue = (value) =>
      String(value || "").replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    
    if (keyword && keyword.trim()) {
      const regex = new RegExp(keyword.trim(), "i");
      andConditions.push({
        $or: [
          { soPhieu: regex },
          { khachHang: regex },
          { diaChi: regex },
          { nguoiThucHien: regex },
          { tinhTrang: regex },
        ],
      });
    }
    
    if (company) {
      const escapedCompany = escapeRegexValue(company);
      andConditions.push({ khachHang: new RegExp("^" + escapedCompany + "$", "i") });
    }
    
    // Filter by ticket date field `ngay` (dd/MM/yyyy),
    // not by record creation time `createdAt`.
    if (from && to) {
      const fromDate = dayjs(from).startOf("day").toDate();
      const toDate = dayjs(to).endOf("day").toDate();

      // `ngay` is stored as string: "DD/MM/YYYY". Convert it to date inside Mongo.
      // onError/onNull ensures invalid values won't match the range.
      andConditions.push({
        $expr: {
          $and: [
            {
              $ne: [
                {
                  $dateFromString: {
                    dateString: "$ngay",
                    format: "%d/%m/%Y",
                    onError: null,
                    onNull: null,
                  },
                },
                null,
              ],
            },
            {
              $gte: [
                {
                  $dateFromString: {
                    dateString: "$ngay",
                    format: "%d/%m/%Y",
                    onError: null,
                    onNull: null,
                  },
                },
                fromDate,
              ],
            },
            {
              $lte: [
                {
                  $dateFromString: {
                    dateString: "$ngay",
                    format: "%d/%m/%Y",
                    onError: null,
                    onNull: null,
                  },
                },
                toDate,
              ],
            },
          ],
        },
      });
    }
    
    if (typeof printed === "boolean") {
      andConditions.push({ printed });
    }
    
    if (loaiPhieu) {
      andConditions.push({ loaiPhieu });
    }
    
    if (nguoiThucHien) {
      const escapedNguoiThucHien = escapeRegexValue(nguoiThucHien);
      const exactRegex = new RegExp("^" + escapedNguoiThucHien + "$", "i");

      const usersCollection = db.collection("users");
      const matchingUsers = await usersCollection
        .find(
          {
            $or: [
              { key: nguoiThucHien },
              { username: nguoiThucHien },
              { fullNamePrivate: nguoiThucHien },
            ],
          },
          { projection: { key: 1, username: 1, fullNamePrivate: 1 } }
        )
        .toArray();

      const performerValues = Array.from(
        new Set(
          matchingUsers
            .flatMap((u) => [u.key, u.username, u.fullNamePrivate])
            .filter(Boolean)
            .map((v) => String(v).trim())
        )
      );

      if (performerValues.length > 0) {
        andConditions.push({
          $or: performerValues.map((value) => {
            const escapedValue = escapeRegexValue(value);
            return {
              nguoiThucHien: new RegExp("^" + escapedValue + "$", "i"),
            };
          }),
        });
      } else {
        andConditions.push({ nguoiThucHien: exactRegex });
      }
    }

    if (createdBy) {
      const escapedCreatedBy = escapeRegexValue(createdBy);
      const exactCreatedByRegex = new RegExp("^" + escapedCreatedBy + "$", "i");

      const usersCollection = db.collection("users");
      const matchingUsers = await usersCollection
        .find(
          {
            $or: [
              { key: createdBy },
              { username: createdBy },
              { fullNamePrivate: createdBy },
            ],
          },
          { projection: { key: 1, username: 1, fullNamePrivate: 1 } }
        )
        .toArray();

      const creatorValues = Array.from(
        new Set(
          matchingUsers
            .flatMap((u) => [u.key, u.username, u.fullNamePrivate])
            .filter(Boolean)
            .map((v) => String(v).trim())
        )
      );

      if (creatorValues.length > 0) {
        andConditions.push({
          $or: creatorValues.map((value) => {
            const escapedValue = escapeRegexValue(value);
            return {
              createdBy: new RegExp("^" + escapedValue + "$", "i"),
            };
          }),
        });
      } else {
        andConditions.push({ createdBy: exactCreatedByRegex });
      }
    }
    
    if (status) {
      const rawStatus = String(status || "").trim().toLowerCase();
      const normalizedStatus = (() => {
        if (
          !rawStatus ||
          rawStatus === "hoàn tất" ||
          rawStatus === "hoan tat" ||
          rawStatus === "done" ||
          rawStatus === "completed" ||
          rawStatus === "closed"
        ) {
          return "closed";
        }
        if (
          rawStatus === "đang xử lý" ||
          rawStatus === "dang xu ly" ||
          rawStatus === "in progress" ||
          rawStatus === "in_progress" ||
          rawStatus === "inprogress"
        ) {
          return "in_progress";
        }
        if (rawStatus === "pending") return "pending";
        if (rawStatus === "resolved") return "resolved";
        if (rawStatus === "assigned") return "assigned";
        if (rawStatus === "new") return "new";
        return rawStatus;
      })();

      if (normalizedStatus === "closed") {
        andConditions.push({
          $or: [
            { status: null },
            { status: { $exists: false } },
            { status: "" },
            { status: { $regex: /^(closed|done|completed|hoàn tất|hoan tat)$/i } },
          ],
        });
      } else if (normalizedStatus === "in_progress" || normalizedStatus === "pending") {
        andConditions.push({
          status: { $regex: new RegExp(`^${normalizedStatus}$`, "i") },
        });
      } else {
        andConditions.push({
          status: { $regex: new RegExp(`^${normalizedStatus}$`, "i") },
        });
      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};
    
    const skip = (page - 1) * pageSize;
    const limit = pageSize;

    const projection = this._buildProjection(fields);
    
    const [data, total] = await Promise.all([
      history
        .find(query, projection ? { projection } : undefined)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      history.countDocuments(query),
    ]);
    
    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Lấy tất cả history
   */
  async getAllHistory() {
    const db = await getDb();
    const history = db.collection("print_history");
    return await history.find({}).sort({ createdAt: -1 }).toArray();
  }

  /**
   * Lấy history record theo ID
   */
  async getHistoryById(id, { fields } = {}) {
    const db = await getDb();
    const history = db.collection("print_history");
    
    if (!id) {
      return null;
    }
    
    try {
      const idStr = String(id).trim();
      const projection = this._buildProjection(fields);
      const findOptions = projection ? { projection } : undefined;

      // Strategy 1: Try ObjectId format first
      if (ObjectId.isValid(idStr)) {
        const result = await history.findOne({ _id: new ObjectId(idStr) }, findOptions);
        if (result) return result;
      }

      // Strategy 2: Try string format as fallback
      const result = await history.findOne({ _id: idStr }, findOptions);
      if (result) return result;

      return null;
    } catch (err) {
      console.error(`[history.service] getHistoryById error for id=${id}:`, err);
      return null;
    }
  }

  /**
   * Cập nhật history (mark as printed, etc)
   */
  async updateHistory(id, updateData) {
    return historyUpdateQueue.enqueue(() => this._performUpdateHistory(id, updateData));
  }

  /**
   * Internal: Thực hiện update history (gọi từ queue)
   */
  async _performUpdateHistory(id, updateData) {
    const db = await getDb();
    const history = db.collection("print_history");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    const getValueString = (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch (e) {
          return String(value);
        }
      }
      return String(value);
    };

    const getSaveableChange = (field, oldValue, newValue) => ({
      field,
      newValue: newValue === undefined ? null : newValue,
    });

    try {
      const idStr = String(id).trim();
      const existingRecord = await this.getHistoryById(idStr);
      const changes = [];
      if (existingRecord && updateData && typeof updateData === "object") {
        Object.keys(updateData).forEach((field) => {
          if (
            field === "updatedAt" ||
            field === "auditTrail" ||
            field === "updatedBy" ||
            field === "currentUser" ||
            field === "createdBy"
          ) return;
          const oldValue = existingRecord[field];
          const newValue = updateData[field];
          const oldString = getValueString(oldValue);
          const newString = getValueString(newValue);
          if (oldString !== newString) {
            changes.push(getSaveableChange(field, oldValue, newValue));
          }
        });
      }

      const updatePayload = {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      };

      const dbTimeline = db.collection("timeline");
      let timelineEntry = null;
      if (changes.length > 0) {
        timelineEntry = {
          historyId: existingRecord._id,
          type: "updated",
          by: updateData.updatedBy || existingRecord?.updatedBy || "unknown",
          timestamp: new Date(),
          changes,
        };
      }

      let result = null;
      let updatedDoc = null;

      // Strategy 1: Try ObjectId format first (most common - MongoDB stores _id as ObjectId)
      if (ObjectId.isValid(idStr)) {
        result = await history.findOneAndUpdate(
          { _id: new ObjectId(idStr) },
          updatePayload,
          { returnDocument: "after" }
        );

        if (result) {
          updatedDoc = result.value || result;
        }
      }

      if (!updatedDoc) {
        // Strategy 2: Try string format as fallback
        result = await history.findOneAndUpdate(
          { _id: idStr },
          updatePayload,
          { returnDocument: "after" }
        );
        if (result) {
          updatedDoc = result.value || result;
        }
      }

      if (!updatedDoc && updateData.soPhieu) {
        // Strategy 3: Try partial match on soPhieu as fallback
        result = await history.findOneAndUpdate(
          { soPhieu: updateData.soPhieu },
          updatePayload,
          { returnDocument: "after" }
        );
        if (result) {
          updatedDoc = result.value || result;
        }
      }

      if (updatedDoc) {
        if (timelineEntry) {
          await dbTimeline.insertOne(timelineEntry);
        }
        return updatedDoc;
      }

      return null;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Xóa history
   * Sử dụng queue để tránh race condition
   */
  async deleteHistory(id) {
    return historyDeleteQueue.enqueue(() => this._performDeleteHistory(id));
  }

  /**
   * Internal: Thực hiện delete history (gọi từ queue)
   */
  async _performDeleteHistory(id) {
    const db = await getDb();
    const history = db.collection("print_history");
    
    if (!id) {
      throw new Error("ID is required");
    }
    
    try {
      const idStr = String(id).trim();
      
      // Try ObjectId format first (most common - MongoDB stores _id as ObjectId)
      if (ObjectId.isValid(idStr)) {
        let result = await history.deleteOne({ _id: new ObjectId(idStr) });
        if (result && result.deletedCount > 0) return true;
      }

      // Try string format as fallback
      let result = await history.deleteOne({ _id: idStr });
      if (result && result.deletedCount > 0) return true;

      return false;
    } catch (err) {
      console.error(`[history.service] deleteHistory error for id=${id}:`, err && err.message ? err.message : err);
      throw err;
    }
  }

  /**
   * Lấy suggestions cho tình trạng hoặc phương án xử lý
   * Trả về 6 suggestions mới nhất (theo count - tần số sử dụng)
   */
  async getSuggestions(field) {
    const db = await getDb();
    const history = db.collection("print_history");
    
    if (!field || (field !== "tinhTrang" && field !== "phuongAnXuLy")) {
      throw new Error("Field không hợp lệ");
    }
    
    const pipeline = [
      {
        $match: {
          [field]: { $exists: true, $ne: "", $ne: null }
        }
      },
      {
        $project: {
          value: `$${field}`,
          createdAt: 1
        }
      },
      {
        $group: {
          _id: "$value",
          count: { $sum: 1 },
          lastUsed: { $max: "$createdAt" }
        }
      },
      {
        $sort: { 
          lastUsed: -1,  // Mới nhất trước
          count: -1      // Nếu cùng ngày, dùng nhiều nhất trước
        }
      },
      {
        $limit: 6 // Giới hạn 6 suggestions mới nhất
      }
    ];
    
    const results = await history.aggregate(pipeline).toArray();
    const suggestions = results.map(r => r._id).filter(Boolean);
    
    return suggestions;
  }

  /**
   * Lấy history records theo danh sách IDs
   * Dùng cho in hàng loạt
   */
  async getHistoryByIds(ids, { fields } = {}) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return [];
    }
    
    const db = await getDb();
    const history = db.collection("print_history");
    
    // Chuyển đổi string IDs thành ObjectId
    const objectIds = ids
      .filter(id => id && typeof id === 'string' && id.length === 24)
      .map(id => {
        try {
          return new ObjectId(id);
        } catch (err) {
          return null;
        }
      })
      .filter(id => id !== null);
    
    if (objectIds.length === 0) {
      return [];
    }

    const projection = this._buildProjection(fields);
    
    const rows = await history
      .find({ _id: { $in: objectIds } }, projection ? { projection } : undefined)
      .sort({ createdAt: -1, _id: -1 })
      .toArray();
    
    return rows;
  }

  /**
   * Khởi tạo indexes
   */
  async initializeIndexes() {
    const db = await getDb();
    const history = db.collection("print_history");
    const counters = db.collection("counters");
    
    try {
      // Drop existing unique indexes that might have duplicates
      await history.dropIndex("ticketNumber_1").catch(() => {});
      await history.dropIndex("soPhieu_1").catch(() => {});
    } catch (e) {
      // Ignore if index doesn't exist
    }
    
    await history.createIndex({ createdAt: -1 });
    await history.createIndex({ soPhieu: 1 }, { unique: true, sparse: true });
    await history.createIndex({ khachHang: 1 });
    await history.createIndex({ diaChi: 1 });
    await history.createIndex({ nguoiThucHien: 1 });
    await history.createIndex({ createdBy: 1 });
    await history.createIndex({ printed: 1 });

    const timeline = db.collection("timeline");
    await timeline.createIndex({ historyId: 1 });
    await timeline.createIndex({ timestamp: 1 });
    
    // Don't add unique constraint to _id - it's already unique by default
    // Just ensure the counters collection exists
    await counters.findOne({ _id: "dummy" }).catch(() => {});
    
    console.log("✓ History indexes initialized");
  }
}

module.exports = new HistoryService();
