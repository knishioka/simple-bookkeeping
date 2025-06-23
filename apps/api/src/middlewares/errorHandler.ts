/**
 * エラーハンドリングミドルウェア
 */

import { Prisma } from '@prisma/client';
import { BaseError } from '@simple-bookkeeping/core';
import { NextFunction, Request, Response } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // ログ出力
  if (err instanceof BaseError && err.isOperational) {
    console.error(`[ERROR] ${err.code}: ${err.message}`);
  } else {
    console.error('[FATAL ERROR]', err);
  }

  // BaseErrorの場合
  if (err instanceof BaseError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  // Prismaのエラー
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: '既に同じデータが存在します',
        },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'データが見つかりません',
        },
      });
      return;
    }
  }

  // その他のエラー
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'サーバーエラーが発生しました',
    },
  });
};
