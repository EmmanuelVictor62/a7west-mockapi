import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load JSON databases
const crmDatabase = JSON.parse(fs.readFileSync("./data/crm.json", "utf-8"));
const essedaDatabase = JSON.parse(fs.readFileSync("./data/esseda.json", "utf-8"));
const haynesProDatabase = JSON.parse(fs.readFileSync("./data/haynespro.json", "utf-8"));

// In-memory booking storage (replace with real DB in production)
let bookings = [];

// ----------------------
// MIDDLEWARE: Optional Auth (commented out for testing)
// ----------------------
// app.use((req, res, next) => {
//   const auth = req.headers["authorization"];
//   if (!auth || auth !== "Bearer MOCK_TOKEN_123") {
//     return res.status(401).json({ error: "Unauthorized" });
//   }
//   next();
// });

// ----------------------
// UTILITY FUNCTIONS
// ----------------------
function normalizePlate(plate) {
  if (!plate) return null;
  return plate.toUpperCase().replace(/[\s-]/g, "");
}

function generateBookingId() {
  return "BOOKING-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5).toUpperCase();
}

function generateConfirmationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ----------------------
// 1. CRM CUSTOMER LOOKUP (NextLane Mock)
// ----------------------
app.post("/api/customer-lookup", (req, res) => {
  try {
    const plate = normalizePlate(req.body.license_plate);
    
    if (!plate) {
      return res.status(400).json({
        success: false,
        error: "License plate is required"
      });
    }

    const record = crmDatabase[plate];
    
    if (record) {
      res.json({
        success: true,
        customer: {
          id: record.customer.id,
          name: record.customer.name,
          phone: record.customer.phone,
          email: record.customer.email || `${record.customer.name.toLowerCase().replace(/\s/g, '.')}@email.ch`,
          vehicle: {
            plate: plate,
            brand: record.vehicle.brand,
            model: record.vehicle.model,
            year: record.vehicle.year,
            vin: record.vehicle.vin,
            engine: record.vehicle.engine || "Unknown"
          },
          isReturningCustomer: record.history ? record.history.visits > 0 : true,
          lastVisit: record.history?.lastVisit || null,
          totalVisits: record.history?.visits || 1
        },
        message: `Customer found: ${record.customer.name}`
      });
    } else {
      // New customer - no records found
      res.json({
        success: true,
        customer: {
          id: "CUST-NEW-" + Date.now(),
          name: "Neuer Kunde",
          phone: null,
          email: null,
          vehicle: {
            plate: plate,
            brand: "Unknown",
            model: "Unknown",
            year: null,
            vin: null,
            engine: null
          },
          isReturningCustomer: false,
          lastVisit: null,
          totalVisits: 0
        },
        message: "New customer - no records found in CRM"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// 2. TIRE INVENTORY & PRICING (Esseda Mock)
// ----------------------
app.post("/api/tire-inventory", (req, res) => {
  try {
    const plate = normalizePlate(req.body.license_plate);
    const tireType = req.body.tire_type; // 'summer', 'winter', 'allseason'
    
    if (!plate || !tireType) {
      return res.status(400).json({
        success: false,
        error: "License plate and tire_type are required"
      });
    }

    const vehicleData = essedaDatabase[plate];
    
    if (vehicleData) {
      // Filter tire options by requested type
      const matchingTires = vehicleData.tire_options.filter(
        tire => tire.season === tireType
      );

      res.json({
        success: true,
        license_plate: plate,
        vehicle: {
          brand: vehicleData.brand,
          model: vehicleData.model,
          fuel: vehicleData.fuel,
          type_certificate: vehicleData.type_certificate
        },
        tire_size: vehicleData.tire_size,
        requested_type: tireType,
        options: matchingTires,
        installation_time_minutes: 60,
        message: `Found ${matchingTires.length} tire option(s) for ${tireType} tires`
      });
    } else {
      // Unknown vehicle - return default options
      const defaultTires = {
        summer: [
          { brand: "Michelin", model: "Energy Saver", price_chf: 140, stock: 15, warehouse: "Zürich Nord" },
          { brand: "Continental", model: "EcoContact", price_chf: 135, stock: 20, warehouse: "Zürich Nord" }
        ],
        winter: [
          { brand: "Continental", model: "WinterContact", price_chf: 145, stock: 18, warehouse: "Zürich Nord" },
          { brand: "Pirelli", model: "Winter Sottozero", price_chf: 155, stock: 12, warehouse: "Bern Mitte" }
        ],
        allseason: [
          { brand: "Goodyear", model: "Vector 4Seasons", price_chf: 150, stock: 10, warehouse: "Zürich Nord" }
        ]
      };

      res.json({
        success: true,
        license_plate: plate,
        vehicle: null,
        tire_size: "205/55 R16 (Standard)",
        requested_type: tireType,
        options: defaultTires[tireType] || [],
        installation_time_minutes: 60,
        message: "Vehicle not found - showing standard tire options"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// 3. SERVICE TIME ESTIMATION (HaynesPro Mock)
// ----------------------
app.post("/api/service-estimate", (req, res) => {
  try {
    const vehicleModel = req.body.vehicle_model;
    const serviceType = req.body.service_type;
    const additionalNotes = req.body.additional_notes || "";
    
    if (!vehicleModel || !serviceType) {
      return res.status(400).json({
        success: false,
        error: "vehicle_model and service_type are required"
      });
    }

    // Look up in HaynesPro database
    const serviceData = haynesProDatabase[serviceType] || haynesProDatabase["general_repair"];
    
    // Add complexity multiplier based on vehicle brand (luxury = more time)
    let multiplier = 1.0;
    if (vehicleModel.toLowerCase().includes("bmw") || 
        vehicleModel.toLowerCase().includes("audi") || 
        vehicleModel.toLowerCase().includes("mercedes")) {
      multiplier = 1.2;
    }

    const estimatedDuration = Math.round(serviceData.base_duration_minutes * multiplier);
    const estimatedPrice = Math.round(serviceData.base_price_chf * multiplier);

    res.json({
      success: true,
      service_type: serviceType,
      vehicle_model: vehicleModel,
      estimated_duration_minutes: estimatedDuration,
      complexity: serviceData.complexity,
      estimated_price_chf: estimatedPrice,
      parts_required: serviceData.parts || [],
      mechanic_skill_required: serviceData.skill_level || "standard",
      additional_notes: additionalNotes,
      message: `Service will take approximately ${estimatedDuration} minutes (${Math.round(estimatedDuration/60)} hours)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ----------------------
// 5. CONFIRM BOOKING
// ----------------------
// app.post("/api/confirm-booking", (req, res) => {
//   try {
//     const {
//       customer_id,
//       appointment_datetime,
//       service_type,
//       license_plate,
//       notification_preference = "all"
//     } = req.body;
    
//     if (!customer_id || !appointment_datetime || !service_type || !license_plate) {
//       return res.status(400).json({
//         success: false,
//         error: "Missing required fields: customer_id, appointment_datetime, service_type, license_plate"
//       });
//     }

//     const bookingId = generateBookingId();
//     const confirmationCode = generateConfirmationCode();
    
//     const booking = {
//       id: bookingId,
//       customer_id: customer_id,
//       license_plate: normalizePlate(license_plate),
//       appointment_datetime: appointment_datetime,
//       service_type: service_type,
//       status: "confirmed",
//       confirmation_code: confirmationCode,
//       created_at: new Date().toISOString(),
//       notification_preference: notification_preference
//     };
    
//     // Store booking in memory
//     bookings.push(booking);
    
//     // Simulate notification sending
//     const notifications = {
//       sms: (notification_preference === "sms" || notification_preference === "all") 
//         ? { status: "sent", sent_at: new Date().toISOString() }
//         : { status: "skipped" },
//       whatsapp: (notification_preference === "whatsapp" || notification_preference === "all")
//         ? { status: "sent", sent_at: new Date().toISOString() }
//         : { status: "skipped" },
//       email: (notification_preference === "email" || notification_preference === "all")
//         ? { status: "sent", sent_at: new Date().toISOString() }
//         : { status: "skipped" }
//     };

//     res.json({
//       success: true,
//       booking: booking,
//       notifications: notifications,
//       message: `Booking confirmed successfully. Confirmation code: ${confirmationCode}`,
//       next_steps: [
//         "Confirmation sent via selected channels",
//         "Reminder will be sent 24 hours before appointment",
//         "Please arrive 10 minutes early"
//       ]
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// ----------------------
// 6. ESCALATE TO HUMAN
// ----------------------
// app.post("/api/escalate-human", (req, res) => {
//   try {
//     const {
//       reason,
//       context_summary,
//       customer_id = "UNKNOWN"
//     } = req.body;
    
//     if (!reason || !context_summary) {
//       return res.status(400).json({
//         success: false,
//         error: "reason and context_summary are required"
//       });
//     }

//     const escalationId = "ESC-" + Date.now();
//     const timestamp = new Date().toISOString();
    
//     const escalation = {
//       id: escalationId,
//       customer_id: customer_id,
//       reason: reason,
//       context: context_summary,
//       timestamp: timestamp,
//       assigned_to: "next_available_agent",
//       priority: reason === "emergency" ? "high" : "normal",
//       status: "pending_transfer"
//     };

//     res.json({
//       success: true,
//       escalation: escalation,
//       transfer_info: {
//         queue: reason === "emergency" ? "emergency_queue" : "general_queue",
//         estimated_wait_seconds: reason === "emergency" ? 0 : 30,
//         agent_status: "connecting..."
//       },
//       message: "Call escalated to human operator. Please hold.",
//       hold_music: "enabled"
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       error: error.message
//     });
//   }
// });

// ----------------------
// ADMIN ENDPOINTS (for testing/debugging)
// ----------------------

// View all bookings
app.get("/api/admin/bookings", (req, res) => {
  res.json({
    success: true,
    total: bookings.length,
    bookings: bookings
  });
});

// Clear all bookings
app.delete("/api/admin/bookings", (req, res) => {
  const count = bookings.length;
  bookings = [];
  res.json({
    success: true,
    message: `Cleared ${count} bookings`
  });
});

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.json({ 
    status: "Mock API online ✅",
    version: "2.0",
    endpoints: {
      customer_lookup: "POST /api/customer-lookup",
      tire_inventory: "POST /api/tire-inventory",
      service_estimate: "POST /api/service-estimate",
      // confirm_booking: "POST /api/confirm-booking",
      // escalate_human: "POST /api/escalate-human",
      admin_bookings: "GET /api/admin/bookings"
    },
    timestamp: new Date().toISOString()
  });
});

// ----------------------
// ERROR HANDLER
// ----------------------
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message
  });
});

// ----------------------
// START SERVER
// ----------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Mock API Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/`);
  // console.log(`📋 All bookings: http://localhost:${PORT}/api/admin/bookings`);
});