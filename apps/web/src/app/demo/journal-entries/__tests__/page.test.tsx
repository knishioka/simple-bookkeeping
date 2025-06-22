import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DemoJournalEntriesPage from '../page';

// Toasterモックをインポート前に定義
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
  Toaster: () => null,
}));

describe('DemoJournalEntriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the demo journal entries page', () => {
    render(<DemoJournalEntriesPage />);

    expect(screen.getByText('仕訳入力')).toBeInTheDocument();
    expect(
      screen.getByText('デモページ: これは仕訳入力画面のUIデモです。実際のデータは保存されません。')
    ).toBeInTheDocument();
    expect(screen.getByText('新規作成')).toBeInTheDocument();
  });

  it('displays mock journal entries data', () => {
    render(<DemoJournalEntriesPage />);

    // Mock entries should be visible
    expect(screen.getByText('現金での商品仕入')).toBeInTheDocument();
    expect(screen.getByText('売上の計上')).toBeInTheDocument();
    expect(screen.getByText('給料支払')).toBeInTheDocument();
  });

  it('filters entries by search term', async () => {
    render(<DemoJournalEntriesPage />);
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText('仕訳番号、摘要、証憑番号で検索...');
    await user.type(searchInput, '売上');

    expect(screen.getByText('売上の計上')).toBeInTheDocument();
    expect(screen.queryByText('現金での商品仕入')).not.toBeInTheDocument();
  });

  it('has status filter', () => {
    render(<DemoJournalEntriesPage />);

    expect(screen.getByText('すべて')).toBeInTheDocument();
  });

  it('has new and edit buttons', () => {
    render(<DemoJournalEntriesPage />);

    const createButton = screen.getByText('新規作成');
    expect(createButton).toBeInTheDocument();

    const editButtons = screen.getAllByText('編集');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('displays journal entry details correctly', () => {
    render(<DemoJournalEntriesPage />);

    // Check that debit and credit accounts are displayed
    expect(screen.getByText('仕入高')).toBeInTheDocument();
    expect(screen.getByText('現金')).toBeInTheDocument();
    expect(screen.getByText('売上高')).toBeInTheDocument();
    expect(screen.getByText('売掛金')).toBeInTheDocument();
  });
});
