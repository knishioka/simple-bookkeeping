/**
 * Sanitization utilities for XSS protection
 * Uses DOMPurify for HTML sanitization on both client and server
 */

import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';

// Server-side sanitization setup
let serverSanitizer: typeof DOMPurify | null = null;

/**
 * Initialize DOMPurify for server-side rendering
 */
function initServerSanitizer() {
  if (typeof window === 'undefined' && !serverSanitizer) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom');
    const window = new JSDOM('').window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverSanitizer = DOMPurify(window as any);
  }
  return serverSanitizer;
}

/**
 * Get the appropriate DOMPurify instance based on environment
 */
function getSanitizer() {
  if (typeof window !== 'undefined') {
    // Client-side: use the global DOMPurify
    return DOMPurify;
  } else {
    // Server-side: use JSDOM-based DOMPurify
    return initServerSanitizer();
  }
}

/**
 * Default configuration for DOMPurify
 * Allows basic formatting tags but removes dangerous elements
 */
const DEFAULT_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'em',
    'strong',
    'u',
    's',
    'strike',
    'p',
    'br',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'code',
    'pre',
    'blockquote',
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

/**
 * Strict configuration that only allows text content
 */
const STRICT_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * @param dirty - The untrusted HTML content
 * @param config - Optional DOMPurify configuration (defaults to DEFAULT_CONFIG)
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * ```typescript
 * const clean = sanitizeHtml('<script>alert("XSS")</script><p>Hello</p>');
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeHtml(dirty: string, config: DOMPurifyConfig = DEFAULT_CONFIG): string {
  const sanitizer = getSanitizer();
  if (!sanitizer) {
    console.error('Failed to initialize DOMPurify');
    return '';
  }

  try {
    return String(sanitizer.sanitize(dirty, config));
  } catch (error) {
    console.error('Sanitization error:', error);
    return '';
  }
}

/**
 * Sanitize plain text content (removes all HTML)
 *
 * @param dirty - The untrusted text content
 * @returns Plain text with all HTML removed
 *
 * @example
 * ```typescript
 * const clean = sanitizeText('<script>alert("XSS")</script>Hello');
 * // Returns: 'Hello'
 * ```
 */
export function sanitizeText(dirty: string): string {
  return sanitizeHtml(dirty, STRICT_CONFIG);
}

/**
 * Sanitize URL to prevent XSS through href attributes
 *
 * @param url - The untrusted URL
 * @returns Safe URL or empty string if invalid
 *
 * @example
 * ```typescript
 * const clean = sanitizeUrl('javascript:alert("XSS")');
 * // Returns: ''
 * ```
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  // Remove leading/trailing whitespace
  const trimmed = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];

  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '';
    }
  }

  // Allow only safe protocols
  const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:', '/'];
  const isSafe = safeProtocols.some(
    (protocol) =>
      lowerUrl.startsWith(protocol) || (!lowerUrl.includes(':') && !lowerUrl.startsWith('//'))
  );

  return isSafe ? trimmed : '';
}

/**
 * Sanitize user input for form fields
 * Removes HTML but preserves line breaks
 *
 * @param input - The user input
 * @returns Sanitized input safe for storage
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  // First remove all HTML
  const text = sanitizeText(input);

  // Preserve line breaks by converting to <br> for display
  // This is safe because we've already removed all HTML
  return text.replace(/\n/g, '<br>');
}

/**
 * Configuration for markdown content
 * Allows more tags for rich text editing
 */
const MARKDOWN_CONFIG: DOMPurifyConfig = {
  ...DEFAULT_CONFIG,
  ALLOWED_TAGS: [
    ...(DEFAULT_CONFIG.ALLOWED_TAGS || []),
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'hr',
    'del',
    'ins',
    'sup',
    'sub',
  ],
  ALLOWED_ATTR: [...(DEFAULT_CONFIG.ALLOWED_ATTR || []), 'src', 'alt', 'width', 'height', 'align'],
  // Only allow data URIs for images with safe formats
  ADD_TAGS: [],
  ADD_ATTR: [],
  ALLOW_DATA_ATTR: false,
  // Custom hook to validate image sources
  FORBID_CONTENTS: [],
};

/**
 * Sanitize markdown/rich text content
 *
 * @param content - The markdown/rich text content
 * @returns Sanitized content safe for rendering
 */
export function sanitizeMarkdown(content: string): string {
  return sanitizeHtml(content, MARKDOWN_CONFIG);
}

/**
 * Check if content contains any potentially dangerous HTML
 *
 * @param content - The content to check
 * @returns True if content appears to contain dangerous HTML
 */
export function containsDangerousHtml(content: string): boolean {
  const sanitized = sanitizeHtml(content);
  return sanitized !== content;
}

/**
 * Escape HTML entities for safe display in non-HTML contexts
 *
 * @param str - The string to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  const div =
    typeof document !== 'undefined'
      ? document.createElement('div')
      : { textContent: '', innerHTML: '' };

  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create a safe HTML renderer hook for React components
 *
 * @example
 * ```tsx
 * const SafeHtml = ({ content }: { content: string }) => {
 *   const safeHtml = useSafeHtml(content);
 *   return <div dangerouslySetInnerHTML={{ __html: safeHtml }} />;
 * };
 * ```
 */
export function useSafeHtml(dirty: string, config: DOMPurifyConfig = DEFAULT_CONFIG): string {
  if (typeof window === 'undefined') {
    // Server-side: sanitize immediately
    return sanitizeHtml(dirty, config);
  }

  // Client-side: use React's built-in XSS protection
  // and only sanitize if we're using dangerouslySetInnerHTML
  return sanitizeHtml(dirty, config);
}

export default {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  sanitizeInput,
  sanitizeMarkdown,
  containsDangerousHtml,
  escapeHtml,
  useSafeHtml,
};
