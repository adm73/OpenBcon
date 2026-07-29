DELETE FROM app_state
WHERE key NOT IN (
  'bconomics-platform-config-v1',
  'bconomics-synced-funding-programs-v1',
  'bconomics-synced-resource-records-v1',
  'bconomics-user-settings-v1',
  'bconomics-pinned-social-resources-v1',
  'bconomics-saved-tools-v1',
  'bconomics-workspaces-v2',
  'bconomics-active-workspace-v2',
  'bconomics-company-portfolio-v1',
  'bconomics-applications-v1',
  'bconomics-saved-programs-v1',
  'bconomics-selected-funding-program-v1',
  'bconomics-selected-template-v1',
  'bconomics-quick-generate-draft-v1',
  'bconomics-generated-documents-v1'
);
