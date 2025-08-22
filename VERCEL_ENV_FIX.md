# Vercel Environment Variable Fix

## Issue

The `NEXT_PUBLIC_API_URL` environment variable in Vercel had a trailing newline character which was causing API connection failures.

## Solution

- Removed the incorrect environment variable with trailing `\n`
- Added the correct URL: `https://simple-bookkeeping-api.onrender.com/api/v1`

## Verification

After deployment, the journal entries page should work correctly without showing "仕訳の取得中にエラーが発生しました" error.

Date: 2025-08-22
