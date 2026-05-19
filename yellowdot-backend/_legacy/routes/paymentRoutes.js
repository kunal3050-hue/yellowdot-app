const express = require("express");

const {
  recordPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/record-payment", recordPayment);

module.exports = router;