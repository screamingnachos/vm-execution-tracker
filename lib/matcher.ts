import Fuse from 'fuse.js';

export function getBestStoreMatch(slackText: string, stores: any[]) {
  // Clean Slack syntax tags
  const cleanText = slackText
    .replace(/<@[A-Z0-9]+>/g, '')
    .toLowerCase()
    .trim();

  const fuse = new Fuse(stores, {
    keys: ['name'],
    threshold: 0.4, // Adjust for strictness
  });

  const results = fuse.search(cleanText);
  return results.length > 0 ? results[0].item : null;
}
