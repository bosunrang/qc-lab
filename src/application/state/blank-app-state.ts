export interface BlankAppStateOptions {
  users?: unknown;
  teaRegistryVersion: number;
  schemaVersion: number;
  westgardDefaults: Record<string, unknown>;
}

export function createBlankAppState(options: BlankAppStateOptions): Record<string, any> {
  return {
    lab: { name: '', dept: '', address: '', brandTitle: 'QC Lab', brandSub: 'Nội kiểm xét nghiệm', logoText: 'QC', logoData: '' },
    tests: [], machines: [], instruments: [], assayGroups: [], qcPanels: [], lotTransitions: [], lotGroups: [], qcLots: [], data: {},
    actions: [], activity: [], activityAnchor: '', users: Array.isArray(options.users) ? options.users : [], reagentTests: [], reagentOperators: [],
    reagentSampleTypes: ['Mẫu bệnh nhân', 'Mẫu nội kiểm (IQC)', 'Mẫu ngoại kiểm (EQA)'], sigmaData: {}, periodLocks: [], teaRefs: [],
    teaRegistryVersion: options.teaRegistryVersion, westgardRules: { ...options.westgardDefaults }, westgardProfileVersion: 2,
    configMigrationVersion: 1, schemaVersion: options.schemaVersion,
  };
}
