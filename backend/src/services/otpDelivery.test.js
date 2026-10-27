import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverSignupOtp } from './otpDelivery.js';

test('OTP delivery selects separate email and SMS providers without exposing credentials', async (t) => {
  const names = ['NODE_ENV', 'OTP_DELIVERY_PROVIDER', 'OTP_EMAIL_PROVIDER', 'OTP_SMS_PROVIDER', 'RESEND_API_KEY', 'OTP_EMAIL_FROM', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => names.forEach(name => {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }));
  process.env.NODE_ENV = 'production';
  process.env.OTP_DELIVERY_PROVIDER = '';
  process.env.OTP_EMAIL_PROVIDER = 'resend';
  process.env.OTP_SMS_PROVIDER = 'twilio';
  for (const name of names.slice(4)) delete process.env[name];

  await assert.rejects(
    deliverSignupOtp({ contactType: 'email', contact: 'farmer@example.test', code: '123456' }),
    /Resend OTP delivery is not configured/,
  );
  await assert.rejects(
    deliverSignupOtp({ contactType: 'phone', contact: '+919876543210', code: '123456' }),
    /Twilio OTP delivery is not configured/,
  );
});
