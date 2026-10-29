import nodemailer, {
  type Transporter,
} from 'nodemailer';

const BEIRUT_TIMEZONE = 'Asia/Beirut';

export interface AppointmentEmailDetails {
  to: string;
  customerName: string;
  reference: string;
  serviceName: string;
  staffName: string;
  start: Date;
  end: Date;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !portValue || !user || !pass) {
    console.error(
      'SMTP email is not configured. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.',
    );
    return null;
  }

  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0) {
    console.error('SMTP_PORT must be a valid positive number.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

function getFromAddress(): string {
  return (
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'no-reply@example.com'
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BEIRUT_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

async function sendEmail(details: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    return false;
  }

  try {
    await mailTransporter.sendMail({
      from: getFromAddress(),
      to: details.to,
      subject: details.subject,
      text: details.text,
      html: details.html,
    });

    console.log(
      `Email sent successfully to ${details.to}: ${details.subject}`,
    );

    return true;
  } catch (error) {
    console.error(
      `Failed to send email to ${details.to}:`,
      error,
    );

    return false;
  }
}

export async function sendBookingConfirmationEmail(
  details: AppointmentEmailDetails,
): Promise<boolean> {
  const when = `${formatDateTime(details.start)} – ${formatDateTime(details.end)}`;

  return sendEmail({
    to: details.to,
    subject: `Appointment confirmed — ${details.reference}`,
    text: [
      `Hi ${details.customerName},`,
      '',
      'Your appointment is confirmed.',
      '',
      `Reference: ${details.reference}`,
      `Service: ${details.serviceName}`,
      `With: ${details.staffName}`,
      `When: ${when}`,
      '',
      'Please check in at reception by 15 minutes after your appointment start time.',
      'After the 15-minute grace period, the appointment may be marked as a no-show.',
      '',
      'Thank you.',
    ].join('\n'),
    html: `
      <p>Hi ${details.customerName},</p>
      <p>Your appointment is confirmed.</p>
      <ul>
        <li><strong>Reference:</strong> ${details.reference}</li>
        <li><strong>Service:</strong> ${details.serviceName}</li>
        <li><strong>With:</strong> ${details.staffName}</li>
        <li><strong>When:</strong> ${when}</li>
      </ul>
      <p>
        Please check in at reception by 15 minutes after your appointment
        start time. After the 15-minute grace period, the appointment may
        be marked as a no-show.
      </p>
      <p>Thank you.</p>
    `,
  });
}

export async function sendRescheduleEmail(
  details: AppointmentEmailDetails,
): Promise<boolean> {
  const when = `${formatDateTime(details.start)} – ${formatDateTime(details.end)}`;

  return sendEmail({
    to: details.to,
    subject: `Appointment rescheduled — ${details.reference}`,
    text: [
      `Hi ${details.customerName},`,
      '',
      'Your appointment has been rescheduled.',
      '',
      `Reference: ${details.reference}`,
      `Service: ${details.serviceName}`,
      `With: ${details.staffName}`,
      `New time: ${when}`,
      '',
      'Thank you.',
    ].join('\n'),
    html: `
      <p>Hi ${details.customerName},</p>
      <p>Your appointment has been rescheduled.</p>
      <ul>
        <li><strong>Reference:</strong> ${details.reference}</li>
        <li><strong>Service:</strong> ${details.serviceName}</li>
        <li><strong>With:</strong> ${details.staffName}</li>
        <li><strong>New time:</strong> ${when}</li>
      </ul>
      <p>Thank you.</p>
    `,
  });
}

export async function sendCancellationEmail(
  details: AppointmentEmailDetails,
): Promise<boolean> {
  const when = `${formatDateTime(details.start)} – ${formatDateTime(details.end)}`;

  return sendEmail({
    to: details.to,
    subject: `Appointment cancelled — ${details.reference}`,
    text: [
      `Hi ${details.customerName},`,
      '',
      'Your appointment has been cancelled.',
      '',
      `Reference: ${details.reference}`,
      `Service: ${details.serviceName}`,
      `With: ${details.staffName}`,
      `Original time: ${when}`,
      '',
      'Thank you.',
    ].join('\n'),
    html: `
      <p>Hi ${details.customerName},</p>
      <p>Your appointment has been cancelled.</p>
      <ul>
        <li><strong>Reference:</strong> ${details.reference}</li>
        <li><strong>Service:</strong> ${details.serviceName}</li>
        <li><strong>With:</strong> ${details.staffName}</li>
        <li><strong>Original time:</strong> ${when}</li>
      </ul>
      <p>Thank you.</p>
    `,
  });
}
