// Loads Razorpay's hosted checkout.js exactly once. The script attaches a
// `window.Razorpay` constructor we use to open the checkout modal. We rely on
// Razorpay's CDN copy — embedding the script ourselves isn't supported.

const SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let pending = null;

export function loadRazorpay() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => {
      pending = null;
      reject(new Error('Failed to load Razorpay Checkout'));
    };
    document.head.appendChild(s);
  });
  return pending;
}
