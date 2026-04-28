const express = require("express");
const router = express.Router();
const historyService = require("../services/history.service");
const userService = require("../services/user.service");
const notificationService = require("../services/notification.service");

/**
 * Helper function to format MongoDB documents
 * Converts ObjectId to string for JSON serialization
 */
function formatDoc(doc) {
  if (!doc) return doc;
  return {
    ...doc,
    _id: doc._id ? String(doc._id) : doc._id,
  };
}

function formatDocs(docs) {
  if (!Array.isArray(docs)) return docs;
  return docs.map(formatDoc);
}

/**
 * GET /api/history/next-ticket-number
 * Lấy số phiếu tiếp theo
 */
router.get("/next-ticket-number", async (req, res) => {
  try {
    const dateStr = req.query.date;
    const ticketNumber = await historyService.getNextTicketNumber(dateStr);
    
    res.json({
      success: true,
      data: { ticketNumber },
    });
  } catch (error) {
    console.error("Error getting next ticket number:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/history/create-with-ticket
 * ATOMIC: Lấy số phiếu tiếp theo + lưu vào history trong 1 operation
 * Tránh race condition khi nhiều người cùng nhấn
 * Yêu cầu: body chứa data cần lưu (không cần soPhieu, sẽ được generate)
 * Query param: date (optional, định dạng DD/MM/YYYY)
 */
router.post("/create-with-ticket", async (req, res) => {
  try {
    const dateStr = req.query.date;
    const authHeader = req.headers.authorization;
    let createdBy = String(req.body.createdBy || "unknown").trim() || "unknown";

    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [username] = credentials.split(":");
        if (username) {
          const authUser = await userService.getUserByKeyOrUsername(username);
          const authKey = authUser?.key || username;
          if (!createdBy || createdBy === "unknown") {
            createdBy = authKey;
          } else {
            const bodyUser = await userService.getUserByKeyOrUsername(createdBy);
            if (bodyUser?.key) {
              createdBy = bodyUser.key;
            }
          }
        }
      } catch (e) {
        // ignore; keep createdBy from body if present
      }
    }

    const record = await historyService.createHistoryWithNextTicketNumber({ ...req.body, createdBy }, dateStr);

    const io = req.app.get("io");
    if (io) {
      io.to("history").emit("history:new", record);
      try {
        const suggestions = await historyService.getSuggestions("tinhTrang");
        io.to("history").emit("suggestions:update", { field: "tinhTrang", suggestions });
      } catch (e) {
        console.warn("Failed to emit suggestions update:", e.message);
      }
      console.log("[history.route] history:new event emitted successfully!");
    } else {
      console.warn("[history.route] Socket.io instance not found!");
    }

    res.status(201).json({
      success: true,
      data: formatDoc(record),
    });
  } catch (error) {
    console.error("Error creating history with ticket number:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/history
 * Thêm record vào history
 */
router.post("/", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let createdBy = String(req.body.createdBy || "unknown").trim() || "unknown";
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [username] = credentials.split(":");
        if (username) {
          const authUser = await userService.getUserByKeyOrUsername(username);
          const authKey = authUser?.key || username;
          if (!createdBy || createdBy === "unknown") {
            createdBy = authKey;
          } else {
            const bodyUser = await userService.getUserByKeyOrUsername(createdBy);
            if (bodyUser?.key) {
              createdBy = bodyUser.key;
            }
          }
        }
      } catch (e) {}
    }

    const record = await historyService.addHistory({ ...req.body, createdBy });
    
    // Emit socket event to history room
    const io = req.app.get("io");
    if (io) {
      io.to("history").emit("history:new", record);
      // Emit suggestions update for autocomplete
      try {
        const suggestions = await historyService.getSuggestions("tinhTrang");
        io.to("history").emit("suggestions:update", { field: "tinhTrang", suggestions });
      } catch (e) {
        console.warn("Failed to emit suggestions update:", e.message);
      }
    }
    
    res.status(201).json({
      success: true,
      data: formatDoc(record),
    });
  } catch (error) {
    console.error("Error creating history record:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history
 * Tìm kiếm history
 */
router.get("/", async (req, res) => {
  try {
    const params = {
      keyword: req.query.keyword || "",
      from: req.query.from,
      to: req.query.to,
      company: req.query.company,
      printed: req.query.printed === "true" ? true : req.query.printed === "false" ? false : undefined,
      loaiPhieu: req.query.loaiPhieu,
      createdBy: req.query.createdBy,
      nguoiThucHien: req.query.nguoiThucHien,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 15,
    };

    // Optional projection: comma-separated list of fields.
    // Example: ?fields=soPhieu,ngay,khachHang,status,printed
    const fields = req.query.fields;

    const result = await historyService.searchHistory(params, { fields });
    
    res.json({
      success: true,
      data: {
        ...result,
        data: formatDocs(result.data),
      },
    });
  } catch (error) {
    console.error("Error searching history:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history/all
 * Lấy tất cả history
 */
router.get("/all", async (req, res) => {
  try {
    const data = await historyService.getAllHistory();
    
    res.json({
      success: true,
      data: formatDocs(data),
    });
  } catch (error) {
    console.error("Error fetching all history:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history/:id/timeline
 * Lấy timeline riêng cho phiếu
 */
router.get("/:id/timeline", async (req, res) => {
  try {
    const entries = await historyService.getTimelineByHistoryId(req.params.id);
    res.json({
      success: true,
      data: entries,
    });
  } catch (error) {
    console.error("Error fetching history timeline:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/history/:id
 * Cập nhật history record
 */
router.put("/:id", async (req, res) => {
  try {
    // Check current user from request body first, then Basic Auth header.
    let currentUser = String(req.body?.currentUser || "").trim() || "unknown";
    const authHeader = req.headers.authorization;
    if ((!currentUser || currentUser === "unknown") && authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [username] = credentials.split(":");
        if (username) {
          const foundUser = await userService.getUserByKeyOrUsername(username);
          currentUser = foundUser?.key || username;
        }
      } catch (e) {}
    }

    const existing = await historyService.getHistoryById(req.params.id);

    // If attempting to change status, ensure only the creator can do it when the status actually changes
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      const owner = existing && (existing.createdBy || existing.createdBy === "") ? existing.createdBy : null;
      const statusChanged = existing && String(existing.status || "").trim() !== String(req.body.status || "").trim();
      const currentActor = await userService.getUserByKeyOrUsername(currentUser);
      const actorUsername = String(currentActor?.username || "").trim().toLowerCase();
      const actorCanManage = currentActor?.canManage === true || currentActor?.canManage === "true";
      const actorIsAdmin = actorUsername === "admin";
      const canBypassOwnerCheck = actorCanManage || actorIsAdmin;
      if (
        statusChanged &&
        owner &&
        String(owner).trim().toLowerCase() !== String(currentUser).trim().toLowerCase() &&
        !canBypassOwnerCheck
      ) {
        return res.status(403).json({ success: false, error: "Forbidden: only the ticket creator can change status" });
      }
    }

    if (!req.body) req.body = {};
    if (!req.body.updatedBy) {
      req.body.updatedBy = currentUser;
    }

    // Normalize followers if present, and ensure performer is always included
    if (Object.prototype.hasOwnProperty.call(req.body, "followers")) {
      const rawFollowers = Array.isArray(req.body.followers)
        ? req.body.followers
        : req.body.followers
          ? [req.body.followers]
          : [];
      const performer = String(req.body?.nguoiThucHien || existing?.nguoiThucHien || "").trim();
      const merged = [...rawFollowers, performer].filter(Boolean);
      const normalized = Array.from(
        new Set(
          merged
            .map((v) => String(v || "").trim().toLowerCase())
            .filter(Boolean)
        )
      );
      req.body.followers = normalized;
    }

    const record = await historyService.updateHistory(req.params.id, req.body);

    if (!record) {
      return res.status(404).json({ success: false, error: "Không tìm thấy phiếu này" });
    }

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      // Phân biệt giữa cập nhật in và cập nhật khác
      const updateType = req.body.printed ? "print" : "update";
      
      if (updateType === "print") {
        io.to("tickets").emit("ticket:printed", {
          ticketId: req.params.id,
          soPhieu: record.soPhieu,
          nguoiInPhieu: req.body.nguoiInPhieu || record.nguoiInPhieu,
          timestamp: Date.now()
        });
      } else {
        io.to("history").emit("history:update", formatDoc(record));

        const nextPerformerRaw = String(req.body?.nguoiThucHien || record?.nguoiThucHien || "").trim();
        const prevPerformerRaw = String(existing?.nguoiThucHien || "").trim();
        const performerChanged =
          nextPerformerRaw &&
          nextPerformerRaw.toLowerCase() !== prevPerformerRaw.toLowerCase();
        const nextStatusRaw = String(req.body?.status || record?.status || "").trim().toLowerCase();
        const prevStatusRaw = String(existing?.status || "").trim().toLowerCase();
        const assignedNow = nextStatusRaw === "assigned" && prevStatusRaw !== "assigned";

        if (nextPerformerRaw && (performerChanged || assignedNow)) {
          try {
            const allUsers = await userService.getAllUsers();
            const normalizedTarget = nextPerformerRaw.toLowerCase();
            const targetUser = (allUsers || []).find((u) => {
              const key = String(u?.key || "").trim().toLowerCase();
              const username = String(u?.username || "").trim().toLowerCase();
              const fullName = String(u?.fullNamePrivate || "").trim().toLowerCase();
              return (
                (key && key === normalizedTarget) ||
                (username && username === normalizedTarget) ||
                (fullName && fullName === normalizedTarget)
              );
            });
            const targetKey = String(targetUser?.key || targetUser?.username || "").trim().toLowerCase();
            const actor = String(req.body?.updatedBy || currentUser || "unknown").trim();
            const actorUser = await userService.getUserByKeyOrUsername(actor);
            const actorDisplayName = actorUser
              ? String(actorUser?.fullNamePrivate || actorUser?.username || actorUser?.key || "").trim()
              : "";
            if (targetKey && targetKey !== actor.toLowerCase()) {
              const createdNotification = await notificationService.createNotification({
                type: "ticket-assigned",
                userKey: targetKey,
                title: record?.soPhieu
                  ? `Bạn có phiếu cần xử lý từ ${actorDisplayName || actor}`
                  : "Bạn có phiếu cần xử lý",
                message: record?.soPhieu
                  ? `Bạn có phiếu cần xử lý từ ${actorDisplayName || actor}: ${record?.soPhieu || ""}`
                  : `Bạn có phiếu cần xử lý từ ${actorDisplayName || actor}`,
                ticketId: String(req.params.id),
                soPhieu: record?.soPhieu || "",
                assignedBy: actor,
                assignedByName: actorDisplayName || undefined,
                status: String(req.body?.status || record?.status || "").trim(),
              });
              io.to(`user:key:${targetKey}`).emit("ticket:assigned", {
                notificationId: createdNotification?._id || `${req.params.id}:${Date.now()}`,
                ticketId: String(req.params.id),
                soPhieu: record?.soPhieu || "",
                assignedTo: targetKey,
                assignedBy: actor,
                assignedByName: actorDisplayName || undefined,
                status: String(req.body?.status || record?.status || "").trim(),
                timestamp: Date.now(),
              });
            }
          } catch (notifyErr) {
            console.warn("Failed to emit assignment notification:", notifyErr?.message || notifyErr);
          }
        }

        // Notify newly added followers when user is tagged to follow this ticket
        try {
          if (Object.prototype.hasOwnProperty.call(req.body || {}, "followers")) {
            const actor = String(req.body?.updatedBy || currentUser || "unknown").trim();
            const actorUser = await userService.getUserByKeyOrUsername(actor);
            const actorDisplayName = actorUser
              ? String(actorUser?.fullNamePrivate || actorUser?.username || actorUser?.key || "").trim()
              : "";
            const prevFollowers = Array.isArray(existing?.followers) ? existing.followers : [];
            const nextFollowers = Array.isArray(record?.followers) ? record.followers : [];
            const prevSet = new Set(prevFollowers.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean));
            const actorKey = String(actor || "").trim().toLowerCase();
            const newlyAdded = nextFollowers
              .map((v) => String(v || "").trim().toLowerCase())
              .filter((k) => k && !prevSet.has(k) && k !== actorKey);

            if (newlyAdded.length > 0) {
              await Promise.all(
                newlyAdded.map(async (userKey) => {
                  const title = record?.soPhieu
                    ? `${actorDisplayName || actor} đã gắn bạn theo dõi phiếu ${record.soPhieu}`
                    : `${actorDisplayName || actor} đã gắn bạn theo dõi 1 phiếu`;
                  const createdNotification = await notificationService.createNotification({
                    type: "ticket-followed",
                    userKey,
                    title,
                    message: title,
                    ticketId: String(req.params.id),
                    soPhieu: record?.soPhieu || "",
                    actor,
                    actorName: actorDisplayName || undefined,
                    status: String(req.body?.status || record?.status || "").trim(),
                  });
                  io.to(`user:key:${userKey}`).emit("ticket:followed", {
                    notificationId: createdNotification?._id || `${req.params.id}:${Date.now()}`,
                    ticketId: String(req.params.id),
                    soPhieu: record?.soPhieu || "",
                    actor,
                    actorName: actorDisplayName || undefined,
                    status: String(req.body?.status || record?.status || "").trim(),
                    timestamp: Date.now(),
                  });
                })
              );
            }
          }
        } catch (followTagErr) {
          console.warn("Failed to emit follower tag notifications:", followTagErr?.message || followTagErr);
        }

        // Notify followers when ticket is updated (exclude actor)
        // If the request only changes followers or performer fields, we skip this because
        // those cases already emit more specific notifications.
        const userControlledFields = ["updatedBy", "currentUser", "createdBy"];
        const changedPayloadKeys = Object.keys(req.body || {}).filter((key) => !userControlledFields.includes(key));
        const hasOnlySpecialFields =
          changedPayloadKeys.length > 0 &&
          changedPayloadKeys.every((key) => key === "followers" || key === "nguoiThucHien");
        const shouldNotifyFollowersUpdate = !hasOnlySpecialFields;

        try {
          if (shouldNotifyFollowersUpdate) {
            const actor = String(req.body?.updatedBy || currentUser || "unknown").trim();
            const actorUser = await userService.getUserByKeyOrUsername(actor);
            const actorDisplayName = actorUser
              ? String(actorUser?.fullNamePrivate || actorUser?.username || actorUser?.key || "").trim()
              : "";
            const followerKeysRaw = Array.isArray(record?.followers) ? record.followers : [];
            const performerKeyRaw = String(record?.nguoiThucHien || "").trim().toLowerCase();
            const mergedFollowers = Array.from(
              new Set(
                [...followerKeysRaw, performerKeyRaw]
                  .map((v) => String(v || "").trim().toLowerCase())
                  .filter(Boolean)
              )
            );
            const actorKey = String(actor || "").trim().toLowerCase();
            const toNotify = mergedFollowers.filter((k) => k && k !== actorKey);
            if (toNotify.length > 0) {
              await Promise.all(
                toNotify.map(async (userKey) => {
                  const notificationMessage = actorDisplayName
                    ? `${actorDisplayName} đã thay đổi phiếu ${record?.soPhieu || ""}`
                    : `Phiếu ${record?.soPhieu || ""} đã được cập nhật`;
                  const createdNotification = await notificationService.createNotification({
                    type: "ticket-followed-update",
                    userKey,
                    title: "Phiếu bạn theo dõi đã thay đổi",
                    message: notificationMessage,
                    ticketId: String(req.params.id),
                    soPhieu: record?.soPhieu || "",
                    actor,
                    actorName: actorDisplayName || undefined,
                    assignedBy: actor,
                    assignedByName: actorDisplayName || undefined,
                    status: String(req.body?.status || record?.status || "").trim(),
                  });
                  io.to(`user:key:${userKey}`).emit("ticket:followed-update", {
                    notificationId: createdNotification?._id || `${req.params.id}:${Date.now()}`,
                    ticketId: String(req.params.id),
                    soPhieu: record?.soPhieu || "",
                    actor: actorKey,
                    actorName: actorDisplayName || undefined,
                    status: String(req.body?.status || record?.status || "").trim(),
                    timestamp: Date.now(),
                  });
                })
              );
            }
          }
        } catch (followErr) {
          console.warn("Failed to emit follower update notifications:", followErr?.message || followErr);
        }
      }
    }

    res.json({ success: true, data: formatDoc(record) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/history/:id
 * Xóa/hủy history record
 * Nếu có param ?reason=cancelled, sẽ broadcast hủy, nếu không sẽ broadcast xóa
 */
router.delete("/:id", async (req, res) => {
  try {
    const record = await historyService.getHistoryById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy phiếu này",
      });
    }
    
    const success = await historyService.deleteHistory(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Không tìm thấy phiếu này",
      });
    }
    
    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      const hasExplicitReason = req.query.reason !== undefined || req.body.reason !== undefined;
      const reason = req.query.reason || req.body.reason || "Người dùng hủy";

      if (hasExplicitReason) {
        io.to("tickets").emit("ticket:cancelled", {
          ticketId: req.params.id,
          soPhieu: record.soPhieu,
          reason,
          timestamp: Date.now(),
        });
      } else {
        io.to("history").emit("history:delete", { _id: req.params.id });
      }
    } else {
      console.warn('[history:delete] io instance not found');
    }
    
    res.json({
      success: true,
      message: "Record deleted",
    });
  } catch (error) {
    console.error("Error deleting history:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history/suggestions
 * Lấy suggestions cho tình trạng hoặc phương án xử lý
 */
router.get("/suggestions", async (req, res) => {
  try {
    const { field } = req.query; // "tinhTrang" hoặc "phuongAnXuLy"
    if (!field || (field !== "tinhTrang" && field !== "phuongAnXuLy")) {
      return res.status(400).json({
        success: false,
        error: "Field không hợp lệ",
      });
    }
    
    const suggestions = await historyService.getSuggestions(field);
    
    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history/:id
 * Lấy chi tiết 1 phiếu theo id (hỗ trợ fields=... để giảm payload)
 *
 * Lưu ý: route này phải đặt SAU các route tĩnh như `/suggestions`
 * để tránh match nhầm `:id = "suggestions"`.
 */
router.get("/:id", async (req, res) => {
  try {
    const fields = req.query.fields;
    const record = await historyService.getHistoryById(req.params.id, { fields });
    if (!record) {
      return res.status(404).json({ success: false, error: "Không tìm thấy phiếu này" });
    }
    res.json({ success: true, data: formatDoc(record) });
  } catch (error) {
    console.error("Error fetching history by id:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/history/by-ids
 * Lấy history records theo danh sách IDs (dùng cho in hàng loạt)
 */
router.post("/by-ids", async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "IDs must be a non-empty array",
      });
    }
    
    const fields = req.query.fields;
    const records = await historyService.getHistoryByIds(ids, { fields });
    
    res.json({
      success: true,
      data: formatDocs(records),
    });
  } catch (error) {
    console.error("Error fetching history by IDs:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
