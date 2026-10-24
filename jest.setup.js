// Reanimated 4 / worklets load a native runtime on import, which doesn't
// exist under Jest — swap in the libraries' own mocks. Their mock omits
// useReducedMotion, so it's added here as `true`: components then render
// their final, non-animated state, which is also what tests should assert on.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...require("react-native-reanimated/mock"),
  useReducedMotion: () => true
}))
