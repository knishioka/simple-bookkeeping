import { render, screen } from '@testing-library/react';

import { JournalEntryDialogDemo } from '../journal-entry-dialog-demo';

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('JournalEntryDialogDemo', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create dialog correctly', () => {
    render(
      <JournalEntryDialogDemo
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('仕訳の新規作成')).toBeInTheDocument();
    expect(screen.getByText('仕訳の情報を入力してください（デモ版）')).toBeInTheDocument();
  });

  it('has required form fields', () => {
    render(
      <JournalEntryDialogDemo
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByLabelText('日付')).toBeInTheDocument();
    expect(screen.getByLabelText('摘要')).toBeInTheDocument();
    expect(screen.getByText('仕訳明細')).toBeInTheDocument();
    expect(screen.getByText('行を追加')).toBeInTheDocument();
  });
});
