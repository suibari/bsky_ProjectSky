import { Agent } from '@atproto/api';

export const publicAgent = new Agent('https://public.api.bsky.app');

// Helper to resolve PDS endpoint (Cross-PDS support)
export async function getPdsEndpoint(did: string): Promise<string | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${did}`);
      const doc = await res.json();
      const service = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
      return service?.serviceEndpoint || null;
    } else if (did.startsWith('did:web:')) {
      const domain = did.slice(8); // remove did:web:
      const res = await fetch(`https://${domain}/.well-known/did.json`);
      const doc = await res.json();
      const service = doc.service?.find((s: any) => s.type === 'AtprotoPersonalDataServer');
      return service?.serviceEndpoint || null;
    }
  } catch (e) {
    console.error("Failed to resolve DID document", e);
  }
  return null;
}
