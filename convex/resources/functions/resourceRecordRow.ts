import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc } from '../../_generated/dataModel'

export function resourceRecordFromRow(resource: Doc<'resources'>): ResourceRecord {
  return {
    id: assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid),
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, resource.campaignUuid),
    parentId:
      resource.parentResourceUuid === null
        ? null
        : assertDomainId(DOMAIN_ID_KIND.resource, resource.parentResourceUuid),
    kind: resource.kind,
    title: canonicalizeResourceTitle(resource.title),
    icon: resource.icon,
    color: resource.color,
    lifecycle:
      resource.lifecycle === 'active'
        ? { state: 'active' }
        : {
            state: 'trashed',
            at: resource.trashedAt,
            by: assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.trashedByMemberUuid),
          },
    metadataVersion: assertVersionStamp(resource.metadataVersion),
    created: {
      at: resource.createdAt,
      by: assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.createdByMemberUuid),
    },
    updated: {
      at: resource.updatedAt,
      by: assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.updatedByMemberUuid),
    },
  }
}

export function resourceRowFromRecord(
  resource: ResourceRecord,
): WithoutSystemFields<Doc<'resources'>> {
  const common = {
    resourceUuid: resource.id,
    campaignUuid: resource.campaignId,
    parentResourceUuid: resource.parentId,
    kind: resource.kind,
    title: resource.title,
    icon: resource.icon,
    color: resource.color,
    metadataVersion: resource.metadataVersion,
    createdAt: resource.created.at,
    createdByMemberUuid: resource.created.by,
    updatedAt: resource.updated.at,
    updatedByMemberUuid: resource.updated.by,
  }
  return resource.lifecycle.state === 'active'
    ? {
        ...common,
        lifecycle: 'active',
        trashedAt: null,
        trashedByMemberUuid: null,
      }
    : {
        ...common,
        lifecycle: 'trashed',
        trashedAt: resource.lifecycle.at,
        trashedByMemberUuid: resource.lifecycle.by,
      }
}
