import Razorpay from 'razorpay';

export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     ?? 'rzp_test_SrD9RqGOrFNN3c',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? 'nd61HKtvxcHYG8O1VIb7GYIn',
});

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? 'rzp_test_SrD9RqGOrFNN3c';
