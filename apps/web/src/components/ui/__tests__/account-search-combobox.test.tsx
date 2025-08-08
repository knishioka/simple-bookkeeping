import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AccountSearchCombobox } from '../account-search-combobox';

// Mock scrollIntoView which is not available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('AccountSearchCombobox', () => {
  const mockAccounts = [
    {
      id: '1',
      code: '1110',
      name: '現金',
      nameKana: 'ゲンキン',
      accountType: 'ASSET' as const,
    },
    {
      id: '2',
      code: '1120',
      name: '小口現金',
      nameKana: 'コグチゲンキン',
      accountType: 'ASSET' as const,
    },
    {
      id: '3',
      code: '1210',
      name: '普通預金',
      nameKana: 'フツウヨキン',
      accountType: 'ASSET' as const,
    },
    {
      id: '4',
      code: '4110',
      name: '売上高',
      nameKana: 'ウリアゲダカ',
      accountType: 'REVENUE' as const,
    },
    {
      id: '5',
      code: '5680',
      name: 'コンサルティング費',
      nameKana: 'コンサルティングヒ',
      accountType: 'EXPENSE' as const,
    },
  ];

  const mockOnValueChange = jest.fn();

  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  it('renders with placeholder', () => {
    render(
      <AccountSearchCombobox
        accounts={mockAccounts}
        onValueChange={mockOnValueChange}
        placeholder="Select account"
      />
    );
    expect(screen.getByText('Select account')).toBeInTheDocument();
  });

  it('searches by account code', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: '1110' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('searches by account name in kanji', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: '現金' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('小口現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('searches by katakana', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'ゲンキン' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('小口現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('searches by hiragana', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'げんきん' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('小口現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('searches by romaji - genkin should find 現金', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'genkin' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('小口現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('searches by romaji - uriage should find 売上高', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'uriage' } });

    await waitFor(() => {
      expect(screen.getByText('売上高')).toBeInTheDocument();
      expect(screen.queryByText('現金')).not.toBeInTheDocument();
    });
  });

  it('searches by romaji - con should find コンサルティング費', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'con' } });

    await waitFor(() => {
      expect(screen.getByText('コンサルティング費')).toBeInTheDocument();
      expect(screen.queryByText('現金')).not.toBeInTheDocument();
    });
  });

  it('searches by partial romaji - gen should find 現金', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'gen' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
      expect(screen.getByText('小口現金')).toBeInTheDocument();
      expect(screen.queryByText('売上高')).not.toBeInTheDocument();
    });
  });

  it('selects an account', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'genkin' } });

    await waitFor(() => {
      expect(screen.getByText('現金')).toBeInTheDocument();
    });

    const cashOption = screen.getByText('現金').closest('[role="option"]');
    if (cashOption) {
      fireEvent.click(cashOption);
    }

    await waitFor(() => {
      expect(mockOnValueChange).toHaveBeenCalledWith('1');
    });
  });

  it('shows "no results" message when no accounts match', async () => {
    render(<AccountSearchCombobox accounts={mockAccounts} onValueChange={mockOnValueChange} />);

    const button = screen.getByRole('combobox');
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...')
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('コード、名前、カナ、ローマ字で検索...');
    fireEvent.change(searchInput, { target: { value: 'xyz123' } });

    await waitFor(() => {
      expect(screen.getByText('勘定科目が見つかりません')).toBeInTheDocument();
    });
  });

  it('displays selected account', () => {
    render(
      <AccountSearchCombobox accounts={mockAccounts} value="1" onValueChange={mockOnValueChange} />
    );

    expect(screen.getByText('1110 - 現金')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(
      <AccountSearchCombobox
        accounts={mockAccounts}
        onValueChange={mockOnValueChange}
        disabled={true}
      />
    );

    const button = screen.getByRole('combobox');
    expect(button).toBeDisabled();
  });
});
