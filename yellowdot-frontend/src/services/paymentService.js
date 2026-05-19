import { api } from "./authService";

export const recordPayment = (paymentData) =>
  api.post("/record-payment", paymentData).then(r => r.data);
