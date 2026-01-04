import * as postmark from "postmark";

const SENDER_EMAIL = "maarten.bal@capgemini.com";
const ADMIN_EMAIL = "maarten.bal@capgemini.com";

let client: postmark.ServerClient | null = null;

function getClient(): postmark.ServerClient {
  if (!client) {
    const apiKey = process.env.POSTMARK_API_KEY;
    if (!apiKey) {
      throw new Error("POSTMARK_API_KEY environment variable is not set");
    }
    client = new postmark.ServerClient(apiKey);
  }
  return client;
}

export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  userName: string
): Promise<boolean> {
  try {
    const client = getClient();
    await client.sendEmail({
      From: SENDER_EMAIL,
      To: to,
      Subject: "Your login link for Streams App",
      HtmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Welcome back, ${userName}!</h2>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            Click the button below to sign in to Streams App. This link expires in 10 minutes.
          </p>
          <div style="margin: 30px 0;">
            <a href="${magicLink}" 
               style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
              Sign In
            </a>
          </div>
          <p style="color: #888; font-size: 14px;">
            If you didn't request this link, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #888; font-size: 12px;">
            Streams App - Project Orchestration
          </p>
        </div>
      `,
      TextBody: `Welcome back, ${userName}!\n\nClick the link below to sign in to Streams App. This link expires in 10 minutes.\n\n${magicLink}\n\nIf you didn't request this link, you can safely ignore this email.`,
      MessageStream: "outbound",
    });
    console.log(`[Email] Magic link sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send magic link:", error);
    return false;
  }
}

export async function sendNewUserNotification(
  newUserName: string,
  newUserEmail: string
): Promise<boolean> {
  try {
    const client = getClient();
    await client.sendEmail({
      From: SENDER_EMAIL,
      To: ADMIN_EMAIL,
      Subject: `New user registration: ${newUserName}`,
      HtmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">New User Registration</h2>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            A new user has requested access to Streams App:
          </p>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${newUserName}</p>
            <p style="margin: 0;"><strong>Email:</strong> ${newUserEmail}</p>
          </div>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            Login to the Settings page to approve or reject this request.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #888; font-size: 12px;">
            Streams App - Project Orchestration
          </p>
        </div>
      `,
      TextBody: `New User Registration\n\nA new user has requested access to Streams App:\n\nName: ${newUserName}\nEmail: ${newUserEmail}\n\nLogin to the Settings page to approve or reject this request.`,
      MessageStream: "outbound",
    });
    console.log(`[Email] New user notification sent to admin for ${newUserEmail}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send new user notification:", error);
    return false;
  }
}

export async function sendApprovalEmail(
  to: string,
  userName: string
): Promise<boolean> {
  try {
    const client = getClient();
    await client.sendEmail({
      From: SENDER_EMAIL,
      To: to,
      Subject: "Your Streams App account has been approved!",
      HtmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to Streams App, ${userName}!</h2>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            Great news! Your account has been approved. You can now login using your email address.
          </p>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
            Visit the app and request a magic link to sign in.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #888; font-size: 12px;">
            Streams App - Project Orchestration
          </p>
        </div>
      `,
      TextBody: `Welcome to Streams App, ${userName}!\n\nGreat news! Your account has been approved. You can now login using your email address.\n\nVisit the app and request a magic link to sign in.`,
      MessageStream: "outbound",
    });
    console.log(`[Email] Approval email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send approval email:", error);
    return false;
  }
}
