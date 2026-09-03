module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    // secrets.ts is gitignored and only exists once a developer has copied it
    // from secrets.example.ts (see docs/SETUP.md). Tests must not depend on
    // that local file existing, so always resolve to the placeholder values.
    '(.*)config/secrets$': '<rootDir>/src/config/secrets.example.ts',
  },
};
