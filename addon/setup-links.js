import {sfConn, apiVersion} from "./inspector.js";

export async function getObjectSetupLinks(sfHost, sobjectName) {
  let {records: entityDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId from EntityDefinition where QualifiedApiName = '${sobjectName}'`)}`);
  let durableId = entityDefinitions[0].DurableId.split(".");
  let entityDurableId = durableId[0];
  return {
    lightningSetupLink: `https://${sfHost}/lightning/setup/ObjectManager/${entityDurableId}/FieldsAndRelationships/view`,
    classicSetupLink: sobjectName.includes("__")
      ? `https://${sfHost}/${entityDurableId}`
      : `https://${sfHost}/p/setup/layout/LayoutFieldList?type=${entityDurableId}&setupid=${entityDurableId}Fields`
  };
}

function getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinition) {
  let durableId = fieldDefinition.DurableId.split(".");
  let entityDurableId = durableId[0];
  let fieldDurableId = durableId[durableId.length - 1];
  return {
    lightningSetupLink: `https://${sfHost}/lightning/setup/ObjectManager/${entityDurableId}/FieldsAndRelationships/${fieldDurableId}/view`,
    classicSetupLink: fieldName.includes("__")
      ? `https://${sfHost}/${fieldDurableId}`
      : `https://${sfHost}/p/setup/field/StandardFieldAttributes/d?id=${fieldDurableId}&type=${entityDurableId}`
  };
}

export async function getFieldSetupLinks(sfHost, sobjectName, fieldName) {
  let {records: fieldDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId from FieldDefinition where EntityDefinition.QualifiedApiName = '${sobjectName}' and QualifiedApiName = '${fieldName}'`)}`);
  return getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinitions[0]);
}

export async function getAllFieldSetupLinks(sfHost, sobjectName) {
  let {records: fieldDefinitions} = await sfConn.rest(`/services/data/v${apiVersion}/tooling/query/?q=${encodeURIComponent(`select DurableId, QualifiedApiName from FieldDefinition where EntityDefinition.QualifiedApiName = '${sobjectName}'`)}`);
  let fields = new Map();
  for (let fieldDefinition of fieldDefinitions) {
    let fieldName = fieldDefinition.QualifiedApiName;
    fields.set(fieldName, getFieldDefinitionSetupLinks(sfHost, fieldName, fieldDefinition));
  }
  return fields;
}
