const express = require("express");
const router = express.Router();
const customerService = require("../services/customer.service");

/**
 * GET /api/customers
 * Lấy tất cả khách hàng
 */
router.get("/", async (req, res) => {
  try {
    const customers = await customerService.getAllCustomers();
    
    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/customers
 * Tạo khách hàng mới
 */
router.post("/", async (req, res) => {
  try {
    const customer = await customerService.createCustomer(req.body);
    
    // Emit socket event to customers room
    const io = req.app.get("io");
    if (io) {
      io.to("customers").emit("customer:new", customer);
    }
    
    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/customers/:id
 * Cập nhật khách hàng
 */
router.put("/:id", async (req, res) => {
  try {
    const customer = await customerService.updateCustomer(req.params.id, req.body);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }
    
    // Emit socket event to customers room
    const io = req.app.get("io");
    if (io) {
      io.to("customers").emit("customer:update", customer);
    }
    
    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/customers/:id
 * Xóa khách hàng
 */
router.delete("/:id", async (req, res) => {
  try {
    const success = await customerService.deleteCustomer(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }
    
    // Emit socket event to customers room
    const io = req.app.get("io");
    if (io) {
      io.to("customers").emit("customer:delete", { _id: req.params.id });
    }
    
    res.json({
      success: true,
      message: "Customer deleted",
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
