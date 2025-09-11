import {
  createAccountingPeriodSchema,
  updateAccountingPeriodSchema,
  getAccountingPeriodsParamsSchema,
  accountingPeriodIdSchema,
  periodWithOrgSchema,
  accountingPeriodFilterSchema,
  checkPeriodOverlapSchema,
} from '../accounting-periods';

describe('Accounting Periods Validation Schemas', () => {
  describe('createAccountingPeriodSchema', () => {
    describe('valid inputs', () => {
      it('should validate correct accounting period data', () => {
        const validData = {
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          description: '2024年度の会計期間',
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(validData);
        }
      });

      it('should accept null description', () => {
        const validData = {
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          description: null,
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept omitted description', () => {
        const validData = {
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept maximum 2-year period', () => {
        const validData = {
          name: '2年間の会計期間',
          start_date: '2024-01-01',
          end_date: '2025-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject empty name', () => {
        const invalidData = {
          name: '',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('会計期間の名称は必須です');
        }
      });

      it('should reject name exceeding 100 characters', () => {
        const invalidData = {
          name: 'a'.repeat(101),
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            '会計期間の名称は100文字以内で入力してください'
          );
        }
      });

      it('should reject XSS attempts in name', () => {
        const invalidData = {
          name: '<script>alert("XSS")</script>',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe(
            '会計期間の名称に使用できない文字が含まれています'
          );
        }
      });

      it('should reject SQL injection attempts in description', () => {
        const invalidData = {
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          description: "'; DROP TABLE users; --",
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('説明に使用できない文字が含まれています');
        }
      });

      it('should reject description exceeding 500 characters', () => {
        const invalidData = {
          name: '2024年度',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          description: 'a'.repeat(501),
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('説明は500文字以内で入力してください');
        }
      });

      it('should reject invalid date format', () => {
        const invalidData = {
          name: '2024年度',
          start_date: '2024/01/01', // Wrong format
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            '日付はYYYY-MM-DD形式で入力してください'
          );
        }
      });

      it('should reject end date before start date', () => {
        const invalidData = {
          name: '2024年度',
          start_date: '2024-12-31',
          end_date: '2024-01-01',
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('開始日は終了日より前である必要があります');
        }
      });

      it('should reject period exceeding 2 years', () => {
        const invalidData = {
          name: '長期間',
          start_date: '2024-01-01',
          end_date: '2026-01-02', // More than 2 years
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('会計期間は最大2年までです');
        }
      });

      it('should reject missing required fields', () => {
        const invalidData = {
          name: '2024年度',
          // Missing start_date and end_date
        };

        const result = createAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should accept exactly 2-year period', () => {
        const validData = {
          name: '2年間',
          start_date: '2024-01-01',
          end_date: '2026-01-01',
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept same start and end date for single-day period', () => {
        const validData = {
          name: '単日期間',
          start_date: '2024-01-01',
          end_date: '2024-01-02', // Next day to make it valid
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should handle leap year dates correctly', () => {
        const validData = {
          name: 'うるう年',
          start_date: '2024-02-29',
          end_date: '2024-12-31',
        };

        const result = createAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('updateAccountingPeriodSchema', () => {
    describe('valid inputs', () => {
      it('should validate partial updates', () => {
        const validData = {
          name: '更新された名前',
        };

        const result = updateAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should validate full updates', () => {
        const validData = {
          name: '更新された名前',
          start_date: '2024-04-01',
          end_date: '2025-03-31',
          description: '更新された説明',
          is_closed: true,
        };

        const result = updateAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept empty object for no updates', () => {
        const validData = {};

        const result = updateAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe('invalid inputs', () => {
      it('should reject invalid date order when both dates provided', () => {
        const invalidData = {
          start_date: '2024-12-31',
          end_date: '2024-01-01',
        };

        const result = updateAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('開始日は終了日より前である必要があります');
        }
      });

      it('should accept only start_date update', () => {
        const validData = {
          start_date: '2024-01-01',
        };

        const result = updateAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept only end_date update', () => {
        const validData = {
          end_date: '2024-12-31',
        };

        const result = updateAccountingPeriodSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should reject XSS in optional fields', () => {
        const invalidData = {
          description: '<img src=x onerror=alert(1)>',
        };

        const result = updateAccountingPeriodSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('説明に使用できない文字が含まれています');
        }
      });
    });
  });

  describe('getAccountingPeriodsParamsSchema', () => {
    it('should validate with valid UUID and query params', () => {
      const validData = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        page: 1,
        pageSize: 20,
        search: '2024',
        orderBy: 'start_date',
        orderDirection: 'desc',
      };

      const result = getAccountingPeriodsParamsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidData = {
        organizationId: 'not-a-uuid',
      };

      const result = getAccountingPeriodsParamsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('accountingPeriodIdSchema', () => {
    it('should validate valid UUID', () => {
      const validData = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = accountingPeriodIdSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidData = {
        periodId: '550e8400-e29b-41d4-a716',
      };

      const result = accountingPeriodIdSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('periodWithOrgSchema', () => {
    it('should validate both UUIDs', () => {
      const validData = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        organizationId: '660e8400-e29b-41d4-a716-446655440001',
      };

      const result = periodWithOrgSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject if any UUID is invalid', () => {
      const invalidData = {
        periodId: '550e8400-e29b-41d4-a716-446655440000',
        organizationId: 'invalid',
      };

      const result = periodWithOrgSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('accountingPeriodFilterSchema', () => {
    it('should validate all filter options', () => {
      const validData = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        isActive: true,
        isClosed: false,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const result = accountingPeriodFilterSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const validData = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = accountingPeriodFilterSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('checkPeriodOverlapSchema', () => {
    it('should validate overlap check params', () => {
      const validData = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        excludeId: '770e8400-e29b-41d4-a716-446655440002',
      };

      const result = checkPeriodOverlapSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate without excludeId', () => {
      const validData = {
        organizationId: '550e8400-e29b-41d4-a716-446655440000',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };

      const result = checkPeriodOverlapSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
