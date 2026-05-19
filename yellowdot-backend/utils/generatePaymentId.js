function generatePaymentId() {
  return `PAY-${Date.now()}`;
}

module.exports = generatePaymentId;