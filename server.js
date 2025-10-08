import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ----------------------
//  NEXTLANE CRM MOCK
// ----------------------
const crmDatabase = {
  "ZH12345": {
    customer: { id: "CUST001", name: "Hans Meier", phone: "+41791234567" },
    vehicle: { brand: "Audi", model: "A4", year: 2019, vin: "WAUZZZ8K9AA123456" },
  },
  "BE45678": {
    customer: { id: "CUST002", name: "Lara Schmid", phone: "+41795551234" },
    vehicle: { brand: "BMW", model: "X3", year: 2021, vin: "WBAXX32010F998877" },
  },
  "GE98765": {
    customer: { id: "CUST003", name: "Marco Rossi", phone: "+41793334455" },
    vehicle: { brand: "Tesla", model: "Model 3", year: 2023, vin: "5YJ3E1EA7LF789012" },
  },
};

// CRM endpoint
app.post("/api/crm", (req, res) => {
  const plate = req.body.plate?.toUpperCase();
  const record = crmDatabase[plate];
  if (record) {
    res.json({ found: true, ...record });
  } else {
    res.json({ found: false, message: "Kein Kunde mit diesem Kennzeichen gefunden." });
  }
});

// ----------------------
//  ESSEDA MOCK
// ----------------------
const essedaDatabase = {
  "ZH12345": {
    plate: "ZH12345",
    type_certificate: "1AFR9876",
    brand: "Audi",
    model: "A4 Avant",
    fuel: "Diesel",
    tire_type: "Winterreifen",
    tire_size: "225/45 R17",
    stock: 24,
    price_per_tire: 120,
    warehouse: "Zürich Nord",
  },
  "BE45678": {
    plate: "BE45678",
    type_certificate: "2BTR3456",
    brand: "BMW",
    model: "X3",
    fuel: "Benzin",
    tire_type: "Sommerreifen",
    tire_size: "245/50 R18",
    stock: 10,
    price_per_tire: 145,
    warehouse: "Bern Mitte",
  },
  "GE98765": {
    plate: "GE98765",
    type_certificate: "3TES1234",
    brand: "Tesla",
    model: "Model 3",
    fuel: "Elektrisch",
    tire_type: "Ganzjahresreifen",
    tire_size: "235/45 R18",
    stock: 6,
    price_per_tire: 210,
    warehouse: "Genf Süd",
  },
};

// Esseda endpoint
app.post("/api/esseda", (req, res) => {
  const plate = req.body.plate?.toUpperCase();
  const record = essedaDatabase[plate];
  if (record) {
    res.json({ found: true, ...record });
  } else {
    res.json({
      found: false,
      message: "Keine Fahrzeugdaten zu diesem Kennzeichen gefunden.",
    });
  }
});

// ----------------------
// Health Check
// ----------------------
app.get("/", (req, res) => {
  res.json({ status: "Mock API online ✅" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Mock API running on port ${PORT}`));
