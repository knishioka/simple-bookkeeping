module.exports = {
  extends: ['../../.eslintrc.js'],
  settings: {
    'import/resolver': {
      node: {
        paths: ['src'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
      typescript: {
        project: ['./tsconfig.json'],
      },
    },
  },
};