const express = require("express");
const cors = require("cors");

const routes = require("./routes");
const errorMiddleware = require("./middlewares/errorMiddleware");
const notFoundMiddleware = require("./middlewares/notFoundMiddleware");
const { AppError } = require("./utils/AppError");

const app = express();

const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS ||
  "http://127.0.0.1:5500,http://localhost:5500").split(",").map((origin) => origin.trim()).filter(Boolean));

app.use(cors({
  origin(origin, callback) { callback(null, !origin || allowedOrigins.has(origin)); },
  credentials: true
}));
app.use((req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin &&
      !allowedOrigins.has(req.headers.origin)) {
    return next(new AppError("Origem não autorizada.", 403));
  }
  next();
});
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "IntegraHub API",
    message: "API disponível em /api"
  });
});

app.use("/api", routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
