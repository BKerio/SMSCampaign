/** Replaces the `{{name}}` personalization token with the recipient's name. */
export function personalizeMessage(message: string, name: string): string {
  return message.replace(/\{\{\s*name\s*\}\}/gi, name);
}
