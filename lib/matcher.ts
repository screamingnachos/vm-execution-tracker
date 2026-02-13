import Fuse from 'fuse.js';
import { storeNames } from './stores';

// Setup Fuse.js for fuzzy matching
const fuse = new Fuse(storeNames, {
  threshold: 0.4, // 0.0 is a perfect match, 1.0 matches anything
  includeScore: true,
});

export function getBestStoreMatch(slackText: string) {
  if (!slackText) return '';

  // 1. Clean the text: remove Slack user tags (e.g., <@U12345>) and lowercase it
  const cleanText = slackText.replace(/<@[^>]+>/g, '').toLowerCase().trim();

  // 2. Search against the official store list
  const results = fuse.search(cleanText);

  // 3. Return the best match if found, otherwise return empty string
  return results.length > 0 ? results[0].item : '';
}