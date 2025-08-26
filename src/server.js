require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const path = require("path");
const { uptime } = require("process");

const swaggerDocument = require(path.join(__dirname, "..", "openapi.json"));

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || null;

//Middleware

app.use(cors());
app.use(helmet());
app.use(express.json());

// API Key Middleware: for now we only protect non-GET methods.
// (Public GET requests to make it easier to integrate read-only tools like Power BI at the beginning)

app.use((req, res, next) => {
  if (req.method === "GET") return next();
  if (!API_KEY)
    return res.status(500).json({ error: "API Key not configured on server" });
  const provided = req.header("x-api-key");
  if (provided !== API_KEY)
    return res.status(401).json({ error: "API Key is invalid" });
  next();
});

// routes

const customerRoutes = require("./routes/customers");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const reservationRoutes = require("./routes/reservations");

app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/reservations", reservationRoutes);

//healthcheck

app.get("/health", (req, res) => {
  res.json({ status: "OK", uptime: process.uptime() });
});

//Docs Swagger

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger docs available on http://localhost:${PORT}/docs`);
});
