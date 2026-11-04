/**
 * Known SMTP provider presets. "custom" leaves host/port/secure open for the user to fill in.
 */
export type SmtpProvider = "gmail" | "outlook" | "custom";

export interface SmtpPreset {
  label: string;
  host: string;
  port: number;
  secure: boolean;
}

export const SMTP_PRESETS: Record<Exclude<SmtpProvider, "custom">, SmtpPreset> = {
  gmail: {
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
  },
};

export const SMTP_PROVIDERS: { value: SmtpProvider; label: string }[] = [
  { value: "gmail", label: "Gmail" },
  { value: "outlook", label: "Outlook / Microsoft 365" },
  { value: "custom", label: "Custom SMTP server" },
];
