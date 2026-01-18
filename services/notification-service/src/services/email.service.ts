import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import { config } from '../config';
import { EmailLog } from '../models';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
    },
});

// Email templates
const templates: Record<string, { subject: string; html: string }> = {
    welcome: {
        subject: 'Welcome to SubTrack!',
        html: `
      <h1>Welcome, {{firstName}}!</h1>
      <p>Thanks for signing up for SubTrack.</p>
      <p>Get started by creating your first organization.</p>
    `,
    },
    invite: {
        subject: 'You\'ve been invited',
        html: `
      <h1>You're Invited!</h1>
      <p>You've been invited to join <strong>{{organizationName}}</strong> as a {{role}}.</p>
      <a href="{{acceptUrl}}">Accept Invitation</a>
    `,
    },
    password_reset: {
        subject: 'Reset Your Password',
        html: `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password:</p>
      <a href="{{resetUrl}}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `,
    },
    invoice: {
        subject: 'Invoice #{{invoiceNumber}}',
        html: `
      <h1>Invoice {{invoiceNumber}}</h1>
      <p>Amount: {{ amount }}</p>
      <p>Due Date: {{dueDate}}</p>
      <a href="{{pdfUrl}}">Download PDF</a>
    `,
    },
};

interface SendEmailOptions {
    to: string;
    subject?: string;
    template: string;
    variables?: Record<string, any>;
    userId?: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
    const { to, template, variables = {}, userId } = options;

    const emailTemplate = templates[template];
    if (!emailTemplate) {
        logger.error(`Email template not found: ${template}`);
        return false;
    }

    // Compile template
    const compiledSubject = Handlebars.compile(emailTemplate.subject)(variables);
    const compiledHtml = Handlebars.compile(emailTemplate.html)(variables);

    // Create log entry
    const log = await EmailLog.create({
        userId,
        to,
        subject: compiledSubject,
        template,
        status: 'queued',
    });

    try {
        const info = await transporter.sendMail({
            from: `${config.fromName} <${config.fromEmail}>`,
            to,
            subject: compiledSubject,
            html: compiledHtml,
        });

        // Update log
        log.status = 'sent';
        log.messageId = info.messageId;
        log.sentAt = new Date();
        await log.save();

        logger.info(`Email sent: ${template} to ${to}`);
        return true;
    } catch (error: any) {
        log.status = 'failed';
        log.errorMessage = error.message;
        await log.save();

        logger.error(`Email failed: ${template} to ${to}:`, error.message);
        return false;
    }
};
