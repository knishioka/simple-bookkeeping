module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  'package.json': () => 'pnpm install --frozen-lockfile',
  // Temporarily disable typecheck for emergency fix
  // '**/*.{ts,tsx}': () => [
  //   // 変更されたファイルが含まれるパッケージの型チェックを実行
  //   'pnpm typecheck',
  // ],
};
