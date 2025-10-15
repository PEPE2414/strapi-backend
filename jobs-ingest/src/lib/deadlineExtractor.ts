import * as cheerio from 'cheerio';

/**
 * Extract application deadline from HTML content
 * Looks for common deadline patterns and date formats
 */
export function extractDeadlineFromHtml(html: string, $?: cheerio.CheerioAPI): string | undefined {
  if (!html) return undefined;
  
  const $cheerio = $ || cheerio.load(html);
  
  // Common deadline selectors
  const deadlineSelectors = [
    '[class*="deadline"]',
    '[class*="closing"]',
    '[class*="expires"]',
    '[class*="expiry"]',
    '[class*="apply-by"]',
    '[class*="application-deadline"]',
    '[class*="closing-date"]',
    '[class*="expiry-date"]',
    '[class*="end-date"]',
    '[class*="due-date"]',
    '[id*="deadline"]',
    '[id*="closing"]',
    '[id*="expires"]',
    '[id*="expiry"]'
  ];
  
  // Look for deadline in specific elements
  for (const selector of deadlineSelectors) {
    const element = $cheerio(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      const deadline = parseDeadlineText(text);
      if (deadline) {
        return deadline;
      }
    }
  }
  
  // Look for deadline patterns in the entire text
  const text = $cheerio.text();
  const deadline = parseDeadlineText(text);
  if (deadline) {
    return deadline;
  }
  
  return undefined;
}

/**
 * Parse deadline text to extract ISO date
 */
function parseDeadlineText(text: string): string | undefined {
  if (!text) return undefined;
  
  // Common deadline patterns
  const patterns = [
    // "Deadline: 15 March 2024"
    /deadline[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Closing date: 15/03/2024"
    /closing[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    // "Apply by: 15-03-2024"
    /apply\s+by[:\s]+(\d{1,2}-\d{1,2}-\d{4})/i,
    // "Expires: 15.03.2024"
    /expires[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i,
    // "End date: 2024-03-15"
    /end\s+date[:\s]+(\d{4}-\d{1,2}-\d{1,2})/i,
    // "Due: 15 March 2024"
    /due[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Application deadline: 15 March 2024"
    /application\s+deadline[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Closing: 15 March 2024"
    /closing[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Expiry: 15 March 2024"
    /expiry[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Valid until: 15 March 2024"
    /valid\s+until[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i,
    // "Open until: 15 March 2024"
    /open\s+until[:\s]+(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1];
      const date = parseDateString(dateStr);
      if (date) {
        return date.toISOString();
      }
    }
  }
  
  return undefined;
}

/**
 * Parse various date string formats to Date object
 */
function parseDateString(dateStr: string): Date | undefined {
  if (!dateStr) return undefined;
  
  try {
    // Handle different date formats
    const formats = [
      // "15 March 2024"
      /^(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i,
      // "15/03/2024" (DD/MM/YYYY)
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // "15-03-2024" (DD-MM-YYYY)
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // "15.03.2024" (DD.MM.YYYY)
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
      // "2024-03-15" (YYYY-MM-DD)
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    ];
    
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        let day: number, month: number, year: number;
        
        if (format === formats[0]) {
          // "15 March 2024"
          day = parseInt(match[1]);
          month = monthNames.findIndex(m => m.toLowerCase() === match[2].toLowerCase()) + 1;
          year = parseInt(match[3]);
        } else if (format === formats[4]) {
          // "2024-03-15" (YYYY-MM-DD)
          year = parseInt(match[1]);
          month = parseInt(match[2]);
          day = parseInt(match[3]);
        } else {
          // "15/03/2024", "15-03-2024", "15.03.2024" (DD/MM/YYYY)
          day = parseInt(match[1]);
          month = parseInt(match[2]);
          year = parseInt(match[3]);
        }
        
        // Validate date
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2024) {
          const date = new Date(year, month - 1, day, 23, 59, 59); // End of day
          if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            return date;
          }
        }
      }
    }
    
    // Try native Date parsing as fallback
    const date = new Date(dateStr);
    if (!isNaN(date.getTime()) && date.getFullYear() >= 2024) {
      return date;
    }
    
  } catch (error) {
    console.warn('Failed to parse date string:', dateStr, error);
  }
  
  return undefined;
}

/**
 * Extract deadline from job card HTML
 */
export function extractDeadlineFromJobCard($card: cheerio.Cheerio<cheerio.Element>): string | undefined {
  if (!$card || $card.length === 0) return undefined;
  
  // Look for deadline in job card
  const deadlineSelectors = [
    '[class*="deadline"]',
    '[class*="closing"]',
    '[class*="expires"]',
    '[class*="expiry"]',
    '[class*="apply-by"]',
    '[class*="closing-date"]',
    '[class*="expiry-date"]',
    '[class*="end-date"]',
    '[class*="due-date"]'
  ];
  
  for (const selector of deadlineSelectors) {
    const element = $card.find(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      const deadline = parseDeadlineText(text);
      if (deadline) {
        return deadline;
      }
    }
  }
  
  // Look for deadline in the entire job card text
  const text = $card.text();
  const deadline = parseDeadlineText(text);
  if (deadline) {
    return deadline;
  }
  
  return undefined;
}
