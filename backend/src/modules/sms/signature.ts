import { OperatorPosition } from '../../generated/prisma/index.js';

const POSITION_LABELS: Record<OperatorPosition, string> = {
  CHAIRMAN: 'Chairman',
  VICE_CHAIRMAN: 'Vice Chairman',
  SECRETARY: 'Secretary',
  TREASURER: 'Treasurer',
  CATECHIST: 'Catechist',
};

/**
 * Appends the sending operator's sign-off, e.g. "- Chairman, Peter Otieno"
 * (just the name when they hold no position). Plain hyphen rather than a
 * dash so the message stays within the GSM-7 alphabet.
 */
export function signMessage(message: string, signer: { name: string; position: OperatorPosition | null }): string {
  const signOff = signer.position ? `${POSITION_LABELS[signer.position]}, ${signer.name}` : signer.name;
  return `${message.trimEnd()}\n- ${signOff}`;
}
