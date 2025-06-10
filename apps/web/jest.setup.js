import '@testing-library/jest-dom';

// Mock hasPointerCapture for Radix UI
Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  value: jest.fn(),
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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
  Dialog: ({ children, open }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

// Simplified Select mock for testing
global.mockSelectValue = null;

jest.mock('@/components/ui/select', () => {
  const React = require('react');
  
  return {
    Select: ({ children, onValueChange, defaultValue, value, ...props }) => {
      React.useEffect(() => {
        global.mockSelectOnValueChange = onValueChange;
      }, [onValueChange]);
      
      return React.createElement('div', {
        'data-testid': 'mock-select',
        'data-value': value || defaultValue || '',
        ...props
      }, children);
    },
    
    SelectTrigger: ({ children, ...props }) => {
      return React.createElement('button', {
        ...props,
        'data-testid': 'select-trigger',
        role: 'combobox',
        type: 'button'
      }, children);
    },
    
    SelectContent: ({ children, ...props }) => {
      return React.createElement('div', {
        ...props,
        'data-testid': 'select-content'
      }, children);
    },
    
    SelectItem: ({ children, value, ...props }) => {
      return React.createElement('button', {
        ...props,
        'data-testid': `select-item-${value}`,
        'data-value': value,
        role: 'option',
        type: 'button',
        onClick: () => {
          if (global.mockSelectOnValueChange) {
            global.mockSelectOnValueChange(value);
          }
        }
      }, children);
    },
    
    SelectValue: ({ placeholder, children, ...props }) => {
      return React.createElement('span', {
        ...props,
        'data-testid': 'select-value'
      }, children || placeholder);
    },
    
    SelectGroup: ({ children, ...props }) => {
      return React.createElement('div', {
        ...props,
        'data-testid': 'select-group'
      }, children);
    },
    
    SelectLabel: ({ children, ...props }) => {
      return React.createElement('div', {
        ...props,
        'data-testid': 'select-label'
      }, children);
    },
    
    SelectSeparator: (props) => {
      return React.createElement('hr', {
        ...props,
        'data-testid': 'select-separator'
      });
    }
  };
});