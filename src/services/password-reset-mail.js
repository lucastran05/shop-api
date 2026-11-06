import nodemailer from 'nodemailer';

export function passwordResetUrl(token) {
  const base = process.env.PASSWORD_RESET_URL || 'http://localhost:5173/reset-password';
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('PASSWORD_RESET_URL must be an HTTP(S) URL without credentials');
  }
  // A fragment keeps the secret out of HTTP access logs and Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
}

export const passwordResetMail = {
  async send(email, url) {
    const secure = process.env.SMTP_SECURE === 'true';
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || '127.0.0.1',
      port: Number(process.env.SMTP_PORT || (secure ? 465 : 1025)),
      secure,
      requireTLS: Boolean(process.env.SMTP_USER) && !secure,
      ...(process.env.SMTP_USER ? {
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'Bloomora <no-reply@bloomora.test>',
      to: { address: email, name: '' },
      subject: 'Đặt lại mật khẩu Bloomora',
      text: `Mở liên kết sau để đặt lại mật khẩu Bloomora:\n\n${url}\n\nLiên kết chỉ dùng một lần và hết hạn sau 15 phút.\nNếu không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.`,
    });
  },
};
