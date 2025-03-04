// Flag to track intentional redirects
let isRedirecting = false;

// Add beforeunload handler that only triggers for manual navigation
window.addEventListener('beforeunload', (e) => {
  if (!isRedirecting) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/**
 * Safely redirect to a new page without triggering beforeunload
 * @param url The URL to redirect to
 */
export function safeRedirect(url: string): void {
  isRedirecting = true;
  window.location.href = url;
}

/**
 * Check transaction status and handle redirects
 * @param invoiceId The current invoice ID
 */
export async function checkTransactionStatus(invoiceId: string): Promise<void> {
  try {
    const response = await fetch(`/api/checkTransactionStatus?invoiceId=${invoiceId}`);
    const data = await response.json();
    
    if (data.status === 'success') {
      safeRedirect('/success.html');
    } else if (data.status === 'fail') {
      safeRedirect('/fail.html');
    }
  } catch (error) {
    console.error('Error checking transaction status:', error);
    safeRedirect('/error.html');
  }
}

/**
 * Start OTP timer and redirect on expiration
 * @param duration Timer duration in seconds
 */
export function startOtpTimer(duration: number): void {
  let timeLeft = duration;
  
  const timer = setInterval(() => {
    timeLeft--;
    
    // Update timer display
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const display = document.getElementById('timer');
    if (display) {
      display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Redirect on timer expiration
    if (timeLeft <= 0) {
      clearInterval(timer);
      safeRedirect('/fail.html');
    }
  }, 1000);
  
  // Store timer reference for cleanup
  window.otpTimer = timer;
}

// Clean up timer on page unload
window.addEventListener('unload', () => {
  if (window.otpTimer) {
    clearInterval(window.otpTimer);
  }
});

// Add type definition for window object
declare global {
  interface Window {
    otpTimer: number;
  }
}