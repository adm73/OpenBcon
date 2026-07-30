DELETE FROM app_state
WHERE key IN (
  'bconomics-platform-config-v1',
  'bconomics-user-settings-v1',
  'bconomics-billing-transactions-v1'
);
