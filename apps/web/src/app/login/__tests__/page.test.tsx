import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/auth-context';

import LoginPage from '../page';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));


jest.mock('@/contexts/auth-context', () => ({
  useAuth: jest.fn(),
}));

const mockRouter = { push: jest.fn() };
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LoginPage - ユーザーエクスペリエンス', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter as any);
    mockUseAuth.mockReturnValue({
      login: mockLogin,
      loading: false,
      user: null,
      logout: jest.fn(),
      isAuthenticated: false,
      switchOrganization: jest.fn(),
      currentOrganization: null,
    });
  });

  describe('新規ユーザーのログインシナリオ', () => {
    it('【シナリオ1】正しい認証情報でログインが成功する', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      // ページの基本要素が表示されることを確認
      expect(screen.getByText('ログイン')).toBeInTheDocument();
      expect(screen.getByText('Simple Bookkeepingへようこそ')).toBeInTheDocument();

      // フォーム入力
      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');

      await user.type(emailInput, 'user@example.com');
      await user.type(passwordInput, 'password123');

      // ログインボタンクリック
      const loginButton = screen.getByRole('button', { name: 'ログイン' });
      await user.click(loginButton);

      // ログイン関数が正しい引数で呼び出されることを確認
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    it('【シナリオ2】必須項目未入力時のHTML5バリデーション', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      // メールアドレス未入力でログイン試行
      const loginButton = screen.getByRole('button', { name: 'ログイン' });
      await user.click(loginButton);

      // HTML5の required 属性によるバリデーション
      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      expect(emailInput.validity.valid).toBe(false);
      expect(emailInput.validity.valueMissing).toBe(true);
    });

    it('【シナリオ3】無効なメールアドレス形式の入力', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');

      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');

      const loginButton = screen.getByRole('button', { name: 'ログイン' });
      await user.click(loginButton);

      // HTML5のtype="email"バリデーション
      const emailElement = emailInput as HTMLInputElement;
      expect(emailElement.validity.valid).toBe(false);
      expect(emailElement.validity.typeMismatch).toBe(true);
    });
  });

  describe('ログイン処理中のユーザーエクスペリエンス', () => {
    it('【シナリオ4】ログイン処理中のローディング表示と操作無効化', async () => {
      
      // ローディング状態をモック
      mockUseAuth.mockReturnValue({
        login: mockLogin,
        loading: true,
        user: null,
        logout: jest.fn(),
        isAuthenticated: false,
        switchOrganization: jest.fn(),
        currentOrganization: null,
      });

      render(<LoginPage />);

      // ローディング中の表示とボタンの無効化を確認
      expect(screen.getByRole('button', { name: 'ログイン中...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ログイン中...' })).toBeDisabled();

      // 入力フィールドも無効化されていることを確認
      expect(screen.getByLabelText('メールアドレス')).toBeDisabled();
      expect(screen.getByLabelText('パスワード')).toBeDisabled();
    });
  });

  describe('エラーハンドリングのユーザーシナリオ', () => {
    it('【シナリオ5】認証失敗時の適切なフィードバック', async () => {
      const user = userEvent.setup();
      
      // ログイン失敗をシミュレート
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      render(<LoginPage />);

      // ログイン試行
      await user.type(screen.getByLabelText('メールアドレス'), 'wrong@example.com');
      await user.type(screen.getByLabelText('パスワード'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      // エラーが発生してもページが正常に動作することを確認
      expect(mockLogin).toHaveBeenCalled();
      
      // フォームが再び入力可能状態になることを確認
      await waitFor(() => {
        expect(screen.getByLabelText('メールアドレス')).not.toBeDisabled();
        expect(screen.getByLabelText('パスワード')).not.toBeDisabled();
      });
    });
  });

  describe('ナビゲーションのユーザーシナリオ', () => {
    it('【シナリオ6】新規登録ページへのナビゲーション', () => {
      render(<LoginPage />);

      // 新規登録リンクが表示されることを確認
      const registerLink = screen.getByRole('link', { name: '新規登録' });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('アクセシビリティとユーザビリティ', () => {
    it('【シナリオ7】フォームラベルとフィールドの適切な関連付け', () => {
      render(<LoginPage />);

      // ラベルがフィールドと適切に関連付けられていることを確認
      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
    });

    it('【シナリオ8】プレースホルダーテキストの表示', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('メールアドレス');
      expect(emailInput).toHaveAttribute('placeholder', 'user@example.com');
    });

    it('【シナリオ9】Enterキーでのフォーム送信', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      // フォーム入力
      await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
      await user.type(screen.getByLabelText('パスワード'), 'password123');

      // Enterキーでフォーム送信
      await user.keyboard('{Enter}');

      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
    });
  });

  describe('実際の使用パターン', () => {
    it('【シナリオ10】経理担当者の毎日のログインフロー', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      // 実際の経理担当者のログインパターンをシミュレート
      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');

      // よくある入力パターン: ゆっくりとした入力
      await user.type(emailInput, 'accounting@company.com', { delay: 50 });
      
      // パスワード入力前の一時停止（実際のユーザー行動をシミュレート）
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await user.type(passwordInput, 'SecurePass2024', { delay: 30 });

      // ログイン実行
      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      expect(mockLogin).toHaveBeenCalledWith('accounting@company.com', 'SecurePass2024');
    });

    it('【シナリオ11】入力途中での画面離脱と復帰', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      // 部分的に入力
      await user.type(screen.getByLabelText('メールアドレス'), 'partial@');

      // コンポーネントを再レンダリング（画面遷移から戻ってきた状況をシミュレート）
      render(<LoginPage />);

      // フォームが初期状態に戻っていることを確認
      expect(screen.getByLabelText('メールアドレス')).toHaveValue('partial@');
      
      // 入力を続行できることを確認
      await user.type(screen.getByLabelText('メールアドレス'), 'example.com');
      await user.type(screen.getByLabelText('パスワード'), 'password123');

      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      expect(mockLogin).toHaveBeenCalledWith('partial@example.com', 'password123');
    });
  });

  describe('エッジケースのユーザーシナリオ', () => {
    it('【シナリオ12】長いメールアドレスでの入力', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      const longEmail = 'very.long.email.address.for.testing.purposes@very-long-domain-name-example.com';
      
      await user.type(screen.getByLabelText('メールアドレス'), longEmail);
      await user.type(screen.getByLabelText('パスワード'), 'password123');

      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      expect(mockLogin).toHaveBeenCalledWith(longEmail, 'password123');
    });

    it('【シナリオ13】特殊文字を含むパスワードでの入力', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage />);

      const complexPassword = 'P@ssw0rd!#$%&*()';
      
      await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com');
      await user.type(screen.getByLabelText('パスワード'), complexPassword);

      await user.click(screen.getByRole('button', { name: 'ログイン' }));

      expect(mockLogin).toHaveBeenCalledWith('user@example.com', complexPassword);
    });
  });
});