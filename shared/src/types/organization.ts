// Organization Types

export interface Organization {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    logoUrl?: string;
    billingEmail?: string;
    industry?: string;
    size?: OrganizationSize;
    settings: OrganizationSettings;
    createdAt: Date;
    updatedAt: Date;
}

export type OrganizationSize = '1-10' | '11-50' | '51-200' | '201-500' | '500+';

export interface OrganizationSettings {
    timezone: string;
    dateFormat: string;
    currency: string;
}

export interface CreateOrganizationRequest {
    name: string;
    billingEmail?: string;
    industry?: string;
    size?: OrganizationSize;
}

export interface UpdateOrganizationRequest {
    name?: string;
    billingEmail?: string;
    industry?: string;
    size?: OrganizationSize;
    settings?: Partial<OrganizationSettings>;
}

// Member Types
export interface Member {
    id: string;
    userId: string;
    organizationId: string;
    role: MemberRole;
    email: string;
    firstName: string;
    lastName: string;
    status: MemberStatus;
    invitedAt?: Date;
    joinedAt?: Date;
}

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'pending' | 'active' | 'inactive';

export interface InviteMemberRequest {
    email: string;
    role: MemberRole;
}

export interface UpdateMemberRequest {
    role?: MemberRole;
}
