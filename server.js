import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load JSON data
const crmDatabase = JSON.parse(fs.readFileSync("./data/crm.json", "utf-8"));
const essedaDatabase = JSON.parse(fs.readFileSync("./data/esseda.json", "utf-8"));

// ----------------------
// NEXTLANE CRM MOCK
// ----------------------
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
// ESSEDA MOCK
// ----------------------
app.post("/api/esseda", (req, res) => {
  const plate = req.body.plate?.toUpperCase();
  const record = essedaDatabase[plate];
  if (record) {
    res.json({ found: true, ...record });
  } else {
    res.json({
      found: false,
      message: "Keine Fahrzeugdaten zu diesem Kennzeichen gefunden."
    });
  }
});

// ----------------------
// HEALTH CHECK
// ----------------------
app.get("/", (req, res) => {
  res.json({ status: "Mock API online ✅" });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Mock API running on port ${PORT}`));
