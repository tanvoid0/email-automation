import connectDB from "@/lib/mongodb";
import { UserProfileModel } from "@/lib/models/UserProfile";
import type { SmtpSendConfig } from "@/lib/smtp";

/**
 * Loads the sending SMTP config for a given account (username).
 * Returns null if the account hasn't finished configuring email yet.
 */
export async function getUserSmtpConfig(username: string): Promise<SmtpSendConfig | null> {
  await connectDB();
  const profile = await UserProfileModel.findOne({ name: username }).lean();
  const smtp = profile?.smtp;

  if (!smtp?.host || !smtp?.port || !smtp?.user || !smtp?.pass) {
    return null;
  }

  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure ?? true,
    user: smtp.user,
    pass: smtp.pass,
    from: smtp.from,
  };
}
