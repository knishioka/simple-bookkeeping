// Setup test environment variables first
import '../../test-utils/env-setup';

import { UserRole } from '@simple-bookkeeping/database';
import request from 'supertest';

import app from '../../index';
import { prisma } from '../../lib/prisma';
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
  generateTestToken,
} from '../../test-utils/test-helpers';

describe('OrganizationsController', () => {
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let accountantUser: any;
  let accountantToken: string;
  let viewerUser: any;
  let viewerToken: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test organization
    testOrg = await createTestOrganization({
      name: 'Test Corporation',
      code: 'TEST-CORP',
    });

    // Create users with different roles
    adminUser = await createTestUser(testOrg.id, UserRole.ADMIN, {
      email: 'admin@test.com',
      name: 'Admin User',
    });
    adminToken = generateTestToken(adminUser.id, testOrg.id);

    accountantUser = await createTestUser(testOrg.id, UserRole.ACCOUNTANT, {
      email: 'accountant@test.com',
      name: 'Accountant User',
    });
    accountantToken = generateTestToken(accountantUser.id, testOrg.id);

    viewerUser = await createTestUser(testOrg.id, UserRole.VIEWER, {
      email: 'viewer@test.com',
      name: 'Viewer User',
    });
    viewerToken = generateTestToken(viewerUser.id, testOrg.id);
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  describe('GET /api/v1/organizations/current', () => {
    it('should return current organization for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(testOrg.id);
      expect(response.body.data.name).toBe('Test Corporation');
      expect(response.body.data.code).toBe('TEST-CORP');
    });

    it('should include user role in response', async () => {
      const response = await request(app)
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${accountantToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.currentUserRole).toBe(UserRole.ACCOUNTANT);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/v1/organizations/current');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/organizations/:id', () => {
    it('should update organization with ADMIN role', async () => {
      const updateData = {
        name: 'Updated Corporation',
        address: '123 Business St',
        phone: '03-1234-5678',
        email: 'contact@updated.com',
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Corporation');
      expect(response.body.data.address).toBe('123 Business St');
      expect(response.body.data.phone).toBe('03-1234-5678');
    });

    it('should prevent updating organization code', async () => {
      const updateData = {
        code: 'NEW-CODE', // Trying to change code
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CODE_CHANGE_NOT_ALLOWED');
    });

    it('should require ADMIN role for update', async () => {
      const updateData = {
        name: 'Try Update',
      };

      // Try with ACCOUNTANT
      const accountantResponse = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(updateData);

      expect(accountantResponse.status).toBe(403);

      // Try with VIEWER
      const viewerResponse = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(updateData);

      expect(viewerResponse.status).toBe(403);
    });

    it('should prevent updating other organization', async () => {
      const otherOrg = await createTestOrganization({
        name: 'Other Corporation',
        code: 'OTHER-CORP',
      });

      const updateData = {
        name: 'Unauthorized Update',
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${otherOrg.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/organizations/:id/members', () => {
    it('should return organization members', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3); // admin, accountant, viewer

      const roles = response.body.data.map((m: any) => m.role);
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.ACCOUNTANT);
      expect(roles).toContain(UserRole.VIEWER);
    });

    it('should include member details', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const adminMember = response.body.data.find((m: any) => m.role === UserRole.ADMIN);
      expect(adminMember.user.email).toBe('admin@test.com');
      expect(adminMember.user.name).toBe('Admin User');
    });

    it('should allow all authenticated users to view members', async () => {
      // Even viewer can see members
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('POST /api/v1/organizations/:id/members', () => {
    it('should add new member with ADMIN role', async () => {
      const newUser = await prisma.user.create({
        data: {
          email: 'newmember@test.com',
          passwordHash: 'hash',
          name: 'New Member',
        },
      });

      const memberData = {
        userId: newUser.id,
        role: UserRole.ACCOUNTANT,
      };

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(memberData);

      expect(response.status).toBe(201);
      expect(response.body.data.userId).toBe(newUser.id);
      expect(response.body.data.role).toBe(UserRole.ACCOUNTANT);
    });

    it('should prevent duplicate members', async () => {
      const memberData = {
        userId: accountantUser.id, // Already a member
        role: UserRole.VIEWER,
      };

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(memberData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_ALREADY_MEMBER');
    });

    it('should require ADMIN role to add members', async () => {
      const newUser = await prisma.user.create({
        data: {
          email: 'another@test.com',
          passwordHash: 'hash',
          name: 'Another User',
        },
      });

      const memberData = {
        userId: newUser.id,
        role: UserRole.VIEWER,
      };

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(memberData);

      expect(response.status).toBe(403);
    });

    it('should validate user exists', async () => {
      const memberData = {
        userId: 'non-existent-user-id',
        role: UserRole.VIEWER,
      };

      const response = await request(app)
        .post(`/api/v1/organizations/${testOrg.id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(memberData);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/organizations/:id/members/:userId', () => {
    it('should update member role', async () => {
      const updateData = {
        role: UserRole.ADMIN, // Promote accountant to admin
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/members/${accountantUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(UserRole.ADMIN);
    });

    it('should prevent self role change', async () => {
      const updateData = {
        role: UserRole.VIEWER, // Try to demote self
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/members/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANNOT_CHANGE_OWN_ROLE');
    });

    it('should require ADMIN role to update roles', async () => {
      const updateData = {
        role: UserRole.ADMIN,
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/members/${viewerUser.id}`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(updateData);

      expect(response.status).toBe(403);
    });

    it('should prevent removing last admin', async () => {
      // First, get count of admins
      const members = await prisma.userOrganization.findMany({
        where: {
          organizationId: testOrg.id,
          role: UserRole.ADMIN,
        },
      });

      if (members.length === 1) {
        const updateData = {
          role: UserRole.ACCOUNTANT, // Try to demote last admin
        };

        const response = await request(app)
          .put(`/api/v1/organizations/${testOrg.id}/members/${adminUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(updateData);

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('LAST_ADMIN');
      }
    });
  });

  describe('DELETE /api/v1/organizations/:id/members/:userId', () => {
    it('should remove member from organization', async () => {
      const response = await request(app)
        .delete(`/api/v1/organizations/${testOrg.id}/members/${viewerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('削除されました');

      // Verify removal
      const member = await prisma.userOrganization.findFirst({
        where: {
          userId: viewerUser.id,
          organizationId: testOrg.id,
        },
      });
      expect(member).toBeNull();
    });

    it('should prevent self removal', async () => {
      const response = await request(app)
        .delete(`/api/v1/organizations/${testOrg.id}/members/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANNOT_REMOVE_SELF');
    });

    it('should prevent removing last admin', async () => {
      // Remove other admins if any exist
      await prisma.userOrganization.deleteMany({
        where: {
          organizationId: testOrg.id,
          role: UserRole.ADMIN,
          userId: { not: adminUser.id },
        },
      });

      // Create another admin to try removing the original
      const anotherAdmin = await createTestUser(testOrg.id, UserRole.ADMIN, {
        email: 'another-admin@test.com',
      });

      // Remove the new admin first
      await request(app)
        .delete(`/api/v1/organizations/${testOrg.id}/members/${anotherAdmin.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Now try to remove the last admin
      const response = await request(app)
        .delete(`/api/v1/organizations/${testOrg.id}/members/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('LAST_ADMIN');
    });

    it('should require ADMIN role to remove members', async () => {
      const response = await request(app)
        .delete(`/api/v1/organizations/${testOrg.id}/members/${viewerUser.id}`)
        .set('Authorization', `Bearer ${accountantToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/organizations/:id/settings', () => {
    it('should return organization settings', async () => {
      // Update org with settings
      await prisma.organization.update({
        where: { id: testOrg.id },
        data: {
          address: '456 Business Street',
          phone: '03-5555-5555',
          email: 'contact@corp.com',
        },
      });

      const response = await request(app)
        .get(`/api/v1/organizations/${testOrg.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.address).toBe('456 Business Street');
      expect(response.body.data.phone).toBe('03-5555-5555');
      expect(response.body.data.email).toBe('contact@corp.com');
    });

    it('should allow all members to view settings', async () => {
      const response = await request(app)
        .get(`/api/v1/organizations/${testOrg.id}/settings`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('PUT /api/v1/organizations/:id/settings', () => {
    it('should update organization settings', async () => {
      const settingsData = {
        address: '123 New Address',
        phone: '03-9999-9999',
        email: 'new@example.com',
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(settingsData);

      expect(response.status).toBe(200);
      expect(response.body.data.address).toBe('123 New Address');
      expect(response.body.data.phone).toBe('03-9999-9999');
      expect(response.body.data.email).toBe('new@example.com');
    });

    it('should validate email format', async () => {
      const invalidSettings = {
        email: 'invalid-email', // Invalid email
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/settings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidSettings);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    it('should require ADMIN role to update settings', async () => {
      const settingsData = {
        address: 'New Address',
      };

      const response = await request(app)
        .put(`/api/v1/organizations/${testOrg.id}/settings`)
        .set('Authorization', `Bearer ${accountantToken}`)
        .send(settingsData);

      expect(response.status).toBe(403);
    });
  });
});
