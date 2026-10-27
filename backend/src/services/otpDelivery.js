const getProvider = (contactType) => {
  const channelProvider = contactType === 'email' ? process.env.OTP_EMAIL_PROVIDER : process.env.OTP_SMS_PROVIDER;
  return channelProvider || process.env.OTP_DELIVERY_PROVIDER || (process.env.NODE_ENV === 'production' ? '' : 'console');
};

export async function deliverSignupOtp({ contactType, contact, code }) {
  const provider = getProvider(contactType);
  const message = `Your KisanAI verification code is ${code}. It expires in 10 minutes.`;
  if (provider === 'console') {
    if (process.env.NODE_ENV === 'production') throw new Error('Console OTP delivery is disabled in production');
    console.info(`[KisanAI local OTP] ${contactType} ${contact}: ${code}`);
    return;
  }
  if (provider === 'resend' && contactType === 'email') {
    if (!process.env.RESEND_API_KEY || !process.env.OTP_EMAIL_FROM) throw new Error('Resend OTP delivery is not configured');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.OTP_EMAIL_FROM, to: [contact], subject: 'Your KisanAI verification code', text: message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return;
  }
  if (provider === 'twilio' && contactType === 'phone') {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, TWILIO_MESSAGING_SERVICE_SID: messagingServiceSid } = process.env;
    if (!sid || !token || (!from && !messagingServiceSid)) throw new Error('Twilio OTP delivery is not configured');
    const body = new URLSearchParams({ To: contact, Body: message });
    if (from) body.set('From', from);
    if (messagingServiceSid) body.set('MessagingServiceSid', messagingServiceSid);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`SMS provider returned ${response.status}`);
    return;
  }
  throw new Error(`OTP provider ${provider || '(unset)'} cannot deliver ${contactType} OTP`);
}
