import { render, screen } from '@testing-library/react';

import { AccountDialogDemo } from '../account-dialog-demo';

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AccountDialogDemo', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockAccounts = [
    { id: '1', code: '1110', name: '現金', accountType: 'ASSET' as const, parentId: null },
    { id: '2', code: '1120', name: '当座預金', accountType: 'ASSET' as const, parentId: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create dialog correctly', () => {
    render(
      <AccountDialogDemo
        open={true}
        onOpenChange={mockOnOpenChange}
        accounts={mockAccounts}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('勘定科目の新規作成')).toBeInTheDocument();
    expect(screen.getByText('勘定科目の情報を入力してください（デモ版）')).toBeInTheDocument();
  });

  it('renders edit dialog correctly', () => {
    const editAccount = mockAccounts[0];
    render(
      <AccountDialogDemo
        open={true}
        onOpenChange={mockOnOpenChange}
        account={editAccount}
        accounts={mockAccounts}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('勘定科目の編集')).toBeInTheDocument();
  });
});
