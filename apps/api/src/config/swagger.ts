import swaggerJsdoc from 'swagger-jsdoc';

import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Simple Bookkeeping API',
      version,
      description: 'REST API for Simple Bookkeeping - Japanese double-entry bookkeeping system',
      contact: {
        name: 'API Support',
        email: 'support@simple-bookkeeping.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: process.env.API_URL || 'https://api.simple-bookkeeping.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                },
                message: {
                  type: 'string',
                  example: 'Validation failed',
                },
                details: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
              required: ['code', 'message'],
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1,
            },
            limit: {
              type: 'integer',
              example: 20,
            },
            total: {
              type: 'integer',
              example: 100,
            },
            totalPages: {
              type: 'integer',
              example: 5,
            },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            code: {
              type: 'string',
              example: '1001',
            },
            name: {
              type: 'string',
              example: '現金',
            },
            accountTypeId: {
              type: 'string',
              format: 'uuid',
            },
            balance: {
              type: 'number',
              example: 1000000,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'code', 'name', 'accountTypeId'],
        },
        JournalEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            entryNumber: {
              type: 'string',
              example: 'JE-2024-001',
            },
            entryDate: {
              type: 'string',
              format: 'date',
              example: '2024-01-15',
            },
            description: {
              type: 'string',
              example: '売上計上',
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'APPROVED', 'CANCELLED'],
              example: 'APPROVED',
            },
            totalAmount: {
              type: 'number',
              example: 100000,
            },
            lines: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/JournalEntryLine',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'entryNumber', 'entryDate', 'description', 'lines'],
        },
        JournalEntryLine: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            accountId: {
              type: 'string',
              format: 'uuid',
            },
            account: {
              $ref: '#/components/schemas/Account',
            },
            debitAmount: {
              type: 'number',
              example: 100000,
            },
            creditAmount: {
              type: 'number',
              example: 0,
            },
            lineNumber: {
              type: 'integer',
              example: 1,
            },
            description: {
              type: 'string',
              example: '商品売上',
            },
          },
          required: ['accountId', 'debitAmount', 'creditAmount', 'lineNumber'],
        },
      },
      parameters: {
        organizationId: {
          name: 'organizationId',
          in: 'query',
          description: 'Organization ID for multi-tenant context',
          required: false,
          schema: {
            type: 'string',
            format: 'uuid',
          },
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints',
      },
      {
        name: 'Organizations',
        description: 'Organization management',
      },
      {
        name: 'Accounts',
        description: 'Chart of accounts management',
      },
      {
        name: 'Journal Entries',
        description: 'Journal entry management',
      },
      {
        name: 'Reports',
        description: 'Financial reports',
      },
      {
        name: 'Ledgers',
        description: 'Subsidiary ledgers',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
