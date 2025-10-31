/**
 * Generates a meaningful session name from a prompt
 * @param prompt The user's prompt or input text
 * @returns A concise, meaningful title for the session
 */
export function generateSessionName(prompt: string): string {
  if (!prompt) return "Untitled Session";
  
  // Clean and trim the prompt
  const cleanPrompt = prompt.trim();
  
  // Extract potential title candidates
  const titleCandidates = [
    // Look for text in quotes
    ...(cleanPrompt.match(/(?<="|'|`)([^"'`]+)(?="|'|`)/g) || []),
    // Look for text after common prefixes
    ...(cleanPrompt.match(/(?:title|name|prompt):\s*([^\n"]+)/i)?.slice(1) || []),
    // Take first sentence (up to 10 words)
    cleanPrompt.split(/[.!?\n]/)[0].trim(),
  ];
  
  // Find the best candidate
  let bestCandidate = titleCandidates
    .filter(Boolean)
    .map(c => c.trim())
    .find(c => 
      c.length >= 10 && 
      c.length <= 60 && 
      !c.toLowerCase().includes("http") &&
      !c.match(/^[\s\d\W]+$/)
    );

  // If no good candidate, take first 5-8 words
  if (!bestCandidate) {
    const words = cleanPrompt.split(/\s+/);
    const wordCount = Math.min(Math.max(5, Math.floor(words.length / 2)), 8);
    bestCandidate = words.slice(0, wordCount).join(' ');
    
    // Clean up any trailing punctuation
    bestCandidate = bestCandidate.replace(/[.,;:!?]+$/, '');
  }
  
  // Truncate if too long
  if (bestCandidate.length > 60) {
    bestCandidate = bestCandidate.substring(0, 57) + '...';
  }
  
  // Capitalize first letter
  return bestCandidate.charAt(0).toUpperCase() + bestCandidate.slice(1);
}

/**
 * Generates a default session name based on the current time
 * @returns A string like "New Session (HH:MM AM/PM)"
 */
export function generateDefaultSessionName(): string {
  return `New Session (${new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).toLowerCase()})`;
}
