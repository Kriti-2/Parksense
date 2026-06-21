import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import get_settings

logger = logging.getLogger(__name__)


def send_otp_email(to_email: str, otp: str) -> bool:
    """Send a password reset OTP to the user's email.

    Falls back to console output and log file writing if SMTP is not configured.
    """
    settings = get_settings()

    subject = f"मार्ग Sense - Your Password Reset OTP: {otp}"
    body_text = (
        f"Hello,\n\n"
        f"You requested a password reset. Your 6-digit verification code is:\n\n"
        f"{otp}\n\n"
        f"This OTP is valid for 10 minutes. If you did not request this, please ignore this email.\n\n"
        f"Best regards,\n"
        f"मार्ग Sense Team"
    )

    body_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0c0a09; color: #ffffff; padding: 20px; text-align: center;">
        <div style="max-width: 400px; margin: 0 auto; background-color: #1c1917; padding: 30px; border-radius: 12px; border: 1px solid #2e2a24; text-align: left;">
          <h2 style="color: #ffffff; margin-bottom: 5px; text-align: center;">मार्ग Sense</h2>
          <div style="font-size: 11px; color: #a8a29e; letter-spacing: 1px; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; text-align: center;">Bengaluru Traffic Violation Portal</div>
          <p style="color: #d6d3d1; font-size: 14px;">You requested a password reset. Use the verification code below to complete the reset:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #ffffff; margin: 25px 0; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); text-align: center;">{otp}</div>
          <p style="color: #78716c; font-size: 11px; margin-top: 20px; text-align: center;">This OTP is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      </body>
    </html>
    """

    # 1. Attempt SMTP delivery if credentials are provided
    if settings.smtp_host and settings.smtp_username:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.smtp_from_email
            msg["To"] = to_email

            msg.attach(MIMEText(body_text, "plain"))
            msg.attach(MIMEText(body_html, "html"))

            if settings.smtp_use_tls:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                server.starttls()
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, to_email, msg.as_string())
            server.quit()

            logger.info("Successfully sent OTP email to %s via SMTP", to_email)
            return True
        except Exception as e:
            logger.error("Failed to send email via SMTP to %s: %s", to_email, e)
            # Fall back to logging

    # 2. Local fallback: print in logs and write to a development log file
    divider = "=" * 60
    logger.info(
        "\n%s\n[LOCAL MOCK EMAIL] to: %s\nSubject: %s\nOTP Code: %s\n%s",
        divider,
        to_email,
        subject,
        otp,
        divider,
    )

    try:
        # Write to log file in backend/data
        # Resolve path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_dir = os.path.abspath(os.path.join(current_dir, "..", "data"))
        os.makedirs(data_dir, exist_ok=True)
        log_file = os.path.join(data_dir, "sent_emails.log")

        from datetime import datetime
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(
                f"[{datetime.utcnow().isoformat()}] To: {to_email} | Subject: {subject} | OTP: {otp}\n"
            )
    except Exception as e:
        logger.error("Failed to write mock email log: %s", e)

    return False
