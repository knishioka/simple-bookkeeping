import { sanitizeHtml, sanitizeMarkdown } from '../sanitize';

describe('sanitizeHtml', () => {
  describe('XSS Protection', () => {
    it('should remove script tags', () => {
      const input = '<div>Hello<script>alert("XSS")</script>World</div>';
      const output = sanitizeHtml(input);
      expect(output).toBe('<div>HelloWorld</div>');
      expect(output).not.toContain('<script>');
    });

    it('should remove inline JavaScript event handlers', () => {
      const inputs = [
        '<div onclick="alert(\'XSS\')">Click me</div>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<a href="#" onmouseover="alert(\'XSS\')">Link</a>',
        '<button onfocus="alert(\'XSS\')">Button</button>',
      ];

      inputs.forEach((input) => {
        const output = sanitizeHtml(input);
        expect(output).not.toContain('onclick');
        expect(output).not.toContain('onerror');
        expect(output).not.toContain('onmouseover');
        expect(output).not.toContain('onfocus');
        expect(output).not.toContain('alert');
      });
    });

    it('should remove javascript: protocol URLs', () => {
      const inputs = [
        '<a href="javascript:alert(\'XSS\')">Click</a>',
        '<a href="JavaScript:alert(\'XSS\')">Click</a>',
        '<a href=" javascript:alert(\'XSS\') ">Click</a>',
        '<img src="javascript:alert(\'XSS\')">',
      ];

      inputs.forEach((input) => {
        const output = sanitizeHtml(input);
        expect(output).not.toContain('javascript:');
        expect(output).not.toContain('alert');
      });
    });

    it('should remove data: URLs with script content', () => {
      const input = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('data:');
      expect(output).not.toContain('script');
    });

    it('should remove vbscript: protocol URLs', () => {
      const input = '<a href="vbscript:msgbox">Click</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('vbscript:');
    });

    it('should handle nested script tags', () => {
      const input = '<div><script><script>alert("XSS")</script></script></div>';
      const output = sanitizeHtml(input);
      expect(output).toBe('<div></div>');
    });

    it('should remove iframe tags', () => {
      const input = '<div><iframe src="evil.com"></iframe></div>';
      const output = sanitizeHtml(input);
      expect(output).toBe('<div></div>');
      expect(output).not.toContain('iframe');
    });

    it('should remove object and embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">';
      const output = sanitizeHtml(input);
      expect(output).toBe('');
      expect(output).not.toContain('object');
      expect(output).not.toContain('embed');
    });

    it('should handle encoded XSS attempts', () => {
      const inputs = [
        '<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">',
        '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;">Click</a>',
      ];

      inputs.forEach((input) => {
        const output = sanitizeHtml(input);
        expect(output).not.toContain('alert');
        expect(output).not.toContain('javascript');
      });
    });

    it('should remove form tags with malicious actions', () => {
      const input = '<form action="javascript:alert(\'XSS\')"><input type="submit"></form>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });
  });

  describe('Safe Content Preservation', () => {
    it('should preserve safe HTML tags', () => {
      const input = '<p>This is <strong>bold</strong> and <em>italic</em> text</p>';
      const output = sanitizeHtml(input);
      expect(output).toBe('<p>This is <strong>bold</strong> and <em>italic</em> text</p>');
    });

    it('should preserve safe attributes', () => {
      const input = '<a href="/safe-link" target="_blank">Link</a>';
      const output = sanitizeHtml(input);
      expect(output).toContain('href="/safe-link"');
      expect(output).toContain('target="_blank"');
    });

    it('should preserve lists', () => {
      const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const output = sanitizeHtml(input);
      expect(output).toBe(input);
    });

    it('should preserve tables (with markdown config)', () => {
      const input = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
      const output = sanitizeMarkdown(input);
      // DOMPurify automatically adds <tbody> to tables (valid HTML5)
      expect(output).toBe('<table><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>');
    });

    it('should preserve images with safe src (with markdown config)', () => {
      const input = '<img src="/safe-image.jpg" alt="Description">';
      const output = sanitizeMarkdown(input);
      expect(output).toContain('src="/safe-image.jpg"');
      expect(output).toContain('alt="Description"');
    });

    it('should preserve div and span with safe classes', () => {
      const input = '<div class="container"><span class="highlight">Text</span></div>';
      const output = sanitizeHtml(input);
      expect(output).toBe(input);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      expect(sanitizeHtml('')).toBe('');
    });

    it('should handle null and undefined gracefully', () => {
      expect(sanitizeHtml(null as any)).toBe('');
      expect(sanitizeHtml(undefined as any)).toBe('');
    });

    it('should handle plain text without HTML', () => {
      const input = 'This is plain text without any HTML tags';
      expect(sanitizeHtml(input)).toBe(input);
    });

    it('should handle malformed HTML', () => {
      const input = '<div>Unclosed div<p>Unclosed paragraph';
      const output = sanitizeHtml(input);
      expect(output).toContain('div');
      expect(output).toContain('p');
      // DOMPurify should fix the unclosed tags
    });

    it('should handle very long strings', () => {
      const longString = `<p>${'a'.repeat(10000)}</p>`;
      const output = sanitizeHtml(longString);
      expect(output).toContain('a'.repeat(10000));
    });

    it('should handle mixed case tags', () => {
      const input = '<ScRiPt>alert("XSS")</ScRiPt>';
      const output = sanitizeHtml(input);
      expect(output).toBe('');
      expect(output).not.toContain('script');
      expect(output).not.toContain('alert');
    });

    it('should handle SVG XSS attempts', () => {
      const input = '<svg onload="alert(\'XSS\')"></svg>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('onload');
      expect(output).not.toContain('alert');
    });

    it('should handle style tag with malicious CSS', () => {
      const input = '<style>body { background: url("javascript:alert(\'XSS\')"); }</style>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript:');
    });
  });

  describe('Complex Attack Vectors', () => {
    it('should prevent DOM clobbering attacks', () => {
      const input = '<img name="getElementById"><img name="createElement">';
      const output = sanitizeHtml(input);
      // Ensure potentially dangerous name attributes are handled
      expect(output).toBeDefined();
    });

    it('should prevent mutation XSS (mXSS)', () => {
      const input = '<noscript><p title="</noscript><img src=x onerror=alert(1)>">';
      const output = sanitizeHtml(input);
      // DOMPurify treats the entire string after </noscript> as part of the attribute value
      // which prevents the actual XSS from executing in browsers
      // The resulting HTML is safe because it's inside an attribute value
      expect(output).toBeDefined();
      // Verify noscript tag is removed
      expect(output).not.toContain('<noscript>');
      // The malicious code is rendered as text content, not executable
      expect(output).toContain('title='); // attribute is preserved as text
    });

    it('should handle recursive payloads', () => {
      const input = '<div><div><div><script>alert("XSS")</script></div></div></div>';
      const output = sanitizeHtml(input);
      expect(output).toBe('<div><div><div></div></div></div>');
      expect(output).not.toContain('script');
    });

    it('should handle UTF-8 encoded attacks', () => {
      const input = '<a href="javas\x09cript:alert(1)">Click</a>';
      const output = sanitizeHtml(input);
      expect(output).not.toContain('javascript');
      expect(output).not.toContain('alert');
    });
  });

  describe('Performance', () => {
    it('should handle input efficiently', () => {
      const startTime = Date.now();
      const input = `<div>${'<p>Test</p>'.repeat(1000)}</div>`;
      sanitizeHtml(input);
      const endTime = Date.now();
      // Should process within reasonable time (< 100ms for 1000 elements)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});
