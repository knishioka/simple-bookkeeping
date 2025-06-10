import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'react-hot-toast';

import { apiClient } from '@/lib/api-client';

import { AccountDialog } from '../account-dialog';

// Mock dependencies
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(),
    put: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockToast = toast as jest.Mocked<typeof toast>;

describe('AccountDialog - ユーザーインタラクション', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockAccounts = [
    { id: '1', code: '1000', name: '流動資産', accountType: 'ASSET' as const, parentId: null },
    { id: '2', code: '4000', name: '売上', accountType: 'REVENUE' as const, parentId: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('新規勘定科目作成のユーザーシナリオ', () => {
    it('【シナリオ1】新規スタッフが必須項目を未入力で登録しようとした場合、適切なエラーメッセージが表示される', async () => {
      const user = userEvent.setup();
      
      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 作成ボタンをクリック（必須項目未入力）
      const submitButton = screen.getByRole('button', { name: '作成' });
      await user.click(submitButton);

      // バリデーションエラーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('コードは必須です')).toBeInTheDocument();
        expect(screen.getByText('科目名は必須です')).toBeInTheDocument();
      });

      // API呼び出しがされていないことを確認
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('【シナリオ2】正しい情報を入力して勘定科目を作成する', async () => {
      const user = userEvent.setup();
      
      // API成功レスポンスをモック
      mockApiClient.post.mockResolvedValue({
        data: { id: '3', code: '1110', name: '現金', accountType: 'ASSET' }
      });

      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // フォーム入力
      await user.type(screen.getByLabelText('コード'), '1110');
      await user.type(screen.getByLabelText('科目名'), '現金');
      
      // タイプ選択
      await user.click(screen.getByRole('combobox', { name: 'タイプ' }));
      await user.click(screen.getByRole('option', { name: '資産' }));

      // 作成ボタンクリック
      const submitButton = screen.getByRole('button', { name: '作成' });
      await user.click(submitButton);

      // API呼び出しの確認
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', 
          expect.objectContaining({
            code: '1110',
            name: '現金',
            accountType: 'ASSET',
          })
        );
      });

      // 成功処理の確認
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('勘定科目を作成しました');
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('【シナリオ3】親科目を選択して勘定科目を作成する', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: { id: '4', code: '1111', name: '現金預金', accountType: 'ASSET' }
      });

      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 基本情報入力
      await user.type(screen.getByLabelText('コード'), '1111');
      await user.type(screen.getByLabelText('科目名'), '現金預金');
      
      // タイプ選択（資産）
      await user.click(screen.getByRole('combobox', { name: 'タイプ' }));
      await user.click(screen.getByRole('option', { name: '資産' }));

      // 親科目選択
      await user.click(screen.getByRole('combobox', { name: '親科目（任意）' }));
      await user.click(screen.getByRole('option', { name: '1000 - 流動資産' }));

      // 作成
      await user.click(screen.getByRole('button', { name: '作成' }));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/accounts', {
          code: '1111',
          name: '現金預金',
          accountType: 'ASSET',
          parentId: '1',
        });
      });
    });
  });

  describe('既存勘定科目編集のユーザーシナリオ', () => {
    const existingAccount = { 
      id: '5', 
      code: '1110', 
      name: '現金', 
      accountType: 'ASSET' as const, 
      parentId: null 
    };

    it('【シナリオ4】既存勘定科目の名称を変更する', async () => {
      const user = userEvent.setup();
      
      mockApiClient.put.mockResolvedValue({
        data: { ...existingAccount, name: '現金・小切手' }
      });

      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          account={existingAccount}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 編集モードであることを確認
      expect(screen.getByText('勘定科目の編集')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1110')).toBeDisabled(); // コードは編集不可
      expect(screen.getByDisplayValue('現金')).toBeInTheDocument();

      // 名称を変更
      const nameInput = screen.getByLabelText('科目名');
      await user.clear(nameInput);
      await user.type(nameInput, '現金・小切手');

      // 更新
      await user.click(screen.getByRole('button', { name: '更新' }));

      await waitFor(() => {
        expect(mockApiClient.put).toHaveBeenCalledWith('/accounts/5', {
          code: '1110',
          name: '現金・小切手',
          accountType: 'ASSET',
          parentId: undefined,
        });
        expect(mockToast.success).toHaveBeenCalledWith('勘定科目を更新しました');
      });
    });
  });

  describe('エラーハンドリングのユーザーシナリオ', () => {
    it('【シナリオ5】API通信エラー時に適切なエラーメッセージが表示される', async () => {
      const user = userEvent.setup();
      
      // API エラーをモック
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 正常なデータを入力
      await user.type(screen.getByLabelText('コード'), '1110');
      await user.type(screen.getByLabelText('科目名'), '現金');
      await user.click(screen.getByRole('combobox', { name: 'タイプ' }));
      await user.click(screen.getByRole('option', { name: '資産' }));

      // 作成実行
      await user.click(screen.getByRole('button', { name: '作成' }));

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('勘定科目の作成に失敗しました');
      });

      // ダイアログは閉じられていないことを確認
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('【シナリオ6】入力値の文字数制限エラー', async () => {
      const user = userEvent.setup();
      
      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 制限を超える文字数を入力
      await user.type(screen.getByLabelText('コード'), '12345678901'); // 11文字（制限10文字）
      await user.type(screen.getByLabelText('科目名'), 'あ'.repeat(51)); // 51文字（制限50文字）

      await user.click(screen.getByRole('button', { name: '作成' }));

      // バリデーションエラーが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('コードは10文字以内で入力してください')).toBeInTheDocument();
        expect(screen.getByText('科目名は50文字以内で入力してください')).toBeInTheDocument();
      });

      expect(mockApiClient.post).not.toHaveBeenCalled();
    });
  });

  describe('ユーザビリティ', () => {
    it('【シナリオ7】キャンセルボタンでダイアログが閉じられる', async () => {
      const user = userEvent.setup();
      
      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // データを一部入力
      await user.type(screen.getByLabelText('コード'), '1110');

      // キャンセル
      await user.click(screen.getByRole('button', { name: 'キャンセル' }));

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('【シナリオ8】タイプ変更時に親科目選択肢が適切にフィルタリングされる', async () => {
      const user = userEvent.setup();
      
      render(
        <AccountDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          accounts={mockAccounts}
          onSuccess={mockOnSuccess}
        />
      );

      // 資産タイプを選択
      await user.click(screen.getByRole('combobox', { name: 'タイプ' }));
      await user.click(screen.getByRole('option', { name: '資産' }));

      // 親科目を確認（資産タイプの勘定科目のみ表示されるべき）
      await user.click(screen.getByRole('combobox', { name: '親科目（任意）' }));
      
      expect(screen.getByRole('option', { name: '1000 - 流動資産' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: '4000 - 売上' })).not.toBeInTheDocument();
    });
  });
});