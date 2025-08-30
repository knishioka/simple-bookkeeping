import '@testing-library/jest-dom';

// Configure React 19 testing environment for act() support
// This is required for react-hook-form with React 19
global.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress JSDOM navigation warnings and React act warnings
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string') {
      // Suppress navigation warnings from JSDOM
      if (args[0].includes('Not implemented: navigation')) {
        return;
      }
      // Suppress React act warnings for react-hook-form
      if (args[0].includes('The current testing environment is not configured to support act')) {
        return;
      }
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock hasPointerCapture for Radix UI
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  value: jest.fn(),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock Radix UI Dialog component
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

// Simplified Select mock for testing
jest.mock('@/components/ui/select', () => {
  const React = require('react');

  // Store callbacks for each Select instance
  const selectCallbacks = new Map();
  let selectIdCounter = 0;

  return {
    Select: ({ children, onValueChange, defaultValue, value, ...props }) => {
      const selectId = React.useRef(`select-${selectIdCounter++}`).current;

      React.useEffect(() => {
        if (onValueChange) {
          selectCallbacks.set(selectId, onValueChange);
        }
        return () => {
          selectCallbacks.delete(selectId);
        };
      }, [onValueChange, selectId]);

      return React.createElement(
        'div',
        {
          'data-testid': 'mock-select',
          'data-select-id': selectId,
          'data-value': value || defaultValue || '',
          ...props,
        },
        React.Children.map(children, (child) =>
          React.isValidElement(child)
            ? React.cloneElement(child, { 'data-select-id': selectId })
            : child
        )
      );
    },

    SelectTrigger: ({ children, ...props }) => {
      return React.createElement(
        'button',
        {
          ...props,
          'data-testid': 'select-trigger',
          role: 'combobox',
          type: 'button',
        },
        children
      );
    },

    SelectContent: ({ children, ...props }) => {
      return React.createElement(
        'div',
        {
          ...props,
          'data-testid': 'select-content',
        },
        children
      );
    },

    SelectItem: ({ children, value, ...props }) => {
      const handleClick = (event) => {
        // Find the parent select element
        const selectElement = event.currentTarget.closest('[data-select-id]');
        if (selectElement) {
          const selectId = selectElement.getAttribute('data-select-id');
          const callback = selectCallbacks.get(selectId);
          if (callback) {
            callback(value);
          }
        }
      };

      return React.createElement(
        'button',
        {
          ...props,
          'data-testid': `select-item-${value}`,
          'data-value': value,
          role: 'option',
          type: 'button',
          onClick: handleClick,
        },
        children
      );
    },

    SelectValue: ({ placeholder, children, ...props }) => {
      return React.createElement(
        'span',
        {
          ...props,
          'data-testid': 'select-value',
        },
        children || placeholder
      );
    },

    SelectGroup: ({ children, ...props }) => {
      return React.createElement(
        'div',
        {
          ...props,
          'data-testid': 'select-group',
        },
        children
      );
    },

    SelectLabel: ({ children, ...props }) => {
      return React.createElement(
        'div',
        {
          ...props,
          'data-testid': 'select-label',
        },
        children
      );
    },

    SelectSeparator: (props) => {
      return React.createElement('hr', {
        ...props,
        'data-testid': 'select-separator',
      });
    },
  };
});
