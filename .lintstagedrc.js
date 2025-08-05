module.exports = {
  '*.{js,jsx,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  'package.json': () => 'pnpm install --frozen-lockfile',
  '**/*.{ts,tsx}': () => [
    // 変更されたファイルが含まれるパッケージの型チェックを実行
    'echo "📝 Type checking will be performed by pre-commit hook"',
  ],
  // Shell scripts and other files that need newline at EOF
  '*.{sh,bash,zsh,fish,env,env.example,env.local.example}': (filenames) => {
    const checkNewlines = filenames.map(
      (filename) =>
        `sh -c 'if [ -n "$(tail -c 1 "${filename}")" ]; then echo "" >> "${filename}"; fi'`
    );
    return checkNewlines;
  },
  // Files without extensions (Dockerfile, Makefile, etc.)
  '**/Dockerfile*': (filenames) => {
    const checkNewlines = filenames.map(
      (filename) =>
        `sh -c 'if [ -n "$(tail -c 1 "${filename}")" ]; then echo "" >> "${filename}"; fi'`
    );
    return checkNewlines;
  },
  '**/Makefile': (filenames) => {
    const checkNewlines = filenames.map(
      (filename) =>
        `sh -c 'if [ -n "$(tail -c 1 "${filename}")" ]; then echo "" >> "${filename}"; fi'`
    );
    return checkNewlines;
  },
};
